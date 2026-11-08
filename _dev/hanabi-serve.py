"""試遊とテスト用の小さなサーバー。python -m http.server は同時接続を断ることがあり、
ES モジュールを 10 個以上まとめて読むと ERR_CONNECTION_REFUSED で画面が止まる（40 回中 3 回）。受付の列を広げて避ける。

    python _dev/hanabi-serve.py <ポート> <フォルダ> [開くページ]
"""
import functools, http.server, sys, threading, webbrowser


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")  # 直したものがすぐ見えるように
        super().end_headers()

    def log_message(self, *a):
        pass


class Server(http.server.ThreadingHTTPServer):
    request_queue_size = 256
    daemon_threads = True


port, root = int(sys.argv[1]), sys.argv[2]
srv = Server(("127.0.0.1", port), functools.partial(Handler, directory=root))
if len(sys.argv) > 3:  # 受付が始まってからブラウザを開く
    threading.Timer(0.2, lambda: webbrowser.open(f"http://127.0.0.1:{port}/{sys.argv[3]}")).start()
srv.serve_forever()
