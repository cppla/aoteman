"""Development API server: AOTEMAN_DATA_DIR=./data python3 -m server."""

import argparse
import os
from wsgiref.simple_server import make_server


def main():
    parser = argparse.ArgumentParser(description="Run the save API development server.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "8081")))
    args = parser.parse_args()
    from .app import application
    try:
        with make_server(args.host, args.port, application) as httpd:
            print("Save API listening on http://%s:%d" % (args.host, args.port), flush=True)
            httpd.serve_forever()
    finally:
        application.close()


if __name__ == "__main__":
    main()
