"""Create a verified snapshot of the database, including live WAL writes."""

import argparse
import os
import sqlite3
from pathlib import Path

from .storage import make_backup


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, help="New SQLite backup path (must not already exist)")
    args = parser.parse_args()
    data_dir = Path(os.environ.get("AOTEMAN_DATA_DIR", "/data"))
    try:
        output = make_backup(data_dir / "aoteman.sqlite3", args.output)
    except (OSError, ValueError, RuntimeError, sqlite3.Error) as error:
        parser.exit(1, "Backup failed: %s\n" % error)
    print("Verified SQLite backup: %s" % output)


if __name__ == "__main__":
    main()
