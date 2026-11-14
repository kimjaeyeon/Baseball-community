import { beforeEach, expect, it, vi } from "vitest";
const { rpc, getPost, revalidatePath, from, remove } = vi.hoisted(() => ({ rpc: vi.fn(), getPost: vi.fn(), revalidatePath: vi.fn(), from: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "fan" } }, error: null }) }, rpc, from, storage: { from: () => ({ remove }) } }) }));
vi.mock("@/lib/posts", () => ({ getBoard: async () => ({ id: 1, slug: "kbo" }), getPost }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
import { createPost, updatePost } from "../../src/app/write/actions";
const images = [{ path: "fan/a.webp", thumb_path: "fan/a_t.webp" }, { path: "fan/b.gif", thumb_path: "fan/b_t.webp" }];
function form() { const data = new FormData(); for (const [k, v] of Object.entries({ board: "kbo", kind: "text", title: "사진 글", body: "본문" })) data.set(k, v); return data; }
beforeEach(() => {
  vi.clearAllMocks(); rpc.mockResolvedValue({ data: 42, error: null });
  getPost.mockResolvedValue({ author_id: "fan", kind: "text", board: { slug: "mlb" } });
  from.mockReturnValue({ select: () => ({ eq: async () => ({ data: [], error: null }) }) });
  remove.mockResolvedValue({ error: null });
});
it("sends ordered attachments and representative to the atomic create", async () => {
  await expect(createPost(form(), images, 1)).rejects.toThrow("REDIRECT:/kbo/42");
  expect(rpc).toHaveBeenCalledWith("save_post_with_images", { p_id: null, p_board_id: 1, p_kind: "text", p_title: "사진 글", p_body: "본문", p_url: null, p_images: images, p_representative: 1 });
});
it("replaces edit attachments and revalidates both boards", async () => {
  await expect(updatePost(42, form(), images, 0)).rejects.toThrow("REDIRECT:/kbo/42");
  expect(rpc.mock.calls[0][1]).toMatchObject({ p_id: 42, p_images: images, p_representative: 0 });
  expect(revalidatePath).toHaveBeenCalledWith("/mlb");
});
it("reports database image failure without redirecting", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "23514" } });
  expect(await createPost(form(), images, 0)).toHaveProperty("error");
  expect(revalidatePath).not.toHaveBeenCalled();
});
it("deletes removed persisted originals and thumbs only after a successful save", async () => {
  const completed = vi.fn().mockResolvedValue({ error: null });
  from.mockImplementation((table: string) => table === "post_image_cleanup"
    ? { select: () => ({ eq: async () => ({ data: [{ path: "fan/old.webp" }, { path: "fan/old_t.webp" }], error: null }) }), delete: () => ({ in: completed }) }
    : { select: () => ({ in: async () => ({ data: [], error: null }) }) });
  await expect(updatePost(42, form(), images, 0)).rejects.toThrow("REDIRECT");
  expect(remove).toHaveBeenCalledWith(["fan/old.webp", "fan/old_t.webp"]);
  expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(remove.mock.invocationCallOrder[0]);
  expect(completed).toHaveBeenCalledWith("path", ["fan/old.webp", "fan/old_t.webp"]);
});
it("retains cleanup jobs and reports a retryable saved-state error when storage fails", async () => {
  const completed = vi.fn();
  from.mockImplementation((table: string) => table === "post_image_cleanup"
    ? { select: () => ({ eq: async () => ({ data: [{ path: "fan/old.webp" }], error: null }) }), delete: completed }
    : { select: () => ({ in: async () => ({ data: [], error: null }) }) });
  remove.mockResolvedValue({ error: { message: "offline" } });
  expect(await updatePost(42, form(), images, 0)).toEqual({ error: expect.stringContaining("글은 저장됐지만") });
  expect(completed).not.toHaveBeenCalled();
  expect(revalidatePath).toHaveBeenCalledWith("/kbo/42");
});
