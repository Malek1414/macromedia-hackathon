"""Serves the repo for the fallback page with caching off, so a browser never
shows a stale copy after an edit. Usage: python3 scripts/serve.py [port]"""
import http.server, os, sys

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
port = int(sys.argv[1]) if len(sys.argv) > 1 else 5180
print(f'http://127.0.0.1:{port}/fallback/')
http.server.ThreadingHTTPServer(('127.0.0.1', port), NoCache).serve_forever()
