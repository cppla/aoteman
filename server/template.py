"""Build an empty, versioned SQLite template for a new application release."""

import argparse
import os
from contextlib import closing
from pathlib import Path

from .storage import connect, migrate


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, help="New empty template path; existing files are never overwritten")
    args = parser.parse_args()
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    descriptor = os.open(output, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    os.close(descriptor)
    with closing(connect(output)) as db:
        migrate(db)
        db.execute("PRAGMA journal_mode=DELETE")
        db.execute("VACUUM")
    print("Created empty SQLite schema template: %s" % output)


if __name__ == "__main__":
    main()
