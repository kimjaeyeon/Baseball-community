import Link from "next/link";

export default function NotFound() {
  return <section className="py-12 text-center"><h1 className="text-2xl font-bold">페이지를 찾을 수 없습니다</h1><p className="my-4">존재하지 않거나 삭제된 글 또는 게시판입니다.</p><Link href="/" className="underline">홈으로</Link></section>;
}
