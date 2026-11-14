"use client";

import { useState, useTransition } from "react";
import type { PostListItem } from "@/lib/posts";
import { loadMorePosts } from "@/app/actions";
import PostRow from "./PostRow";

export default function PostList({ initial, board, best, emptyMessage = "아직 글이 없어요" }: {
  initial: { items: PostListItem[]; nextCursor: string | null }; board?: string; best?: boolean; emptyMessage?: string;
}) {
  const [items, setItems] = useState(initial.items);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  function loadMore() {
    if (!cursor || pending) return;
    startTransition(async () => {
      try {
        const next = await loadMorePosts({ board, best, cursor });
        setItems((previous) => [...previous, ...next.items.filter((p) => !previous.some((old) => old.id === p.id))]);
        setCursor(next.nextCursor);
        setError("");
      } catch { setError("목록을 불러오지 못했습니다. 다시 시도해 주세요"); }
    });
  }
  return <>
    {items.length ? <ul>{items.map((post) => <PostRow key={post.id} post={post} />)}</ul> : <p className="py-12 text-center text-zinc-500">{emptyMessage}</p>}
    {cursor && <button className="mt-6 w-full rounded border p-3 disabled:opacity-50" onClick={loadMore} disabled={pending}>{pending ? "불러오는 중…" : "더 보기"}</button>}
    {error && <p role="alert">{error}</p>}
  </>;
}
