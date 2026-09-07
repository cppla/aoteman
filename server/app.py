"""Small, authenticated WSGI API. All player reads require a recovery code."""

import hashlib
import json
import logging
import re
import sqlite3
import uuid
from http import HTTPStatus

from .openapi import specification
from .state import ValidationError, sanitize_state
from .storage import Store, SCHEMA_VERSION, encode_state, snapshot, timestamp

MAX_BODY = 100 * 1024
TOKEN_PATTERN = re.compile(r"gxy_[0-9a-f]{64}\Z")
MUTATION_PATTERN = re.compile(r"[A-Za-z0-9][A-Za-z0-9._:-]{7,127}\Z")
LOGGER = logging.getLogger(__name__)


class APIError(Exception):
    def __init__(self, status, code, message, extra=None):
        self.status = status
        self.payload = {"error": {"code": code, "message": message}}
        self.payload.update(extra or {})


def token_hash(code):
    if not isinstance(code, str) or not TOKEN_PATTERN.fullmatch(code):
        raise APIError(401, "unauthorized", "恢复码无效或已失效。")
    return hashlib.sha256(code.encode("ascii")).hexdigest()


def positive_integer(value, name):
    if type(value) is not int or value < 1 or value > 9007199254740991:
        raise APIError(400, "invalid_request", "%s 必须是正整数。" % name)
    return value


def mutation_id(body):
    value = body.get("mutationId")
    if not isinstance(value, str) or not MUTATION_PATTERN.fullmatch(value):
        raise APIError(400, "invalid_request", "mutationId 必须是 8–128 个字母、数字、点、下划线、冒号或连字符。")
    return value


def reject_constant(value):
    raise ValueError("Non-finite JSON number")


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON key")
        result[key] = value
    return result


class Application:
    def __init__(self, data_dir=None, start_backups=True):
        self.store = Store(data_dir=data_dir, start_backups=start_backups)

    def close(self):
        self.store.close()

    def body(self, environ):
        if environ.get("CONTENT_TYPE", "").split(";", 1)[0].strip().lower() != "application/json":
            raise APIError(415, "unsupported_media_type", "请使用 application/json。")
        try:
            size = int(environ.get("CONTENT_LENGTH") or "0")
        except ValueError:
            raise APIError(400, "invalid_request", "Content-Length 无效。")
        if size < 0:
            raise APIError(400, "invalid_request", "Content-Length 无效。")
        if size > MAX_BODY:
            raise APIError(413, "body_too_large", "存档请求不能超过 100 KB。")
        if size == 0:
            raise APIError(400, "invalid_json", "请求正文不能为空。")
        raw = environ["wsgi.input"].read(size)
        if len(raw) != size:
            raise APIError(400, "invalid_json", "请求正文不完整。")
        try:
            result = json.loads(raw.decode("utf-8"), parse_constant=reject_constant, object_pairs_hook=unique_object)
        except (ValueError, UnicodeError, RecursionError):
            raise APIError(400, "invalid_json", "请求正文不是有效 JSON。")
        if not isinstance(result, dict):
            raise APIError(400, "invalid_request", "请求正文必须是 JSON 对象。")
        return result

    def auth(self, environ):
        header = environ.get("HTTP_AUTHORIZATION", "")
        if not header.startswith("Bearer "):
            raise APIError(401, "unauthorized", "请提供恢复码。")
        return token_hash(header[7:])

    def profile(self, db, hashed):
        row = db.execute("SELECT * FROM profiles WHERE token_hash=?", (hashed,)).fetchone()
        if row is None:
            raise APIError(401, "unauthorized", "恢复码无效或已失效。")
        return row

    def save_version(self, db, profile_id, revision, encoded, now, reason):
        db.execute("INSERT INTO save_versions(profile_id,revision,state_json,created_at,reason) VALUES(?,?,?,?,?)", (profile_id, revision, encoded, now, reason))
        db.execute("DELETE FROM save_versions WHERE profile_id=? AND revision<=?", (profile_id, revision - 100))

    def create(self, environ):
        body = self.body(environ)
        hashed = token_hash(body.get("recoveryCode"))
        with self.store.connection(write=True) as db:
            row = db.execute("SELECT * FROM profiles WHERE token_hash=?", (hashed,)).fetchone()
            if row is not None:
                # A retry can arrive after this profile has already advanced.
                return 200, snapshot(row), []
            state = sanitize_state(body.get("state"))
            profile_id, now, encoded = str(uuid.uuid4()), timestamp(), encode_state(state)
            db.execute("INSERT INTO profiles(id,token_hash,revision,state_json,created_at,updated_at) VALUES(?,?,1,?,?,?)", (profile_id, hashed, encoded, now, now))
            self.save_version(db, profile_id, 1, encoded, now, "initial")
            return 201, snapshot(self.profile(db, hashed)), []

    def write(self, environ, restore=False):
        hashed = self.auth(environ)
        body = self.body(environ)
        base = positive_integer(body.get("baseRevision"), "baseRevision")
        mutation = mutation_id(body)
        with self.store.connection(write=True) as db:
            row = self.profile(db, hashed)
            previous = db.execute("SELECT revision FROM mutations WHERE profile_id=? AND mutation_id=?", (row["id"], mutation)).fetchone()
            if previous:
                # Return CURRENT HEAD, never the stale response of the first
                # application. The ID represents one write for this player.
                return 200, {**snapshot(row), "mutationRevision": previous["revision"]}, []
            if row["revision"] != base:
                raise APIError(409, "revision_conflict", "其他页面或设备已更新存档，请先读取最新进度。", {"current": snapshot(row)})
            if restore:
                revision = positive_integer(body.get("revision"), "revision")
                source = db.execute("SELECT state_json FROM save_versions WHERE profile_id=? AND revision=?", (row["id"], revision)).fetchone()
                if source is None:
                    raise APIError(404, "version_not_found", "此历史版本不存在或已超过保留范围。")
                state = sanitize_state(json.loads(source["state_json"]))
                reason = "restore:%d" % revision
            else:
                state = sanitize_state(body.get("state"))
                reason = body.get("reason", "save")
                if not isinstance(reason, str) or not 1 <= len(reason) <= 120:
                    raise APIError(400, "invalid_request", "reason 必须是 1–120 字符的说明。")
            now, revision, encoded = timestamp(), row["revision"] + 1, encode_state(state)
            db.execute("UPDATE profiles SET revision=?,state_json=?,updated_at=? WHERE id=? AND revision=?", (revision, encoded, now, row["id"], base))
            self.save_version(db, row["id"], revision, encoded, now, reason)
            db.execute("INSERT INTO mutations(profile_id,mutation_id,revision,created_at) VALUES(?,?,?,?)", (row["id"], mutation, revision, now))
            return 200, {**snapshot(self.profile(db, hashed)), "mutationRevision": revision}, []

    def dispatch(self, environ):
        path, method = environ.get("PATH_INFO", "/"), environ.get("REQUEST_METHOD", "GET").upper()
        routes = {
            "/api/healthz": ("GET",), "/api/openapi.json": ("GET",),
            "/api/v1/profiles": ("POST",), "/api/v1/save": ("GET", "PUT"),
            "/api/v1/history": ("GET",), "/api/v1/restore": ("POST",),
            "/api/v1/export": ("GET",),
        }
        if path not in routes:
            raise APIError(404, "not_found", "API 路径不存在。")
        if method not in routes[path]:
            return 405, {"error": {"code": "method_not_allowed", "message": "此 API 不支持该方法。"}}, [("Allow", ", ".join(routes[path]))]
        if path == "/api/openapi.json":
            return 200, specification(), []
        if path == "/api/healthz":
            with self.store.connection() as db:
                db.execute("SELECT revision FROM profiles LIMIT 1").fetchone()
            return 200, {"status": "ok", "storage": "sqlite", "schemaVersion": SCHEMA_VERSION}, []
        if path == "/api/v1/profiles":
            return self.create(environ)
        if path == "/api/v1/restore" or method == "PUT":
            return self.write(environ, restore=(path == "/api/v1/restore"))
        hashed = self.auth(environ)
        with self.store.connection() as db:
            row = self.profile(db, hashed)
            if path == "/api/v1/history":
                versions = []
                for version in db.execute("SELECT revision,created_at,reason,state_json FROM save_versions WHERE profile_id=? ORDER BY revision DESC LIMIT 50", (row["id"],)):
                    state = json.loads(version["state_json"])
                    versions.append({"revision": version["revision"], "createdAt": version["created_at"], "reason": version["reason"], **{key: state.get(key, 0) for key in ("xp", "wins", "stars")}})
                return 200, {"versions": versions}, []
            headers = [("Content-Disposition", 'attachment; filename="aoteman-save.json"')] if path == "/api/v1/export" else []
            return 200, snapshot(row), headers

    def __call__(self, environ, start_response):
        try:
            status, payload, headers = self.dispatch(environ)
        except APIError as error:
            status, payload, headers = error.status, error.payload, []
        except ValidationError as error:
            status, payload, headers = 400, {"error": {"code": "invalid_state", "message": str(error)}}, []
        except sqlite3.Error as error:
            LOGGER.error("SQLite request failed (%s)", type(error).__name__)
            status, payload, headers = 503, {"error": {"code": "storage_unavailable", "message": "存档服务暂时不可用，请保留本地进度并重试。"}}, [("Retry-After", "5")]
        except Exception as error:
            LOGGER.error("Save API request failed (%s)", type(error).__name__)
            status, payload, headers = 500, {"error": {"code": "internal_error", "message": "存档请求失败，请稍后重试。"}}, []
        encoded = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode("utf-8")
        headers += [("Content-Type", "application/json; charset=utf-8"), ("Content-Length", str(len(encoded))), ("Cache-Control", "no-store"), ("X-Content-Type-Options", "nosniff")]
        if status == 401:
            headers.append(("WWW-Authenticate", "Bearer"))
        start_response("%d %s" % (status, HTTPStatus(status).phrase), headers)
        return [encoded]


def create_app(data_dir=None, start_backups=True):
    return Application(data_dir=data_dir, start_backups=start_backups)


# Eager initialization rejects newer/corrupt databases at worker startup.
application = create_app()
