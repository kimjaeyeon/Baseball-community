import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/ui";
import { markNotificationsRead } from "./actions";

type OwnPost = { id: number; title: string; created_at: string; board: { slug: string; name: string } };
type Notification = {
  id: number;
  kind: "comment" | "reply" | "best";
  read_at: string | null;
  created_at: string;
  post: { title: string; board: { slug: string } } | null;
  post_id: number;
};
const messages = { comment: "내 글에 댓글이 달렸어요", reply: "내 댓글에 답글이 달렸어요", best: "베스트에 올랐어요" };

export default async function MePage({ searchParams }: PageProps<"/me">) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const params = await searchParams;
  const [notifications, posts] = await Promise.all([
    supabase.from("notifications")
      .select("id,kind,post_id,read_at,created_at,post:posts!notifications_post_id_fkey(title,board:boards!posts_board_id_fkey(slug))")
      .eq("user_id", data.user.id).order("created_at", { ascending: false }).order("id", { ascending: false }),
    supabase.from("posts").select("id,title,created_at,board:boards!posts_board_id_fkey(slug,name)")
      .eq("author_id", data.user.id).is("deleted_at", null).order("created_at", { ascending: false }).order("id", { ascending: false }),
  ]);
  if (notifications.error) throw new Error("알림을 불러오지 못했습니다", { cause: notifications.error });
  if (posts.error) throw new Error("내 글을 불러오지 못했습니다", { cause: posts.error });
  const items = notifications.data as unknown as Notification[];
  const ownPosts = posts.data as unknown as OwnPost[];

  return <div>
    <h1 className="text-2xl font-bold">알림·내 정보</h1>
    <section aria-labelledby="notifications-heading" className="mt-8">
      <div className="flex items-center justify-between gap-4">
        <h2 id="notifications-heading" className="text-xl font-semibold">알림</h2>
        <form action={markNotificationsRead}>
          <button className="rounded border px-3 py-2 text-sm disabled:opacity-50" disabled={!items.some((item) => !item.read_at)}>모두 읽음</button>
        </form>
      </div>
      {params.error === "read" && <p role="alert" className="mt-3 text-red-700">읽음 처리하지 못했습니다. 다시 시도해 주세요</p>}
      {items.length === 0 ? <p className="py-6 text-zinc-500">아직 알림이 없어요</p> : <ul className="mt-4 divide-y">
        {items.map((item) => <li key={item.id} className={`py-4 ${item.read_at ? "text-zinc-500" : "font-semibold"}`}>
          {item.post ? <Link className="block" href={`/${item.post.board.slug}/${item.post_id}`}>
            <span>{!item.read_at && <span className="mr-2 text-red-600" aria-label="안 읽음">●</span>}{messages[item.kind]}</span>
            <span className="mt-1 block break-words text-sm">{item.post.title}</span>
          </Link> : <p>{messages[item.kind]} · 삭제된 글</p>}
          <time className="mt-1 block text-xs font-normal text-zinc-500" dateTime={item.created_at}>{timeAgo(item.created_at)}</time>
        </li>)}
      </ul>}
    </section>
    <section aria-labelledby="own-posts-heading" className="mt-10">
      <h2 id="own-posts-heading" className="text-xl font-semibold">내가 쓴 글</h2>
      {ownPosts.length === 0 ? <p className="py-6 text-zinc-500">아직 작성한 글이 없어요</p> : <ul className="mt-4 divide-y">
        {ownPosts.map((post) => <li key={post.id} className="py-4">
          <Link className="block break-words font-semibold" href={`/${post.board.slug}/${post.id}`}>{post.title}</Link>
          <p className="mt-1 text-xs text-zinc-500">{post.board.name} · {timeAgo(post.created_at)}</p>
        </li>)}
      </ul>}
    </section>
  </div>;
}
