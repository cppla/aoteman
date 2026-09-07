"""Offline restore: stop the API first; preserve the previous database."""

import argparse
import fcntl
import os
import shutil
import sqlite3
import uuid
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

from .storage import connect, make_backup, sync_directory, validate_database


def preserve_damaged_database(target, directory):
    """Preserve all bytes for manual recovery when SQLite cannot read the old DB."""
    directory.mkdir(mode=0o700, parents=True, exist_ok=False)
    for suffix in ("", "-wal", "-shm"):
        original = Path(str(target) + suffix)
        if original.exists():
            saved = directory / original.name
            shutil.copyfile(original, saved)
            os.chmod(saved, 0o600)
            with saved.open("rb") as handle:
                os.fsync(handle.fileno())
    sync_directory(directory)
    return directory


def restore_backup(backup_path, data_dir=None):
    data_dir = Path(data_dir or os.environ.get("AOTEMAN_DATA_DIR", "/data")).resolve()
    data_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    backup_path, target = Path(backup_path).resolve(), data_dir / "aoteman.sqlite3"
    if backup_path == target:
        raise ValueError("Restore source cannot be the live database.")
    if not backup_path.is_file() or backup_path.stat().st_size < 100:
        raise ValueError("Backup is missing or empty.")
    with (data_dir / ".service.lock").open("a+b") as service_lock:
        try:
            fcntl.flock(service_lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RuntimeError("The save API is running. Stop the API service before restoring.")
        with closing(connect(backup_path, readonly=True)) as source:
            version = validate_database(source)
            if version == 0:
                raise ValueError("Backup does not contain a versioned save database.")
        staging = data_dir / (".restore-%s.sqlite3" % uuid.uuid4().hex)
        before = None
        try:
            make_backup(backup_path, staging)
            if target.exists():
                stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
                damaged = target.stat().st_size < 100
                if not damaged:
                    try:
                        before = make_backup(target, data_dir / "backups" / ("pre-restore-%s.sqlite3" % stamp))
                    except sqlite3.DatabaseError:
                        damaged = True
                if damaged:
                    before = preserve_damaged_database(target, data_dir / "backups" / ("damaged-pre-restore-%s" % stamp))
                # The service is stopped and its shared lock released. Flush
                # any remaining WAL before removing sidecars for replacement.
                if not damaged:
                    with closing(connect(target)) as current:
                        result = current.execute("PRAGMA wal_checkpoint(TRUNCATE)").fetchone()
                        if result[0] != 0:
                            raise RuntimeError("Database is still busy; stop all database users before restoring.")
                for suffix in ("-wal", "-shm"):
                    Path(str(target) + suffix).unlink(missing_ok=True)
            os.replace(staging, target)
            os.chmod(target, 0o600)
            sync_directory(data_dir)
        finally:
            staging.unlink(missing_ok=True)
    return target, before


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("backup", help="Verified SQLite backup to restore")
    args = parser.parse_args()
    try:
        target, before = restore_backup(args.backup)
    except (OSError, ValueError, RuntimeError, sqlite3.Error) as error:
        parser.exit(1, "Restore failed: %s\n" % error)
    print("Restored SQLite database: %s" % target)
    if before:
        print("Previous database preserved: %s" % before)


if __name__ == "__main__":
    main()
