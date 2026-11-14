import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "./SignOutButton";

export default async function Header() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims.sub;
  const { data: profile } = uid
    ? await supabase.from("profiles").select("nickname").eq("id", uid).single()
    : { data: null };
  const { count: unreadCount, error: notificationsError } = uid
    ? await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", uid).is("read_at", null)
    : { count: 0, error: null };
  if (notificationsError) throw new Error("알림을 불러오지 못했습니다", { cause: notificationsError });

  return (
    <header className="border-b">
      <nav aria-label="주 메뉴" className="mx-auto flex max-w-5xl flex-wrap items-center gap-5 px-4 py-4">
        <Link className="font-bold" href="/">야구 커뮤니티</Link>
        <Link href="/kbo">KBO</Link>
        <Link href="/mlb">MLB</Link>
        <Link href="/free">자유</Link>
        <div className="ml-auto flex items-center gap-4">
          {uid ? <>
            <span>{profile?.nickname ?? "회원"}</span>
            <Link href="/me" aria-label="알림·내 정보" className="relative">
              <span aria-hidden>🔔</span>
              {(unreadCount ?? 0) > 0 && <span aria-label="안 읽은 알림 있음" className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-600" />}
            </Link>
            <SignOutButton />
          </> : <Link href="/login">로그인</Link>}
        </div>
      </nav>
    </header>
  );
}
