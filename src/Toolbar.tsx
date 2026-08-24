import { displayDpi, formatBytes, middleEllipsisParts } from "./core";
import { LayoutColumnsIcon, LayoutRowsIcon, ResetIcon, RulerIcon } from "./icons";
import type { CompareLayout, LoadedImage, RulerUnit } from "./types";

interface ToolbarProps {
  images: Array<LoadedImage | null>;
  scale: number;
  layout: CompareLayout;
  rulerVisible: boolean;
  rulerUnit: RulerUnit;
  onScale: (scale: number) => void;
  onLayout: () => void;
  onRuler: () => void;
  onUnit: (unit: RulerUnit) => void;
  onReset: () => void;
}

function Metadata({ image, side }: { image: LoadedImage | null; side: "left" | "right" }) {
  const summary = image
    ? `${image.width}x${image.height}px | ${image.colorSpace} | ${displayDpi(image.dpi)} DPI`
    : "Chưa có ảnh";
  const title = image
    ? `${image.fileName} · ${formatBytes(image.fileSize)}${image.dpi === null ? " · File không lưu DPI, dùng mặc định 72 DPI" : ""}`
    : `Ảnh ${side === "left" ? 1 : 2}`;
  const fileName = image ? middleEllipsisParts(image.fileName) : null;

  return (
    <div className={`metadata ${side}`} title={title}>
      {fileName && (
        <div className="file-name" aria-label={image?.fileName}>
          <span className="file-name-leading">{fileName.leading}</span>
          {fileName.trailing && <span className="file-name-trailing">{fileName.trailing}</span>}
        </div>
      )}
      <div className="metadata-summary">{summary}</div>
    </div>
  );
}

export function Toolbar({
  images,
  scale,
  layout,
  rulerVisible,
  rulerUnit,
  onScale,
  onLayout,
  onRuler,
  onUnit,
  onReset
}: ToolbarProps) {
  const sideBySide = layout === "sideBySide";
  return (
    <div className="toolbar" role="toolbar" aria-label="Image comparison tools">
      <Metadata image={images[0]} side="left" />
      <div className="tool-controls">
        <output className="zoom-value">{Math.round(scale * 100)}%</output>
        <input
          className="zoom-slider"
          type="range"
          min="0.9"
          max="15"
          value={scale}
          step="0.01"
          aria-label="Mức phóng đại"
          onChange={(event) => onScale(Number(event.target.value))}
        />
        <button
          className="round-button"
          type="button"
          title={sideBySide ? "Chia ảnh trên dưới" : "Chia ảnh trái phải"}
          aria-label="Đổi bố cục"
          onClick={onLayout}
        >
          {sideBySide ? <LayoutColumnsIcon /> : <LayoutRowsIcon />}
        </button>
        <button
          className={`round-button ${rulerVisible ? "active" : ""}`}
          type="button"
          title={rulerVisible ? "Ẩn thước kẻ" : "Hiện thước kẻ"}
          aria-label="Bật hoặc tắt thước kẻ"
          aria-pressed={rulerVisible}
          onClick={onRuler}
        >
          <RulerIcon />
        </button>
        <label className="unit-picker" title="Đơn vị thước đo">
          <span className="sr-only">Đơn vị thước đo</span>
          <select value={rulerUnit} onChange={(event) => onUnit(event.target.value as RulerUnit)}>
            <option value="pixels">px</option>
            <option value="points">pt</option>
            <option value="inches">in</option>
            <option value="centimeters">cm</option>
          </select>
        </label>
        <button className="round-button" type="button" title="Tắt hết ảnh" aria-label="Tắt hết ảnh" onClick={onReset}>
          <ResetIcon />
        </button>
      </div>
      <Metadata image={images[1]} side="right" />
    </div>
  );
}
