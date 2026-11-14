import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, from, revalidatePath } = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser }, from }) }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: () => { throw new Error("REDIRECT"); } }));

import { toggleLike } from "../../src/app/[board]/[id]/actions";

function query(result: unknown) {
  return { eq: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue(result) }) }) };
}

beforeEach(() => {
  vi.resetAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "fan-a" } }, error: null });
});

describe("toggleLike", () => {
  it("adds a new like then returns the current database state", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    let likeReads = 0;
    from.mockImplementation((table: string) => table === "post_likes"
      ? { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: vi.fn().mockImplementation(() => Promise.resolve(++likeReads === 1 ? { data: null, error: null } : { data: { post_id: 12 }, error: null })) }) }) }), insert }
      : { select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { like_count: 3 }, error: null }) }) }) });
    expect(await toggleLike(12)).toEqual({ liked: true, count: 3 });
    expect(insert).toHaveBeenCalledWith({ post_id: 12, user_id: "fan-a" });
  });

  it("deletes an existing like and returns the refreshed state", async () => {
    const remove = vi.fn().mockReturnValue({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) });
    let likeReads = 0;
    from.mockImplementation((table: string) => table === "post_likes"
      ? { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: vi.fn().mockImplementation(() => Promise.resolve(++likeReads === 1 ? { data: { post_id: 12 }, error: null } : { data: null, error: null })) }) }) }), delete: remove }
      : { select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { like_count: 2 }, error: null }) }) }) });
    expect(await toggleLike(12)).toEqual({ liked: false, count: 2 });
    expect(remove).toHaveBeenCalledOnce();
  });

  it("ignores a duplicate insert and re-reads current state", async () => {
    const insert = vi.fn().mockResolvedValue({ error: { code: "23505" } });
    let likeReads = 0;
    from.mockImplementation((table: string) => table === "post_likes"
      ? { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: vi.fn().mockImplementation(() => Promise.resolve(++likeReads === 1 ? { data: null, error: null } : { data: { post_id: 12 }, error: null })) }) }) }), insert }
      : { select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { like_count: 5 }, error: null }) }) }) });
    expect(await toggleLike(12)).toEqual({ liked: true, count: 5 });
  });

  it("returns a friendly error for non-unique failures", async () => {
    const insert = vi.fn().mockResolvedValue({ error: { code: "23514" } });
    from.mockImplementation((table: string) => table === "post_likes"
      ? { select: () => query({ data: null, error: null }), insert }
      : { select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { like_count: 0 }, error: null }) }) }) });
    expect(await toggleLike(12)).toEqual({ error: "추천을 처리하지 못했습니다. 다시 시도해 주세요" });
  });

  it("returns a friendly error when the current state cannot be read", async () => {
    from.mockImplementation((table: string) => table === "post_likes"
      ? { select: () => query({ data: null, error: { message: "failed" } }) }
      : { select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { like_count: 0 }, error: null }) }) }) });
    expect(await toggleLike(12)).toEqual({ error: "추천 상태를 불러오지 못했습니다. 다시 시도해 주세요" });
  });

  it("redirects anonymous users to login", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(toggleLike(12)).rejects.toThrow("REDIRECT");
  });

  it("rejects an invalid post id before querying", async () => {
    expect(await toggleLike(0)).toEqual({ error: "글 정보가 올바르지 않습니다" });
    expect(from).not.toHaveBeenCalled();
  });
});
