"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getBoard, getPost } from "@/lib/posts";
import { validatePost } from "@/lib/validate";
import type { UploadedImage } from "@/lib/images";

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

async function cleanupImages(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<boolean> {
  try {
    const { data: jobs, error } = await supabase.from("post_image_cleanup").select("path").eq("user_id", userId);
    if (error) return false;
    if (!jobs?.length) return true;
    const paths = jobs.map((job: { path: string }) => job.path);
    // A caller may reuse an uploaded image in another post. Keep shared files.
    const [originals, thumbs] = await Promise.all([
      supabase.from("post_images").select("path,thumb_path").in("path", paths),
      supabase.from("post_images").select("path,thumb_path").in("thumb_path", paths),
    ]);
    if (originals.error || thumbs.error) return false;
    const referenced = new Set([...originals.data, ...thumbs.data].flatMap((image: UploadedImage) => [image.path, image.thumb_path]));
    const unused = paths.filter((path: string) => !referenced.has(path));
    if (unused.length) {
      const { error: removeError } = await supabase.storage.from("post-images").remove(unused);
      if (removeError) return false;
    }
    const { error: doneError } = await supabase.from("post_image_cleanup").delete().in("path", paths);
    return !doneError;
  } catch { return false; }
}

export async function createPost(formData: FormData, images: UploadedImage[] = [], representativeIndex = 0) {
  const { supabase } = await authenticatedClient();
  const input = postInput(formData);
  const errors = validatePost(input);
  if (Object.keys(errors).length) return { errors };
  const board = await getBoard(String(formData.get("board") ?? ""));
  if (!board) return { error: "게시판을 선택해 주세요" };
  const { data, error } = await supabase.rpc("save_post_with_images", {
    p_id: null, p_board_id: board.id, p_kind: input.kind, p_title: input.title, p_body: input.body,
    p_url: input.kind === "link" ? input.url : null, p_images: images, p_representative: representativeIndex,
  });
  if (error) return { error: "글을 저장하지 못했습니다. 다시 시도해 주세요" };
  revalidatePost(data, board.slug);
  redirect(`/${board.slug}/${data}`);
}

export async function updatePost(id: number, formData: FormData, images: UploadedImage[] = [], representativeIndex = 0) {
  const { supabase, user } = await authenticatedClient();
  const post = await getPost(id);
  if (!post || post.author_id !== user.id) return { error: "글을 수정할 권한이 없습니다" };
  // kind is intentionally immutable under the DB column grants.
  const input = { ...postInput(formData), kind: post.kind };
  const errors = validatePost(input);
  if (Object.keys(errors).length) return { errors };
  const board = await getBoard(String(formData.get("board") ?? ""));
  if (!board) return { error: "게시판을 선택해 주세요" };
  const { data, error } = await supabase.rpc("save_post_with_images", {
    p_id: id, p_board_id: board.id, p_kind: post.kind, p_title: input.title, p_body: input.body,
    p_url: post.kind === "link" ? input.url : null, p_images: images, p_representative: representativeIndex,
  });
  if (error || !data) return { error: "글을 수정하지 못했습니다. 다시 시도해 주세요" };
  revalidatePost(id, board.slug, post.board.slug);
  if (!await cleanupImages(supabase, user.id)) return { error: "글은 저장됐지만 제거한 사진을 정리하지 못했습니다. 수정하기를 다시 눌러 주세요" };
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
