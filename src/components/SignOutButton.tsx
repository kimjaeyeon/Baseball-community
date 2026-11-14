"use client";

import { useActionState } from "react";
import { signOut } from "@/app/login/actions";

export default function SignOutButton() {
  const [state, action, pending] = useActionState(signOut, null);
  return (
    <form action={action}>
      <button disabled={pending}>{pending ? "처리 중…" : "로그아웃"}</button>
      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
    </form>
  );
}
