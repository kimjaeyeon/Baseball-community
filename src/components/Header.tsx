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
            <span role="img" aria-label="알림">🔔</span>
            <SignOutButton />
          </> : <Link href="/login">로그인</Link>}
        </div>
      </nav>
    </header>
  );
}
