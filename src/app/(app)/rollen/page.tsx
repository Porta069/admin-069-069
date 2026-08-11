import { requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import {
  hasPermission,
  type PermissionAction,
  type PermissionMap,
  type PermissionModule,
} from "@/lib/permissions";
import { formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Check, Lock, Sparkles, Users } from "lucide-react";

const MODULE_LABELS: Record<PermissionModule, string> = {
  dashboard: "Dashboard",
  candidates: "Kandidaten",
  companies: "Unternehmen",
  jobs: "Stellenanzeigen",
  applications: "Bewerbungen",
  matching: "Matching-Center",
  placements: "Vermittlungen",
  tasks: "Aufgaben",
  calendar: "Termine",
  communication: "Kommunikation",
  notes: "Notizen",
  documents: "Dokumente",
  map: "Kartenansicht",
  analytics: "Analytics",
  automations: "Automatisierungen",
  templates: "Vorlagen",
  notifications: "Benachrichtigungen",
  employees: "Mitarbeiter",
  roles: "Rollen & Rechte",
  affiliates: "Affiliate / Partner",
  rewards: "Prämien",
  audit: "Audit & Sicherheit",
  settings: "Einstellungen",
};

const MODULES = Object.keys(MODULE_LABELS) as PermissionModule[];

const ACTIONS: { key: PermissionAction; label: string }[] = [
  { key: "view", label: "Ansehen" },
  { key: "create", label: "Erstellen" },
  { key: "edit", label: "Bearbeiten" },
  { key: "delete", label: "Löschen" },
  { key: "assign", label: "Zuweisen" },
  { key: "export", label: "Export" },
  { key: "override", label: "Override" },
  { key: "manage", label: "Verwalten" },
];

function isFullAccess(permissions: PermissionMap): boolean {
  const all = permissions["*"];
  return Boolean(all && all.includes("*"));
}

function PermissionMatrix({ permissions }: { permissions: PermissionMap }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[640px] text-xs">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">
              Modul
            </th>
            {ACTIONS.map((action) => (
              <th
                key={action.key}
                className="px-1.5 py-2 text-center font-medium whitespace-nowrap text-muted-foreground"
              >
                {action.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MODULES.map((module) => (
            <tr key={module} className="border-b last:border-0">
              <td className="px-3 py-1.5 font-medium whitespace-nowrap">
                {MODULE_LABELS[module]}
              </td>
              {ACTIONS.map((action) => (
                <td key={action.key} className="px-1.5 py-1.5 text-center">
                  {hasPermission(permissions, module, action.key) ? (
                    <Check
                      className="inline size-3.5 text-success"
                      aria-label="erlaubt"
                    />
                  ) : (
                    <span
                      className="inline-block size-1 rounded-full bg-muted-foreground/25 align-middle"
                      aria-label="nicht erlaubt"
                    />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function RollenPage() {
  await requireEmployee("roles");

  const roles = await sql`
    select r.id, r.name, r.description, r.permissions, r.is_system,
           (select count(*)::int from admin.employee e
              where e.role_id = r.id and e.deleted_at is null) as employee_count
    from admin.role r
    order by array_position(array['SUPERADMIN','ADMIN','TEAMLEAD','STAFF'], r.id) nulls last, r.name`;

  return (
    <>
      <PageHeader
        title="Rollen & Rechte"
        description="System-Rollen und ihre Berechtigungen — durchgesetzt wird ausschließlich serverseitig."
      />

      {roles.length === 0 ? (
        <EmptyState
          icon={Lock}
          title="Keine Rollen vorhanden"
          description="Die System-Rollen wurden noch nicht eingerichtet."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {roles.map((role) => {
            const permissions = role.permissions as PermissionMap;
            const full = isFullAccess(permissions);
            return (
              <Card key={role.id as string} className={full ? "xl:col-span-2" : undefined}>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="font-display text-base">
                      {role.name as string}
                    </CardTitle>
                    {Boolean(role.is_system) && (
                      <Badge variant="secondary">
                        <Lock className="size-3" />
                        System
                      </Badge>
                    )}
                    <span className="ml-auto inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Users className="size-3.5" />
                      <span className="tabular">
                        {formatNumber(role.employee_count as number)}
                      </span>
                      Mitarbeiter
                    </span>
                  </div>
                  {role.description ? (
                    <CardDescription>{role.description as string}</CardDescription>
                  ) : null}
                </CardHeader>
                <CardContent>
                  {full ? (
                    <div className="flex items-center gap-3 rounded-lg border border-dashed bg-accent/60 p-4">
                      <span className="flex size-9 items-center justify-center rounded-full bg-primary/10">
                        <Sparkles className="size-4 text-primary" />
                      </span>
                      <div>
                        <p className="text-sm font-medium">Vollzugriff (*)</p>
                        <p className="text-sm text-muted-foreground">
                          Diese Rolle besitzt uneingeschränkte Rechte auf alle
                          Module und Aktionen.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <PermissionMatrix permissions={permissions} />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="mt-4 border-dashed">
        <CardContent className="flex items-start gap-3 py-1">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
            <Sparkles className="size-4 text-muted-foreground" />
          </span>
          <div>
            <p className="text-sm font-medium">
              Eigene Rollen & granulare Anpassung folgen
            </p>
            <p className="text-sm text-muted-foreground">
              Das Rechtemodell ist dafür vorbereitet — System-Rollen sind bis
              dahin nicht editierbar.
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
