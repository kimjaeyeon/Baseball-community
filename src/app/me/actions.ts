"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function markNotificationsRead() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const { error } = await supabase.rpc("mark_notifications_read");
  if (error) redirect("/me?error=read");
  revalidatePath("/", "layout");
  redirect("/me");
}
