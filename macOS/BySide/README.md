# BySide for macOS

Ứng dụng macOS có UI native viết bằng Swift, SwiftUI và AppKit; phần kiểm tra file, kích thước, màu, DPI và dung lượng ảnh chạy bằng Rust core trong `RustCore`. Dự án Windows/Tauri ở thư mục gốc dùng cùng hướng Rust cho backend.

## Chạy trong Xcode

1. Mở `BySide.xcodeproj`.
2. Chọn scheme `BySide` và `My Mac`.
3. Nhấn Run.

## Build bản Release

```sh
xcodebuild -project BySide.xcodeproj -scheme BySide -configuration Release build
```

Script phát hành tự build Rust core cho arm64 và x86_64, ghép thành static library universal rồi link vào Xcode:

```sh
bash ../../script/build_macos.sh
```

Canvas dùng ảnh gốc từ ImageIO, không tạo thumbnail/downsample trước khi zoom.
