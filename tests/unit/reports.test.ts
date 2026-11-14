import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, from, revalidatePath } = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser }, from }) }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: () => { throw new Error("REDIRECT"); } }));

import { addComment, reportTarget } from "../../src/app/[board]/[id]/actions";
import { RATE_LIMIT_MESSAGE, friendlyDbError } from "../../src/lib/db-errors";

beforeEach(() => {
  vi.resetAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "fan-a" } }, error: null });
});

describe("friendlyDbError", () => {
  it("passes the rate limit message through", () => {
    expect(friendlyDbError({ message: "잠시 후 다시 시도해 주세요" }, "실패")).toBe(RATE_LIMIT_MESSAGE);
  });
  it("hides other database messages behind the fallback", () => {
    expect(friendlyDbError({ message: 'new row violates row-level security policy for table "posts"' }, "실패")).toBe("실패");
  });
});

describe("reportTarget", () => {
  it("inserts a report as the current user", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    from.mockReturnValue({ insert });
    await expect(reportTarget("post", 12, "스팸")).resolves.toEqual({ reported: true });
    expect(from).toHaveBeenCalledWith("reports");
    expect(insert).toHaveBeenCalledWith({ target_type: "post", target_id: 12, reporter_id: "fan-a", reason: "스팸" });
  });
  it("treats a duplicate report as already reported", async () => {
    from.mockReturnValue({ insert: vi.fn().mockResolvedValue({ error: { code: "23505", message: "duplicate" } }) });
    await expect(reportTarget("comment", 3, "욕설")).resolves.toEqual({ reported: true });
  });
  it("rejects unknown reasons and target types without touching the database", async () => {
    await expect(reportTarget("post", 12, "아무거나")).resolves.toEqual({ error: "신고 사유를 선택해 주세요" });
    await expect(reportTarget("user" as never, 12, "스팸")).resolves.toEqual({ error: "신고 대상이 올바르지 않습니다" });
    await expect(reportTarget("post", 0, "스팸")).resolves.toEqual({ error: "신고 대상이 올바르지 않습니다" });
    expect(from).not.toHaveBeenCalled();
  });
  it("reports a missing target", async () => {
    from.mockReturnValue({ insert: vi.fn().mockResolvedValue({ error: { code: "23503", message: "신고 대상이 없습니다" } }) });
    await expect(reportTarget("post", 99, "기타")).resolves.toEqual({ error: "삭제되었거나 없는 대상입니다" });
  });
});

describe("addComment rate limit", () => {
  it("shows the rate limit message from the database", async () => {
    from.mockReturnValue({ insert: vi.fn().mockResolvedValue({ error: { code: "P0001", message: "잠시 후 다시 시도해 주세요" } }) });
    const form = new FormData();
    form.set("body", "도배 댓글");
    await expect(addComment(1, null, form)).resolves.toEqual({ error: RATE_LIMIT_MESSAGE });
  });
});
