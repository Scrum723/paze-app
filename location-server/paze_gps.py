#!/usr/bin/env python3
"""PAZE Native macOS Location Server — uses CoreLocation (Wi-Fi positioning)."""

import json
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

from CoreLocation import CLLocationManager
from Foundation import NSObject, NSRunLoop, NSDefaultRunLoopMode
import objc

PORT = 8765
latest = {"ok": False, "error": "Starting location service…"}


class LocationDelegate(NSObject):
    def init(self):
        self = objc.super(LocationDelegate, self).init()
        if self is None:
            return None
        self.manager = CLLocationManager.alloc().init()
        self.manager.setDelegate_(self)
        self.manager.setDesiredAccuracy_(0)  # kCLLocationAccuracyBest
        return self

    def start(self):
        global latest
        if not CLLocationManager.locationServicesEnabled():
            latest = {"ok": False, "error": "Location Services OFF — enable in System Settings → Privacy → Location Services"}
            return
        self.manager.requestWhenInUseAuthorization()
        self.manager.startUpdatingLocation()
        latest = {"ok": False, "error": "Waiting for fix — allow location for Python/Terminal in System Settings"}

    def locationManager_didUpdateLocations_(self, manager, locations):
        global latest
        loc = locations[-1]
        latest = {
            "ok": True,
            "lat": loc.coordinate().latitude,
            "lng": loc.coordinate().longitude,
            "accuracy": loc.horizontalAccuracy(),
            "source": "macos-corelocation",
        }
        print(f"GPS fix: {latest['lat']:.5f}, {latest['lng']:.5f} (±{latest['accuracy']:.0f}m)", flush=True)

    def locationManager_didFailWithError_(self, manager, error):
        global latest
        err = str(error)
        if "Code=1" in err:
            latest = {"ok": False, "error": "DENIED — System Settings → Privacy → Location Services → enable PAZE GPS (or Python)"}
        else:
            latest = {"ok": False, "error": err}

    def locationManagerDidChangeAuthorization_(self, manager):
        status = manager.authorizationStatus()
        # 0=notDetermined, 3=authorizedAlways, 4=authorizedWhenInUse, 2=denied, 1=restricted
        if status in (3, 4):
            manager.startUpdatingLocation()
        elif status == 2:
            global latest
            latest = {"ok": False, "error": "Location DENIED — System Settings → Privacy → Location → enable Python or Terminal"}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(latest).encode())

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.end_headers()


def run_http():
    server = HTTPServer(("127.0.0.1", PORT), Handler)
    print(f"PAZE GPS server: http://127.0.0.1:{PORT}", flush=True)
    server.serve_forever()


def run_location_loop():
    from Foundation import NSDate
    delegate = LocationDelegate.alloc().init()
    delegate.start()
    run_loop = NSRunLoop.currentRunLoop()
    while True:
        run_loop.runMode_beforeDate_(NSDefaultRunLoopMode, NSDate.dateWithTimeIntervalSinceNow_(0.2))


if __name__ == "__main__":
    threading.Thread(target=run_http, daemon=True).start()
    time.sleep(0.5)
    run_location_loop()