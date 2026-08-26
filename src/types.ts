export type CompareLayout = "sideBySide" | "stacked";
export type RulerUnit = "pixels" | "points" | "inches" | "centimeters";

export interface ImageMetadata {
  fileName: string;
  width: number;
  height: number;
  colorSpace: string;
  dpi: number | null;
  mimeType: string;
  fileSize: number;
}

export interface LoadedImage extends ImageMetadata {
  path: string;
  url: string;
}

export interface ViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}
