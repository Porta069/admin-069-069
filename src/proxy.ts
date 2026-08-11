import { NextResponse, type NextRequest } from "next/server";

/**
 * Fast redirect layer only. Real authentication + authorization happen
 * server-side in requireEmployee() — this never acts as a security boundary.
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("pw_session");
  const { pathname } = request.nextUrl;

  if (pathname === "/login") {
    if (hasSession) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (!hasSession) {
    const login = new URL("/login", request.url);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"],
};
