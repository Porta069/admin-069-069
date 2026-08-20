"use server";

import { redirect } from "next/navigation";
import { login, logout } from "@/lib/auth";

export interface LoginState {
  error: string;
  needsTotp?: boolean;
  needsTotpSetup?: boolean;
  qrDataUrl?: string;
  totpSecret?: string;
}

export async function loginAction(
  _prev: LoginState | null,
  formData: FormData,
): Promise<LoginState | null> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const totp = String(formData.get("totp") ?? "").trim();

  if (!email || !password) {
    return { error: "Bitte E-Mail und Passwort eingeben." };
  }

  const result = await login(email, password, totp || undefined);
  if (!result.ok) {
    return {
      error: result.error,
      needsTotp: result.needsTotp,
      needsTotpSetup: result.needsTotpSetup,
      qrDataUrl: result.qrDataUrl,
      totpSecret: result.totpSecret,
    };
  }
  redirect(result.mustChangePassword ? "/konto?erst=1" : "/");
}

export async function logoutAction(): Promise<void> {
  await logout();
  redirect("/login");
}

/** Löscht ein vorhandenes, aber serverseitig ungültiges Session-Cookie. */
export async function clearStaleSessionAction(): Promise<void> {
  const { cookies } = await import("next/headers");
  const { getEmployee } = await import("@/lib/auth");
  const store = await cookies();
  if (store.has("pw_session") && !(await getEmployee())) {
    store.delete("pw_session");
  }
}
