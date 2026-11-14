import Link from "next/link";
import type { PostListItem } from "@/lib/posts";
import { timeAgo } from "@/lib/ui";

export default function PostRow({ post }: { post: PostListItem }) {
  let domain = "링크";
  if (post.kind === "link" && post.url) {
    try { domain = new URL(post.url).hostname; } catch { /* DB permits http(s) prefixes only. */ }
  }
  const color = post.board.slug === "kbo" ? "bg-blue-100 text-blue-900" : post.board.slug === "mlb" ? "bg-red-100 text-red-900" : "bg-green-100 text-green-900";
  return <li className="border-b py-4">
    <Link href={`/${post.board.slug}/${post.id}`} className="flex gap-3">
      <span className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center overflow-hidden rounded p-1 text-center text-xs ${color}`}>
        {post.kind === "link" ? <><span aria-hidden>↗</span><span className="w-full truncate">{domain}</span></> : post.board.name}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex gap-2"><span className="line-clamp-2 font-semibold">{post.is_best && "🔥 "}{post.title}</span>{post.comment_count > 0 && <span>[{post.comment_count}]</span>}</span>
        <span className="mt-2 block text-xs text-zinc-500">▲{post.like_count} · 조회 {post.view_count.toLocaleString("ko-KR")} · {post.board.name} · {timeAgo(post.created_at)} · {post.author.nickname}</span>
      </span>
    </Link>
  </li>;
}
