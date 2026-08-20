import { getEmployee } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { SnapchatAdsClient } from "@/lib/ads/snapchat";

// Temporäre, session-geschützte Diagnose-Route für den Snapchat-Verbindungstest.
// Wird nach der Prüfung wieder entfernt.
export const dynamic = "force-dynamic";

export async function GET() {
  const emp = await getEmployee();
  if (!emp || !hasPermission(emp.permissions, "communication", "edit")) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await new SnapchatAdsClient().testConnection();
  return Response.json(result);
}
