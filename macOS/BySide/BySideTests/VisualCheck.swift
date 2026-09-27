import AppKit
import SwiftUI

@main
struct VisualCheck {
    @MainActor static func main() throws {
        let app = NSApplication.shared
        app.setActivationPolicy(.accessory)
        let model = AppModel()
        model.comparisonEnabled = false
        model.layout = .sideBySide
        model.rulerVisible = true
        let loaded = try FullResolutionImageLoader.load(URL(fileURLWithPath: CommandLine.arguments[1]))
        model.images = [loaded, loaded]
        let host = NSHostingView(rootView: ContentView().environmentObject(model))
        let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1180, height: 760),
                              styleMask: [.titled, .closable, .resizable], backing: .buffered, defer: false)
        window.contentView = host
        window.orderFront(nil)
        RunLoop.main.run(until: Date(timeIntervalSinceNow: 2))
        host.layoutSubtreeIfNeeded()
        func inspect(_ view: NSView) {
            if let canvas = view as? SharpImageCanvas {
                print("CANVAS", canvas.frame, "bounds", canvas.bounds)
                precondition(canvas.bounds.width > 400 && canvas.bounds.width < 650)
                precondition(canvas.bounds.height > 500)
            }
            view.subviews.forEach(inspect)
        }
        inspect(host)
        guard let bitmap = host.bitmapImageRepForCachingDisplay(in: host.bounds) else { fatalError("No bitmap") }
        host.cacheDisplay(in: host.bounds, to: bitmap)
        try bitmap.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: CommandLine.arguments[2]))
        print("SNAPSHOT", CommandLine.arguments[2])
    }
}
