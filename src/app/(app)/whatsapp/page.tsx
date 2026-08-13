import { can, requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CalendarClock,
  Clock,
  FileText,
  MessagesSquare,
  Power,
} from "lucide-react";
import { WhatsappNotice } from "./_components/whatsapp-notice";
import {
  CreateRuleDialog,
  type RuleFormData,
  type TemplateOption,
} from "./_components/rule-dialog";
import { RuleToggle } from "./_components/rule-toggle";
import { RuleActions } from "./_components/rule-actions";
import { RecipeButton } from "./_components/recipe-button";
import { MasterSwitch } from "./_components/master-switch";
import {
  formatDelay,
  RECIPES,
  TRIGGER_LABELS,
  WHATSAPP_OUTBOX_STATUS,
  type WhatsappTrigger,
} from "./constants";

/** Variablen wie {first_name} im Text farbig hervorheben (Server-Render). */
function highlightVars(text: string): React.ReactNode {
  return text.split(/(\{[a-z_]+\})/g).map((part, i) =>
    /^\{[a-z_]+\}$/.test(part) ? (
      <span
        key={i}
        className="rounded-sm bg-primary/10 px-0.5 font-mono text-[0.85em] font-medium text-primary"
      >
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function triggerLabel(value: string): string {
  return TRIGGER_LABELS[value as WhatsappTrigger] ?? value;
}

export default async function WhatsappPage() {
  const employee = await requireEmployee("communication");
  const canCreate = can(employee, "communication", "create");
  const canEdit = can(employee, "communication", "edit");
  const canToggleMaster =
    can(employee, "communication", "edit") ||
    can(employee, "settings", "edit") ||
    can(employee, "communication", "manage");

  const [rules, templateRows, outbox, [settingRow]] = await Promise.all([
    sql`
      select r.id, r.name, r.trigger, r.verzoegerung_stunden, r.template_id,
             r.nachricht, r.enabled, t.name as template_name, t.body as template_body
      from admin.whatsapp_rule r
      left join admin.template t on t.id = r.template_id and t.deleted_at is null
      where r.deleted_at is null
      order by r.created_at desc
      limit 100`,
    sql`
      select id, name from admin.template
      where deleted_at is null
      order by name
      limit 200`,
    sql`
      select o.id, o.to_name, o.to_phone, o.nachricht, o.scheduled_at, o.status,
             r.name as rule_name
      from admin.whatsapp_outbox o
      left join admin.whatsapp_rule r on r.id = o.rule_id
      where o.status = 'GEPLANT'
      order by o.scheduled_at asc nulls last
      limit 50`,
    sql`select value from admin.setting where key = 'whatsapp' limit 1`,
  ]);

  const templates: TemplateOption[] = templateRows.map((t) => ({
    id: t.id as string,
    name: t.name as string,
  }));

  const aktiviert = Boolean(
    (settingRow?.value as { aktiviert?: boolean } | undefined)?.aktiviert,
  );

  return (
    <>
      <PageHeader
        title="WhatsApp"
        description="Automatische WhatsApp-Nachrichten für Kandidaten — Regeln definieren, Versand folgt mit der Integration."
        actions={canCreate ? <CreateRuleDialog templates={templates} /> : undefined}
      />

      <div className="space-y-6">
        <WhatsappNotice />

        {/* Master-Schalter */}
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
              <Power className="size-4 text-muted-foreground" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-medium">WhatsApp-Versand</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Der Schalter wird gespeichert. Der tatsächliche Versand startet
                erst, sobald die WhatsApp Business API angebunden ist.
              </p>
            </div>
          </div>
          <MasterSwitch aktiviert={aktiviert} canToggle={canToggleMaster} />
        </section>

        {/* Rezepte */}
        <section>
          <h2 className="mb-3 font-display text-base font-semibold">
            Beispiel-Regeln
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {RECIPES.map((recipe) => (
              <Card key={recipe.title} className="flex flex-col">
                <CardHeader className="pb-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge
                      variant="secondary"
                      className="font-mono text-[11px]"
                    >
                      {triggerLabel(recipe.trigger)}
                    </Badge>
                    <Badge variant="outline" className="text-muted-foreground">
                      <Clock className="size-3" aria-hidden />
                      {formatDelay(recipe.verzoegerungStunden)}
                    </Badge>
                  </div>
                  <CardTitle className="text-sm leading-snug">
                    {recipe.title}
                  </CardTitle>
                  <CardDescription>{recipe.description}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto flex items-center justify-end pt-4">
                  {canCreate ? (
                    <RecipeButton recipe={recipe} />
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      Ansehen
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Regeln */}
        <section>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-base font-semibold">
              Automatische Nachrichten (Regeln)
            </h2>
            <p className="text-xs text-muted-foreground">
              Aktivierte Regeln greifen automatisch, sobald die Integration
              steht.
            </p>
          </div>
          {rules.length === 0 ? (
            <EmptyState
              icon={MessagesSquare}
              title="Noch keine Regeln angelegt"
              description="Lege die erste Regel an oder nutze eine der Beispiel-Regeln oben — Regeln werden gespeichert und greifen später automatisch."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Name</TableHead>
                    <TableHead>Auslöser</TableHead>
                    <TableHead>Verzögerung</TableHead>
                    <TableHead>Nachricht</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule) => {
                    const templateId = rule.template_id as string | null;
                    const templateName = rule.template_name as string | null;
                    const nachricht = rule.nachricht as string | null;
                    const preview =
                      templateId && templateName
                        ? null
                        : (nachricht ??
                          (rule.template_body as string | null) ??
                          "");
                    const ruleData: RuleFormData = {
                      id: rule.id as string,
                      name: rule.name as string,
                      trigger: rule.trigger as string,
                      verzoegerungStunden: rule.verzoegerung_stunden as number,
                      nachricht,
                      templateId,
                    };
                    return (
                      <TableRow key={rule.id as string}>
                        <TableCell className="font-medium">
                          {rule.name as string}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className="font-mono text-[11px]"
                          >
                            {triggerLabel(rule.trigger as string)}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {formatDelay(rule.verzoegerung_stunden as number)}
                        </TableCell>
                        <TableCell>
                          {templateId && templateName ? (
                            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                              <FileText
                                className="size-3.5 shrink-0"
                                aria-hidden
                              />
                              Vorlage: {templateName}
                            </span>
                          ) : (
                            <span className="block max-w-72 truncate text-sm text-muted-foreground">
                              {highlightVars(preview ?? "")}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-2">
                            <RuleToggle
                              id={rule.id as string}
                              enabled={Boolean(rule.enabled)}
                              disabled={!canEdit}
                            />
                            <span className="text-xs text-muted-foreground">
                              {rule.enabled ? "Aktiv" : "Pausiert"}
                            </span>
                          </span>
                        </TableCell>
                        <TableCell>
                          <RuleActions
                            rule={ruleData}
                            templates={templates}
                            canEdit={canEdit}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        {/* Geplante Nachrichten */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <CalendarClock
              className="size-4 text-muted-foreground"
              aria-hidden
            />
            <h2 className="font-display text-base font-semibold">
              Geplante Nachrichten (Vorschau)
            </h2>
          </div>
          {outbox.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="Noch keine geplanten Nachrichten"
              description="Sobald die Integration aktiv ist, erscheinen hier die Nachrichten, die durch deine Regeln automatisch geplant werden."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Empfänger</TableHead>
                    <TableHead>Regel</TableHead>
                    <TableHead>Nachricht</TableHead>
                    <TableHead>Geplant für</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {outbox.map((msg) => (
                    <TableRow key={msg.id as string}>
                      <TableCell>
                        <span className="font-medium">
                          {(msg.to_name as string | null) ?? "—"}
                        </span>
                        {msg.to_phone ? (
                          <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
                            {msg.to_phone as string}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {(msg.rule_name as string | null) ?? "—"}
                      </TableCell>
                      <TableCell>
                        <span className="block max-w-72 truncate text-sm text-muted-foreground">
                          {highlightVars((msg.nachricht as string | null) ?? "")}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground tabular">
                        {msg.scheduled_at
                          ? formatDateTime(msg.scheduled_at as Date)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <StatusBadge
                          map={WHATSAPP_OUTBOX_STATUS}
                          value={msg.status as string}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
