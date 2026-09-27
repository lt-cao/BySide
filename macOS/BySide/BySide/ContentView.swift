import SwiftUI
import UniformTypeIdentifiers

struct ContentView: View {
  @EnvironmentObject private var model: AppModel

  var body: some View {
    VStack(spacing: 0) {
      GeometryReader { geometry in
        workspace
          .frame(width: geometry.size.width, height: geometry.size.height)
          .clipped()
          .onAppear { model.viewportSize = geometry.size }
          .onChange(of: geometry.size) { model.viewportSize = $0 }
      }
    }
    .frame(minWidth: 760, minHeight: 480)
    .overlay(alignment: .top) {
      CompareToolbar(model: model)
        .padding(.horizontal, 12)
        .padding(.top, 36)
    }
    .ignoresSafeArea(.container, edges: .top)
    .background(Color(nsColor: NSColor(calibratedWhite: 0.09, alpha: 1)))
    .alert(
      "BySide",
      isPresented: Binding(
        get: { model.errorMessage != nil },
        set: { if !$0 { model.errorMessage = nil } }
      )
    ) {
      Button("Đóng", role: .cancel) { model.errorMessage = nil }
    } message: {
      Text(model.errorMessage ?? "")
    }
    .onOpenURL { model.openFromFinder($0) }
    .sheet(isPresented: $model.settingsPresented) {
      VStack(alignment: .trailing, spacing: 0) {
        Button("Đóng") { model.settingsPresented = false }.padding(12)
        SettingsView()
      }
    }
  }

  @ViewBuilder
  private var workspace: some View {
    if model.comparisonEnabled {
      ComparisonPanel()
    } else if model.layout == .sideBySide {
      HStack(spacing: 1) {
        ImagePanel(side: 0)
        ImagePanel(side: 1)
      }
      .background(Color.black)
    } else {
      VStack(spacing: 1) {
        ImagePanel(side: 0)
        ImagePanel(side: 1)
      }
      .background(Color.black)
    }
  }
}

private struct ImagePanel: View {
  @EnvironmentObject private var model: AppModel
  let side: Int
  @State private var dropTargeted = false

  var body: some View {
    VStack(spacing: 0) {
      ZStack {
        ImageCanvasView(
          foregroundImage: model.images[side],
          backgroundImage: nil,
          comparisonPosition: nil,
          transform: model.transform,
          onPan: model.pan,
          onZoom: model.zoom,
          onResetView: model.resetView
        )

        if model.images[side] == nil {
          EmptyImageView(side: side, loading: model.loading[side]) {
            model.chooseImage(for: side)
          }
        } else if model.loading[side] {
          ProgressView().controlSize(.small)
        }

        if model.rulerVisible {
          RulerOverlay(image: model.images[side], transform: model.transform, unit: model.rulerUnit)
        }

        DropHighlight(visible: dropTargeted)
      }
      .contentShape(Rectangle())
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .clipped()
      .dropDestination(for: URL.self) { urls, _ in
        model.openDropped(urls, target: side)
        return !urls.isEmpty
      } isTargeted: {
        dropTargeted = $0
      }
      .contextMenu { ImageContextMenu(side: side) }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }
}

private struct ComparisonPanel: View {
  @EnvironmentObject private var model: AppModel
  @State private var dropTargeted = false

  var body: some View {
    VStack(spacing: 0) {
      GeometryReader { proxy in
        ZStack(alignment: .topLeading) {
          ImageCanvasView(
            foregroundImage: model.images[0],
            backgroundImage: model.images[1],
            comparisonPosition: model.comparisonPosition,
            comparisonLayout: model.layout,
            transform: model.transform,
            onPan: model.pan,
            onZoom: model.zoom,
            onResetView: model.resetView
          )

          if model.images.allSatisfy({ $0 == nil }) {
            EmptyImageView(side: 0, loading: model.loading.contains(true)) {
              model.chooseImage(for: 0)
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
          }

          if model.rulerVisible {
            RulerOverlay(
              image: model.images[0] ?? model.images[1],
              transform: model.transform,
              unit: model.rulerUnit
            )
          }

          comparisonHandle(width: proxy.size.width, height: proxy.size.height)
          DropHighlight(visible: dropTargeted)
        }
        .coordinateSpace(name: "comparison")
        .dropDestination(for: URL.self) { urls, location in
          let coordinate = model.layout == .sideBySide ? location.x : location.y
          let length = model.layout == .sideBySide ? proxy.size.width : proxy.size.height
          let side = coordinate <= length * model.comparisonPosition ? 0 : 1
          model.openDropped(urls, target: side)
          return !urls.isEmpty
        } isTargeted: {
          dropTargeted = $0
        }
        .contextMenu {
          ImageContextMenu(side: model.comparisonPosition >= 0.5 ? 0 : 1)
        }
      }
    }

  }

  private func comparisonHandle(width: CGFloat, height: CGFloat) -> some View {
    let vertical = model.layout == .sideBySide
    let x = vertical ? width * model.comparisonPosition : width / 2
    let y = vertical ? height / 2 : height * model.comparisonPosition
    return ZStack {
      Rectangle()
        .fill(Color.white.opacity(0.88))
        .frame(width: vertical ? 1.5 : width, height: vertical ? height : 1.5)
        .shadow(color: .black.opacity(0.65), radius: 2)
      Circle()
        .fill(.ultraThinMaterial)
        .frame(width: 42, height: 42)
        .overlay(Circle().stroke(Color.white.opacity(0.92), lineWidth: 1.5))
        .overlay {
          Image(systemName: vertical ? "arrow.left.and.right" : "arrow.up.and.down")
            .font(.system(size: 13, weight: .bold))
        }
        .shadow(color: .black.opacity(0.45), radius: 7, y: 3)
    }
    .frame(width: vertical ? 44 : width, height: vertical ? height : 44)
    // Define the hit region before positioning: position expands the outer
    // layout to the whole stage, which must not capture image drags.
    .contentShape(Rectangle())
    .gesture(
      DragGesture(minimumDistance: 0, coordinateSpace: .named("comparison"))
        .onChanged { value in
          let length = vertical ? width : height
          guard length > 0 else { return }
          model.setComparisonPosition((vertical ? value.location.x : value.location.y) / length)
        }
    )
    .position(x: x, y: y)
  }
}

private struct EmptyImageView: View {
  let side: Int
  let loading: Bool
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      VStack(spacing: 9) {
        if loading {
          ProgressView().controlSize(.small)
        } else {
          Image(systemName: "photo.badge.plus")
            .font(.system(size: 38, weight: .light))
          Text("Kéo thả ảnh vào đây")
            .font(.system(size: 14, weight: .semibold))
          Text("hoặc bấm để chọn ảnh \(side + 1)")
            .font(.system(size: 11))
            .opacity(0.7)
        }
      }
      .foregroundStyle(Color.white.opacity(0.48))
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
  }
}

private struct DropHighlight: View {
  let visible: Bool

  var body: some View {
    RoundedRectangle(cornerRadius: 9)
      .stroke(Color.accentColor, lineWidth: 2)
      .background(
        RoundedRectangle(cornerRadius: 9).fill(Color.accentColor.opacity(visible ? 0.14 : 0))
      )
      .padding(7)
      .opacity(visible ? 1 : 0)
      .allowsHitTesting(false)
  }
}

private struct ImageContextMenu: View {
  @EnvironmentObject private var model: AppModel
  let side: Int

  var body: some View {
    Button("Tắt hết ảnh", systemImage: "xmark.rectangle") { model.closeAll() }
      .disabled(model.images.allSatisfy { $0 == nil })
    Divider()
    Button("Mở thư mục ảnh", systemImage: "folder") { model.reveal(side) }
      .disabled(model.images[side] == nil)
    Button("Mở bằng…", systemImage: "square.and.arrow.up") { model.openWith(side) }
      .disabled(model.images[side] == nil)
    Divider()
    Button("Cài đặt", systemImage: "gearshape") {
      model.settingsPresented = true
    }
    Button("Cập nhật ảnh hiện tại", systemImage: "arrow.clockwise") { model.reload(side) }
      .disabled(model.images[side] == nil)
  }
}
