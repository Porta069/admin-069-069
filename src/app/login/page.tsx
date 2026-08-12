import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getEmployee } from "@/lib/auth";
import { LoginForm } from "./login-form";
import { ClearStaleCookie } from "./clear-cookie";

export const metadata = { title: "Anmelden" };

/**
 * Serverseitige Session-Prüfung: Nur bei WIRKLICH gültiger Sitzung geht es
 * zum Dashboard. Ein bloß vorhandener (abgelaufener) Cookie rendert die
 * Login-Seite — das verhindert Redirect-Schleifen.
 */
export default async function LoginPage() {
  const employee = await getEmployee();
  if (employee) {
    redirect("/");
  }
  const staleCookie = (await cookies()).has("pw_session");
  return (
    <>
      {staleCookie && <ClearStaleCookie />}
      <LoginForm />
    </>
  );
}
