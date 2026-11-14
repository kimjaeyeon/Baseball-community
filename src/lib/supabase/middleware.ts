import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(req: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request: req });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          const next = NextResponse.next({ request: req });
          response.cookies.getAll().forEach((cookie) => next.cookies.set(cookie));
          response.headers.forEach((value, name) => {
            if (["cache-control", "expires", "pragma"].includes(name)) next.headers.set(name, value);
          });
          cookiesToSet.forEach(({ name, value, options }) => next.cookies.set(name, value, options));
          Object.entries(headers).forEach(([name, value]) => next.headers.set(name, value));
          response = next;
        },
      },
    },
  );

  await supabase.auth.getClaims();
  return response;
}
