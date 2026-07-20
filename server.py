from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os

class StaticHandler(SimpleHTTPRequestHandler):
    def do_POST(self):
        self.send_error(404, "Not Found")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8080"))
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    ThreadingHTTPServer(("0.0.0.0", port), StaticHandler).serve_forever()
