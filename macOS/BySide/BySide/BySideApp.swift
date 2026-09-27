import SwiftUI

@main
struct BySideApp: App {
    @StateObject private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(model)
                .background(WindowAppearance())
        }
        .windowStyle(.hiddenTitleBar)
        .defaultSize(width: 1180, height: 760)
        .commands {
            CommandGroup(replacing: .newItem) {
                Button("Mở ảnh bên trái…") { model.chooseImage(for: 0) }
                    .keyboardShortcut("o")
                Button("Mở ảnh bên phải…") { model.chooseImage(for: 1) }
                    .keyboardShortcut("o", modifiers: [.command, .shift])
                Divider()
                Button("Tắt hết ảnh") { model.closeAll() }
                    .keyboardShortcut("w", modifiers: [.command, .option])
            }
            CommandMenu("Hiển thị") {
                Button("Vừa cửa sổ") { model.resetView() }
                    .keyboardShortcut("0", modifiers: .command)
                Button(model.layout == .sideBySide ? "Chia trên dưới" : "Chia trái phải") {
                    model.toggleLayout()
                }
                Button(model.comparisonEnabled ? "Tắt thanh so sánh" : "Bật thanh so sánh") {
                    model.toggleComparison()
                }
                Button(model.rulerVisible ? "Ẩn thước" : "Hiện thước") {
                    model.toggleRuler()
                }
            }
        }

        Settings {
            SettingsView()
        }
    }
}

private struct WindowAppearance: NSViewRepresentable {
    func makeNSView(context: Context) -> NSView { WindowAppearanceView() }
    func updateNSView(_ nsView: NSView, context: Context) { }
}

private final class WindowAppearanceView: NSView {
    private var titlebarDoubleClickMonitor: Any?

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()

        if let monitor = titlebarDoubleClickMonitor {
            NSEvent.removeMonitor(monitor)
            titlebarDoubleClickMonitor = nil
        }

        window?.titleVisibility = .hidden
        window?.titlebarAppearsTransparent = true
        window?.styleMask.insert(.fullSizeContentView)
        window?.isMovableByWindowBackground = false

        guard window != nil else { return }
        titlebarDoubleClickMonitor = NSEvent.addLocalMonitorForEvents(matching: .leftMouseDown) { [weak self] event in
            guard let window = self?.window,
                  event.window === window,
                  event.clickCount == 2,
                  !window.styleMask.contains(.fullScreen),
                  let contentView = window.contentView else { return event }

            let point = event.locationInWindow
            let contentFrame = contentView.convert(contentView.bounds, to: nil)
            // The floating toolbar starts 36 points below the top edge.
            guard point.y >= contentFrame.maxY - 36,
                  point.y <= contentFrame.maxY,
                  point.x >= contentFrame.minX,
                  point.x <= contentFrame.maxX else { return event }

            // Leave the native close, minimize and full-screen buttons alone.
            for buttonType: NSWindow.ButtonType in [.closeButton, .miniaturizeButton, .zoomButton] {
                if let button = window.standardWindowButton(buttonType),
                   button.convert(button.bounds, to: nil).insetBy(dx: -4, dy: -4).contains(point) {
                    return event
                }
            }

            window.performZoom(nil)
            return nil
        }
    }

    deinit {
        if let monitor = titlebarDoubleClickMonitor {
            NSEvent.removeMonitor(monitor)
        }
    }
}
