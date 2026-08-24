$ErrorActionPreference = "Stop"

Set-Location (Split-Path -Parent $PSScriptRoot)
npm install
npm test
cargo test --manifest-path src-tauri/Cargo.toml
npm run tauri -- build --bundles nsis

Write-Host "Hoàn tất. Installer nằm trong src-tauri\target\release\bundle\nsis"
