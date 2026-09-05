#!/usr/bin/env python3
"""
PAZE Native Desktop OS Application Runner
Runs PAZE as a standalone native desktop program with integrated macOS CoreLocation GPS.
"""

import os
import sys
import time
import socket
import threading
import subprocess
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, '..'))
WEB_DIR = os.path.join(PROJECT_DIR, 'web')
LOCATION_SERVER_SCRIPT = os.path.join(PROJECT_DIR, 'location-server', 'paze_gps.py')

def find_free_port(start_port=8080):
    for port in range(start_port, start_port + 50):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(('127.0.0.1', port)) != 0:
                return port
    return start_port

class PazeHTTPHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PROJECT_DIR, **kwargs)

    def log_message(self, format, *args):
        # Suppress noisy tile requests
        pass

def start_gps_daemon():
    """Starts the native macOS CoreLocation daemon if available."""
    if sys.platform == 'darwin' and os.path.exists(LOCATION_SERVER_SCRIPT):
        try:
            print("[PAZE OS] Launching native macOS CoreLocation daemon...")
            proc = subprocess.Popen(
                [sys.executable, LOCATION_SERVER_SCRIPT],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            return proc
        except Exception as e:
            print(f"[PAZE OS] Note: CoreLocation daemon could not be started: {e}")
    return None

def main():
    print("=" * 60)
    print("  PAZE — Native Desktop OS Program")
    print("  Drive. Report. Get Paid.")
    print("=" * 60)

    # 1. Start CoreLocation helper
    gps_proc = start_gps_daemon()

    # 2. Find port and start HTTP server
    port = find_free_port(8080)
    server = ThreadingHTTPServer(('127.0.0.1', port), PazeHTTPHandler)
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    app_url = f"http://127.0.0.1:{port}/web/index.html"
    print(f"[PAZE OS] Server running at {app_url}")

    # 3. Launch desktop window
    # Try launching in dedicated app-window mode (Chrome/Edge/Brave/Safari app mode)
    opened = False
    if sys.platform == 'darwin':
        # Check for Google Chrome / Brave / Edge app mode
        app_candidates = [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        ]
        for app_bin in app_candidates:
            if os.path.exists(app_bin):
                try:
                    subprocess.Popen([app_bin, f"--app={app_url}", "--window-size=1200,820"])
                    opened = True
                    print(f"[PAZE OS] Opened standalone desktop window via {os.path.basename(app_bin)}")
                    break
                except Exception:
                    pass

    if not opened:
        print("[PAZE OS] Opening in default desktop browser...")
        webbrowser.open(app_url)

    print("\nPAZE Desktop is running. Press Ctrl+C in this terminal to exit.\n")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[PAZE OS] Shutting down...")
        if gps_proc:
            gps_proc.terminate()
        server.shutdown()
        print("[PAZE OS] Exited.")

if __name__ == '__main__':
    main()
