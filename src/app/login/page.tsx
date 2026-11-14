"use client";

import { useActionState, useState } from "react";
import { signIn, signUp } from "./actions";

function AuthForm({ signup }: { signup: boolean }) {
  const [state, action, pending] = useActionState(
    async (_previous: { error: string } | null, data: FormData) => (signup ? signUp(data) : signIn(data)),
    null,
  );

  return (
    <form action={action} className="mt-6 flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        이메일
        <input className="rounded border p-2" name="email" type="email" autoComplete="email" required />
      </label>
      <label className="flex flex-col gap-1">
        비밀번호
        <input className="rounded border p-2" name="password" type="password" minLength={6}
          autoComplete={signup ? "new-password" : "current-password"} required />
      </label>
      {signup && (
        <label className="flex flex-col gap-1">
          닉네임 (2~12자)
          <input className="rounded border p-2" name="nickname" autoComplete="nickname" required />
        </label>
      )}
      <p role="alert" className="text-sm text-red-700">{state?.error}</p>
      <button className="rounded bg-zinc-900 p-2 text-white disabled:opacity-50" disabled={pending}>
        {pending ? "처리 중…" : signup ? "가입하기" : "로그인"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  const [signup, setSignup] = useState(false);
  return (
    <section className="mx-auto w-full max-w-sm py-10">
      <h1 className="text-2xl font-bold">{signup ? "회원가입" : "로그인"}</h1>
      <div className="mt-4 flex gap-4" aria-label="로그인 또는 회원가입">
        <button type="button" aria-pressed={!signup} onClick={() => setSignup(false)}>로그인</button>
        <button type="button" aria-pressed={signup} onClick={() => setSignup(true)}>회원가입</button>
      </div>
      <AuthForm key={String(signup)} signup={signup} />
    </section>
  );
}
