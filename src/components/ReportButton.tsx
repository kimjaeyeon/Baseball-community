"use client";

import { useState, useTransition } from "react";
import { reportTarget } from "@/app/[board]/[id]/actions";
import { REPORT_REASONS } from "@/lib/db-errors";

export default function ReportButton({ targetType, targetId, initialReported, compact = false }: {
  targetType: "post" | "comment"; targetId: number; initialReported: boolean; compact?: boolean;
}) {
  const [reported, setReported] = useState(initialReported);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const size = compact ? "text-xs" : "text-sm";

  if (reported) return <span className={`${size} text-zinc-500`}>🚩 신고됨</span>;

  function submit(reason: string) {
    startTransition(async () => {
      const result = await reportTarget(targetType, targetId, reason);
      if ("error" in result) { setError(result.error); return; }
      setReported(true);
      setOpen(false);
    });
  }

  return <span className={`inline-flex flex-wrap items-center gap-2 ${size}`}>
    <button type="button" className="text-zinc-600 underline" aria-expanded={open} onClick={() => setOpen((v) => !v)}>🚩 신고</button>
    {open && <span role="group" aria-label="신고 사유" className="inline-flex flex-wrap gap-1">
      {REPORT_REASONS.map((reason) => <button key={reason} type="button" disabled={pending}
        className="rounded border px-2 py-0.5 disabled:opacity-50" onClick={() => submit(reason)}>{reason}</button>)}
    </span>}
    {error && <span role="alert" className="text-red-700">{error}</span>}
  </span>;
}
