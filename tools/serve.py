"""로컬 확인용 서버 — 캐시를 끈다 (모듈을 고쳐도 브라우저가 옛 파일을 쓰지 않게).
사용: python3 tools/serve.py [포트=8732]  (저장소 루트에서)"""
import http.server, sys

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8732
http.server.ThreadingHTTPServer(('', port), NoCache).serve_forever()
