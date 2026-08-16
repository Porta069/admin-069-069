import { NextResponse, type NextRequest } from "next/server";

/**
 * Fast redirect layer only. Real authentication + authorization happen
 * server-side in requireEmployee() — this never acts as a security boundary.
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("pw_session");
  const { pathname } = request.nextUrl;

  // Aktuellen Pfad als Header durchreichen, damit serverseitige Pflicht-Gates
  // (Passwort setzen, 2FA) die Konto-Seite ausnehmen können.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  const weiter = () =>
    NextResponse.next({ request: { headers: requestHeaders } });

  // /login niemals hier umleiten: Der Cookie kann existieren, aber
  // serverseitig ungültig sein — die Weiterleitung anhand der ECHTEN
  // Session macht die Login-Seite selbst (sonst droht eine Redirect-Schleife
  // /login → / → /login bei abgelaufener Sitzung).
  if (pathname === "/login") {
    return weiter();
  }

  if (!hasSession) {
    const login = new URL("/login", request.url);
    return NextResponse.redirect(login);
  }

  return weiter();
}

export const config = {
  // Statische Dateien (Logo, Icons, Fonts …) werden anhand ihrer Endung
  // ausgenommen — sonst würde die Redirect-Schicht sie auf /login umleiten.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/health|api/cron|api/ical|.*\\.(?:jpg|jpeg|png|gif|svg|webp|ico|txt|xml|woff2?)).*)",
  ],
};
