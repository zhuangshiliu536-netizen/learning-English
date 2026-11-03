#!/usr/bin/env python3
"""Run the self-contained flow prototype on loopback only."""
import argparse
import functools
import http.server
import threading
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent


class DemoHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


def main():
    parser = argparse.ArgumentParser(description='Milo first-day demo')
    parser.add_argument('--port', type=int, default=4173)
    parser.add_argument('--open', action='store_true')
    args = parser.parse_args()
    handler = functools.partial(DemoHandler, directory=str(ROOT))
    for port in range(args.port, args.port + 10):
        url = f'http://127.0.0.1:{port}/'
        try:
            server = http.server.ThreadingHTTPServer(('127.0.0.1', port), handler)
            break
        except OSError:
            try:
                with urllib.request.urlopen(url, timeout=1) as response:
                    body = response.read(4096).decode('utf-8', errors='ignore')
                if 'Milo · 首日英语冒险' in body:
                    print(f'已有体验版在运行：{url}')
                    if args.open:
                        webbrowser.open(url)
                    return
            except Exception:
                pass
    else:
        raise SystemExit('没有可用预览端口，请使用 --port 指定其他端口。')
    print(f'Milo 首日体验版：{url}', flush=True)
    print('只在本机运行。停止服务请按 Ctrl+C。', flush=True)
    if args.open:
        threading.Timer(0.4, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
