import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPost } from "@/lib/posts";
import PostForm from "./PostForm";

export default async function WritePage({ searchParams }: PageProps<"/write">) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const { edit, board } = await searchParams;
  if (edit !== undefined && (typeof edit !== "string" || !/^[1-9]\d*$/.test(edit) || !Number.isSafeInteger(Number(edit)))) notFound();
  const post = typeof edit === "string" ? await getPost(Number(edit)) : null;
  if (edit !== undefined && (!post || post.author_id !== data.user.id)) notFound();
  const { data: boards, error } = await supabase.from("boards").select("slug,name").order("sort");
  if (error) throw new Error("게시판을 불러오지 못했습니다", { cause: error });
  return <section className="mx-auto max-w-2xl"><h1 className="text-2xl font-bold">{post ? "글 수정" : "글쓰기"}</h1><PostForm boards={boards} post={post} initialBoard={typeof board === "string" ? board : undefined} /></section>;
}
