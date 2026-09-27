import SwiftUI

struct SettingsView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 14) {
                Image(nsImage: NSApp.applicationIconImage)
                    .resizable()
                    .frame(width: 52, height: 52)
                VStack(alignment: .leading, spacing: 3) {
                    Text("BySide")
                        .font(.title2.bold())
                    Text("Phiên bản \(version)")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(22)

            Divider()

            HStack {
                VStack(alignment: .leading, spacing: 5) {
                    Text("Cập nhật ứng dụng")
                        .font(.headline)
                    Text("Cập nhật trực tiếp chưa có trong bản thử nghiệm này.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 18)
                Button("Kiểm tra") {}
                    .disabled(true)
            }
            .padding(22)

            Divider()

            HStack {
                Text("Tác giả")
                    .foregroundStyle(.secondary)
                Spacer()
                Text("Cao Le").fontWeight(.semibold)
            }
            .font(.system(size: 12))
            .padding(.horizontal, 22)
            .padding(.vertical, 14)
        }
        .frame(width: 480)
    }

    private var version: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.5.0"
    }
}
