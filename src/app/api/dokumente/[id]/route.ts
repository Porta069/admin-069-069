import { type NextRequest, NextResponse } from "next/server";
import { getEmployee } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { createSignedDocumentUrl } from "@/lib/storage";

/**
 * Sicherer Dokumenten-Zugriff: prüft Login + documents:view, signiert die
 * Storage-URL (5 Minuten gültig) und leitet per 307 weiter.
 * ?download=1 nutzt den download-Query-Param der Supabase-signierten URL,
 * damit der Browser den Original-Dateinamen zum Speichern anbietet.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const employee = await getEmployee();
  if (!employee) {
    return NextResponse.json(
      { error: "Nicht angemeldet." },
      { status: 401 },
    );
  }
  if (!hasPermission(employee.permissions, "documents", "view")) {
    return NextResponse.json(
      { error: "Keine Berechtigung für den Dokumenten-Zugriff." },
      { status: 403 },
    );
  }

  const [doc] = await sql`
    select d.id, d."storageKey", d."originalName", d."mimeType"
    from public."Document" d
    left join public."Application" a on a.id = d."applicationId"
    where d.id = ${id} and (a.id is null or a.status <> 'ERASED')
    limit 1`;
  if (!doc) {
    return NextResponse.json(
      { error: "Das Dokument wurde nicht gefunden." },
      { status: 404 },
    );
  }

  const signedUrl = await createSignedDocumentUrl(doc.storageKey as string);
  if (!signedUrl) {
    return NextResponse.json(
      {
        error:
          "Der Dokumenten-Speicher ist derzeit nicht erreichbar. Bitte in ein paar Minuten erneut versuchen.",
      },
      { status: 502 },
    );
  }

  const wantsDownload = request.nextUrl.searchParams.get("download") === "1";
  const targetUrl = wantsDownload
    ? `${signedUrl}${signedUrl.includes("?") ? "&" : "?"}download=${encodeURIComponent(
        (doc.originalName as string | null) ?? "dokument",
      )}`
    : signedUrl;

  await recordAudit({
    actorId: employee.id,
    action: "document.accessed",
    entityType: "document",
    entityId: id,
    metadata: {
      originalName: doc.originalName,
      mimeType: doc.mimeType,
      download: wantsDownload,
    },
  });

  return NextResponse.redirect(targetUrl, 307);
}
