import SwiftUI

struct RulerOverlay: View {
    let image: LoadedImage?
    let transform: ViewTransform
    let unit: RulerUnit

    var body: some View {
        GeometryReader { proxy in
            if let image {
                Canvas { context, size in
                    drawRulers(context: &context, size: size, image: image)
                }
            }
        }
        .allowsHitTesting(false)
    }

    private func drawRulers(context: inout GraphicsContext, size: CGSize, image: LoadedImage) {
        let rect = imageRect(image: image, in: size)
        guard rect.width > 0, rect.height > 0 else { return }

        let strip: CGFloat = 24
        let top: CGFloat = 100
        context.fill(Path(CGRect(x: 0, y: top, width: size.width, height: strip)), with: .color(Color(white: 0.16)))
        context.fill(Path(CGRect(x: 0, y: 0, width: strip, height: size.height)), with: .color(Color(white: 0.16)))

        let xScale = rect.width / CGFloat(image.width)
        let yScale = rect.height / CGFloat(image.height)
        drawAxis(
            context: &context,
            length: size.width,
            imageOrigin: rect.minX,
            pixelsToScreen: xScale,
            dpi: image.dpi,
            horizontal: true,
            strip: strip
        )
        drawAxis(
            context: &context,
            length: size.height,
            imageOrigin: rect.minY,
            pixelsToScreen: yScale,
            dpi: image.dpi,
            horizontal: false,
            strip: strip
        )
    }

    private func drawAxis(
        context: inout GraphicsContext,
        length: CGFloat,
        imageOrigin: CGFloat,
        pixelsToScreen: CGFloat,
        dpi: CGFloat?,
        horizontal: Bool,
        strip: CGFloat
    ) {
        let pixelsPerUnit: CGFloat
        switch unit {
        case .pixels: pixelsPerUnit = 1
        case .points: pixelsPerUnit = (dpi ?? 72) / 72
        case .inches: pixelsPerUnit = dpi ?? 72
        case .centimeters: pixelsPerUnit = (dpi ?? 72) / 2.54
        }
        let screenPerUnit = max(0.0001, pixelsToScreen * pixelsPerUnit)
        let major = pleasantStep(minimum: 72 / screenPerUnit)
        let minor = major / 5
        let visibleStart = max(0, -imageOrigin / screenPerUnit)
        let visibleEnd = max(visibleStart, (length - imageOrigin) / screenPerUnit)
        var value = floor(visibleStart / minor) * minor
        var safety = 0

        while value <= visibleEnd && safety < 4000 {
            let position = imageOrigin + value * screenPerUnit
            let majorIndex = Int((value / minor).rounded())
            let isMajor = majorIndex % 5 == 0
            var path = Path()
            if horizontal {
                path.move(to: CGPoint(x: position, y: 100 + strip))
                path.addLine(to: CGPoint(x: position, y: 100 + (isMajor ? 8 : 16)))
            } else {
                path.move(to: CGPoint(x: strip, y: position))
                path.addLine(to: CGPoint(x: isMajor ? 8 : 16, y: position))
            }
            context.stroke(path, with: .color(.white.opacity(isMajor ? 0.78 : 0.42)), lineWidth: 0.7)

            if isMajor {
                let label = context.resolve(Text(format(value)).font(.system(size: 9, design: .monospaced)).foregroundColor(.white.opacity(0.82)))
                if horizontal {
                    context.draw(label, at: CGPoint(x: position + 3, y: 108), anchor: .topLeading)
                } else {
                    context.draw(label, at: CGPoint(x: 3, y: position + 2), anchor: .topLeading)
                }
            }
            value += minor
            safety += 1
        }
    }

    private func imageRect(image: LoadedImage, in size: CGSize) -> CGRect {
        let fit = min(size.width / CGFloat(image.width), size.height / CGFloat(image.height))
        let width = CGFloat(image.width) * fit * transform.scale
        let height = CGFloat(image.height) * fit * transform.scale
        return CGRect(
            x: (size.width - width) / 2 + transform.offset.width,
            y: (size.height - height) / 2 + transform.offset.height,
            width: width,
            height: height
        )
    }

    private func pleasantStep(minimum: CGFloat) -> CGFloat {
        let safe = max(minimum, 0.0001)
        let magnitude = pow(10, floor(log10(safe)))
        for multiplier: CGFloat in [1, 2, 5, 10] where magnitude * multiplier >= safe {
            return magnitude * multiplier
        }
        return magnitude * 10
    }

    private func format(_ value: CGFloat) -> String {
        if abs(value.rounded() - value) < 0.001 { return String(Int(value.rounded())) }
        if abs(value) < 10 { return String(format: "%.2f", value) }
        return String(format: "%.1f", value)
    }
}
