"use client";

import { useEffect } from "react";
import { markPostRead } from "@/lib/read-posts";

export default function ReadPost({ id }: { id: number }) {
  useEffect(() => { markPostRead(id); }, [id]);
  return null;
}
