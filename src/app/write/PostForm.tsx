"use client";

import { useActionState, useState } from "react";
import { createPost, updatePost } from "./actions";
import type { PostDetail } from "@/lib/posts";

type FormState = { error?: string; errors?: Record<string, string> } | null;
export default function PostForm({ boards, post, initialBoard }: {
  boards: { slug: string; name: string }[]; post: PostDetail | null; initialBoard?: string;
}) {
  const [kind, setKind] = useState(post?.kind ?? "text");
  const [state, action, pending] = useActionState<FormState, FormData>(
    async (_previous, data) => post ? updatePost(post.id, data) : createPost(data), null,
  );
  return <form action={action} className="mt-6 flex flex-col gap-4">
    <fieldset className="flex gap-5" disabled={!!post}>
      <legend className="mb-2">글 종류{post && " (수정 시 변경 불가)"}</legend>
      <label><input type="radio" checked={kind === "text"} onChange={() => setKind("text")} /> 본문</label>
      <label><input type="radio" checked={kind === "link"} onChange={() => setKind("link")} /> 링크</label>
    </fieldset>
    <input type="hidden" name="kind" value={kind} />
    <label className="flex flex-col gap-1">게시판<select name="board" className="rounded border p-2" defaultValue={post?.board.slug ?? initialBoard ?? boards[0]?.slug} required>
      {boards.map((board) => <option key={board.slug} value={board.slug}>{board.name}</option>)}
    </select></label>
    <label className="flex flex-col gap-1">제목 (2~100자)<input name="title" className="rounded border p-2" defaultValue={post?.title} required /></label>
    {state?.errors?.title && <p role="alert" className="text-red-700">{state.errors.title}</p>}
    {kind === "link" && <label className="flex flex-col gap-1">URL<input name="url" type="url" className="rounded border p-2" defaultValue={post?.url ?? ""} required /></label>}
    {state?.errors?.url && <p role="alert" className="text-red-700">{state.errors.url}</p>}
    <label className="flex flex-col gap-1">{kind === "text" ? "본문 (마크다운, 1~20,000자)" : "내 코멘트 (선택, 2,000자 이내)"}
      <textarea name="body" className="min-h-64 rounded border p-2" defaultValue={post?.body ?? ""} required={kind === "text"} />
    </label>
    {state?.errors?.body && <p role="alert" className="text-red-700">{state.errors.body}</p>}
    {state?.error && <p role="alert" className="text-red-700">{state.error}</p>}
    <button className="rounded bg-zinc-900 p-3 text-white disabled:opacity-50" disabled={pending}>{pending ? "저장 중…" : post ? "수정하기" : "등록하기"}</button>
  </form>;
}
