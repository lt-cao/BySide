import { useCallback, useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

type UpdateState =
  | { kind: "idle" | "checking" }
  | { kind: "current"; latest: string }
  | { kind: "available"; latest: string; pending: Update }
  | { kind: "downloading"; latest: string; downloaded: number; total?: number }
  | { kind: "installing"; latest: string }
  | { kind: "error"; message: string };

const FALLBACK_VERSION = "1.4.2";

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const [currentVersion, setCurrentVersion] = useState(FALLBACK_VERSION);
  const [update, setUpdate] = useState<UpdateState>({ kind: "idle" });
  const busy = update.kind === "checking" || update.kind === "downloading" || update.kind === "installing";

  const checkForUpdates = useCallback(async () => {
    setUpdate({ kind: "checking" });
    try {
      const installed = await getVersion().catch(() => FALLBACK_VERSION);
      setCurrentVersion(installed);
      const pending = await check({ timeout: 30_000 });
      setUpdate(pending
        ? { kind: "available", latest: pending.version, pending }
        : { kind: "current", latest: installed });
    } catch {
      setUpdate({ kind: "error", message: "Không thể kiểm tra bản cập nhật. Hãy thử lại khi có mạng." });
    }
  }, []);

  const installUpdate = useCallback(async (pending: Update) => {
    const latest = pending.version;
    let downloaded = 0;
    let total: number | undefined;
    setUpdate({ kind: "downloading", latest, downloaded });
    try {
      await pending.downloadAndInstall((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength;
          setUpdate({ kind: "downloading", latest, downloaded, total });
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          setUpdate({ kind: "downloading", latest, downloaded, total });
        } else {
          setUpdate({ kind: "installing", latest });
        }
      }, { timeout: 120_000 });
      setUpdate({ kind: "installing", latest });
      await relaunch();
    } catch {
      setUpdate({ kind: "error", message: "Không thể tải hoặc cài bản cập nhật. Hãy thử lại." });
    }
  }, []);

  useEffect(() => {
    if (open) void checkForUpdates();
  }, [checkForUpdates, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose, open]);

  if (!open) return null;

  const progress = update.kind === "downloading" && update.total
    ? Math.min(update.downloaded / update.total * 100, 100)
    : 0;
  return (
    <div className="settings-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onClose();
    }}>
      <section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className="settings-header">
          <div>
            <h2 id="settings-title">Cài đặt</h2>
            <p>BySide phiên bản {currentVersion}</p>
          </div>
          <button type="button" className="settings-close" disabled={busy} onClick={onClose} aria-label="Đóng cài đặt">×</button>
        </header>

        <div className="settings-section">
          <div className="settings-section-copy">
            <h3>Cập nhật ứng dụng</h3>
            {update.kind === "checking" && <p>Đang kiểm tra phiên bản mới nhất…</p>}
            {update.kind === "current" && <p>Bạn đang dùng phiên bản mới nhất ({update.latest}).</p>}
            {update.kind === "available" && <p>Đã có BySide {update.latest}. Có thể cập nhật ngay trong ứng dụng.</p>}
            {update.kind === "downloading" && (
              <>
                <p>Đang tải BySide {update.latest}… {update.total ? `${Math.round(progress)}%` : ""}</p>
                <div className="settings-progress" aria-label="Tiến trình tải cập nhật">
                  <span style={{ width: `${update.total ? progress : 12}%` }} />
                </div>
              </>
            )}
            {update.kind === "installing" && <p>Đang cài BySide {update.latest} và chuẩn bị khởi động lại…</p>}
            {update.kind === "error" && <p className="settings-error">{update.message}</p>}
            {update.kind === "idle" && <p>Kiểm tra bản phát hành mới từ GitHub.</p>}
          </div>
          <div className="settings-actions">
            {update.kind === "available" && (
              <button type="button" className="primary-action" onClick={() => void installUpdate(update.pending)}>
                Cập nhật ngay
              </button>
            )}
            {(update.kind === "idle" || update.kind === "current" || update.kind === "error") && (
              <button type="button" onClick={() => void checkForUpdates()}>Kiểm tra lại</button>
            )}
            {busy && <button type="button" disabled>{update.kind === "checking" ? "Đang kiểm tra…" : "Vui lòng chờ…"}</button>}
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
