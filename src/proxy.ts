import { NextResponse, type NextRequest } from "next/server";

/**
 * Fast redirect layer only. Real authentication + authorization happen
 * server-side in requireEmployee() — this never acts as a security boundary.
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("pw_session");
  const { pathname } = request.nextUrl;

  // /login niemals hier umleiten: Der Cookie kann existieren, aber
  // serverseitig ungültig sein — die Weiterleitung anhand der ECHTEN
  // Session macht die Login-Seite selbst (sonst droht eine Redirect-Schleife
  // /login → / → /login bei abgelaufener Sitzung).
  if (pathname === "/login") {
    return NextResponse.next();
  }

  if (!hasSession) {
    const login = new URL("/login", request.url);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health|api/cron|api/ical).*)"],
};
