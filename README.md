# BySide

Ứng dụng desktop so sánh ảnh: Windows dùng **Tauri 2 + React/TypeScript + Rust**; macOS dùng **SwiftUI + AppKit** trong thư mục `macOS/BySide`.

Tác giả: **Cao Le**

## Tính năng

- Hai khung ảnh dùng chung mức zoom và vị trí pan.
- Hiển thị tên file phía trên metadata; tên dài được rút gọn ở giữa.
- Zoom tối đa 1500% bằng con lăn, thanh trượt hoặc giữ `Z` và kéo (`Alt` để thu nhỏ).
- Mở ảnh bằng hộp thoại chọn file hoặc kéo thả vào từng khung.
- macOS hỗ trợ mở ảnh từ Finder bằng **Open With → BySide**.
- Thanh tiêu đề tự thích ứng: điều khiển kiểu Windows ở bên phải, kiểu macOS ở bên trái.
- Bố cục trái/phải hoặc trên/dưới.
- Thước đo px, pt, inch và cm.
- Rust đọc kích thước pixel, hệ màu, DPI PNG/JPEG và dung lượng file.
- Giữ độ phân giải ảnh gốc khi zoom để so sánh chi tiết.
- Windows hỗ trợ cập nhật trong ứng dụng. Bản macOS Swift hiện cài/cập nhật bằng DMG.
- Ghi nhớ bố cục, trạng thái thước và đơn vị.
- Giới hạn file 512 MB và chỉ cho phép các định dạng ảnh hỗ trợ.

## Chạy khi phát triển

Yêu cầu Rust stable, Node.js và các dependency hệ thống của Tauri:

```bash
npm install
npm run dev
```

## Hai bộ cài phát hành

Dự án chỉ phát hành hai file cài đặt, không phát hành bản Windows portable:

- Windows x64: `*-setup.exe` (NSIS).
- macOS Universal: `.dmg`, dùng cho cả Intel và Apple Silicon.

Build Windows trong PowerShell:

```powershell
npm run build:windows
```

Build macOS Universal:

```bash
npm run build:macos
```

## Phát hành bằng GitHub

Workflow `.github/workflows/release.yml` chạy khi cập nhật nhánh `main`, hoặc khi bấm **Run workflow** trong GitHub Actions. Hãy tăng `version` trong cấu hình trước mỗi lần phát hành.

Ví dụ cập nhật mã nguồn:

```bash
git push origin main
```

Build macOS cần Xcode 26 trở lên và Node.js. GitHub Actions kiểm thử và build hai bộ cài, chỉ công khai GitHub Release sau khi cả hai thành công. Các file chữ ký và `latest.json` bổ sung phục vụ cập nhật Windows.

## Kiểm thử

```bash
npm test
cargo test --manifest-path src-tauri/Cargo.toml
npm run build
```
