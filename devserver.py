#!/usr/bin/env python3
"""Dev server with hot reformat + reload.

Serves the site, polls posts/ for changes, reruns build.py (which reformats the
markdown and regenerates HTML), then tells open pages to reload.

Usage: python3 devserver.py [port]
"""

import http.server
import subprocess
import sys
import threading
import time
from pathlib import Path

ROOT = Path(__file__).parent
POSTS_DIR = ROOT / "posts"
POLL_INTERVAL = 0.5
RELOAD_PATH = "/__livereload"

# Injected into every served HTML page. Reloads when the server reports a new
# build; EventSource reconnects on its own if the server restarts.
RELOAD_SNIPPET = f"""
<script>
(function () {{
    var es = new EventSource("{RELOAD_PATH}");
    es.onmessage = function () {{ location.reload(); }};
}})();
</script>
""".encode("utf-8")

build_version = 0
build_cond = threading.Condition()


def snapshot():
    """Map of watched file -> mtime."""
    files = list(POSTS_DIR.glob("*.md")) + [POSTS_DIR / "posts.txt"]
    return {f: f.stat().st_mtime for f in files if f.exists()}


def run_build():
    print("Building blog...", flush=True)
    result = subprocess.run([sys.executable, str(ROOT / "build.py")], cwd=ROOT)
    if result.returncode != 0:
        print("Build failed; not reloading.", flush=True)
    return result.returncode == 0


def watch():
    global build_version
    last = snapshot()
    while True:
        time.sleep(POLL_INTERVAL)
        current = snapshot()
        if current == last:
            continue
        changed = sorted(f.name for f in current.keys() | last.keys() if current.get(f) != last.get(f))
        print(f"Changed: {', '.join(changed)}", flush=True)
        ok = run_build()
        # The build reformats posts in place; re-snapshot so those writes
        # don't trigger another build.
        last = snapshot()
        if ok:
            with build_cond:
                build_version += 1
                build_cond.notify_all()


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if self.path == RELOAD_PATH:
            return self.serve_events()
        url_path = self.path.split("?")[0].split("#")[0]
        path = Path(self.translate_path(self.path))
        if path.is_dir():
            # Directories without a trailing slash get the stock redirect.
            if not url_path.endswith("/"):
                return super().do_GET()
            path = path / "index.html"
        if path.suffix == ".html" and path.is_file():
            return self.serve_html(path)
        return super().do_GET()

    def serve_html(self, path):
        body = path.read_bytes()
        idx = body.rfind(b"</body>")
        body = body[:idx] + RELOAD_SNIPPET + body[idx:] if idx != -1 else body + RELOAD_SNIPPET
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def serve_events(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.end_headers()
        with build_cond:
            seen = build_version
        try:
            while True:
                with build_cond:
                    build_cond.wait_for(lambda: build_version != seen, timeout=15)
                    current = build_version
                if current != seen:
                    seen = current
                    self.wfile.write(b"data: reload\n\n")
                else:
                    self.wfile.write(b": keepalive\n\n")  # detects closed tabs
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass

    def log_message(self, format, *args):
        if RELOAD_PATH not in self.path:
            super().log_message(format, *args)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    run_build()
    threading.Thread(target=watch, daemon=True).start()
    server = http.server.ThreadingHTTPServer(("", port), Handler)
    server.daemon_threads = True
    print(f"Hot-reloading server at http://localhost:{port} (watching posts/)", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
