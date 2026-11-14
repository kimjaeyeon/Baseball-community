import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const { getUser, getClaims, rpc, from, revalidatePath } = vi.hoisted(() => ({
  getUser: vi.fn(), getClaims: vi.fn(), rpc: vi.fn(), from: vi.fn(), revalidatePath: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser, getClaims }, rpc, from }) }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
import Header from "../../src/components/Header";
import MePage from "../../src/app/me/page";
import { markNotificationsRead } from "../../src/app/me/actions";

let unread: boolean;
let notifications: unknown[];
let posts: unknown[];
let queryError: unknown;
beforeEach(() => {
  vi.resetAllMocks();
  unread = true; notifications = []; posts = []; queryError = null;
  getUser.mockResolvedValue({ data: { user: { id: "user-a" } }, error: null });
  getClaims.mockResolvedValue({ data: { claims: { sub: "user-a" } }, error: null });
  rpc.mockResolvedValue({ error: null });
  from.mockImplementation((table: string) => {
    let head = false;
    const query = {
      select: (_columns: string, opts?: { head?: boolean }) => { head = !!opts?.head; return query; },
      eq: () => query, is: () => query, order: () => query, limit: () => query,
      single: async () => ({ data: { nickname: "작성자" }, error: null }),
      then: (resolve: (result: unknown) => unknown) => Promise.resolve(resolve({
        data: head ? null : table === "notifications" ? notifications : posts,
        count: unread ? 1 : 0, error: queryError,
      })),
    };
    return query;
  });
});

it("links the header bell to /me with a dot only while unread notifications exist", async () => {
  let html = renderToStaticMarkup(await Header());
  expect(html).toContain('href="/me"');
  expect(html).toContain('aria-label="안 읽은 알림 있음"');
  unread = false;
  html = renderToStaticMarkup(await Header());
  expect(html).toContain('href="/me"');
  expect(html).not.toContain('aria-label="안 읽은 알림 있음"');
});

it("redirects anonymous /me visitors and read actions to login", async () => {
  getUser.mockResolvedValue({ data: { user: null }, error: null });
  await expect(MePage({ searchParams: Promise.resolve({}) } as never)).rejects.toThrow("REDIRECT:/login");
  await expect(markNotificationsRead()).rejects.toThrow("REDIRECT:/login");
  expect(rpc).not.toHaveBeenCalled();
});

it("renders comment, reply, best and deleted-post notifications and own posts", async () => {
  const post = { title: "내가 쓴 글", board: { slug: "kbo", name: "KBO" } };
  notifications = ["comment", "reply", "best"].map((kind, i) => ({ id: i + 1, kind, post_id: 7, read_at: null, created_at: "2026-11-14T01:00:00Z", post }));
  notifications.push({ id: 4, kind: "comment", post_id: 8, read_at: "2026-11-14T01:00:00Z", created_at: "2026-11-14T01:00:00Z", post: null });
  posts = [{ id: 7, created_at: "2026-11-14T01:00:00Z", ...post }];
  const html = renderToStaticMarkup(await MePage({ searchParams: Promise.resolve({}) } as never));
  expect(html).toContain("내 글에 댓글이 달렸어요");
  expect(html).toContain("내 댓글에 답글이 달렸어요");
  expect(html).toContain("베스트에 올랐어요");
  expect(html).toContain('href="/kbo/7"');
  expect(html).not.toContain('href="/kbo/8"');
  expect(html).toContain("삭제된 글");
  expect(html).toContain("내가 쓴 글");
  expect(html).toContain("모두 읽음");
});

it("renders empty states and reports read failures", async () => {
  const html = renderToStaticMarkup(await MePage({ searchParams: Promise.resolve({ error: "read" }) } as never));
  expect(html).toContain("아직 알림이 없어요");
  expect(html).toContain("아직 작성한 글이 없어요");
  expect(html).toContain('role="alert"');
});

it("marks only the authenticated session read and refreshes the header", async () => {
  await expect(markNotificationsRead()).rejects.toThrow("REDIRECT:/me");
  expect(rpc).toHaveBeenCalledWith("mark_notifications_read");
  expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
});

it("redirects to an error message when mark read fails", async () => {
  rpc.mockResolvedValue({ error: { message: "offline" } });
  await expect(markNotificationsRead()).rejects.toThrow("REDIRECT:/me?error=read");
  expect(revalidatePath).not.toHaveBeenCalled();
});

it("does not silently show an empty page when fetching notifications fails", async () => {
  queryError = { message: "offline" };
  await expect(MePage({ searchParams: Promise.resolve({}) } as never)).rejects.toThrow();
});
