#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."
version=$(node -p "require('./package.json').version")
output="$PWD/release/BySide_${version}_universal.dmg"
rm -f "$output"

rustup target add aarch64-apple-darwin x86_64-apple-darwin
cargo build --manifest-path macOS/BySide/RustCore/Cargo.toml --release --target aarch64-apple-darwin
cargo build --manifest-path macOS/BySide/RustCore/Cargo.toml --release --target x86_64-apple-darwin
mkdir -p macOS/BySide/RustCore/target/universal/release
lipo -create \
  macOS/BySide/RustCore/target/aarch64-apple-darwin/release/libbyside_rust_core.a \
  macOS/BySide/RustCore/target/x86_64-apple-darwin/release/libbyside_rust_core.a \
  -output macOS/BySide/RustCore/target/universal/release/libbyside_rust_core.a

xcodebuild -quiet \
  -project macOS/BySide/BySide.xcodeproj \
  -scheme BySide -configuration Release \
  -destination 'generic/platform=macOS' \
  -derivedDataPath macOS/BySide/build \
  CODE_SIGNING_ALLOWED=NO ARCHS='arm64 x86_64' ONLY_ACTIVE_ARCH=NO \
  MARKETING_VERSION="$version" build

app="$PWD/macOS/BySide/build/Build/Products/Release/BySide.app"
archs=$(lipo -archs "$app/Contents/MacOS/BySide")
[[ "$archs" == *arm64* && "$archs" == *x86_64* ]] || {
  echo "BySide.app is not a universal binary: $archs" >&2
  exit 1
}
codesign --force --sign - "$app"
codesign --verify --strict "$app"
mkdir -p release
# A fresh staging folder avoids packaging artifacts from older releases.
staging=$(mktemp -d "$PWD/release/macos-staging.XXXXXX")
ditto "$app" "$staging/BySide.app"
ln -s /Applications "$staging/Applications"
hdiutil create -volname "BySide $version" -srcfolder "$staging" -format UDZO "$output"
hdiutil verify "$output"
echo "Built: $output"
