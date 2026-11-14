"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { REPORT_REASONS, friendlyDbError } from "@/lib/db-errors";

async function authenticatedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login");
  return { supabase, user: data.user };
}

function validId(id: number) {
  return Number.isSafeInteger(id) && id > 0;
}

function revalidateComments() {
  revalidatePath("/", "layout");
}

export async function addComment(postId: number, parentId: number | null, formData: FormData) {
  if (!validId(postId)) return { error: "글 정보가 올바르지 않습니다" };
  if (parentId !== null && !validId(parentId)) return { error: "답글 대상이 올바르지 않습니다" };
  const body = String(formData.get("body") ?? "").trim();
  const length = Array.from(body).length;
  if (length < 1 || length > 2000) return { error: "댓글은 1~2,000자로 입력해 주세요" };

  const { supabase, user } = await authenticatedClient();
  const { error } = await supabase.from("comments").insert({
    post_id: postId,
    parent_id: parentId,
    author_id: user.id,
    body,
  });
  if (error) return { error: friendlyDbError(error, "댓글을 등록하지 못했습니다. 다시 시도해 주세요") };
  revalidateComments();
}

export async function reportTarget(
  targetType: "post" | "comment", targetId: number, reason: string,
): Promise<{ reported: true } | { error: string }> {
  if ((targetType !== "post" && targetType !== "comment") || !validId(targetId)) {
    return { error: "신고 대상이 올바르지 않습니다" };
  }
  if (!(REPORT_REASONS as readonly string[]).includes(reason)) return { error: "신고 사유를 선택해 주세요" };
  const { supabase, user } = await authenticatedClient();
  const { error } = await supabase.from("reports").insert({
    target_type: targetType, target_id: targetId, reporter_id: user.id, reason,
  });
  if (!error || error.code === "23505") return { reported: true };
  if (error.code === "23503") return { error: "삭제되었거나 없는 대상입니다" };
  return { error: "신고하지 못했습니다. 다시 시도해 주세요" };
}

export async function deleteComment(id: number) {
  if (!validId(id)) return { error: "댓글 정보가 올바르지 않습니다" };
  const { supabase } = await authenticatedClient();
  const { error } = await supabase.rpc("soft_delete_comment", { p_id: id });
  if (error) return { error: "댓글을 삭제하지 못했습니다. 다시 시도해 주세요" };
  revalidateComments();
}

async function currentLikeState(supabase: Awaited<ReturnType<typeof createClient>>, postId: number, userId: string) {
  const [{ data: like, error: likeError }, { data: post, error: postError }] = await Promise.all([
    supabase.from("post_likes").select("post_id").eq("post_id", postId).eq("user_id", userId).maybeSingle(),
    supabase.from("posts").select("like_count").eq("id", postId).maybeSingle(),
  ]);
  if (likeError || postError || !post) return null;
  return { liked: Boolean(like), count: post.like_count };
}

export async function toggleLike(postId: number): Promise<{ liked: boolean; count: number } | { error: string }> {
  if (!validId(postId)) return { error: "글 정보가 올바르지 않습니다" };
  const { supabase, user } = await authenticatedClient();
  const current = await currentLikeState(supabase, postId, user.id);
  if (!current) return { error: "추천 상태를 불러오지 못했습니다. 다시 시도해 주세요" };

  const { error } = current.liked
    ? await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", user.id)
    : await supabase.from("post_likes").insert({ post_id: postId, user_id: user.id });
  if (error && error.code !== "23505") return { error: "추천을 처리하지 못했습니다. 다시 시도해 주세요" };

  const refreshed = await currentLikeState(supabase, postId, user.id);
  if (!refreshed) return { error: "추천 상태를 불러오지 못했습니다. 다시 시도해 주세요" };
  revalidateComments();
  return refreshed;
}
