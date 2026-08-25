import { useCallback, useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { isNewerVersion } from "./core";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

interface GitHubRelease {
  tag_name: string;
  html_url: string;
  assets: Array<{ name: string; browser_download_url: string }>;
}

type UpdateState =
  | { kind: "idle" | "checking" }
  | { kind: "current"; latest: string; pageUrl: string }
  | { kind: "available"; latest: string; downloadUrl: string; pageUrl: string }
  | { kind: "error"; message: string };

const RELEASE_API = "https://api.github.com/repos/lt-cao/BySide/releases/latest";
const FALLBACK_VERSION = "1.3.3";

function installerUrl(release: GitHubRelease) {
  const macOS = navigator.userAgent.toLowerCase().includes("mac");
  const suffix = macOS ? ".dmg" : "-setup.exe";
  return release.assets.find((asset) => asset.name.toLowerCase().endsWith(suffix))?.browser_download_url
    ?? release.html_url;
}

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const [currentVersion, setCurrentVersion] = useState(FALLBACK_VERSION);
  const [update, setUpdate] = useState<UpdateState>({ kind: "idle" });

  const checkForUpdates = useCallback(async () => {
    setUpdate({ kind: "checking" });
    try {
      const installed = await getVersion().catch(() => FALLBACK_VERSION);
      setCurrentVersion(installed);
      const response = await fetch(RELEASE_API, {
        headers: { Accept: "application/vnd.github+json" },
        cache: "no-store"
      });
      if (!response.ok) throw new Error(`GitHub trả về mã ${response.status}`);
      const release = await response.json() as GitHubRelease;
      const latest = release.tag_name.replace(/^v/i, "");
      setUpdate(isNewerVersion(latest, installed)
        ? {
          kind: "available",
          latest,
          downloadUrl: installerUrl(release),
          pageUrl: release.html_url
        }
        : { kind: "current", latest, pageUrl: release.html_url });
    } catch {
      setUpdate({ kind: "error", message: "Không thể kiểm tra GitHub. Hãy thử lại khi có mạng." });
    }
  }, []);

  useEffect(() => {
    if (open) void checkForUpdates();
  }, [checkForUpdates, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  const openExternal = (url: string) => {
    void openUrl(url).catch(() => {
      setUpdate({ kind: "error", message: "Không thể mở trình duyệt để tải bản cập nhật." });
    });
  };

  return (
    <div className="settings-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className="settings-header">
          <div>
            <h2 id="settings-title">Cài đặt</h2>
            <p>BySide phiên bản {currentVersion}</p>
          </div>
          <button type="button" className="settings-close" onClick={onClose} aria-label="Đóng cài đặt">×</button>
        </header>

        <div className="settings-section">
          <div className="settings-section-copy">
            <h3>Cập nhật ứng dụng</h3>
            {update.kind === "checking" && <p>Đang kiểm tra phiên bản mới nhất…</p>}
            {update.kind === "current" && <p>Bạn đang dùng phiên bản mới nhất ({update.latest}).</p>}
            {update.kind === "available" && <p>Đã có BySide {update.latest}. Tải bộ cài phù hợp với máy này.</p>}
            {update.kind === "error" && <p className="settings-error">{update.message}</p>}
            {update.kind === "idle" && <p>Kiểm tra bản phát hành mới từ GitHub.</p>}
          </div>
          <div className="settings-actions">
            {update.kind === "available" && (
              <button type="button" className="primary-action" onClick={() => openExternal(update.downloadUrl)}>
                Tải bản {update.latest}
              </button>
            )}
            {update.kind === "current" && (
              <button type="button" onClick={() => openExternal(update.pageUrl)}>Xem trang phát hành</button>
            )}
            <button type="button" disabled={update.kind === "checking"} onClick={() => void checkForUpdates()}>
              Kiểm tra lại
            </button>
          </div>
        </div>
        <footer className="settings-footer">
          <span>Tác giả</span>
          <strong>Cao Le</strong>
        </footer>
      </section>
    </div>
  );
}
