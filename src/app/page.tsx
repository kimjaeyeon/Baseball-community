import Link from "next/link";
import PostList from "@/components/PostList";
import { listPosts } from "@/lib/posts";

export default async function Home({ searchParams }: PageProps<"/">) {
  const best = (await searchParams).tab !== "new";
  const initial = await listPosts({ best });
  return <section>
    <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">야구 커뮤니티</h1><Link href="/write" className="rounded bg-zinc-900 px-4 py-2 text-white">글쓰기</Link></div>
    <nav className="mt-6 flex gap-6 border-b pb-3" aria-label="글 정렬">
      <Link href="/?tab=best" aria-current={best ? "page" : undefined} className={best ? "font-bold underline underline-offset-8" : undefined}>베스트</Link>
      <Link href="/?tab=new" aria-current={!best ? "page" : undefined} className={!best ? "font-bold underline underline-offset-8" : undefined}>최신</Link>
    </nav>
    <PostList key={best ? "best" : "new"} initial={initial} best={best} emptyMessage={best ? "아직 베스트 글이 없어요" : "아직 글이 없어요"} />
  </section>;
}
