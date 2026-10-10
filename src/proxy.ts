import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Prefixes that need a session, and which role they belong to. */
const HOST_ONLY = ["/host", "/events/new", "/checkin"];
const ATTENDEE_ONLY = ["/dashboard", "/tickets"];
/** Any signed-in account. */
const SIGNED_IN = ["/profile"];

const startsWithAny = (path: string, prefixes: string[]) =>
  prefixes.some((p) => path === p || path.startsWith(`${p}/`));

/**
 * Keeps the Supabase session fresh on every request and turns unauthenticated
 * visitors away before a protected page renders.
 *
 * The role check here reads the JWT's metadata, which makes it fast but not
 * authoritative — the pages themselves re-check against the database. This is
 * the cheap first gate, not the only one.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        },
      },
    },
  );

  // getSession() refreshes the access token when it has expired — and makes no
  // network call when it hasn't. getClaims() then verifies the token's signature
  // locally against the cached JWKS, so a navigation costs no auth round trip.
  await supabase.auth.getSession();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const claims = claimsError ? null : claimsData?.claims;
  const user = typeof claims?.sub === "string" ? { id: claims.sub, user_metadata: claims.user_metadata } : null;

  const path = request.nextUrl.pathname;
  const needsHost =
    startsWithAny(path, HOST_ONLY) && !path.startsWith("/host/signin") && !path.startsWith("/host/signup");
  const needsAttendee = startsWithAny(path, ATTENDEE_ONLY);
  const isRegisterPage = /^\/events\/[^/]+\/register$/.test(path);
  const needsAccount = startsWithAny(path, SIGNED_IN);

  if (!user && (needsHost || needsAttendee || isRegisterPage || needsAccount)) {
    const signIn = needsHost ? "/host/signin" : "/signin";
    const url = new URL(signIn, request.url);
    url.searchParams.set("next", `${path}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  if (user) {
    const role = (user.user_metadata as { role?: string } | undefined)?.role;
    if (needsHost && role === "ATTENDEE") {
      return NextResponse.redirect(new URL("/dashboard?denied=host", request.url));
    }
    if ((needsAttendee || isRegisterPage) && role === "HOST") {
      return NextResponse.redirect(new URL("/host?denied=attendee", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and image files — the session cookie
    // only needs refreshing on real navigations and API calls.
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
