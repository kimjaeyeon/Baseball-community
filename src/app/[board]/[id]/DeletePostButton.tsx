"use client";

import { useActionState } from "react";
import { deletePost } from "@/app/write/actions";

export default function DeletePostButton({ id }: { id: number }) {
  const [state, action, pending] = useActionState(async () => deletePost(id), null);
  return <form action={action}><button disabled={pending} className="text-red-700 underline disabled:opacity-50">{pending ? "삭제 중…" : "삭제"}</button>{state?.error && <p role="alert">{state.error}</p>}</form>;
}
