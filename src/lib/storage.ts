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
