export default function PolicyPage({ title, children }: { title: string; children: React.ReactNode }) {
  return <article className="max-w-2xl space-y-4 leading-7">
    <h1 className="text-2xl font-bold">{title}</h1>
    <p className="rounded bg-zinc-100 p-3 text-sm text-zinc-600">공부용 프로젝트의 예시 문서입니다. 실제 서비스에 쓰려면 법률 검토를 받은 문서로 바꿔야 합니다.</p>
    {children}
  </article>;
}
