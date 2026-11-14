import Link from "next/link";
import { notFound } from "next/navigation";
import { getBoard, listPosts } from "@/lib/posts";
import PostList from "@/components/PostList";

export default async function BoardPage({ params }: PageProps<"/[board]">) {
  const { board: slug } = await params;
  const board = await getBoard(slug);
  if (!board) notFound();
  const initial = await listPosts({ board: slug });
  return <section>
    <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">{board.name}</h1><Link href={`/write?board=${slug}`} className="rounded bg-zinc-900 px-4 py-2 text-white">글쓰기</Link></div>
    <PostList key={slug} initial={initial} board={slug} />
  </section>;
}
