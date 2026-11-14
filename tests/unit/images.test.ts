import { describe, expect, it } from "vitest";
import { validateImages } from "../../src/lib/validate";

const file = (name = "photo.jpg", type = "image/jpeg", size = 1) => new File([new Uint8Array(size)], name, { type });
describe("validateImages", () => {
  it("rejects eleven files", () => expect(validateImages(Array.from({ length: 11 }, () => file()))).toEqual(expect.any(String)));
  it("rejects six MB", () => expect(validateImages([file("x.jpg", "image/jpeg", 6 * 1024 * 1024)])).toEqual(expect.any(String)));
  it("rejects BMP and disguised extensions", () => {
    expect(validateImages([file("x.bmp", "image/bmp")])).toEqual(expect.any(String));
    expect(validateImages([file("x.bmp", "image/jpeg")])).toEqual(expect.any(String));
    expect(validateImages([file("x.jpg", "text/html")])).toEqual(expect.any(String));
  });
  it("accepts ten files and exactly five MB", () => {
    expect(validateImages(Array.from({ length: 10 }, () => file()))).toBeNull();
    expect(validateImages([file("x.PNG", "image/png", 5 * 1024 * 1024)])).toBeNull();
    expect(validateImages([file("x.gif", "image/gif"), file("x.webp", "image/webp")])).toBeNull();
    expect(validateImages([])).toBeNull();
  });
});
