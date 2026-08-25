import type { CompareLayout, LoadedImage, ViewTransform } from "./types";

export const MIN_SCALE = 0.9;
export const MAX_SCALE = 15;
export const PANEL_SPACING = 2;
export const LARGE_IMAGE_THRESHOLD = 10_000;
export const PREVIEW_MAX_DIMENSION = 6_144;

export const clamp = (value: number, lower: number, upper: number) =>
  Math.min(Math.max(value, lower), upper);

export function previewDimensions(width: number, height: number) {
  const largest = Math.max(width, height);
  if (largest <= LARGE_IMAGE_THRESHOLD || width <= 0 || height <= 0) return null;
  const ratio = PREVIEW_MAX_DIMENSION / largest;
  return {
    width: Math.max(Math.round(width * ratio), 1),
    height: Math.max(Math.round(height * ratio), 1)
  };
}

export function isNewerVersion(candidate: string, current: string) {
  const parts = (version: string) => version
    .replace(/^v/i, "")
    .split("-")[0]
    .split(".")
    .map((value) => Number.parseInt(value, 10) || 0);
  const next = parts(candidate);
  const installed = parts(current);
  const length = Math.max(next.length, installed.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (next[index] ?? 0) - (installed[index] ?? 0);
    if (difference !== 0) return difference > 0;
  }
  return false;
}

export function panelPoint(
  location: { x: number; y: number },
  viewport: { width: number; height: number },
  layout: CompareLayout,
  spacing = PANEL_SPACING
) {
  const sideBySide = layout === "sideBySide";
  const panelWidth = sideBySide
    ? Math.max((viewport.width - spacing) / 2, 0)
    : viewport.width;
  const panelHeight = sideBySide
    ? viewport.height
    : Math.max((viewport.height - spacing) / 2, 0);
  const x = sideBySide && location.x > panelWidth
    ? location.x - panelWidth - spacing
    : location.x;
  const y = !sideBySide && location.y > panelHeight
    ? location.y - panelHeight - spacing
    : location.y;

  return {
    x: clamp(x, 0, panelWidth) - panelWidth / 2,
    y: clamp(y, 0, panelHeight) - panelHeight / 2
  };
}

export function zoomAtPoint(
  transform: ViewTransform,
  factor: number,
  focus: { x: number; y: number }
): ViewTransform {
  const scale = clamp(transform.scale * factor, MIN_SCALE, MAX_SCALE);
  if (scale === transform.scale) return transform;
  const ratio = scale / transform.scale;

  return {
    scale,
    offsetX: focus.x + (transform.offsetX - focus.x) * ratio,
    offsetY: focus.y + (transform.offsetY - focus.y) * ratio
  };
}

export function panLimits(
  images: Array<LoadedImage | null>,
  panelSize: { width: number; height: number },
  scale: number,
  minimumVisible = 80
) {
  const loaded = images.filter((image): image is LoadedImage => image !== null);
  if (!loaded.length || panelSize.width <= 0 || panelSize.height <= 0) {
    return { x: 0, y: 0 };
  }

  return loaded
    .map((image) => {
      const fit = Math.min(panelSize.width / image.width, panelSize.height / image.height);
      const displayedWidth = image.width * fit * scale;
      const displayedHeight = image.height * fit * scale;
      return {
        x: Math.max((displayedWidth + panelSize.width) / 2 - minimumVisible, 0),
        y: Math.max((displayedHeight + panelSize.height) / 2 - minimumVisible, 0)
      };
    })
    .reduce((current, next) => ({
      x: Math.min(current.x, next.x),
      y: Math.min(current.y, next.y)
    }));
}

export function clampTransform(
  transform: ViewTransform,
  images: Array<LoadedImage | null>,
  panelSize: { width: number; height: number }
): ViewTransform {
  const limits = panLimits(images, panelSize, transform.scale);
  return {
    ...transform,
    offsetX: clamp(transform.offsetX, -limits.x, limits.x),
    offsetY: clamp(transform.offsetY, -limits.y, limits.y)
  };
}

export function tickStep(visibleUnits: number) {
  const raw = Math.max(visibleUnits / 8, 1);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const multiplier = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return multiplier * magnitude;
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

export function displayDpi(dpi: number | null) {
  return dpi ?? 72;
}

export function middleEllipsisParts(fileName: string) {
  if (fileName.length <= 18) return { leading: fileName, trailing: "" };

  const dot = fileName.lastIndexOf(".");
  const extensionLength = dot > 0 && fileName.length - dot <= 9
    ? fileName.length - dot
    : 0;
  const trailingLength = Math.min(
    Math.max(extensionLength + 3, 10),
    Math.floor(fileName.length / 2)
  );

  return {
    leading: fileName.slice(0, -trailingLength),
    trailing: fileName.slice(-trailingLength)
  };
}

export function nextImagePanel(images: Array<LoadedImage | null>): 0 | 1 {
  if (images[0] === null) return 0;
  if (images[1] === null) return 1;
  return 0;
}

interface RectLike {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export function dropEventPoint(
  position: { x: number; y: number },
  scaleFactor: number,
  macOS: boolean
) {
  // WKWebView reports these drag coordinates in logical points even though
  // Tauri exposes the payload as PhysicalPosition. Dividing them again on a
  // Retina display makes the whole right/bottom half land in the first panel.
  if (macOS) return position;
  const safeScale = Number.isFinite(scaleFactor) && scaleFactor > 0 ? scaleFactor : 1;
  return { x: position.x / safeScale, y: position.y / safeScale };
}

export function panelAtDropPoint(
  point: { x: number; y: number },
  left: RectLike,
  right: RectLike,
  layout: CompareLayout
): 0 | 1 {
  const inside = (rect: RectLike) =>
    point.x >= rect.left && point.x <= rect.right
    && point.y >= rect.top && point.y <= rect.bottom;

  if (inside(right)) return 1;
  if (inside(left)) return 0;
  return layout === "sideBySide"
    ? (point.x >= right.left ? 1 : 0)
    : (point.y >= right.top ? 1 : 0);
}
