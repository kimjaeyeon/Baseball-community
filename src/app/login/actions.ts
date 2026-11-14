"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { validateNickname } from "@/lib/validate";

function credentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  };
}

export async function signUp(formData: FormData) {
  const nickname = String(formData.get("nickname") ?? "").trim();
  const nicknameError = validateNickname(nickname);
  if (nicknameError) return { error: nicknameError };
  const { email, password } = credentials(formData);
  if (!email || password.length < 6) return { error: "이메일과 6자 이상의 비밀번호를 입력해 주세요" };

  const supabase = await createClient();
  const lookup = () => supabase.from("profiles").select("id").eq("nickname", nickname).maybeSingle();
  const existing = await lookup();
  if (existing.error) return { error: "가입하지 못했습니다. 잠시 후 다시 시도해 주세요" };
  if (existing.data) return { error: "이미 쓰는 닉네임입니다" };

  const { data, error } = await supabase.auth.signUp({
    email, password, options: { data: { nickname } },
  });
  if (error) {
    // Auth hides DB trigger details. Recheck after a concurrent unique violation.
    const conflict = await lookup();
    if (conflict.data || /duplicate|unique/i.test(error.message)) {
      return { error: "이미 쓰는 닉네임입니다" };
    }
    return { error: "가입하지 못했습니다. 잠시 후 다시 시도해 주세요" };
  }
  if (!data.session) return { error: "이메일을 확인해 주세요. 이미 가입한 이메일이라면 로그인해 주세요" };
  revalidatePath("/", "layout");
  redirect("/");
}

export async function signIn(formData: FormData) {
  const { email, password } = credentials(formData);
  if (!email || !password) return { error: "이메일과 비밀번호를 입력해 주세요" };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "이메일 또는 비밀번호를 확인해 주세요" };
  revalidatePath("/", "layout");
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) return { error: "로그아웃하지 못했습니다. 다시 시도해 주세요" };
  revalidatePath("/", "layout");
  redirect("/");
}
