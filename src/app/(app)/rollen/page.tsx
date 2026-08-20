import { can, requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import type { PermissionMap } from "@/lib/permissions";
import {
  isFullAccess, countPermissions, levelLabel, mapToSelection,
} from "@/lib/rbac";
import { formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { PermissionMatrix } from "@/components/rbac/permission-matrix";
import { Lock, Shield, Sparkles, Users } from "lucide-react";
import { TemplateDialog, DeleteTemplateButton } from "./_components/template-dialog";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rollen & Templates" };

export default async function RollenPage() {
  const actor = await requireEmployee("roles");
  const canCreate = can(actor, "roles", "create");
  const canEdit = can(actor, "roles", "edit");
  const canDelete = can(actor, "roles", "delete");
  const master = isFullAccess(actor.permissions);

  const roles = await sql`
    select r.id, r.name, r.description, r.icon, r.level, r.permissions, r.is_system,
           (select count(*)::int from admin.employee e
              where e.role_id = r.id and e.deleted_at is null) as employee_count
    from admin.role r
    order by r.level desc, r.is_system desc, r.name`;

  return (
    <>
      <PageHeader
        title="Rollen & Templates"
        description="Vordefinierte Berechtigungs-Profile. Durchgesetzt wird ausschließlich serverseitig."
        actions={
          canCreate ? (
            <TemplateDialog actorPermissions={actor.permissions} actorLevel={actor.roleLevel} isMaster={master} />
          ) : undefined
        }
      />

      {roles.length === 0 ? (
        <EmptyState icon={Lock} title="Keine Rollen vorhanden" description="Es wurden noch keine Templates angelegt." />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {roles.map((role) => {
            const permissions = role.permissions as PermissionMap;
            const full = isFullAccess(permissions);
            const isSystem = Boolean(role.is_system);
            const selection = mapToSelection(permissions);
            return (
              <Card key={role.id as string} className={full ? "xl:col-span-2" : undefined}>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="flex items-center gap-2 font-display text-base">
                      {role.icon ? <span className="text-lg">{role.icon as string}</span> : <Shield className="size-4 text-muted-foreground" />}
                      {role.name as string}
                    </CardTitle>
                    <Badge variant="outline">{levelLabel(role.level as number)}</Badge>
                    {isSystem && (
                      <Badge variant="secondary"><Lock className="size-3" /> System</Badge>
                    )}
                    <span className="ml-auto inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Users className="size-3.5" />
                      <span className="tabular">{formatNumber(role.employee_count as number)}</span> Mitarbeiter
                    </span>
                  </div>
                  {role.description ? <CardDescription>{role.description as string}</CardDescription> : null}
                  {!full && (
                    <p className="text-xs text-muted-foreground">
                      {countPermissions(permissions)} Berechtigungen
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  {full ? (
                    <div className="flex items-center gap-3 rounded-lg border border-dashed bg-accent/60 p-4">
                      <span className="flex size-9 items-center justify-center rounded-full bg-primary/10">
                        <Sparkles className="size-4 text-primary" />
                      </span>
                      <div>
                        <p className="text-sm font-medium">Vollzugriff (*)</p>
                        <p className="text-sm text-muted-foreground">Uneingeschränkte Rechte auf alle Module.</p>
                      </div>
                    </div>
                  ) : (
                    <PermissionMatrix value={selection} readOnly />
                  )}
                  {!isSystem && (canEdit || canDelete) && (
                    <div className="flex items-center justify-end gap-1 border-t pt-2">
                      {canEdit && (
                        <TemplateDialog
                          actorPermissions={actor.permissions}
                          actorLevel={actor.roleLevel}
                          isMaster={master}
                          template={{
                            id: role.id as string,
                            name: role.name as string,
                            description: (role.description as string) ?? "",
                            icon: (role.icon as string) ?? "",
                            level: role.level as number,
                            selection,
                          }}
                        />
                      )}
                      {canDelete && (role.employee_count as number) === 0 && (
                        <DeleteTemplateButton id={role.id as string} name={role.name as string} />
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
