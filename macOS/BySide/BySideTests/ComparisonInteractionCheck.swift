import AppKit
import SwiftUI

@main
struct ComparisonInteractionCheck {
    @MainActor static func main() throws {
        NSApplication.shared.setActivationPolicy(.accessory)
        let model = AppModel()
        model.comparisonEnabled = true
        model.layout = CommandLine.arguments.contains("stacked") ? .stacked : .sideBySide
        model.comparisonPosition = 0.5
        model.rulerVisible = false
        let loaded = try FullResolutionImageLoader.load(URL(fileURLWithPath: CommandLine.arguments[1]))
        model.images = [loaded, loaded]
        model.setZoom(2.35)
        let host = NSHostingView(rootView: ContentView().environmentObject(model))
        let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1180, height: 760),
            styleMask: [.titled, .closable, .resizable, .fullSizeContentView], backing: .buffered, defer: false)
        window.titlebarAppearsTransparent = true
        window.contentView = host
        window.orderFront(nil)
        RunLoop.main.run(until: Date(timeIntervalSinceNow: 1))
        host.layoutSubtreeIfNeeded()
        var failures = 0
        let points = model.layout == .sideBySide
            ? [CGPoint(x: 160, y: 300), CGPoint(x: 1000, y: 300)]
            : [CGPoint(x: 160, y: 230), CGPoint(x: 1000, y: 600)]
        for point in points {
            let hit = host.hitTest(point)
            print("HIT", point, String(describing: hit))
            guard let canvas = hit as? SharpImageCanvas else { failures += 1; continue }
            precondition(canvas.comparisonLayout == model.layout)
            let frameInWindow = canvas.convert(canvas.bounds, to: nil)
            print("IMAGE EXTENT", frameInWindow, "WINDOW HEIGHT", window.frame.height)
            precondition(abs(frameInWindow.maxY - window.frame.height) < 1, "Image must extend under titlebar")
            let start = host.convert(point, to: nil)
            let end = CGPoint(x: start.x + 40, y: start.y + 20)
            let original = model.transform.offset
            let divider = model.comparisonPosition
            func event(_ type: NSEvent.EventType, _ location: CGPoint) -> NSEvent {
                NSEvent.mouseEvent(with: type, location: location, modifierFlags: [], timestamp: 0,
                    windowNumber: window.windowNumber, context: nil, eventNumber: 0, clickCount: 1, pressure: 1)!
            }
            canvas.mouseDown(with: event(.leftMouseDown, start))
            canvas.mouseDragged(with: event(.leftMouseDragged, end))
            canvas.mouseUp(with: event(.leftMouseUp, end))
            precondition(model.transform.offset != original, "Image must pan")
            precondition(model.comparisonPosition == divider, "Image pan must not move divider")
        }
        let centerHit = host.hitTest(CGPoint(x: host.bounds.midX, y: host.bounds.midY))
        precondition(!(centerHit is SharpImageCanvas), "Divider must keep its own hit region")
        print("FAILED IMAGE HIT REGIONS:", failures)
        if failures > 0 { exit(1) }
        print("PASS: both image regions pan; divider retains separate hit region")
    }
}
