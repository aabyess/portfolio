"""로컬 확인용 서버 — 캐시를 끈다 (모듈을 고쳐도 브라우저가 옛 파일을 쓰지 않게).
사용: python3 tools/serve.py [포트=8732]  (저장소 루트에서)"""
import http.server, sys

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8732
# 동시 연결 대기열을 늘린다 (기본 5 — 첫 화면에 수십 개를 한꺼번에 요청하면 가끔 연결이 끊겨 모듈·모델을 못 받았다)
http.server.ThreadingHTTPServer.request_queue_size = 128
http.server.ThreadingHTTPServer(('', port), NoCache).serve_forever()
