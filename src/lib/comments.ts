export type CommentItem = {
  id: number;
  author_id: string;
  parent_id: number | null;
  body: string;
  created_at: string;
  deleted_at: string | null;
  author: { nickname: string };
};

export function prepareComments(comments: CommentItem[]): CommentItem[] {
  return comments.map((comment) => comment.deleted_at ? { ...comment, body: "" } : comment);
}

export function visibleCommentCount(comments: CommentItem[]) {
  return comments.filter((comment) => comment.deleted_at === null).length;
}
