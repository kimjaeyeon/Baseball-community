import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-auto border-t px-4 py-6 text-sm text-zinc-600">
      <nav aria-label="정책 안내" className="mx-auto flex max-w-5xl flex-wrap gap-5">
        <Link href="/terms">이용약관</Link>
        <Link href="/privacy">개인정보처리방침</Link>
        <Link href="/youth">청소년보호정책</Link>
        <Link href="/report-guide">신고 안내</Link>
      </nav>
    </footer>
  );
}
