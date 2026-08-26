import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { needsFullResolution } from "./core";
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

function FullResolutionImage({
  index,
  image,
  style,
  onImageError
}: {
  index: number;
  image: LoadedImage & { preview: ImageBitmap };
  style: CSSProperties;
  onImageError: (index: number, path: string) => void;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      {!loaded && <PreviewCanvas bitmap={image.preview} style={style} />}
      <img
        className="compare-image"
        src={image.url}
        alt={`Ảnh so sánh ${index + 1} — độ phân giải gốc`}
        draggable={false}
        onLoad={() => setLoaded(true)}
        onError={() => onImageError(index, image.path)}
        style={{ ...style, opacity: loaded ? 1 : 0 }}
      />
    </>
  );
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
  const [panelSize, setPanelSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const updateSize = () => {
      const bounds = panel.getBoundingClientRect();
      setPanelSize({ width: bounds.width, height: bounds.height });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [panelRef]);

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
        if (!image.preview) {
          return (
            <img
              className="compare-image"
              src={image.url}
              alt={`Ảnh so sánh ${index + 1}`}
              draggable={false}
              onError={() => onImageError(index, image.path)}
              style={style}
            />
          );
        }

        const showOriginal = needsFullResolution(
          image.width,
          image.height,
          image.preview.width,
          image.preview.height,
          panelSize.width,
          panelSize.height,
          transform.scale,
          window.devicePixelRatio
        );

        return showOriginal
          ? (
            <FullResolutionImage
              key={image.url}
              index={index}
              image={image as LoadedImage & { preview: ImageBitmap }}
              style={style}
              onImageError={onImageError}
            />
          )
          : <PreviewCanvas bitmap={image.preview} style={style} />;
      })()}
      <RulerCanvas image={image} transform={transform} unit={rulerUnit} visible={rulerVisible} />
      <div className="drop-indicator">Thả ảnh vào đây</div>
    </section>
  );
}
