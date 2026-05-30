"""Launcher: spins up http.server, runs niwa_behavior_test.py."""
import os, sys, subprocess, threading, http.server, socketserver, pathlib, time, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace', newline='')

REPO = pathlib.Path(__file__).resolve().parents[1]
PORT = 9302


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a, **kw): pass


def serve():
    os.chdir(REPO)
    socketserver.TCPServer(('127.0.0.1', PORT), Quiet).serve_forever()


def main():
    threading.Thread(target=serve, daemon=True).start()
    time.sleep(0.5)
    env = dict(os.environ, NIWA_PORT=str(PORT))
    rc = subprocess.call([sys.executable, str(pathlib.Path(__file__).with_name('niwa_behavior_test.py'))], env=env)
    sys.exit(rc)


if __name__ == '__main__':
    main()
