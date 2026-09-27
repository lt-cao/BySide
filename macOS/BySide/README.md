# BySide for macOS

Ứng dụng macOS native viết bằng Swift, SwiftUI và AppKit. Dự án Windows/Tauri ở thư mục gốc được giữ nguyên.

## Chạy trong Xcode

1. Mở `BySide.xcodeproj`.
2. Chọn scheme `BySide` và `My Mac`.
3. Nhấn Run.

## Build bản Release

```sh
xcodebuild -project BySide.xcodeproj -scheme BySide -configuration Release build
```

Canvas dùng ảnh gốc từ ImageIO, không tạo thumbnail/downsample trước khi zoom.
