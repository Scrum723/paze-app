import Foundation
import CoreLocation

final class LocDelegate: NSObject, CLLocationManagerDelegate {
    var latest: CLLocation?
    let mgr = CLLocationManager()

    override init() {
        super.init()
        mgr.delegate = self
        mgr.desiredAccuracy = kCLLocationAccuracyBest
    }

    func start() {
        mgr.requestWhenInUseAuthorization()
        mgr.startUpdatingLocation()
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let s = manager.authorizationStatus
        if s == .authorizedAlways || s == .authorizedWhenInUse {
            manager.startUpdatingLocation()
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        latest = locations.last
    }
}

let delegate = LocDelegate()
delegate.start()

let port: UInt16 = 8765
let server = DispatchSource.makeReadSource(fileDescriptor: socket(AF_INET, SOCK_STREAM, 0), queue: .main)
var addr = sockaddr_in(sin_len: 0, sin_family: 0, sin_port: port.bigEndian, sin_addr: in_addr(s_addr: inet_addr("127.0.0.1")), sin_zero: (0,0,0,0,0,0,0,0))
let fd = (server as! DispatchSourceRead).handle
var yes: Int32 = 1
setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &yes, socklen_t(MemoryLayout<Int32>.size))
withUnsafePointer(to: &addr) { bind(fd, $0.withMemoryRebound(to: sockaddr.self, capacity: 1) { $0 }, socklen_t(MemoryLayout<sockaddr_in>.size)) }
listen(fd, 5)

fputs("PAZE Location Server listening on http://127.0.0.1:\(port)\n", stderr)

while true {
    var clientAddr = sockaddr()
    var len = socklen_t(MemoryLayout<sockaddr>.size)
    let client = accept(fd, &clientAddr, &len)
    guard client >= 0 else { continue }

    var buf = [UInt8](repeating: 0, count: 1024)
    _ = read(client, &buf, 1024)

    let body: String
    if let loc = delegate.latest {
        body = "{\"ok\":true,\"lat\":\(loc.coordinate.latitude),\"lng\":\(loc.coordinate.longitude),\"accuracy\":\(loc.horizontalAccuracy),\"source\":\"macos-native\"}"
    } else {
        body = "{\"ok\":false,\"error\":\"Waiting for location — allow Location Services for Terminal/PazeLocationServer in System Settings\"}"
    }
    let resp = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\nContent-Length: \(body.utf8.count)\r\n\r\n\(body)"
    write(client, resp, resp.utf8.count)
    close(client)
}