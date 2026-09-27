import AppKit
import Combine
import ImageIO
import UniformTypeIdentifiers

struct ViewTransform: Equatable {
    var scale: CGFloat = 1
    var offset: CGSize = .zero

    static let identity = ViewTransform()

    func zoomed(by factor: CGFloat, around point: CGPoint, in size: CGSize) -> ViewTransform {
        let nextScale = min(max(scale * factor, 0.1), 15)
        guard scale > 0, nextScale != scale else { return self }

        let center = CGPoint(x: size.width / 2, y: size.height / 2)
        let relative = CGPoint(
            x: point.x - center.x - offset.width,
            y: point.y - center.y - offset.height
        )
        let ratio = nextScale / scale
        return ViewTransform(
            scale: nextScale,
            offset: CGSize(
                width: point.x - center.x - relative.x * ratio,
                height: point.y - center.y - relative.y * ratio
            )
        )
    }
}

enum CompareLayout: String, CaseIterable {
    case sideBySide
    case stacked
}

enum RulerUnit: String, CaseIterable, Identifiable {
    case pixels
    case points
    case inches
    case centimeters

    var id: String { rawValue }

    var shortName: String {
        switch self {
        case .pixels: "px"
        case .points: "pt"
        case .inches: "in"
        case .centimeters: "cm"
        }
    }
}

struct LoadedImage: Identifiable {
    let id = UUID()
    let url: URL
    let image: NSImage
    let width: Int
    let height: Int
    let colorSpace: String
    let dpi: CGFloat?
    let fileSize: Int64

    var fileName: String { url.lastPathComponent }

    var metadataSummary: String {
        let dpiText = dpi.map { String(format: "%.0f", $0) } ?? "—"
        return "\(width)x\(height)px  |  \(colorSpace)  |  \(dpiText) DPI"
    }
}

enum ImageLoadError: LocalizedError {
    case unsupported
    case unreadable

    var errorDescription: String? {
        switch self {
        case .unsupported: "Định dạng ảnh này chưa được macOS hỗ trợ."
        case .unreadable: "Không thể đọc dữ liệu ảnh."
        }
    }
}

enum FullResolutionImageLoader {
    static func load(_ url: URL) throws -> LoadedImage {
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else {
            throw ImageLoadError.unsupported
        }
        guard let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
              let cgImage = CGImageSourceCreateImageAtIndex(
                source,
                0,
                [
                    kCGImageSourceShouldCache: true,
                    kCGImageSourceShouldCacheImmediately: true
                ] as CFDictionary
              ) else {
            throw ImageLoadError.unreadable
        }

        let width = (properties[kCGImagePropertyPixelWidth] as? NSNumber)?.intValue ?? cgImage.width
        let height = (properties[kCGImagePropertyPixelHeight] as? NSNumber)?.intValue ?? cgImage.height
        let dpiWidth = (properties[kCGImagePropertyDPIWidth] as? NSNumber)?.doubleValue
        let dpiHeight = (properties[kCGImagePropertyDPIHeight] as? NSNumber)?.doubleValue
        let dpiValues = [dpiWidth, dpiHeight].compactMap { $0 }.filter { $0 > 0 }
        let dpi = dpiValues.isEmpty ? nil : CGFloat(dpiValues.reduce(0, +) / Double(dpiValues.count))
        let colorModel = (properties[kCGImagePropertyColorModel] as? String)
            ?? cgImage.colorSpace?.name.map { $0 as String }
            ?? "Color —"
        let fileSize = (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize).map(Int64.init) ?? 0

        // NSImage wraps the original CGImage. No thumbnail or downsampled copy is created.
        let image = NSImage(
            cgImage: cgImage,
            size: NSSize(width: cgImage.width, height: cgImage.height)
        )
        return LoadedImage(
            url: url,
            image: image,
            width: width,
            height: height,
            colorSpace: friendlyColorSpace(colorModel),
            dpi: dpi,
            fileSize: fileSize
        )
    }

    private static func friendlyColorSpace(_ value: String) -> String {
        let lower = value.lowercased()
        if lower.contains("gray") || lower.contains("mono") { return "Gray" }
        if lower.contains("cmyk") { return "CMYK" }
        if lower.contains("rgb") { return "RGB" }
        return value
    }
}

@MainActor
final class AppModel: ObservableObject {
    @Published var images: [LoadedImage?] = [nil, nil]
    @Published var loading: [Bool] = [false, false]
    @Published var transform = ViewTransform.identity
    @Published var layout: CompareLayout
    @Published var comparisonEnabled: Bool
    @Published var comparisonPosition: CGFloat
    @Published var rulerVisible: Bool
    @Published var rulerUnit: RulerUnit
    @Published var dropTargets: Set<Int> = []
    @Published var errorMessage: String?
    @Published var settingsPresented = false

    private let defaults = UserDefaults.standard
    var viewportSize: CGSize = .zero
    private var loadIDs = [UUID(), UUID()]
    private static let supportedExtensions = Set(["png", "jpg", "jpeg", "webp", "gif", "bmp", "tif", "tiff", "ico"])

    init() {
        layout = CompareLayout(rawValue: defaults.string(forKey: "compareLayout") ?? "") ?? .sideBySide
        comparisonEnabled = defaults.bool(forKey: "comparisonEnabled")
        let savedPosition = defaults.double(forKey: "comparisonPosition")
        comparisonPosition = defaults.object(forKey: "comparisonPosition") == nil ? 0.5 : min(max(CGFloat(savedPosition), 0), 1)
        rulerVisible = defaults.bool(forKey: "rulerVisible")
        rulerUnit = RulerUnit(rawValue: defaults.string(forKey: "rulerUnit") ?? "") ?? .pixels
    }

    func chooseImage(for side: Int) {
        let panel = NSOpenPanel()
        panel.title = "Chọn ảnh \(side + 1)"
        panel.allowsMultipleSelection = false
        panel.canChooseDirectories = false
        panel.allowedContentTypes = [.image]
        guard panel.runModal() == .OK, let url = panel.url else { return }
        load(url, into: side)
    }

    func openFromFinder(_ url: URL) {
        let side = images[0] == nil && !loading[0] ? 0 : (images[1] == nil && !loading[1] ? 1 : 0)
        load(url, into: side)
    }

    func openDropped(_ urls: [URL], target: Int) {
        let valid = urls.filter(Self.isSupportedImage)
        guard !valid.isEmpty else {
            errorMessage = "Không tìm thấy file ảnh được hỗ trợ trong nội dung vừa thả."
            return
        }
        if valid.count >= 2 {
            load(valid[0], into: 0)
            load(valid[1], into: 1)
        } else {
            load(valid[0], into: target)
        }
    }

    func load(_ url: URL, into side: Int) {
        guard images.indices.contains(side), Self.isSupportedImage(url) else {
            errorMessage = "Định dạng ảnh này chưa được hỗ trợ."
            return
        }
        loading[side] = true
        let loadID = UUID()
        loadIDs[side] = loadID
        errorMessage = nil
        let didAccess = url.startAccessingSecurityScopedResource()

        DispatchQueue.global(qos: .userInitiated).async {
            let result = Result { try FullResolutionImageLoader.load(url) }
            DispatchQueue.main.async { [weak self] in
                if didAccess { url.stopAccessingSecurityScopedResource() }
                guard let self, self.loadIDs[side] == loadID else { return }
                self.loading[side] = false
                switch result {
                case .success(let loaded):
                    self.images[side] = loaded
                case .failure(let error):
                    self.errorMessage = error.localizedDescription
                }
            }
        }
    }

    func reload(_ side: Int) {
        guard images.indices.contains(side), let url = images[side]?.url else { return }
        load(url, into: side)
    }

    func closeAll() {
        loadIDs = [UUID(), UUID()]
        images = [nil, nil]
        loading = [false, false]
        transform = .identity
    }

    func resetView() {
        transform = .identity
    }

    func pan(by delta: CGSize) {
        transform.offset.width += delta.width
        transform.offset.height += delta.height
        clampPan()
    }

    func zoom(by factor: CGFloat, around point: CGPoint, in size: CGSize) {
        transform = transform.zoomed(by: factor, around: point, in: size)
        clampPan()
    }

    func setZoom(_ value: CGFloat) {
        transform.scale = min(max(value, 0.1), 15)
        clampPan()
    }

    private func clampPan() {
        var size = viewportSize
        if !comparisonEnabled {
            if layout == .sideBySide { size.width = max(0, (size.width - 1) / 2) }
            else { size.height = max(0, (size.height - 1) / 2) }
        }
        guard size.width > 0, size.height > 0 else { return }
        let limits = images.compactMap { $0 }.map { image -> CGSize in
            let fit = min(size.width / CGFloat(image.width), size.height / CGFloat(image.height))
            return CGSize(width: max(CGFloat(image.width) * fit * transform.scale, size.width) / 2,
                          height: max(CGFloat(image.height) * fit * transform.scale, size.height) / 2)
        }
        guard let x = limits.map(\.width).min(), let y = limits.map(\.height).min() else { return }
        transform.offset.width = min(max(transform.offset.width, -x), x)
        transform.offset.height = min(max(transform.offset.height, -y), y)
    }

    func toggleLayout() {
        layout = layout == .sideBySide ? .stacked : .sideBySide
        defaults.set(layout.rawValue, forKey: "compareLayout")
    }

    func toggleComparison() {
        comparisonEnabled.toggle()
        defaults.set(comparisonEnabled, forKey: "comparisonEnabled")
    }

    func setComparisonPosition(_ value: CGFloat) {
        comparisonPosition = min(max(value, 0), 1)
        defaults.set(Double(comparisonPosition), forKey: "comparisonPosition")
    }

    func toggleRuler() {
        rulerVisible.toggle()
        defaults.set(rulerVisible, forKey: "rulerVisible")
    }

    func setRulerUnit(_ unit: RulerUnit) {
        rulerUnit = unit
        defaults.set(unit.rawValue, forKey: "rulerUnit")
    }

    func reveal(_ side: Int) {
        guard images.indices.contains(side), let url = images[side]?.url else { return }
        NSWorkspace.shared.activateFileViewerSelecting([url])
    }

    func openWith(_ side: Int) {
        guard images.indices.contains(side), let imageURL = images[side]?.url else { return }
        let panel = NSOpenPanel()
        panel.title = "Chọn ứng dụng để mở ảnh"
        panel.prompt = "Mở"
        panel.directoryURL = URL(fileURLWithPath: "/Applications", isDirectory: true)
        panel.allowedContentTypes = [.application]
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = false
        guard panel.runModal() == .OK, let applicationURL = panel.url else { return }

        let configuration = NSWorkspace.OpenConfiguration()
        NSWorkspace.shared.open(
            [imageURL],
            withApplicationAt: applicationURL,
            configuration: configuration
        ) { [weak self] _, error in
            if let error {
                DispatchQueue.main.async { self?.errorMessage = error.localizedDescription }
            }
        }
    }

    private static func isSupportedImage(_ url: URL) -> Bool {
        supportedExtensions.contains(url.pathExtension.lowercased())
    }
}
