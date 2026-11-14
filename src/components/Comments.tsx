"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { addComment, deleteComment } from "@/app/[board]/[id]/actions";
import { timeAgo } from "@/lib/ui";
import { visibleCommentCount, type CommentItem } from "@/lib/comments";
import ReportButton from "@/components/ReportButton";

type ActionState = { error?: string } | undefined;

function CommentForm({ postId, parentId, onDone }: { postId: number; parentId: number | null; onDone?: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    async (_previous, formData) => {
      const result = await addComment(postId, parentId, formData);
      if (!result) onDone?.();
      return result;
    },
    undefined,
  );
  return <form action={action} className="mt-3 flex gap-2">
    <textarea name="body" aria-label={parentId === null ? "댓글" : "답글"} className="min-h-20 flex-1 rounded border p-2" maxLength={2000} required />
    <button className="self-end rounded bg-zinc-900 px-3 py-2 text-white disabled:opacity-50" disabled={pending}>{pending ? "등록 중…" : "등록"}</button>
    {state?.error && <p role="alert" className="self-end text-sm text-red-700">{state.error}</p>}
  </form>;
}

function DeleteCommentButton({ id }: { id: number }) {
  const [state, action, pending] = useActionState(async () => deleteComment(id), undefined);
  return <form action={action} className="inline"><button className="text-xs text-red-700 underline disabled:opacity-50" disabled={pending}>{pending ? "삭제 중…" : "삭제"}</button>{state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}</form>;
}

function CommentRow({ comment, postId, userId, reply, reported }: { comment: CommentItem; postId: number; userId: string | null; reply: boolean; reported: boolean }) {
  const [replying, setReplying] = useState(false);
  return <li className={`border-t py-4 ${reply ? "ml-6 border-l pl-4" : ""}`}>
    {comment.deleted_at ? <p className="text-sm text-zinc-500">삭제된 댓글입니다</p> : <>
      <p className="text-sm text-zinc-500">{comment.author.nickname} · {timeAgo(comment.created_at)}</p>
      <p className="mt-2 whitespace-pre-wrap break-words">{comment.body}</p>
      <div className="mt-2 flex gap-3">
        {!reply && userId && <button type="button" className="text-xs underline" onClick={() => setReplying((value) => !value)}>답글</button>}
        {userId === comment.author_id && <DeleteCommentButton id={comment.id} />}
        {userId && userId !== comment.author_id && <ReportButton targetType="comment" targetId={comment.id} initialReported={reported} compact />}
      </div>
      {replying && <CommentForm postId={postId} parentId={comment.id} onDone={() => setReplying(false)} />}
    </>}
  </li>;
}

export default function Comments({ comments, postId, userId, reportedIds = [] }: { comments: CommentItem[]; postId: number; userId: string | null; reportedIds?: number[] }) {
  const visibleCount = visibleCommentCount(comments);
  const replies = new Map<number, CommentItem[]>();
  const parents: CommentItem[] = [];
  for (const comment of comments) {
    if (comment.parent_id === null) parents.push(comment);
    else replies.set(comment.parent_id, [...(replies.get(comment.parent_id) ?? []), comment]);
  }
  return <section className="mt-10 border-t pt-6">
    <h2 className="text-xl font-bold">댓글 {visibleCount}</h2>
    {userId ? <CommentForm postId={postId} parentId={null} /> : <p className="mt-4 text-sm"><Link className="underline" href="/login">로그인</Link> 후 댓글을 남길 수 있습니다.</p>}
    <ul className="mt-5">
      {parents.map((comment) => <li key={comment.id}>
        <ul><CommentRow comment={comment} postId={postId} userId={userId} reply={false} reported={reportedIds.includes(comment.id)} /></ul>
        {replies.get(comment.id)?.length ? <ul>{replies.get(comment.id)!.map((child) => <CommentRow key={child.id} comment={child} postId={postId} userId={userId} reply reported={reportedIds.includes(child.id)} />)}</ul> : null}
      </li>)}
    </ul>
  </section>;
}
