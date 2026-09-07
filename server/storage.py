"""SQLite ownership, non-destructive migrations, and consistent backups."""

import fcntl
import json
import logging
import os
import sqlite3
import threading
import uuid
from contextlib import closing, contextmanager
from datetime import datetime, timezone
from pathlib import Path

SCHEMA_VERSION = 2
ROOT = Path(__file__).resolve().parent.parent
MIGRATIONS = ROOT / "database" / "migrations"
LOGGER = logging.getLogger(__name__)


def timestamp():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def connect(path, readonly=False):
    if readonly:
        connection = sqlite3.connect(Path(path).resolve().as_uri() + "?mode=ro", uri=True, timeout=15, isolation_level=None)
    else:
        connection = sqlite3.connect(str(path), timeout=15, isolation_level=None)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA busy_timeout=15000")
    connection.execute("PRAGMA foreign_keys=ON")
    if not readonly:
        connection.execute("PRAGMA synchronous=FULL")
    return connection


def validate_database(connection):
    if connection.execute("PRAGMA quick_check").fetchone()[0] != "ok":
        raise RuntimeError("SQLite integrity check failed; refusing to replace existing data.")
    version = connection.execute("PRAGMA user_version").fetchone()[0]
    if version > SCHEMA_VERSION:
        raise RuntimeError("Database schema is newer than this application; use a compatible image.")
    tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")}
    if version == 0 and tables:
        raise RuntimeError("Unversioned non-empty database; refusing automatic initialization.")
    expected = {"profiles", "save_versions"} if version >= 1 else set()
    if version >= 2:
        expected.add("mutations")
    if not expected.issubset(tables):
        raise RuntimeError("Database schema is incomplete; restore a verified backup.")
    if version >= 1:
        connection.execute("SELECT id, token_hash, revision, state_json, created_at, updated_at FROM profiles LIMIT 0")
        connection.execute("SELECT profile_id, revision, state_json, created_at, reason FROM save_versions LIMIT 0")
        if connection.execute("PRAGMA foreign_key_check").fetchone() is not None:
            raise RuntimeError("Database foreign key check failed.")
    if version >= 2:
        connection.execute("SELECT profile_id, mutation_id, revision, created_at FROM mutations LIMIT 0")
    return version


def make_backup(source_path, output_path):
    """Use SQLite's online backup API; copying the live main file loses WAL data."""
    source_path, output_path = Path(source_path).resolve(), Path(output_path).resolve()
    if source_path == output_path:
        raise ValueError("Backup destination cannot be the live database.")
    if not source_path.is_file() or source_path.stat().st_size < 100:
        raise RuntimeError("Source database is missing or invalid.")
    output_path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    if output_path.exists():
        raise FileExistsError("Backup destination already exists; choose a new filename.")
    temporary = output_path.with_name("." + output_path.name + "." + uuid.uuid4().hex + ".tmp")
    try:
        descriptor = os.open(temporary, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        os.close(descriptor)
        with closing(connect(source_path, readonly=True)) as source, closing(sqlite3.connect(str(temporary))) as target:
            validate_database(source)
            source.backup(target)
            target.execute("PRAGMA journal_mode=DELETE")
            target.commit()
            if target.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                raise RuntimeError("Backup verification failed.")
        with temporary.open("rb") as handle:
            os.fsync(handle.fileno())
        # Hard-link publication is atomic and will never overwrite a backup.
        os.link(temporary, output_path)
        sync_directory(output_path.parent)
    finally:
        temporary.unlink(missing_ok=True)
    return output_path


def sync_directory(path):
    descriptor = os.open(path, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def migrate(connection):
    version = validate_database(connection)
    for next_version in range(version + 1, SCHEMA_VERSION + 1):
        candidates = sorted(MIGRATIONS.glob("%03d_*.sql" % next_version))
        if len(candidates) != 1:
            raise RuntimeError("Missing or ambiguous database migration.")
        sql = candidates[0].read_text(encoding="utf-8")
        try:
            connection.executescript("BEGIN IMMEDIATE;\n" + sql + "\nPRAGMA user_version=%d;\nCOMMIT;" % next_version)
        except BaseException:
            if connection.in_transaction:
                connection.rollback()
            raise
    validate_database(connection)


class Store:
    def __init__(self, data_dir=None, start_backups=True):
        self.data_dir = Path(data_dir or os.environ.get("AOTEMAN_DATA_DIR", "/data")).resolve()
        self.data_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.path = self.data_dir / "aoteman.sqlite3"
        self.backup_dir = self.data_dir / "backups"
        self.stop_event = threading.Event()
        self.thread = None
        self.lock_file = (self.data_dir / ".service.lock").open("a+b")
        os.chmod(self.lock_file.name, 0o600)
        # A shared lock lives as long as the service. Offline restore takes EX.
        fcntl.flock(self.lock_file.fileno(), fcntl.LOCK_SH | fcntl.LOCK_NB)
        try:
            with (self.data_dir / ".initialize.lock").open("a+b") as init_lock:
                fcntl.flock(init_lock.fileno(), fcntl.LOCK_EX)
                existed = self.path.exists()
                if existed:
                    if self.path.stat().st_size < 100:
                        raise RuntimeError("Existing database is empty or damaged; refusing initialization.")
                    with closing(connect(self.path, readonly=True)) as db:
                        validate_database(db)
                    self.backup("startup")
                else:
                    template = ROOT / "database" / "initial.sqlite3"
                    if not template.is_file():
                        raise RuntimeError("The versioned empty SQLite template is missing.")
                    with closing(connect(template, readonly=True)) as template_db:
                        template_version = validate_database(template_db)
                        if template_version != SCHEMA_VERSION:
                            raise RuntimeError("SQLite template must match the application schema.")
                        for table in ("profiles", "save_versions", "mutations"):
                            if template_db.execute("SELECT 1 FROM " + table + " LIMIT 1").fetchone():
                                raise RuntimeError("SQLite template must be empty; refusing to copy player data.")
                    # Copy a verified template only for a genuinely new volume.
                    make_backup(template, self.path)
                with closing(connect(self.path)) as db:
                    migrate(db)
                    db.execute("PRAGMA journal_mode=WAL")
                os.chmod(self.path, 0o600)
            self.last_marker = self.change_marker()
            interval = float(os.environ.get("BACKUP_INTERVAL_SECONDS", "900"))
            if start_backups and interval > 0:
                self.thread = threading.Thread(target=self.backup_loop, args=(max(1, interval),), name="sqlite-backup", daemon=True)
                self.thread.start()
        except BaseException:
            self.lock_file.close()
            raise

    @contextmanager
    def connection(self, write=False):
        with closing(connect(self.path)) as db:
            if write:
                db.execute("BEGIN IMMEDIATE")
            try:
                yield db
                if write:
                    db.commit()
            except BaseException:
                if db.in_transaction:
                    db.rollback()
                raise

    def change_marker(self):
        with self.connection() as db:
            return tuple(db.execute("SELECT count(*), coalesce(sum(revision), 0) FROM profiles").fetchone())

    def backup(self, reason="auto"):
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
        output = make_backup(self.path, self.backup_dir / ("aoteman-%s-%s-%s.sqlite3" % (stamp, reason, uuid.uuid4().hex[:6])))
        daily = self.backup_dir / ("daily-%s.sqlite3" % stamp[:8])
        if not daily.exists():
            try:
                make_backup(output, daily)
            except FileExistsError:
                pass  # Another worker published today's verified snapshot.
        # Never prune manually named/exported or pre-restore backups.
        candidates = sorted(self.backup_dir.glob("aoteman-*.sqlite3"), reverse=True)
        for stale in candidates[48:]:
            stale.unlink(missing_ok=True)
        for stale in sorted(self.backup_dir.glob("daily-????????.sqlite3"), reverse=True)[30:]:
            stale.unlink(missing_ok=True)
        return output

    def backup_if_changed(self):
        marker = self.change_marker()
        if marker != self.last_marker:
            self.backup()
            # Record the pre-backup marker. Concurrent writes cause another
            # backup next cycle instead of being accidentally marked saved.
            self.last_marker = marker
            return True
        return False

    def backup_loop(self, interval):
        while not self.stop_event.wait(interval):
            try:
                self.backup_if_changed()
            except Exception as error:
                LOGGER.error("Automatic SQLite backup failed (%s)", type(error).__name__)

    def close(self):
        self.stop_event.set()
        if self.thread:
            self.thread.join(timeout=20)
        if not self.lock_file.closed:
            self.lock_file.close()


def snapshot(row):
    return {"profileId": row["id"], "revision": row["revision"], "state": json.loads(row["state_json"]), "updatedAt": row["updated_at"]}


def encode_state(state):
    return json.dumps(state, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
