import { useEffect, useRef, type CSSProperties, type RefObject } from "react";
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
}

function PreviewCanvas({ bitmap, style }: { bitmap: ImageBitmap; style: CSSProperties }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext("2d", { alpha: true })?.drawImage(bitmap, 0, 0);
  }, [bitmap]);

  return <canvas ref={canvasRef} className="compare-image" aria-label="Bản xem trước ảnh lớn" style={style} />;
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
  onImageError
}: ImagePanelProps) {
  const classes = [
    "image-panel",
    image ? "has-image" : "",
    dropTarget ? "drop-target" : "",
    dragging ? "dragging" : "",
    zoomCursor ? "zoom-cursor" : "",
    zoomOut ? "zoom-out" : ""
  ].filter(Boolean).join(" ");

  return (
    <section ref={panelRef} id={index === 0 ? "leftPanel" : "rightPanel"} className={classes} aria-label={`Ảnh ${index + 1}`}>
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
        return image.preview
          ? <PreviewCanvas bitmap={image.preview} style={style} />
          : (
            <img
              className="compare-image"
              src={image.url}
              alt={`Ảnh so sánh ${index + 1}`}
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
