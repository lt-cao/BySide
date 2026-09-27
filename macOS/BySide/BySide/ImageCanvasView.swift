import AppKit
import SwiftUI

struct ImageCanvasView: NSViewRepresentable {
    var foregroundImage: LoadedImage?
    var backgroundImage: LoadedImage?
    var comparisonPosition: CGFloat?
    var comparisonLayout: CompareLayout = .sideBySide
    var transform: ViewTransform
    var onPan: (CGSize) -> Void
    var onZoom: (CGFloat, CGPoint, CGSize) -> Void
    var onResetView: () -> Void

    func makeNSView(context: Context) -> SharpImageCanvas {
        let view = SharpImageCanvas()
        update(view)
        return view
    }

    func updateNSView(_ nsView: SharpImageCanvas, context: Context) {
        update(nsView)
    }

    private func update(_ view: SharpImageCanvas) {
        view.foregroundImage = foregroundImage
        view.backgroundImage = backgroundImage
        view.comparisonPosition = comparisonPosition
        view.comparisonLayout = comparisonLayout
        view.transform = transform
        view.onPan = onPan
        view.onZoom = onZoom
        view.onResetView = onResetView
        view.needsDisplay = true
    }
}

final class SharpImageCanvas: NSView {
    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        wantsLayer = true
        layer?.masksToBounds = true
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) is unavailable") }
    var foregroundImage: LoadedImage?
    var backgroundImage: LoadedImage?
    var comparisonPosition: CGFloat?
    var comparisonLayout: CompareLayout = .sideBySide
    var transform = ViewTransform.identity
    var onPan: ((CGSize) -> Void)?
    var onZoom: ((CGFloat, CGPoint, CGSize) -> Void)?
    var onResetView: (() -> Void)?

    private var lastDragPoint: CGPoint?
    private var zoomKeyHeld = false

    override var isFlipped: Bool { true }
    override var acceptsFirstResponder: Bool { true }

    override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        NSGraphicsContext.saveGraphicsState()
        defer { NSGraphicsContext.restoreGraphicsState() }
        NSBezierPath(rect: bounds).addClip()
        NSColor(calibratedWhite: 0.115, alpha: 1).setFill()
        bounds.fill()

        if let comparisonPosition {
            if let backgroundImage { draw(backgroundImage) }
            if let foregroundImage {
                NSGraphicsContext.saveGraphicsState()
                NSBezierPath(rect: NSRect(
                    x: 0,
                    y: 0,
                    width: comparisonLayout == .sideBySide ? bounds.width * comparisonPosition : bounds.width,
                    height: comparisonLayout == .stacked ? bounds.height * comparisonPosition : bounds.height
                )).addClip()
                draw(foregroundImage)
                NSGraphicsContext.restoreGraphicsState()
            }
        } else if let foregroundImage {
            draw(foregroundImage)
        }
    }

    func imageRect(for loaded: LoadedImage) -> CGRect {
        guard loaded.width > 0, loaded.height > 0, bounds.width > 0, bounds.height > 0 else { return .zero }
        let fitScale = min(
            bounds.width / CGFloat(loaded.width),
            bounds.height / CGFloat(loaded.height)
        )
        let width = CGFloat(loaded.width) * fitScale * transform.scale
        let height = CGFloat(loaded.height) * fitScale * transform.scale
        return CGRect(
            x: (bounds.width - width) / 2 + transform.offset.width,
            y: (bounds.height - height) / 2 + transform.offset.height,
            width: width,
            height: height
        )
    }

    private func draw(_ loaded: LoadedImage) {
        let rect = imageRect(for: loaded)
        guard !rect.isEmpty else { return }

        // Use the full NSBitmapImageRep. At or above one source pixel per display pixel,
        // disable interpolation so zoom reveals original pixels instead of a blurred preview.
        let backingScale = window?.backingScaleFactor ?? NSScreen.main?.backingScaleFactor ?? 1
        let physicalPixelsPerSourcePixel = rect.width * backingScale / CGFloat(loaded.width)
        let interpolation: NSImageInterpolation = physicalPixelsPerSourcePixel >= 1 ? .none : .high
        loaded.image.draw(
            in: rect,
            from: NSRect(x: 0, y: 0, width: loaded.image.size.width, height: loaded.image.size.height),
            operation: .copy,
            fraction: 1,
            respectFlipped: true,
            hints: [.interpolation: interpolation]
        )
    }

    override func mouseDown(with event: NSEvent) {
        window?.makeFirstResponder(self)
        lastDragPoint = convert(event.locationInWindow, from: nil)
        if event.clickCount == 2 { onResetView?() }
    }

    override func mouseDragged(with event: NSEvent) {
        let point = convert(event.locationInWindow, from: nil)
        guard let lastDragPoint else {
            self.lastDragPoint = point
            return
        }
        let delta = CGSize(width: point.x - lastDragPoint.x, height: point.y - lastDragPoint.y)
        if zoomKeyHeld {
            let raw = abs(delta.width) >= abs(delta.height) ? delta.width : -delta.height
            let direction = event.modifierFlags.contains(.option) ? -abs(raw) : raw
            onZoom?(pow(1.018, direction), point, bounds.size)
        } else {
            onPan?(delta)
        }
        self.lastDragPoint = point
    }

    override func mouseUp(with event: NSEvent) {
        lastDragPoint = nil
    }

    override func keyDown(with event: NSEvent) {
        if event.charactersIgnoringModifiers?.lowercased() == "z" { zoomKeyHeld = true }
        else { super.keyDown(with: event) }
    }
    override func keyUp(with event: NSEvent) {
        if event.charactersIgnoringModifiers?.lowercased() == "z" { zoomKeyHeld = false }
        else { super.keyUp(with: event) }
    }
    override func resignFirstResponder() -> Bool {
        zoomKeyHeld = false
        lastDragPoint = nil
        return super.resignFirstResponder()
    }

    override func scrollWheel(with event: NSEvent) {
        let point = convert(event.locationInWindow, from: nil)
        let sensitivity: CGFloat = event.hasPreciseScrollingDeltas ? 0.012 : 0.06
        let factor = exp(event.scrollingDeltaY * sensitivity)
        onZoom?(factor, point, bounds.size)
    }

    override func magnify(with event: NSEvent) {
        let point = convert(event.locationInWindow, from: nil)
        onZoom?(max(0.1, 1 + event.magnification), point, bounds.size)
    }
}
