import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/[board]/[id]/actions", () => ({ addComment: vi.fn(), deleteComment: vi.fn() }));

import { prepareComments, visibleCommentCount, type CommentItem } from "../../src/lib/comments";

const active: CommentItem = {
  id: 1, author_id: "author", parent_id: null, body: "보이는 댓글", created_at: "2026-11-14T00:00:00Z", deleted_at: null, author: { nickname: "팬" },
};
const deleted: CommentItem = { ...active, id: 2, body: "삭제 전 비밀 내용", deleted_at: "2026-11-14T01:00:00Z" };

describe("comment display data", () => {
  it("does not count deleted comments and redacts their bodies before rendering", () => {
    expect(visibleCommentCount([active, deleted])).toBe(1);
    expect(prepareComments([active, deleted])[1].body).toBe("");
  });
});
