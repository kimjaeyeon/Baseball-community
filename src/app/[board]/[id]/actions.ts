"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
  if (error) return { error: "댓글을 등록하지 못했습니다. 다시 시도해 주세요" };
  revalidateComments();
}

export async function deleteComment(id: number) {
  if (!validId(id)) return { error: "댓글 정보가 올바르지 않습니다" };
  const { supabase } = await authenticatedClient();
  const { error } = await supabase.rpc("soft_delete_comment", { p_id: id });
  if (error) return { error: "댓글을 삭제하지 못했습니다. 다시 시도해 주세요" };
  revalidateComments();
}
