import type { CSSProperties, RefObject } from "react";
import { ImageAddIcon } from "./icons";
import { RulerCanvas } from "./RulerCanvas";
import type { LoadedImage, RulerUnit, ViewTransform } from "./types";

interface ImagePanelProps {
  index: number;
  panelRef: RefObject<HTMLElement | null>;
  image: LoadedImage | null;
  transform: ViewTransform;
  rulerVisible: boolean;
  rulerUnit: RulerUnit;
  dropTarget: boolean;
  dragging: boolean;
  zoomCursor: boolean;
  zoomOut: boolean;
  onPick: (index: number) => void;
  onImageError: (index: number, path: string) => void;
  className?: string;
  style?: CSSProperties;
}

export function ImagePanel({
  index,
  panelRef,
  image,
  transform,
  rulerVisible,
  rulerUnit,
  dropTarget,
  dragging,
  zoomCursor,
  zoomOut,
  onPick,
  onImageError,
  className,
  style: panelStyle
}: ImagePanelProps) {
  const classes = [
    "image-panel",
    image ? "has-image" : "",
    dropTarget ? "drop-target" : "",
    dragging ? "dragging" : "",
    zoomCursor ? "zoom-cursor" : "",
    zoomOut ? "zoom-out" : "",
    className ?? ""
  ].filter(Boolean).join(" ");

  return (
    <section
      ref={panelRef}
      id={index === 0 ? "leftPanel" : "rightPanel"}
      className={classes}
      style={panelStyle}
      aria-label={`Ảnh ${index + 1}`}
    >
      {!image && (
        <button className="empty-state" type="button" onClick={() => onPick(index)}>
          <ImageAddIcon />
          <span>Kéo thả ảnh vào đây</span>
          <small>hoặc bấm để chọn ảnh</small>
        </button>
      )}
      {image && (() => {
        const style = {
          transform: `translate(${transform.offsetX}px, ${transform.offsetY}px) scale(${transform.scale})`
        };
        return (
          <img
            className="compare-image"
            src={image.url}
            alt={`Ảnh so sánh ${index + 1} — độ phân giải gốc`}
            draggable={false}
            onError={() => onImageError(index, image.path)}
            style={style}
          />
        );
      })()}
      <RulerCanvas image={image} transform={transform} unit={rulerUnit} visible={rulerVisible} />
      <div className="drop-indicator">Thả ảnh vào đây</div>
    </section>
  );
}
