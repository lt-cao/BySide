#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."
version=$(node -p "require('./package.json').version")
output="$PWD/release/BySide_${version}_universal.dmg"
if [[ -e "$output" ]]; then
  echo "Output already exists: $output" >&2
  exit 1
fi

xcodebuild -quiet \
  -project macOS/BySide/BySide.xcodeproj \
  -scheme BySide -configuration Release \
  -destination 'generic/platform=macOS' \
  -derivedDataPath macOS/BySide/build \
  CODE_SIGNING_ALLOWED=NO ARCHS='arm64 x86_64' ONLY_ACTIVE_ARCH=NO \
  MARKETING_VERSION="$version" build

app="$PWD/macOS/BySide/build/Build/Products/Release/BySide.app"
lipo "$app/Contents/MacOS/BySide" -verify_arch arm64 x86_64
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
