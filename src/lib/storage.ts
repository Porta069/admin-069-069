import "server-only";

/**
 * Signierte URLs für den Supabase-Storage-Bucket der Plattform (Dokumente).
 * Läuft ausschließlich serverseitig über den Service-Key.
 */
export async function createSignedDocumentUrl(
  storageKey: string,
  expiresInSeconds = 300,
): Promise<string | null> {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "documents";
  if (!base || !key) return null;

  const path = storageKey.replace(/^\/+/, "");
  const res = await fetch(
    `${base}/storage/v1/object/sign/${bucket}/${path}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn: expiresInSeconds }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    },
  );
  if (!res.ok) {
    console.error("storage sign failed", res.status, await res.text().catch(() => ""));
    return null;
  }
  const data = (await res.json()) as { signedURL?: string };
  return data.signedURL ? `${base}/storage/v1${data.signedURL}` : null;
}

/** Öffentlicher Avatar-Bucket (siehe db/employee-profile.sql). */
const AVATAR_BUCKET = "avatars";
const AVATAR_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
export const AVATAR_MAX_BYTES = 3 * 1024 * 1024;

export function avatarStorageAktiv(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
}

/**
 * Lädt ein Profilbild in den öffentlichen `avatars`-Bucket und gibt die
 * öffentliche URL zurück. Läuft nur serverseitig (Service-Key). Der Objekt-Key
 * enthält einen Zeitstempel, damit die neue URL Browser-/CDN-Caches umgeht.
 */
export async function uploadAvatar(
  employeeId: string,
  bytes: Uint8Array,
  contentType: string,
  stamp: number,
): Promise<string | null> {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  const ext = AVATAR_MIME[contentType];
  if (!base || !key || !ext) return null;

  const objectKey = `${employeeId}/${stamp}.${ext}`;
  const res = await fetch(
    `${base}/storage/v1/object/${AVATAR_BUCKET}/${objectKey}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
        "Content-Type": contentType,
        "x-upsert": "true",
        "cache-control": "public, max-age=31536000, immutable",
      },
      body: bytes as unknown as BodyInit,
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    },
  );
  if (!res.ok) {
    console.error("avatar upload failed", res.status, await res.text().catch(() => ""));
    return null;
  }
  return `${base}/storage/v1/object/public/${AVATAR_BUCKET}/${objectKey}`;
}

/** Entfernt ein zuvor hochgeladenes Avatar-Objekt (best effort). */
export async function deleteAvatarObject(publicUrl: string | null): Promise<void> {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!base || !key || !publicUrl) return;
  const marker = `/object/public/${AVATAR_BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return;
  const objectKey = publicUrl.slice(idx + marker.length);
  await fetch(`${base}/storage/v1/object/${AVATAR_BUCKET}/${objectKey}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${key}`, apikey: key },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  }).catch((e) => console.error("avatar delete failed", e));
}
