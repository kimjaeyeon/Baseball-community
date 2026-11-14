import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { getClaims, createServerClient } = vi.hoisted(() => ({ getClaims: vi.fn(), createServerClient: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient }));
import { proxy } from "../../src/proxy";

beforeEach(() => {
  vi.resetAllMocks();
  createServerClient.mockReturnValue({ auth: { getClaims } });
});

it("sets a one year httpOnly viewer cookie and forwards it on the first request", async () => {
  const response = await proxy(new NextRequest("http://localhost/kbo/1"));
  const cookie = response.cookies.get("vk");
  expect(cookie?.value).toMatch(/^[\da-f-]{36}$/);
  expect(cookie).toMatchObject({ httpOnly: true, path: "/", maxAge: 31536000, sameSite: "lax" });
  expect(response.headers.get("x-middleware-request-cookie")).toContain(`vk=${cookie?.value}`);
});

it("keeps an existing viewer cookie stable without extending its expiry", async () => {
  const response = await proxy(new NextRequest("http://localhost/kbo/1", { headers: { cookie: "vk=existing-viewer" } }));
  expect(response.cookies.get("vk")).toBeUndefined();
  expect(response.headers.get("x-middleware-request-cookie")).toContain("vk=existing-viewer");
});

it("preserves refreshed auth cookies and cache headers alongside a secure viewer cookie", async () => {
  getClaims.mockImplementation(async () => {
    const options = createServerClient.mock.calls[0][2];
    options.cookies.setAll([{ name: "sb-test", value: "refreshed", options: { httpOnly: true } }], { "cache-control": "private, no-store" });
    return { data: null };
  });
  const response = await proxy(new NextRequest("https://example.com/kbo/1"));
  expect(response.cookies.get("vk")).toMatchObject({ secure: true, httpOnly: true });
  expect(response.cookies.get("sb-test")?.value).toBe("refreshed");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("x-middleware-request-cookie")).toContain("vk=");
});
