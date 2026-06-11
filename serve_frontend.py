import http.server
import socketserver
import os

PORT = 5173
DIRECTORY = "dist"

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        path = self.translate_path(self.path)
        if not os.path.exists(path):
            self.path = "/"
        return super().do_GET()

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Serving {DIRECTORY} at port {PORT}")
    httpd.serve_forever()
