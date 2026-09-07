"""Run with: python3 -m unittest discover -s tests -p 'test_api.py' -v."""

import copy
import hashlib
import io
import json
import os
import sqlite3
import subprocess
import sys
import tempfile
import time
import unittest
import uuid
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from pathlib import Path
from unittest.mock import patch

# Importing the production WSGI application intentionally validates its volume.
# Keep that eager startup isolated from /data and from the user's real saves.
_bootstrap = tempfile.TemporaryDirectory()
with patch.dict(os.environ, {"AOTEMAN_DATA_DIR": _bootstrap.name, "BACKUP_INTERVAL_SECONDS": "0"}):
    from server.app import Application, application
    from server.restore import restore_backup
    from server.storage import ROOT, SCHEMA_VERSION, Store, connect, make_backup
application.close()
_bootstrap.cleanup()
NAME_FIXTURES = json.loads((Path(__file__).parent / "fixtures" / "growth-names.json").read_text(encoding="utf-8"))


def state(xp=0, version=2):
    now = int(time.time() * 1000)
    return {"version": version, "food": 72, "energy": 80, "mood": 85,
            "xp": xp, "stars": 0, "wins": 0, "training": 0, "fed": 0,
            "blocks": 0, "pats": 0, "born": now, "updated": now,
            "sleeping": False, "grown": False, "sound": False,
            "scene": "base", "unlocked": ["base"], "difficulty": "normal", "defeated": [],
            "daily": {"date": "2026-9-7", "fed": 1, "training": 0, "battles": 0, "claimed": False}, "journal": []}


def recovery_code():
    return "gxy_" + os.urandom(32).hex()


def invoke(app, method, path, body=None, token=None, raw=None, content_type="application/json", length=None):
    encoded = raw if raw is not None else (json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else b"")
    env = {"REQUEST_METHOD": method, "PATH_INFO": path, "CONTENT_TYPE": content_type,
           "CONTENT_LENGTH": str(len(encoded)) if length is None else length,
           "wsgi.input": io.BytesIO(encoded)}
    if token is not None:
        env["HTTP_AUTHORIZATION"] = "Bearer " + token
    response = {}

    def start_response(status, headers):
        response["status"] = int(status.split(" ")[0])
        response["headers"] = dict(headers)

    output = b"".join(app(env, start_response))
    response["body"] = json.loads(output)
    return response


class APITests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.data_dir = Path(self.temp.name)
        self.app = Application(self.data_dir, start_backups=False)
        self.token = recovery_code()

    def tearDown(self):
        self.app.close()
        self.temp.cleanup()

    def create(self, token=None, initial=None):
        return invoke(self.app, "POST", "/api/v1/profiles", {"recoveryCode": token or self.token, "state": initial or state()})

    def save(self, xp, base=1, mutation=None, token=None, reason="save"):
        return invoke(self.app, "PUT", "/api/v1/save", {"baseRevision": base, "mutationId": mutation or str(uuid.uuid4()), "state": state(xp), "reason": reason}, token or self.token)

    def read(self, token=None):
        return invoke(self.app, "GET", "/api/v1/save", token=token or self.token)

    def test_health_and_discoverable_auth_contract(self):
        health = invoke(self.app, "GET", "/api/healthz")
        self.assertEqual(health["status"], 200)
        self.assertEqual(health["body"]["schemaVersion"], SCHEMA_VERSION)
        spec = invoke(self.app, "GET", "/api/openapi.json")["body"]
        self.assertEqual(spec["openapi"], "3.0.3")
        self.assertEqual(spec["paths"]["/api/v1/save"]["get"]["security"], [{"RecoveryCode": []}])
        self.assertIn("Conflict", spec["components"]["schemas"])
        self.assertIn("WriteSnapshot", spec["components"]["schemas"])

    def test_new_volume_uses_empty_template(self):
        with closing(connect(self.app.store.path)) as db:
            self.assertEqual(db.execute("SELECT count(*) FROM profiles").fetchone()[0], 0)
            self.assertEqual(db.execute("PRAGMA user_version").fetchone()[0], SCHEMA_VERSION)
            self.assertEqual(db.execute("PRAGMA journal_mode").fetchone()[0], "wal")
            self.assertEqual(db.execute("PRAGMA synchronous").fetchone()[0], 2)

    def test_create_and_hashed_recovery_secret(self):
        response = self.create(initial=state(40))
        self.assertEqual(response["status"], 201)
        self.assertEqual(response["body"]["revision"], 1)
        self.assertEqual(self.read()["body"]["state"]["xp"], 40)
        with self.app.store.connection() as db:
            row = db.execute("SELECT * FROM profiles").fetchone()
            self.assertEqual(row["token_hash"], hashlib.sha256(self.token.encode("ascii")).hexdigest())
            self.assertNotIn(self.token, str(dict(row)))
        self.assertNotIn("recoveryCode", response["body"])

    def test_duplicate_creation_returns_current_state_without_overwriting(self):
        first = self.create()["body"]
        self.save(120)
        retry = self.create(initial={"version": 99})
        self.assertEqual(retry["status"], 200)
        self.assertEqual(retry["body"]["profileId"], first["profileId"])
        self.assertEqual(retry["body"]["revision"], 2)
        self.assertEqual(retry["body"]["state"]["xp"], 120)

    def test_invalid_tokens_and_no_public_reads_by_id(self):
        created = self.create()["body"]
        for token in (None, "", "x", "gxy_" + "A" * 64, recovery_code()):
            self.assertEqual(invoke(self.app, "GET", "/api/v1/save", token=token)["status"], 401)
        self.assertEqual(invoke(self.app, "GET", "/api/v1/profiles/" + created["profileId"])["status"], 404)

    def test_player_authentication_isolation(self):
        other = recovery_code()
        self.create(initial=state(50))
        self.create(token=other, initial=state(900))
        self.save(100, token=self.token)
        self.assertEqual(self.read(other)["body"]["state"]["xp"], 900)
        self.assertEqual(len(invoke(self.app, "GET", "/api/v1/history", token=other)["body"]["versions"]), 1)
        missing = invoke(self.app, "POST", "/api/v1/restore", {"baseRevision": 1, "mutationId": str(uuid.uuid4()), "revision": 2}, other)
        self.assertEqual(missing["status"], 404)

    def test_save_increments_revision_and_preserves_daily_local_date(self):
        self.create()
        saved = self.save(80, reason="train")
        self.assertEqual(saved["status"], 200)
        self.assertEqual(saved["body"]["revision"], 2)
        self.assertEqual(saved["body"]["mutationRevision"], 2)
        self.assertEqual(saved["body"]["state"]["daily"]["date"], "2026-9-7")
        self.assertEqual(saved["body"]["state"]["daily"]["fed"], 1)

    def test_retry_old_mutation_returns_current_head_and_original_receipt(self):
        self.create()
        mutation = str(uuid.uuid4())
        self.assertEqual(self.save(100, mutation=mutation)["body"]["mutationRevision"], 2)
        self.save(200, base=2)
        retry = self.save(100, base=1, mutation=mutation)
        self.assertEqual(retry["status"], 200)
        self.assertEqual(retry["body"]["revision"], 3)
        self.assertEqual(retry["body"]["mutationRevision"], 2)
        self.assertEqual(retry["body"]["state"]["xp"], 200)
        self.assertEqual(len(invoke(self.app, "GET", "/api/v1/history", token=self.token)["body"]["versions"]), 3)

    def test_conflict_contains_current_head_and_does_not_write(self):
        self.create()
        self.save(100)
        conflict = self.save(20, base=1)
        self.assertEqual(conflict["status"], 409)
        self.assertEqual(conflict["body"]["error"]["code"], "revision_conflict")
        self.assertEqual(conflict["body"]["current"]["state"]["xp"], 100)
        self.assertEqual(self.read()["body"]["revision"], 2)

    def test_concurrent_cas_has_exactly_one_winner(self):
        self.create()
        with ThreadPoolExecutor(max_workers=2) as executor:
            responses = list(executor.map(lambda xp: self.save(xp), (10, 20)))
        self.assertEqual(sorted(response["status"] for response in responses), [200, 409])
        self.assertEqual(self.read()["body"]["revision"], 2)
        winner = next(response for response in responses if response["status"] == 200)
        self.assertEqual(self.read()["body"]["state"]["xp"], winner["body"]["state"]["xp"])

    def test_concurrent_duplicate_create_is_idempotent(self):
        with ThreadPoolExecutor(max_workers=2) as executor:
            responses = list(executor.map(lambda _: self.create(), range(2)))
        self.assertEqual(sorted(response["status"] for response in responses), [200, 201])
        self.assertEqual(responses[0]["body"]["profileId"], responses[1]["body"]["profileId"])

    def test_restore_creates_new_revision_and_keeps_previous_head(self):
        self.create(initial=state(10))
        self.save(200)
        body = {"baseRevision": 2, "mutationId": str(uuid.uuid4()), "revision": 1}
        restored = invoke(self.app, "POST", "/api/v1/restore", body, self.token)
        self.assertEqual(restored["status"], 200)
        self.assertEqual(restored["body"]["revision"], 3)
        self.assertEqual(restored["body"]["state"]["xp"], 10)
        versions = invoke(self.app, "GET", "/api/v1/history", token=self.token)["body"]["versions"]
        self.assertEqual([version["xp"] for version in versions], [10, 200, 10])
        self.assertEqual(versions[0]["reason"], "restore:1")
        self.assertEqual(invoke(self.app, "POST", "/api/v1/restore", body, self.token)["body"]["revision"], 3)

    def test_restore_requires_current_revision(self):
        self.create()
        self.save(100)
        response = invoke(self.app, "POST", "/api/v1/restore", {"baseRevision": 1, "mutationId": str(uuid.uuid4()), "revision": 1}, self.token)
        self.assertEqual(response["status"], 409)
        self.assertEqual(self.read()["body"]["state"]["xp"], 100)

    def test_history_retention_keeps_100_and_mutation_receipts_longer(self):
        self.create()
        earliest = str(uuid.uuid4())
        self.save(1, mutation=earliest)
        for revision in range(2, 107):
            self.assertEqual(self.save(revision, base=revision)["status"], 200)
        versions = invoke(self.app, "GET", "/api/v1/history", token=self.token)["body"]["versions"]
        self.assertEqual(len(versions), 50)
        with self.app.store.connection() as db:
            self.assertEqual(db.execute("SELECT count(*) FROM save_versions").fetchone()[0], 100)
            self.assertEqual(db.execute("SELECT count(*) FROM mutations").fetchone()[0], 106)
        retry = self.save(1, mutation=earliest)
        self.assertEqual(retry["body"]["revision"], 107)
        self.assertEqual(retry["body"]["mutationRevision"], 2)

    def test_restart_keeps_database_and_makes_verified_startup_backup(self):
        self.create(initial=state(456))
        self.app.close()
        self.app = Application(self.data_dir, start_backups=False)
        self.assertEqual(self.read()["body"]["state"]["xp"], 456)
        backup = next((self.data_dir / "backups").glob("aoteman-*-startup-*.sqlite3"))
        with closing(connect(backup, readonly=True)) as db:
            self.assertEqual(json.loads(db.execute("SELECT state_json FROM profiles").fetchone()[0])["xp"], 456)

    def test_v1_state_migrates_without_resetting_growth(self):
        legacy = {"version": 1, "food": 10, "energy": 20, "mood": 30, "xp": 400, "wins": 3}
        response = self.create(initial=legacy)
        self.assertEqual(response["status"], 201)
        self.assertEqual(response["body"]["state"]["version"], 2)
        self.assertEqual(response["body"]["state"]["xp"], 400)
        self.assertEqual(response["body"]["state"]["blocks"], 0)
        self.assertEqual(response["body"]["state"]["companionName"], "银河")
        self.assertEqual(response["body"]["state"]["milestones"], [])

    def test_companion_names_share_browser_unicode_validation_and_reject_without_writing(self):
        self.create(initial=state(100))
        for invalid in NAME_FIXTURES["invalid"]:
            with self.subTest(invalid=repr(invalid)):
                incoming = {**state(), "companionName": invalid}
                body = {"baseRevision": 1, "mutationId": str(uuid.uuid4()), "state": incoming}
                # Escaped JSON can carry a lone surrogate; the API must reject
                # it before it reaches SQLite or the UTF-8 response encoder.
                response = invoke(self.app, "PUT", "/api/v1/save", token=self.token, raw=json.dumps(body).encode("ascii"))
                self.assertEqual(response["status"], 400)
                self.assertEqual(response["body"]["error"]["code"], "invalid_state")
                self.assertEqual(self.read()["body"]["revision"], 1)
                self.assertEqual(self.read()["body"]["state"]["xp"], 100)
        for base, valid in enumerate(NAME_FIXTURES["valid"], start=1):
            with self.subTest(valid=valid):
                response = invoke(self.app, "PUT", "/api/v1/save", {"baseRevision": base, "mutationId": str(uuid.uuid4()), "state": {**state(100), "companionName": valid["input"]}}, self.token)
                self.assertEqual(response["status"], 200)
                self.assertEqual(response["body"]["state"]["companionName"], valid["name"])

    def test_claimed_milestones_are_bounded_known_and_distinct(self):
        incoming = {**state(), "milestones": ["first_meal", "first_meal", "__proto__", {}, [], None, "galaxy_guardian"] * 200}
        response = self.create(initial=incoming)
        self.assertEqual(response["status"], 201)
        self.assertEqual(response["body"]["state"]["milestones"], ["first_meal", "galaxy_guardian"])
        response = invoke(self.app, "PUT", "/api/v1/save", {"baseRevision": 1, "mutationId": str(uuid.uuid4()), "state": {**state(), "milestones": {"first_guard": True}}}, self.token)
        self.assertEqual(response["status"], 200)
        self.assertEqual(response["body"]["state"]["milestones"], [])

    def test_older_client_saves_preserve_new_growth_fields_and_earned_rewards(self):
        initial = {**state(100), "stars": 55, "companionName": "小光", "milestones": ["first_meal", "first_training"]}
        self.create(initial=initial)
        old_shape = {**state(120), "stars": 60}
        self.assertNotIn("companionName", old_shape)
        self.assertNotIn("milestones", old_shape)
        response = invoke(self.app, "PUT", "/api/v1/save", {"baseRevision": 1, "mutationId": str(uuid.uuid4()), "state": old_shape}, self.token)
        self.assertEqual(response["status"], 200)
        self.assertEqual(response["body"]["state"]["companionName"], "小光")
        self.assertEqual(response["body"]["state"]["milestones"], initial["milestones"])
        self.assertEqual(response["body"]["state"]["xp"], 120)
        self.assertEqual(response["body"]["state"]["stars"], 60)
        # A new client may change one field while omitting the other.
        response = invoke(self.app, "PUT", "/api/v1/save", {"baseRevision": 2, "mutationId": str(uuid.uuid4()), "state": {**old_shape, "companionName": "星星"}}, self.token)
        self.assertEqual(response["body"]["state"]["companionName"], "星星")
        self.assertEqual(response["body"]["state"]["milestones"], initial["milestones"])

    def test_growth_reward_retry_and_historical_restore_preserve_correct_claim_record(self):
        self.create(initial={**state(), "companionName": "小光", "milestones": []})
        mutation = str(uuid.uuid4())
        reward = {**state(10), "fed": 1, "stars": 5, "companionName": "星星", "milestones": ["first_meal"]}
        body = {"baseRevision": 1, "mutationId": mutation, "state": reward, "reason": "milestone:first_meal"}
        for _ in range(2):
            saved = invoke(self.app, "PUT", "/api/v1/save", body, self.token)
            self.assertEqual(saved["status"], 200)
            self.assertEqual(saved["body"]["revision"], 2)
            self.assertEqual(saved["body"]["state"]["xp"], 10)
            self.assertEqual(saved["body"]["state"]["stars"], 5)
            self.assertEqual(saved["body"]["state"]["milestones"], ["first_meal"])
        restored = invoke(self.app, "POST", "/api/v1/restore", {"baseRevision": 2, "mutationId": str(uuid.uuid4()), "revision": 1}, self.token)
        self.assertEqual(restored["status"], 200)
        self.assertEqual(restored["body"]["state"]["companionName"], "小光")
        self.assertEqual(restored["body"]["state"]["milestones"], [])
        self.assertEqual(restored["body"]["state"]["xp"], 0)
        self.assertEqual(restored["body"]["state"]["stars"], 0)
        restored = invoke(self.app, "POST", "/api/v1/restore", {"baseRevision": 3, "mutationId": str(uuid.uuid4()), "revision": 2}, self.token)
        self.assertEqual(restored["body"]["state"]["milestones"], ["first_meal"])
        self.assertEqual(restored["body"]["state"]["xp"], 10)
        self.assertEqual(restored["body"]["state"]["companionName"], "星星")

    def test_optional_growth_fields_survive_database_restart_without_schema_change(self):
        initial = {**state(850), "companionName": "小光", "milestones": ["galaxy_guardian", "first_victory"]}
        self.create(initial=initial)
        self.app.close()
        self.app = Application(self.data_dir, start_backups=False)
        restored = self.read()["body"]["state"]
        self.assertEqual(restored["companionName"], initial["companionName"])
        self.assertEqual(restored["milestones"], initial["milestones"])
        self.assertEqual(restored["xp"], 850)
        self.assertEqual(SCHEMA_VERSION, 2)

    def test_unknown_state_fields_are_removed(self):
        initial = state()
        initial.update({"admin": True, "recoveryCode": "never store", "unlocked": ["base", "moon", "moon", "unknown"]})
        initial["journal"] = [{"text": "X" * 200, "at": 1000, "secret": "remove"}] * 40
        result = self.create(initial=initial)["body"]["state"]
        self.assertNotIn("admin", result)
        self.assertNotIn("recoveryCode", result)
        self.assertEqual(result["unlocked"], ["base", "moon"])
        self.assertEqual(len(result["journal"]), 30)
        self.assertEqual(len(result["journal"][0]["text"]), 160)
        self.assertNotIn("secret", result["journal"][0])

    def test_invalid_important_numbers_do_not_replace_existing_save(self):
        self.create(initial=state(100))
        for key, value in (("xp", -1), ("xp", "100"), ("xp", True), ("xp", 1.5), ("xp", 10 ** 200), ("food", None), ("energy", 101), ("born", 0), ("version", 3), ("version", True)):
            with self.subTest(key=key, value=value):
                incoming = state()
                incoming[key] = value
                response = invoke(self.app, "PUT", "/api/v1/save", {"baseRevision": 1, "mutationId": str(uuid.uuid4()), "state": incoming}, self.token)
                self.assertEqual(response["status"], 400)
                self.assertEqual(self.read()["body"]["state"]["xp"], 100)

    def test_invalid_json_media_type_and_size_are_explicit(self):
        cases = [
            ({"raw": b"{"}, 400), ({"raw": b'{"a":1,"a":2}'}, 400),
            ({"raw": b'{"state":NaN}'}, 400), ({"raw": b"[]"}, 400),
            ({"raw": b"\xff"}, 400), ({"raw": b"{}", "content_type": "text/plain"}, 415),
            ({"raw": b"{}", "length": str(102401)}, 413), ({"raw": b"{}", "length": "-1"}, 400),
            ({"raw": b"{}", "length": "oops"}, 400), ({"raw": b"{}", "length": "10"}, 400),
        ]
        for options, status in cases:
            with self.subTest(options=options):
                self.assertEqual(invoke(self.app, "POST", "/api/v1/profiles", **options)["status"], status)

    def test_invalid_mutation_parameters_are_rejected(self):
        self.create()
        for key, value in (("baseRevision", True), ("baseRevision", 0), ("baseRevision", 1.0), ("mutationId", "x"), ("mutationId", "a" * 129), ("reason", "")):
            body = {"baseRevision": 1, "mutationId": str(uuid.uuid4()), "state": state(), "reason": "save"}
            body[key] = value
            self.assertEqual(invoke(self.app, "PUT", "/api/v1/save", body, self.token)["status"], 400)

    def test_private_responses_are_not_cached_or_cross_origin(self):
        self.create()
        response = self.read()
        self.assertEqual(response["headers"]["Cache-Control"], "no-store")
        self.assertNotIn("Access-Control-Allow-Origin", response["headers"])
        self.assertEqual(invoke(self.app, "OPTIONS", "/api/v1/save")["status"], 405)

    def test_export_has_attachment_and_current_save(self):
        self.create(initial=state(123))
        response = invoke(self.app, "GET", "/api/v1/export", token=self.token)
        self.assertEqual(response["body"]["state"]["xp"], 123)
        self.assertIn("attachment", response["headers"]["Content-Disposition"])

    def test_storage_failures_do_not_expose_internal_details(self):
        with patch.object(self.app.store, "connection", side_effect=sqlite3.OperationalError("secret-path-and-query")):
            with self.assertLogs("server.app", level="ERROR") as captured:
                response = invoke(self.app, "GET", "/api/healthz")
        self.assertEqual(response["status"], 503)
        self.assertNotIn("secret-path", json.dumps(response) + str(captured.output))

    def test_transaction_rolls_back_partial_write_failure(self):
        self.create()
        with patch.object(self.app, "save_version", side_effect=sqlite3.OperationalError("disk full")):
            with self.assertLogs("server.app", level="ERROR"):
                response = self.save(999)
        self.assertEqual(response["status"], 503)
        self.assertEqual(self.read()["body"]["revision"], 1)
        self.assertEqual(self.read()["body"]["state"]["xp"], 0)

    def test_online_backup_includes_wal_and_is_verified(self):
        self.create()
        with closing(connect(self.app.store.path)) as keep_open:
            keep_open.execute("PRAGMA wal_autocheckpoint=0")
            self.save(900)
            output = make_backup(self.app.store.path, self.data_dir / "snapshot.sqlite3")
            with closing(connect(output, readonly=True)) as db:
                self.assertEqual(db.execute("PRAGMA integrity_check").fetchone()[0], "ok")
                self.assertEqual(json.loads(db.execute("SELECT state_json FROM profiles").fetchone()[0])["xp"], 900)
            self.assertEqual(self.read()["body"]["state"]["xp"], 900)

    def test_backup_refuses_overwriting_or_live_database_destination(self):
        self.create()
        output = make_backup(self.app.store.path, self.data_dir / "snapshot.sqlite3")
        original = output.read_bytes()
        with self.assertRaises(FileExistsError):
            make_backup(self.app.store.path, output)
        with self.assertRaises(ValueError):
            make_backup(self.app.store.path, self.app.store.path)
        self.assertEqual(output.read_bytes(), original)

    def test_auto_backup_only_for_changes_and_daily_copy(self):
        self.assertFalse(self.app.store.backup_if_changed())
        self.create()
        self.assertTrue(self.app.store.backup_if_changed())
        self.assertFalse(self.app.store.backup_if_changed())
        self.assertEqual(len(list((self.data_dir / "backups").glob("daily-*.sqlite3"))), 1)

    def test_backup_rotation_keeps_manual_and_predeployment_snapshots(self):
        directory = self.data_dir / "backups"
        directory.mkdir()
        for index in range(52):
            (directory / ("aoteman-20000101T%06dZ-auto-test.sqlite3" % index)).write_bytes(b"test")
        for index in range(32):
            (directory / ("daily-199901%02d.sqlite3" % index)).write_bytes(b"test")
        manual = directory / "pre-deploy-19990101.sqlite3"
        manual.write_bytes(b"preserve")
        self.app.store.backup()
        self.assertEqual(len(list(directory.glob("aoteman-*.sqlite3"))), 48)
        self.assertEqual(len(list(directory.glob("daily-*.sqlite3"))), 30)
        self.assertEqual(manual.read_bytes(), b"preserve")

    def test_offline_restore_refuses_live_service_then_preserves_old_head(self):
        self.create(initial=state(10))
        output = make_backup(self.app.store.path, self.data_dir / "snapshot.sqlite3")
        self.save(500)
        with self.assertRaisesRegex(RuntimeError, "running"):
            restore_backup(output, self.data_dir)
        self.assertEqual(self.read()["body"]["state"]["xp"], 500)
        self.app.close()
        target, before = restore_backup(output, self.data_dir)
        self.assertTrue(before.exists())
        with closing(connect(before, readonly=True)) as db:
            self.assertEqual(json.loads(db.execute("SELECT state_json FROM profiles").fetchone()[0])["xp"], 500)
        self.app = Application(self.data_dir, start_backups=False)
        self.assertEqual(self.read()["body"]["state"]["xp"], 10)

    def test_invalid_restore_source_never_changes_good_database(self):
        self.create(initial=state(100))
        self.app.close()
        corrupt = self.data_dir / "bad.sqlite3"
        corrupt.write_bytes(b"not sqlite" * 20)
        with self.assertRaises(sqlite3.DatabaseError):
            restore_backup(corrupt, self.data_dir)
        self.app = Application(self.data_dir, start_backups=False)
        self.assertEqual(self.read()["body"]["state"]["xp"], 100)

    def test_explicit_restore_recovers_corrupt_database_and_preserves_its_bytes(self):
        self.create(initial=state(400))
        output = make_backup(self.app.store.path, self.data_dir / "good.sqlite3")
        self.app.close()
        damaged = b"broken sqlite file" * 20
        self.app.store.path.write_bytes(damaged)
        _, preserved = restore_backup(output, self.data_dir)
        self.assertEqual((preserved / "aoteman.sqlite3").read_bytes(), damaged)
        self.app = Application(self.data_dir, start_backups=False)
        self.assertEqual(self.read()["body"]["state"]["xp"], 400)

    def test_backup_cli_works_against_running_wal_database(self):
        self.create(initial=state(321))
        output = self.data_dir / "cli.sqlite3"
        result = subprocess.run([sys.executable, "-m", "server.backup", "--output", str(output)], cwd=ROOT, env={**os.environ, "AOTEMAN_DATA_DIR": str(self.data_dir)}, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        with closing(connect(output, readonly=True)) as db:
            self.assertEqual(json.loads(db.execute("SELECT state_json FROM profiles").fetchone()[0])["xp"], 321)


class MigrationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.directory = Path(self.temp.name)
        self.path = self.directory / "aoteman.sqlite3"

    def tearDown(self):
        self.temp.cleanup()

    def version_one(self):
        with closing(connect(self.path)) as db:
            db.executescript((ROOT / "database/migrations/001_initial.sql").read_text() + "\nPRAGMA user_version=1;")
            raw = json.dumps(state(888))
            db.execute("INSERT INTO profiles VALUES(?,?,?,?,?,?)", ("preserved-player", "hash", 1, raw, "2026-09-07T00:00:00Z", "2026-09-07T00:00:00Z"))
            db.execute("INSERT INTO save_versions VALUES(?,?,?,?,?)", ("preserved-player", 1, raw, "2026-09-07T00:00:00Z", "initial"))

    def test_schema_upgrade_keeps_progress_and_before_upgrade_backup(self):
        self.version_one()
        store = Store(self.directory, start_backups=False)
        try:
            with store.connection() as db:
                self.assertEqual(db.execute("PRAGMA user_version").fetchone()[0], 2)
                self.assertEqual(json.loads(db.execute("SELECT state_json FROM profiles").fetchone()[0])["xp"], 888)
                self.assertEqual(db.execute("SELECT count(*) FROM mutations").fetchone()[0], 0)
            backup = next((self.directory / "backups").glob("aoteman-*.sqlite3"))
            with closing(connect(backup, readonly=True)) as db:
                self.assertEqual(db.execute("PRAGMA user_version").fetchone()[0], 1)
        finally:
            store.close()

    def test_newer_schema_refuses_start_and_is_not_overwritten(self):
        self.version_one()
        with closing(connect(self.path)) as db:
            db.execute("PRAGMA user_version=999")
        original = self.path.read_bytes()
        with self.assertRaisesRegex(RuntimeError, "newer"):
            Store(self.directory, start_backups=False)
        self.assertEqual(self.path.read_bytes(), original)

    def test_corrupt_or_empty_existing_database_is_not_initialized(self):
        for raw in (b"", b"not a database" * 20):
            self.path.write_bytes(raw)
            with self.assertRaises((RuntimeError, sqlite3.DatabaseError)):
                Store(self.directory, start_backups=False)
            self.assertEqual(self.path.read_bytes(), raw)

    def test_unversioned_existing_tables_are_not_assumed_empty(self):
        with closing(connect(self.path)) as db:
            db.execute("CREATE TABLE important_data(value TEXT)")
        with self.assertRaisesRegex(RuntimeError, "Unversioned"):
            Store(self.directory, start_backups=False)

    def test_incomplete_schema_is_rejected(self):
        self.version_one()
        with closing(connect(self.path)) as db:
            db.execute("DROP TABLE save_versions")
        with self.assertRaisesRegex(RuntimeError, "incomplete"):
            Store(self.directory, start_backups=False)

    def test_failed_migration_rolls_back_schema_and_keeps_original_save(self):
        self.version_one()
        broken = self.directory / "migrations"
        broken.mkdir()
        (broken / "002_broken.sql").write_text("CREATE TABLE should_rollback(id INTEGER); THIS IS INVALID;")
        with patch("server.storage.MIGRATIONS", broken):
            with self.assertRaises(sqlite3.OperationalError):
                Store(self.directory, start_backups=False)
        with closing(connect(self.path)) as db:
            self.assertEqual(db.execute("PRAGMA user_version").fetchone()[0], 1)
            self.assertIsNone(db.execute("SELECT name FROM sqlite_master WHERE name='should_rollback'").fetchone())
            self.assertEqual(json.loads(db.execute("SELECT state_json FROM profiles").fetchone()[0])["xp"], 888)


if __name__ == "__main__":
    unittest.main()
