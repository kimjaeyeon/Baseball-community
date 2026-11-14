import Link from "next/link";
import Image from "next/image";
import ReadPost from "@/components/ReadPost";
import { imageUrl } from "@/lib/images";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getPost } from "@/lib/posts";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/ui";
import Markdown from "@/components/Markdown";
import Comments from "@/components/Comments";
import { prepareComments, type CommentItem } from "@/lib/comments";
import DeletePostButton from "./DeletePostButton";
import LikeButton from "@/components/LikeButton";
import ReportButton from "@/components/ReportButton";

export default async function PostPage({ params }: PageProps<"/[board]/[id]">) {
  const { board, id } = await params;
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) notFound();
  const post = await getPost(Number(id));
  if (!post || post.board.slug !== board) notFound();
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const viewerKey = (await cookies()).get("vk")?.value ?? null;
  const { error: viewError } = await supabase.rpc("increment_view", { p_post_id: post.id, p_viewer_key: viewerKey });
  if (viewError) throw new Error("조회수를 기록하지 못했습니다", { cause: viewError });
  const { data: current, error: countError } = await supabase.from("posts").select("view_count").eq("id", post.id).maybeSingle();
  if (countError) throw new Error("조회수를 불러오지 못했습니다", { cause: countError });
  if (!current) notFound();
  const { data: images, error: imagesError } = await supabase.from("post_images").select("id,path").eq("post_id", post.id).order("position");
  if (imagesError) throw new Error("사진을 불러오지 못했습니다", { cause: imagesError });
  const { data: like, error: likeError } = data.user
    ? await supabase.from("post_likes").select("post_id").eq("post_id", post.id).eq("user_id", data.user.id).maybeSingle()
    : { data: null, error: null };
  if (likeError) throw new Error("추천 상태를 불러오지 못했습니다", { cause: likeError });
  const { data: commentRows, error: commentsError } = await supabase
    .from("comments")
    .select("id,author_id,parent_id,body,created_at,deleted_at,author:profiles!comments_author_id_fkey(nickname)")
    .eq("post_id", post.id)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (commentsError) throw new Error("댓글을 불러오지 못했습니다", { cause: commentsError });
  const comments = prepareComments(commentRows as unknown as CommentItem[]);
  // RLS가 본인 신고만 돌려준다.
  const { data: myReports } = data.user
    ? await supabase.from("reports").select("target_type,target_id")
    : { data: [] as { target_type: string; target_id: number }[] };
  const reportedPost = (myReports ?? []).some((r) => r.target_type === "post" && r.target_id === post.id);
  const reportedCommentIds = (myReports ?? []).filter((r) => r.target_type === "comment").map((r) => r.target_id);
  return <article>
    <ReadPost id={post.id} />
    <Link className="text-sm underline" href={`/${board}`}>{post.board.name} 목록</Link>
    <h1 className="mt-4 break-words text-2xl font-bold">{post.is_best && "🔥 "}{post.title}</h1>
    <p className="my-4 text-sm text-zinc-500">{post.author.nickname} · 조회 {current.view_count.toLocaleString("ko-KR")} · {timeAgo(post.created_at)}</p>
    {post.kind === "link" && <div className="my-6 rounded border p-5"><p className="mb-2 break-all">{post.url && (() => { try { return new URL(post.url).hostname; } catch { return post.url; } })()}</p><a className="text-blue-700 underline" href={post.url!} target="_blank" rel="noopener noreferrer nofollow">원문 보기 ↗</a></div>}
    <Markdown>{post.body ?? ""}</Markdown>
    {post.kind === "text" && <div className="my-6 flex flex-col items-start gap-4">{images?.map((image, index) => <Image key={image.id} src={imageUrl(image.path)} alt={`첨부 사진 ${index + 1}`} width={1600} height={1600} unoptimized className="h-auto max-w-full rounded" />)}</div>}
    <div className="my-8 border-y py-4"><LikeButton key={`${Boolean(like)}:${post.like_count}:${post.is_best}`} postId={post.id} initialLiked={Boolean(like)} initialCount={post.like_count} isBest={post.is_best} disabled={data.user?.id === post.author_id} />{data.user && data.user.id !== post.author_id && <div className="mt-3 text-center"><ReportButton targetType="post" targetId={post.id} initialReported={reportedPost} /></div>}</div>
    <Comments comments={comments} postId={post.id} userId={data.user?.id ?? null} reportedIds={reportedCommentIds} />
    {data.user?.id === post.author_id && <div className="mt-8 flex gap-5 border-t pt-4"><Link href={`/write?edit=${post.id}`} className="underline">수정</Link><DeletePostButton id={post.id} /></div>}
  </article>;
}
