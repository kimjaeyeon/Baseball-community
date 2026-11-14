import { afterEach, expect, it, vi } from "vitest";
import { resizeImage, makeThumb } from "../../src/lib/images";

afterEach(() => vi.unstubAllGlobals());
function canvasFixture(width: number, height: number) {
  const drawImage = vi.fn();
  const canvas = { width: 0, height: 0, getContext: () => ({ drawImage }), toBlob: (cb: (blob: Blob) => void) => cb(new Blob(["webp"], { type: "image/webp" })) };
  vi.stubGlobal("document", { createElement: () => canvas });
  vi.stubGlobal("Image", class {
    naturalWidth = width; naturalHeight = height;
    onload?: () => void;
    set src(_value: string) { queueMicrotask(() => this.onload?.()); }
  });
  return { canvas, drawImage };
}
it("resizes a landscape photo to a 1600px long edge", async () => {
  const { canvas, drawImage } = canvasFixture(3200, 1800);
  expect((await resizeImage(new File(["x"], "x.jpg"), 1600)).type).toBe("image/webp");
  expect([canvas.width, canvas.height]).toEqual([1600, 900]);
  expect(drawImage.mock.calls[0].slice(1)).toEqual([0, 0, 1600, 900]);
});
it("does not upscale small portrait photos", async () => {
  const { canvas } = canvasFixture(200, 400);
  await resizeImage(new File(["x"], "x.png"), 1600);
  expect([canvas.width, canvas.height]).toEqual([200, 400]);
});
it("crops the center square for the 240px thumbnail", async () => {
  const { canvas, drawImage } = canvasFixture(1200, 800);
  expect((await makeThumb(new File(["x"], "x.gif"), 240)).type).toBe("image/webp");
  expect([canvas.width, canvas.height]).toEqual([240, 240]);
  expect(drawImage.mock.calls[0].slice(1)).toEqual([200, 0, 800, 800, 0, 0, 240, 240]);
});
