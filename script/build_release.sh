#!/bin/zsh
set -euo pipefail

project_dir="${0:A:h:h}"
cd "$project_dir"

toolchain_dir="$project_dir/work/windows-toolchain"
rustup_proxy="$(command -v rustup)"
export RUSTUP_HOME="$toolchain_dir/rustup"
export CARGO_HOME="$toolchain_dir/cargo"
mkdir -p "$RUSTUP_HOME" "$CARGO_HOME/bin"
ln -sf "$rustup_proxy" "$CARGO_HOME/bin/rustup"
for proxy_name in cargo rustc rustdoc; do
  ln -sf rustup "$CARGO_HOME/bin/$proxy_name"
done
export PATH="$CARGO_HOME/bin:$PATH"

rustup toolchain install stable --profile minimal --target x86_64-pc-windows-msvc
rustup default stable

if ! command -v cargo-xwin >/dev/null 2>&1; then
  cargo install --locked cargo-xwin
fi

llvm_prefix="${BYSIDE_LLVM_PREFIX:-/opt/homebrew/opt/llvm}"
if [[ ! -x "$llvm_prefix/bin/llvm-rc" ]]; then
  if command -v brew >/dev/null 2>&1; then
    echo "Đang cài LLVM bằng Homebrew để cross-compile Windows..."
    brew install llvm
  else
    echo "Không tìm thấy llvm-rc tại $llvm_prefix/bin/llvm-rc"
    echo "Cài LLVM, hoặc đặt BYSIDE_LLVM_PREFIX."
    exit 2
  fi
fi

export PATH="$llvm_prefix/bin:$PATH"
export CC_x86_64_pc_windows_msvc="clang-cl"
export CXX_x86_64_pc_windows_msvc="clang-cl"
export AR_x86_64_pc_windows_msvc="llvm-lib"

if ! command -v makensis >/dev/null 2>&1; then
  echo "Đang cài makensis bằng Homebrew để tạo NSIS installer..."
  brew install makensis
fi

npm run tauri -- build \
  --runner cargo-xwin \
  --target x86_64-pc-windows-msvc \
  --bundles nsis
