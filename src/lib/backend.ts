import "server-only";

/**
 * Server-to-server client for the Werkpair platform backend on Render.
 * Privileged routes are protected by the x-admin-api-key header — the key
 * never leaves the server.
 */

const BASE = process.env.BACKEND_URL ?? "https://portbackend-069-069.onrender.com/api/v1";

export class BackendError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  init: RequestInit & { admin?: boolean } = {},
): Promise<T> {
  const { admin = true, ...rest } = init;
  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(admin ? { "x-admin-api-key": process.env.ADMIN_API_KEY! } : {}),
      ...rest.headers,
    },
    // Render free tier can cold-start; give it room.
    signal: rest.signal ?? AbortSignal.timeout(60_000),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // NestJS-Fehler tragen die Klartextmeldung (Feldname!) in `message` — die
    // wollen wir dem Mitarbeiter zeigen, nicht den rohen Statuscode.
    let msg = `Backend ${res.status} on ${path}: ${body.slice(0, 300)}`;
    try {
      const j = JSON.parse(body) as { message?: unknown };
      if (j?.message) {
        msg = Array.isArray(j.message) ? j.message.join("; ") : String(j.message);
      }
    } catch {
      /* kein JSON — Rohtext behalten */
    }
    throw new BackendError(res.status, msg);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ── Applications (Handwerker-Registrierungen) ────────────────────────────

export interface BackendApplication {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  birthYear: number | null;
  profession: string | null;
  federalState: string | null;
  availability: string | null;
  verified: boolean;
  status: string;
  searchIntent: string | null;
  createdAt: string;
  updatedAt: string;
}

export function listApplications(params: Record<string, string | number | undefined> = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  const suffix = qs.size ? `?${qs}` : "";
  return request<unknown>(`/applications${suffix}`);
}

export function getApplication(id: string) {
  return request<unknown>(`/applications/${id}`);
}

export function eraseApplication(id: string) {
  return request<unknown>(`/applications/${id}`, { method: "DELETE" });
}

// ── Partner / Referrals ──────────────────────────────────────────────────

export function listReferrals() {
  return request<unknown>(`/partner/admin/referrals`);
}

export type ReferralStatus = "REGISTERED" | "IN_PLACEMENT" | "PLACED" | "PAID";

export function setReferralStatus(id: string, status: ReferralStatus) {
  return request<unknown>(`/partner/admin/referrals/${id}/status`, {
    method: "POST",
    body: JSON.stringify({ status }),
  });
}

// ── Companies ────────────────────────────────────────────────────────────

/** Betriebs-Kennzahlen aus dem Backend (Quelle der Wahrheit für die Aggregate). */
export interface AdminCompanyAggregat {
  id: string;
  aktiveInserate?: number;
  entwuerfe?: number;
  vorschlaege?: number;
  konten?: number;
  gesperrteKonten?: number;
  zuletztAngemeldet?: string | null;
}

/** Liefert IMMER ein Array (Antwort ist Liste oder {companies|data:[…]}). */
export async function adminListCompanies(): Promise<AdminCompanyAggregat[]> {
  const raw = await request<unknown>(`/employer/admin/companies`);
  if (Array.isArray(raw)) return raw as AdminCompanyAggregat[];
  const obj = (raw ?? {}) as { companies?: unknown; data?: unknown };
  const arr = Array.isArray(obj.companies)
    ? obj.companies
    : Array.isArray(obj.data)
      ? obj.data
      : [];
  return arr as AdminCompanyAggregat[];
}

export function adminCreateCompany(payload: unknown) {
  return request<unknown>(`/employer/admin/companies`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ── Jobs (Admin-Schreibweg — dieselbe Prüfung wie der Betriebsweg) ────────
// Direkt-SQL auf public."JobPosting" ist damit passé: das Backend prüft Katalog,
// Erfahrungsspanne, Stichwort-/Gewichts-Grenzen und die companyId-Zugehörigkeit.

export type JobSource = "ADMIN" | "AI";
/** Das fertige Inserat, wie das Backend es zurückgibt (mind. die id). */
export type JobDto = { id: string } & Record<string, unknown>;

export function adminCreateJob(companyId: string, source: JobSource, job: unknown) {
  return request<JobDto>(`/employer/admin/jobs`, {
    method: "POST",
    body: JSON.stringify({ companyId, source, job }),
  });
}

export function adminUpdateJob(
  jobId: string,
  companyId: string,
  source: JobSource,
  job: unknown,
) {
  return request<JobDto>(`/employer/admin/jobs/${jobId}`, {
    method: "PATCH",
    body: JSON.stringify({ companyId, source, job }),
  });
}

// ── Public (no admin key needed) ─────────────────────────────────────────

export function getPlatformStats() {
  return request<unknown>(`/stats`, { admin: false });
}

export function getCatalog() {
  return request<unknown>(`/catalog`, { admin: false });
}
