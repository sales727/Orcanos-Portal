import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  // In production (HTTPS) next-auth uses the __Secure- prefix on the cookie
  const isSecure = request.nextUrl.protocol === "https:";
  const cookieName = isSecure
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";

  const session = request.cookies.get(cookieName);
  if (!session) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon\\.ico|login).*)"],
};
