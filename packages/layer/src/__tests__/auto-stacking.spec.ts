import { describe, expect, it } from "vitest";
import { AnchorEdge } from "@ghost-shell/contracts/layer";
import type { StackedSurface } from "../auto-stacking.js";
import { applyAutoStacking } from "../auto-stacking.js";

function mockElement(width = 300, height = 60): HTMLElement {
  return {
    style: { transform: "" },
    getBoundingClientRect: () => ({
      width,
      height,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      x: 0,
      y: 0,
      toJSON: () => {},
    }),
  } as unknown as HTMLElement;
}

function makeSurface(
  id: string,
  anchor: number,
  autoStack?: { direction: "up" | "down" | "left" | "right"; gap: number },
  order?: number,
): StackedSurface {
  return {
    surfaceId: id,
    surface: {
      id,
      component: "test",
      layer: "overlay",
      anchor,
      autoStack,
      order,
    },
    element: mockElement(),
  };
}

describe("applyAutoStacking", () => {
  it("single surface with autoStack — no transform", () => {
    const s = makeSurface("a", AnchorEdge.Top | AnchorEdge.Right, { direction: "down", gap: 8 });
    applyAutoStacking([s]);
    expect(s.element.style.transform).toBe("");
  });

  it("two surfaces same anchor, direction down — second gets translateY", () => {
    const a = makeSurface("a", AnchorEdge.Top | AnchorEdge.Right, { direction: "down", gap: 8 }, 0);
    const b = makeSurface("b", AnchorEdge.Top | AnchorEdge.Right, { direction: "down", gap: 8 }, 1);
    applyAutoStacking([a, b]);
    expect(a.element.style.transform).toBe("");
    expect(b.element.style.transform).toBe("translateY(68px)");
  });

  it("three surfaces stacking — cumulative offsets", () => {
    const surfaces = [0, 1, 2].map((i) =>
      makeSurface(`s${i}`, AnchorEdge.Top | AnchorEdge.Right, { direction: "down", gap: 10 }, i),
    );
    applyAutoStacking(surfaces);
    expect(surfaces[0].element.style.transform).toBe("");
    expect(surfaces[1].element.style.transform).toBe("translateY(70px)");
    expect(surfaces[2].element.style.transform).toBe("translateY(140px)");
  });

  it("direction up produces negative translateY", () => {
    const a = makeSurface("a", AnchorEdge.Bottom | AnchorEdge.Right, { direction: "up", gap: 8 }, 0);
    const b = makeSurface("b", AnchorEdge.Bottom | AnchorEdge.Right, { direction: "up", gap: 8 }, 1);
    applyAutoStacking([a, b]);
    expect(a.element.style.transform).toBe("");
    expect(b.element.style.transform).toBe("translateY(-68px)");
  });

  it("direction right produces translateX", () => {
    const a = makeSurface("a", AnchorEdge.Top | AnchorEdge.Left, { direction: "right", gap: 4 }, 0);
    const b = makeSurface("b", AnchorEdge.Top | AnchorEdge.Left, { direction: "right", gap: 4 }, 1);
    applyAutoStacking([a, b]);
    expect(b.element.style.transform).toBe("translateX(304px)");
  });

  it("direction left produces negative translateX", () => {
    const a = makeSurface("a", AnchorEdge.Top | AnchorEdge.Right, { direction: "left", gap: 4 }, 0);
    const b = makeSurface("b", AnchorEdge.Top | AnchorEdge.Right, { direction: "left", gap: 4 }, 1);
    applyAutoStacking([a, b]);
    expect(b.element.style.transform).toBe("translateX(-304px)");
  });

  it("surfaces without autoStack at same anchor are unaffected", () => {
    const a = makeSurface("a", AnchorEdge.Top | AnchorEdge.Right, { direction: "down", gap: 8 }, 0);
    const b = makeSurface("b", AnchorEdge.Top | AnchorEdge.Right, undefined);
    b.element.style.transform = "scale(2)"; // pre-existing
    applyAutoStacking([a, b]);
    // Single autoStack surface → no stacking transform
    expect(a.element.style.transform).toBe("");
    // Non-autoStack surface → cleared
    expect(b.element.style.transform).toBe("");
  });

  it("gap value affects offset", () => {
    const a = makeSurface("a", AnchorEdge.Top, { direction: "down", gap: 20 }, 0);
    const b = makeSurface("b", AnchorEdge.Top, { direction: "down", gap: 20 }, 1);
    applyAutoStacking([a, b]);
    expect(b.element.style.transform).toBe("translateY(80px)"); // 60 + 20
  });

  it("sorts by order regardless of input order", () => {
    const a = makeSurface("a", AnchorEdge.Top, { direction: "down", gap: 0 }, 2);
    const b = makeSurface("b", AnchorEdge.Top, { direction: "down", gap: 0 }, 1);
    applyAutoStacking([a, b]);
    // b has lower order so comes first (no transform), a gets offset
    expect(b.element.style.transform).toBe("");
    expect(a.element.style.transform).toBe("translateY(60px)");
  });
});
