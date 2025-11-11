"""
Simple HTTPS server for testing WebAR application
Requires HTTPS for camera access on mobile devices
"""

import http.server
import ssl
import os

PORT = 8443

# Create self-signed certificate if it doesn't exist
if not os.path.exists('cert.pem'):
    print("Generating self-signed certificate...")
    os.system('openssl req -new -x509 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost"')

class CORSHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        super().end_headers()

print(f"Starting HTTPS server on port {PORT}...")
print(f"Open https://localhost:{PORT} in your browser")
print("Note: You'll need to accept the self-signed certificate warning")

httpd = http.server.HTTPServer(('0.0.0.0', PORT), CORSHTTPRequestHandler)

context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain('cert.pem', 'key.pem')

httpd.socket = context.wrap_socket(httpd.socket, server_side=True)

try:
    httpd.serve_forever()
except KeyboardInterrupt:
    print("\nServer stopped.")