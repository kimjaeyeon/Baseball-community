import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(req: NextRequest) {
  const newViewer = !req.cookies.get("vk")?.value;
  const viewerKey = req.cookies.get("vk")?.value || crypto.randomUUID();
  // Forward the cookie before rendering so the first visit is counted too.
  if (newViewer) req.cookies.set("vk", viewerKey);
  const response = await updateSession(req);
  if (newViewer) {
    response.cookies.set("vk", viewerKey, {
      maxAge: 60 * 60 * 24 * 365,
      httpOnly: true,
      sameSite: "lax",
      secure: req.nextUrl.protocol === "https:",
      path: "/",
    });
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$).*)"],
};
