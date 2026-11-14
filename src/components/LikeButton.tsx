"use client";

import { useState, useTransition } from "react";
import { toggleLike } from "@/app/[board]/[id]/actions";
import { likeChipTone } from "@/lib/ui";

const tones = {
  gray: "border-zinc-300 bg-zinc-100 text-zinc-700",
  orange: "border-orange-300 bg-orange-100 text-orange-800",
  red: "border-red-300 bg-red-100 text-red-800",
};

export default function LikeButton({ postId, initialLiked, initialCount, isBest, disabled }: {
  postId: number; initialLiked: boolean; initialCount: number; isBest: boolean; disabled: boolean;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  function onClick() {
    if (pending || disabled) return;
    startTransition(async () => {
      const result = await toggleLike(postId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setLiked(result.liked);
      setCount(result.count);
      setError("");
    });
  }
  return <div className="text-center">
    <button type="button" aria-pressed={liked} onClick={onClick} disabled={disabled || pending}
      className={`rounded-full border px-4 py-2 font-medium disabled:opacity-50 ${tones[likeChipTone(count, isBest)]} ${liked ? "ring-2 ring-zinc-900" : ""}`}>
      ▲ 추천 {count}
    </button>
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
  </div>;
}
