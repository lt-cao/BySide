import SwiftUI

struct CompareToolbar: View {
    @ObservedObject var model: AppModel

    var body: some View {
        HStack(spacing: 12) {
            metadata(model.images[0], side: 0)
                .frame(maxWidth: .infinity, alignment: .leading)
            controls.fixedSize(horizontal: true, vertical: false)
            metadata(model.images[1], side: 1)
                .frame(maxWidth: .infinity, alignment: .trailing)
        }
        .padding(.horizontal, 16)
        .frame(height: 54)
        .modifier(ToolbarGlass())
        .environment(\.colorScheme, .dark)
    }

    private var controls: some View {
        HStack(spacing: 8) {
            tool("minus.magnifyingglass", "Thu nhỏ") { model.setZoom(model.transform.scale / 1.2) }
            Slider(value: Binding(get: { Double(model.transform.scale) }, set: { model.setZoom(CGFloat($0)) }), in: 0.1...15)
                .frame(width: 100).controlSize(.small).help("Mức phóng đại")
            tool("plus.magnifyingglass", "Phóng to") { model.setZoom(model.transform.scale * 1.2) }
            Button { model.resetView() } label: {
                Text(verbatim: "\(Int((model.transform.scale * 100).rounded()))%")
                    .font(.system(size: 12, weight: .medium, design: .monospaced))
                    .fixedSize().frame(width: 58)
            }.buttonStyle(.plain).help("Vừa cửa sổ")
            Divider().frame(height: 18).padding(.horizontal, 2)
            tool(model.layout == .sideBySide ? "rectangle.split.2x1" : "rectangle.split.1x2", "Đổi bố cục") { model.toggleLayout() }
            tool("square.lefthalf.filled", "Thanh so sánh", active: model.comparisonEnabled) { model.toggleComparison() }
            Menu {
                Toggle("Hiện thước", isOn: Binding(get: { model.rulerVisible }, set: { _ in model.toggleRuler() }))
                Picker("Đơn vị", selection: Binding(get: { model.rulerUnit }, set: { model.setRulerUnit($0) })) {
                    ForEach(RulerUnit.allCases) { Text($0.shortName).tag($0) }
                }
            } label: {
                Image(systemName: "ruler").font(.system(size: 14)).frame(width: 30, height: 30)
            }.menuStyle(.borderlessButton).fixedSize().help("Thước đo và đơn vị")
        }
    }

    private func tool(_ symbol: String, _ title: String, active: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol).font(.system(size: 14, weight: .medium))
                .foregroundStyle(active ? Color.accentColor : Color.primary)
                .frame(width: 30, height: 30)
                .background(active ? Color.accentColor.opacity(0.12) : Color.clear, in: RoundedRectangle(cornerRadius: 8))
        }.buttonStyle(.plain).help(title).accessibilityLabel(title)
    }

    private func metadata(_ image: LoadedImage?, side: Int) -> some View {
        VStack(alignment: side == 0 ? .leading : .trailing, spacing: 3) {
            Text(image?.fileName ?? "Ảnh \(side + 1)")
                .font(.system(size: 12, weight: .medium))
                .lineLimit(1).truncationMode(.middle)
            Text(image?.metadataSummary ?? "Chưa có ảnh")
                .font(.system(size: 10)).foregroundStyle(.secondary)
                .lineLimit(1).truncationMode(.middle)
        }.help(image.map { "\($0.fileName)\n\($0.metadataSummary)" } ?? "Kéo thả ảnh vào ô bên dưới")
    }
}

private struct ToolbarGlass: ViewModifier {
    func body(content: Content) -> some View {
        if #available(macOS 26.0, *) {
            content.glassEffect(.regular, in: RoundedRectangle(cornerRadius: 18))
        } else {
            content.background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 18))
                .overlay(RoundedRectangle(cornerRadius: 18).stroke(.white.opacity(0.14), lineWidth: 0.5))
        }
    }
}
