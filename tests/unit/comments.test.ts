import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, insert, rpc } = vi.hoisted(() => ({
  getUser: vi.fn(),
  insert: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: () => ({ insert }),
    rpc,
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: () => { throw new Error("REDIRECT"); } }));

import { addComment, deleteComment } from "../../src/app/[board]/[id]/actions";

function form(body = "  좋은 글입니다  ") {
  const data = new FormData();
  data.set("body", body);
  return data;
}

beforeEach(() => {
  vi.resetAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "user-a" } }, error: null });
  insert.mockResolvedValue({ error: null });
  rpc.mockResolvedValue({ error: null });
});

describe("comment actions", () => {
  it("validates comment body before inserting", async () => {
    expect(await addComment(12, null, form(" "))).toEqual({ error: "댓글은 1~2,000자로 입력해 주세요" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects reply parents that are not positive safe integers", async () => {
    expect(await addComment(12, 0, form())).toEqual({ error: "답글 대상이 올바르지 않습니다" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("inserts the authenticated author and trimmed body", async () => {
    expect(await addComment(12, 4, form())).toEqual(undefined);
    expect(insert).toHaveBeenCalledWith({ post_id: 12, parent_id: 4, author_id: "user-a", body: "좋은 글입니다" });
  });

  it("uses the soft-delete RPC", async () => {
    expect(await deleteComment(9)).toEqual(undefined);
    expect(rpc).toHaveBeenCalledWith("soft_delete_comment", { p_id: 9 });
  });
});
