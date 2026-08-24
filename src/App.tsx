import { useCallback, useEffect, useRef, useState } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open } from "@tauri-apps/plugin-dialog";
import {
  clampTransform,
  dropEventPoint,
  nextImagePanel,
  panelAtDropPoint,
  panelPoint,
  zoomAtPoint
} from "./core";
import { ImagePanel } from "./ImagePanel";
import { Titlebar } from "./Titlebar";
import { Toolbar } from "./Toolbar";
import type { CompareLayout, ImageMetadata, LoadedImage, RulerUnit, ViewTransform } from "./types";

const DEFAULT_TRANSFORM: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };
const imageExtensions = ["png", "jpg", "jpeg", "webp", "gif", "bmp", "tif", "tiff", "ico"];

function storedLayout(): CompareLayout {
  return localStorage.getItem("compareLayout") === "stacked" ? "stacked" : "sideBySide";
}

function storedUnit(): RulerUnit {
  const value = localStorage.getItem("rulerUnit");
  return value === "points" || value === "inches" || value === "centimeters" ? value : "pixels";
}

export default function App() {
  const workspaceRef = useRef<HTMLElement>(null);
  const leftPanelRef = useRef<HTMLElement>(null);
  const rightPanelRef = useRef<HTMLElement>(null);
  const imagesRef = useRef<Array<LoadedImage | null>>([null, null]);
  const transformRef = useRef<ViewTransform>(DEFAULT_TRANSFORM);
  const layoutRef = useRef<CompareLayout>(storedLayout());
  const dragRef = useRef({ active: false, pointerId: -1, x: 0, y: 0, mode: "pan" as "pan" | "zoom" });
  const zKeyRef = useRef(false);
  const dropTargetRef = useRef<0 | 1 | null>(null);

  const [images, setImages] = useState<Array<LoadedImage | null>>([null, null]);
  const [transform, setTransformState] = useState<ViewTransform>(DEFAULT_TRANSFORM);
  const [layout, setLayoutState] = useState<CompareLayout>(layoutRef.current);
  const [rulerVisible, setRulerVisible] = useState(localStorage.getItem("isRulerVisible") === "true");
  const [rulerUnit, setRulerUnit] = useState<RulerUnit>(storedUnit());
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [zoomCursor, setZoomCursor] = useState(false);
  const [zoomOut, setZoomOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setTransform = useCallback((next: ViewTransform) => {
    transformRef.current = next;
    setTransformState(next);
  }, []);

  const panelSize = useCallback(() => {
    const bounds = leftPanelRef.current?.getBoundingClientRect();
    return { width: bounds?.width ?? 0, height: bounds?.height ?? 0 };
  }, []);

  const clamped = useCallback((next: ViewTransform) =>
    clampTransform(next, imagesRef.current, panelSize()), [panelSize]);

  const replaceImage = useCallback((index: number, next: LoadedImage) => {
    const updated = [...imagesRef.current];
    updated[index] = next;
    imagesRef.current = updated;
    setImages(updated);
    setTransform(clampTransform(transformRef.current, updated, panelSize()));
  }, [panelSize, setTransform]);

  const loadPath = useCallback(async (index: number, path: string) => {
    try {
      setError(null);
      const metadata = await invoke<ImageMetadata>("inspect_image", { path });
      const url = convertFileSrc(path);
      replaceImage(index, { ...metadata, path, url });
    } catch (reason) {
      setError(reason instanceof Error
        ? reason.message
        : typeof reason === "string"
          ? reason
          : "Không thể mở ảnh này.");
    }
  }, [replaceImage]);

  const pickImage = useCallback(async (index: number) => {
    const path = await open({
      multiple: false,
      directory: false,
      title: `Chọn ảnh ${index + 1}`,
      filters: [{ name: "Hình ảnh", extensions: imageExtensions }]
    });
    if (typeof path === "string") await loadPath(index, path);
  }, [loadPath]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    const drainOpenedFiles = async () => {
      try {
        const paths = await invoke<string[]>("take_opened_files");
        for (const path of paths.slice(0, 2)) {
          if (disposed) return;
          await loadPath(nextImagePanel(imagesRef.current), path);
        }
      } catch (reason) {
        if (!disposed) {
          setError(reason instanceof Error ? reason.message : "Không thể mở ảnh từ Finder.");
        }
      }
    };

    listen("open-image-files", () => { void drainOpenedFiles(); }).then((dispose) => {
      if (disposed) dispose();
      else {
        unlisten = dispose;
        void drainOpenedFiles();
      }
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [loadPath]);

  useEffect(() => {
    let dispose: (() => void) | undefined;
    getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type === "leave") {
        dropTargetRef.current = null;
        setDropTarget(null);
        return;
      }
      const leftBounds = leftPanelRef.current?.getBoundingClientRect();
      const rightBounds = rightPanelRef.current?.getBoundingClientRect();
      if (!leftBounds || !rightBounds) return;
      const point = dropEventPoint(
        event.payload.position,
        window.devicePixelRatio,
        navigator.userAgent.toLowerCase().includes("mac")
      );
      const detectedTarget = panelAtDropPoint(point, leftBounds, rightBounds, layoutRef.current);
      const target = event.payload.type === "drop"
        ? (dropTargetRef.current ?? detectedTarget)
        : detectedTarget;
      dropTargetRef.current = target;
      setDropTarget(target);
      if (event.payload.type === "drop") {
        dropTargetRef.current = null;
        setDropTarget(null);
        const path = event.payload.paths.find((candidate) => {
          const extension = candidate.split(".").pop()?.toLowerCase();
          return extension ? imageExtensions.includes(extension) : false;
        });
        if (path) void loadPath(target, path);
      }
    }).then((unlisten) => { dispose = unlisten; });
    return () => dispose?.();
  }, [loadPath]);

  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const observer = new ResizeObserver(() => setTransform(clamped(transformRef.current)));
    observer.observe(workspace);
    return () => observer.disconnect();
  }, [clamped, setTransform]);

  const focusAt = useCallback((clientX: number, clientY: number) => {
    const bounds = workspaceRef.current?.getBoundingClientRect();
    if (!bounds) return { x: 0, y: 0 };
    return panelPoint(
      { x: clientX - bounds.left, y: clientY - bounds.top },
      { width: bounds.width, height: bounds.height },
      layoutRef.current
    );
  }, []);

  const onWheel = (event: React.WheelEvent<HTMLElement>) => {
    if ((event.target as Element).closest(".toolbar")) return;
    const next = zoomAtPoint(transformRef.current, Math.exp(-event.deltaY * 0.0015), focusAt(event.clientX, event.clientY));
    setTransform(clamped(next));
  };

  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || (event.target as Element).closest(".toolbar, .empty-state, .window-controls")) return;
    dragRef.current = {
      active: true,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      mode: zKeyRef.current ? "zoom" : "pan"
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.x;
    const deltaY = event.clientY - drag.y;
    drag.x = event.clientX;
    drag.y = event.clientY;
    if (drag.mode === "zoom") {
      const raw = Math.abs(deltaX) >= Math.abs(deltaY) ? deltaX : -deltaY;
      const direction = event.altKey ? -Math.abs(raw) : raw;
      setTransform(clamped(zoomAtPoint(
        transformRef.current,
        1.018 ** direction,
        focusAt(event.clientX, event.clientY)
      )));
    } else {
      setTransform(clamped({
        ...transformRef.current,
        offsetX: transformRef.current.offsetX + deltaX,
        offsetY: transformRef.current.offsetY + deltaY
      }));
    }
  };

  const endPointer = (event: React.PointerEvent<HTMLElement>) => {
    if (dragRef.current.pointerId !== event.pointerId) return;
    dragRef.current.active = false;
    setDragging(false);
  };

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "z" && !(event.target as Element)?.matches?.("input, select")) {
        zKeyRef.current = true;
        setZoomCursor(true);
      }
      if (event.key === "Alt" && zKeyRef.current) setZoomOut(true);
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "z") {
        zKeyRef.current = false;
        setZoomCursor(false);
        setZoomOut(false);
      }
      if (event.key === "Alt") setZoomOut(false);
    };
    const blur = () => {
      zKeyRef.current = false;
      dragRef.current.active = false;
      setZoomCursor(false);
      setZoomOut(false);
      setDragging(false);
    };
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", blur);
    };
  }, []);

  const changeLayout = () => {
    const next: CompareLayout = layoutRef.current === "sideBySide" ? "stacked" : "sideBySide";
    layoutRef.current = next;
    setLayoutState(next);
    localStorage.setItem("compareLayout", next);
    requestAnimationFrame(() => setTransform(clamped(transformRef.current)));
  };

  const reset = () => {
    imagesRef.current = [null, null];
    setImages([null, null]);
    setTransform(DEFAULT_TRANSFORM);
    setError(null);
  };

  const imageLoadFailed = useCallback((index: number, path: string) => {
    const current = imagesRef.current[index];
    if (!current || current.path !== path) return;
    const updated = [...imagesRef.current];
    updated[index] = null;
    imagesRef.current = updated;
    setImages(updated);
    setError(`Không thể hiển thị ảnh “${current.fileName}”. Hãy chọn lại file.`);
  }, []);

  const panelProps = {
    transform,
    rulerVisible,
    rulerUnit,
    dragging,
    zoomCursor,
    zoomOut,
    onPick: pickImage,
    onImageError: imageLoadFailed
  };

  return (
    <>
      <Titlebar />
      <main
        ref={workspaceRef}
        className={`workspace ${layout === "sideBySide" ? "side-by-side" : "stacked"}`}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      >
        <Toolbar
          images={images}
          scale={transform.scale}
          layout={layout}
          rulerVisible={rulerVisible}
          rulerUnit={rulerUnit}
          onScale={(scale) => setTransform(clamped({ ...transformRef.current, scale }))}
          onLayout={changeLayout}
          onRuler={() => {
            setRulerVisible((current) => {
              localStorage.setItem("isRulerVisible", String(!current));
              return !current;
            });
          }}
          onUnit={(unit) => {
            setRulerUnit(unit);
            localStorage.setItem("rulerUnit", unit);
          }}
          onReset={reset}
        />
        <ImagePanel index={0} panelRef={leftPanelRef} image={images[0]} dropTarget={dropTarget === 0} {...panelProps} />
        <div className="divider" aria-hidden="true" />
        <ImagePanel index={1} panelRef={rightPanelRef} image={images[1]} dropTarget={dropTarget === 1} {...panelProps} />
        <div className={`zoom-hint ${zoomCursor ? "visible" : ""}`}>Giữ Z và kéo để zoom · Alt để thu nhỏ</div>
        {error && <button className="error-toast" type="button" onClick={() => setError(null)}>{error}<span>×</span></button>}
      </main>
    </>
  );
}
