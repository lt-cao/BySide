import { describe, expect, it } from "vitest";
import {
  displayDpi,
  dropImageAssignments,
  dropEventPoint,
  MAX_SCALE,
  middleEllipsisParts,
  nextImagePanel,
  isNewerVersion,
  overlayPanelAtPoint,
  panelAtDropPoint,
  panelPoint,
  tickStep,
  zoomAtPoint
} from "./core";

describe("shared image transform", () => {
  it("maps a point into the second side-by-side panel", () => {
    expect(panelPoint({ x: 750, y: 200 }, { width: 1002, height: 600 }, "sideBySide"))
      .toEqual({ x: -2, y: -100 });
  });

  it("keeps the focused image point stable while zooming", () => {
    expect(zoomAtPoint(
      { scale: 1, offsetX: 0, offsetY: 0 },
      2,
      { x: 100, y: -40 }
    )).toEqual({ scale: 2, offsetX: -100, offsetY: 40 });
  });

  it("limits zoom to 1500 percent", () => {
    expect(zoomAtPoint(
      { scale: 10, offsetX: 0, offsetY: 0 },
      2,
      { x: 0, y: 0 }
    ).scale).toBe(MAX_SCALE);
    expect(MAX_SCALE).toBe(15);
  });

  it("uses clean ruler intervals", () => {
    expect(tickStep(800)).toBe(100);
    expect(tickStep(300)).toBe(50);
    expect(tickStep(10)).toBe(2);
  });

  it("uses 72 DPI only when the image has no stored DPI", () => {
    expect(displayDpi(300)).toBe(300);
    expect(displayDpi(null)).toBe(72);
  });

  it("keeps the filename ending visible for middle ellipsis", () => {
    expect(middleEllipsisParts("anh-san-pham-phien-ban-cuoi-cung.jpg"))
      .toEqual({ leading: "anh-san-pham-phien-ban-cuo", trailing: "i-cung.jpg" });
    expect(middleEllipsisParts("anh-01.jpg"))
      .toEqual({ leading: "anh-01.jpg", trailing: "" });
  });

  it("selects the empty right panel for the next opened image", () => {
    const image = { fileName: "left.jpg" } as never;
    expect(nextImagePanel([null, null])).toBe(0);
    expect(nextImagePanel([image, null])).toBe(1);
    expect(nextImagePanel([image, image])).toBe(0);
  });

  it("splits two dropped images between the left and right panels", () => {
    expect(dropImageAssignments(["first.png", "second.jpg"], 1)).toEqual([
      { index: 0, path: "first.png" },
      { index: 1, path: "second.jpg" }
    ]);
    expect(dropImageAssignments(["single.png"], 1)).toEqual([
      { index: 1, path: "single.png" }
    ]);
  });

  it("keeps macOS Retina drop coordinates in logical points", () => {
    expect(dropEventPoint({ x: 900, y: 300 }, 2, true))
      .toEqual({ x: 900, y: 300 });
    expect(dropEventPoint({ x: 1800, y: 600 }, 2, false))
      .toEqual({ x: 900, y: 300 });
  });

  it("recognizes the right panel using its real bounds", () => {
    const left = { left: 0, right: 589, top: 36, bottom: 760 };
    const right = { left: 591, right: 1180, top: 36, bottom: 760 };
    expect(panelAtDropPoint({ x: 900, y: 300 }, left, right, "sideBySide")).toBe(1);
    expect(panelAtDropPoint({ x: 300, y: 300 }, left, right, "sideBySide")).toBe(0);
  });

  it("uses the movable divider to target Before or After", () => {
    const bounds = { left: 20, right: 1020, top: 36, bottom: 760 };
    expect(overlayPanelAtPoint({ x: 619, y: 300 }, bounds, 60)).toBe(0);
    expect(overlayPanelAtPoint({ x: 621, y: 300 }, bounds, 60)).toBe(1);
  });

  it("compares release versions numerically", () => {
    expect(isNewerVersion("v1.3.2", "1.3.1")).toBe(true);
    expect(isNewerVersion("1.10.0", "1.9.9")).toBe(true);
    expect(isNewerVersion("v1.3.1", "1.3.1")).toBe(false);
  });
});
