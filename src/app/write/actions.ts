"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getBoard, getPost } from "@/lib/posts";
import { validatePost } from "@/lib/validate";

async function authenticatedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login");
  return { supabase, user: data.user };
}

function postInput(formData: FormData) {
  return {
    kind: String(formData.get("kind") ?? ""),
    title: String(formData.get("title") ?? "").trim(),
    body: String(formData.get("body") ?? "").trim(),
    url: String(formData.get("url") ?? "").trim(),
  };
}

function revalidatePost(id: number, slug: string, previousSlug?: string) {
  revalidatePath("/");
  revalidatePath(`/${slug}`);
  revalidatePath(`/${slug}/${id}`);
  if (previousSlug && previousSlug !== slug) {
    revalidatePath(`/${previousSlug}`);
    revalidatePath(`/${previousSlug}/${id}`);
  }
}

export async function createPost(formData: FormData) {
  const { supabase, user } = await authenticatedClient();
  const input = postInput(formData);
  const errors = validatePost(input);
  if (Object.keys(errors).length) return { errors };
  const board = await getBoard(String(formData.get("board") ?? ""));
  if (!board) return { error: "게시판을 선택해 주세요" };
  const { data, error } = await supabase.from("posts").insert({
    board_id: board.id, author_id: user.id, ...input, url: input.kind === "link" ? input.url : null,
  }).select("id").single();
  if (error) return { error: "글을 저장하지 못했습니다. 다시 시도해 주세요" };
  revalidatePost(data.id, board.slug);
  redirect(`/${board.slug}/${data.id}`);
}

export async function updatePost(id: number, formData: FormData) {
  const { supabase, user } = await authenticatedClient();
  const post = await getPost(id);
  if (!post || post.author_id !== user.id) return { error: "글을 수정할 권한이 없습니다" };
  // kind is intentionally immutable under the DB column grants.
  const input = { ...postInput(formData), kind: post.kind };
  const errors = validatePost(input);
  if (Object.keys(errors).length) return { errors };
  const board = await getBoard(String(formData.get("board") ?? ""));
  if (!board) return { error: "게시판을 선택해 주세요" };
  const { data, error } = await supabase.from("posts").update({
    board_id: board.id, title: input.title, body: input.body, url: post.kind === "link" ? input.url : null,
  }).eq("id", id).eq("author_id", user.id).select("id").maybeSingle();
  if (error || !data) return { error: "글을 수정하지 못했습니다. 다시 시도해 주세요" };
  revalidatePost(id, board.slug, post.board.slug);
  redirect(`/${board.slug}/${id}`);
}

export async function deletePost(id: number) {
  const { supabase, user } = await authenticatedClient();
  const post = await getPost(id);
  if (!post || post.author_id !== user.id) return { error: "글을 삭제할 권한이 없습니다" };
  const { error } = await supabase.rpc("soft_delete_post", { p_id: id });
  if (error) return { error: "글을 삭제하지 못했습니다. 다시 시도해 주세요" };
  revalidatePost(id, post.board.slug);
  redirect(`/${post.board.slug}`);
}
