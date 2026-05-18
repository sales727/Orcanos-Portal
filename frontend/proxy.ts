import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  // In production (HTTPS) next-auth uses __Secure- prefix on the cookie
  const isSecure = request.url.startsWith("https");
  const cookieName = isSecure
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";

  const session = request.cookies.get(cookieName);
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon\\.ico|login).*)"],
};
