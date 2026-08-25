import { useEffect, useRef } from "react";
import { tickStep } from "./core";
import type { LoadedImage, RulerUnit, ViewTransform } from "./types";

interface RulerCanvasProps {
  image: LoadedImage | null;
  transform: ViewTransform;
  unit: RulerUnit;
  visible: boolean;
}

const unitSize = (unit: RulerUnit) =>
  unit === "inches" ? 72 : unit === "centimeters" ? 72 / 2.54 : 1;

const unitLabel = (unit: RulerUnit) => ({
  pixels: "px",
  points: "pt",
  inches: "in",
  centimeters: "cm"
}[unit]);

export function RulerCanvas({ image, transform, unit, visible }: RulerCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const draw = () => {
      const bounds = parent.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      const pixelWidth = Math.max(Math.round(bounds.width * ratio), 1);
      const pixelHeight = Math.max(Math.round(bounds.height * ratio), 1);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, bounds.width, bounds.height);
      if (!visible || !image) return;

      context.strokeStyle = "rgba(255,255,255,.8)";
      context.fillStyle = "rgba(255,255,255,.9)";
      context.lineWidth = 0.75;
      context.font = '700 9px "Cascadia Mono", Consolas, monospace';
      context.shadowColor = "rgba(0,0,0,.75)";
      context.shadowBlur = 2;
      drawAxis(context, "horizontal", bounds.width, bounds.height, image, transform, unit);
      drawAxis(context, "vertical", bounds.width, bounds.height, image, transform, unit);
    };

    const observer = new ResizeObserver(draw);
    observer.observe(parent);
    draw();
    return () => observer.disconnect();
  }, [image, transform, unit, visible]);

  return <canvas ref={canvasRef} className="ruler-canvas" aria-hidden="true" />;
}

function drawAxis(
  context: CanvasRenderingContext2D,
  orientation: "horizontal" | "vertical",
  width: number,
  height: number,
  image: LoadedImage,
  transform: ViewTransform,
  unit: RulerUnit
) {
  const horizontal = orientation === "horizontal";
  const axisLength = horizontal ? width : height;
  const imageAxisLength = horizontal ? image.width : image.height;
  const fit = Math.min(width / image.width, height / image.height);
  const displayedLength = imageAxisLength * fit * transform.scale;
  const offset = horizontal ? transform.offsetX : transform.offsetY;
  const imageStart = (axisLength - displayedLength) / 2 + offset;
  const pointsPerUnit = unitSize(unit);
  const maximum = imageAxisLength / pointsPerUnit;
  const visibleStart = Math.max(-imageStart / (fit * transform.scale * pointsPerUnit), 0);
  const visibleEnd = Math.min(
    (axisLength - imageStart) / (fit * transform.scale * pointsPerUnit),
    maximum
  );
  const majorStep = tickStep(Math.max(visibleEnd - visibleStart, 1));
  const minorStep = majorStep / 5;
  let value = Math.max(Math.floor(visibleStart / minorStep) * minorStep, 0);
  const last = Math.min(Math.ceil(visibleEnd / minorStep) * minorStep, maximum);
  // Keep the horizontal numbers below the floating toolbar (ends at ~56 px).
  const top = 64;

  context.beginPath();
  let iterations = 0;
  while (value <= last + minorStep * 0.01 && iterations < 2000) {
    const position = imageStart + value * pointsPerUnit * fit * transform.scale;
    const ratio = value / majorStep;
    const major = Math.abs(Math.round(ratio) - ratio) < 0.001;
    const length = major ? 9 : 5;
    if (horizontal) {
      context.moveTo(position, top + 18);
      context.lineTo(position, top + 18 - length);
    } else {
      context.moveTo(26, position);
      context.lineTo(26 - length, position);
    }
    if (major) drawLabel(context, orientation, position, value, unit, top);
    value += minorStep;
    iterations += 1;
  }
  context.stroke();
}

function drawLabel(
  context: CanvasRenderingContext2D,
  orientation: "horizontal" | "vertical",
  position: number,
  value: number,
  unit: RulerUnit,
  top: number
) {
  const label = unit === "inches" || unit === "centimeters"
    ? (Math.abs(value) >= 10 ? Math.round(value).toString() : value.toFixed(1))
    : Math.round(value).toString();
  if (value === 0) {
    if (orientation === "horizontal") context.fillText(`0 ${unitLabel(unit)}`, position + 5, top + 8);
    return;
  }
  if (orientation === "horizontal") {
    context.fillText(label, Math.max(position - context.measureText(label).width / 2, 3), top + 8);
  } else {
    context.save();
    context.translate(10, Math.max(position + context.measureText(label).width / 2, 18));
    context.rotate(-Math.PI / 2);
    context.fillText(label, 0, 0);
    context.restore();
  }
}
