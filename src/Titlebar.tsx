import { getCurrentWindow } from "@tauri-apps/api/window";
import { CloseIcon, MaximizeIcon, MinimizeIcon } from "./icons";

const hasTauriRuntime = () => "__TAURI_INTERNALS__" in window;
const isMacOS = navigator.userAgent.toLowerCase().includes("mac");

function WindowControls() {
  return (
    <div className="window-controls" aria-label="Điều khiển cửa sổ">
      {isMacOS ? (
        <>
          <button type="button" className="close" aria-label="Đóng" title="Đóng" onClick={() => hasTauriRuntime() && getCurrentWindow().close()}><CloseIcon /></button>
          <button type="button" className="minimize" aria-label="Thu nhỏ" title="Thu nhỏ" onClick={() => hasTauriRuntime() && getCurrentWindow().minimize()}><MinimizeIcon /></button>
          <button type="button" className="maximize" aria-label="Phóng to" title="Phóng to" onClick={() => hasTauriRuntime() && getCurrentWindow().toggleMaximize()}><MaximizeIcon /></button>
        </>
      ) : (
        <>
          <button type="button" aria-label="Thu nhỏ" title="Thu nhỏ" onClick={() => hasTauriRuntime() && getCurrentWindow().minimize()}><MinimizeIcon /></button>
          <button type="button" aria-label="Phóng to" title="Phóng to" onClick={() => hasTauriRuntime() && getCurrentWindow().toggleMaximize()}><MaximizeIcon /></button>
          <button type="button" className="close" aria-label="Đóng" title="Đóng" onClick={() => hasTauriRuntime() && getCurrentWindow().close()}><CloseIcon /></button>
        </>
      )}
    </div>
  );
}

export function Titlebar() {
  return (
    <header className={`titlebar ${isMacOS ? "macos" : "windows"}`} data-tauri-drag-region>
      {isMacOS && <WindowControls />}
      <div className="app-identity" data-tauri-drag-region>
        <img src="/app-icon.png" alt="" aria-hidden="true" />
        <span data-tauri-drag-region>BySide</span>
      </div>
      {!isMacOS && <WindowControls />}
    </header>
  );
}
