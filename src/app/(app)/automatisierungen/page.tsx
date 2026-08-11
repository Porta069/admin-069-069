import { can, requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowDown,
  ArrowRight,
  Filter,
  Play,
  Workflow,
  Zap,
} from "lucide-react";
import { AutomationToggle } from "./_components/automation-toggle";
import { CreateAutomationDialog } from "./_components/create-automation-dialog";
import {
  ACTION_LABELS,
  TRIGGER_LABELS,
  type AutomationActionType,
  type AutomationTrigger,
} from "./_components/constants";

const RECIPES: {
  title: string;
  description: string;
  trigger: AutomationTrigger;
}[] = [
  {
    title: "Neuer Kandidat → Mitarbeiter benachrichtigen",
    description:
      "Sobald sich ein Handwerker registriert, wird das zuständige Team sofort informiert.",
    trigger: "NEW_CANDIDATE",
  },
  {
    title: "Passender Job gefunden → Kandidat informieren",
    description:
      "Erreicht eine neue Stelle einen hohen Matching-Score, geht automatisch eine Nachricht raus.",
    trigger: "NEW_JOB",
  },
  {
    title: "Bewerbung 5 Tage unbeantwortet → Aufgabe erstellen",
    description:
      "Bleibt ein Betrieb stumm, erhält das Team eine Nachfass-Aufgabe mit Frist.",
    trigger: "APPLICATION_STALE",
  },
  {
    title: "Interview morgen → Erinnerung senden",
    description:
      "Kandidat und Betrieb bekommen am Vortag automatisch eine Terminerinnerung.",
    trigger: "INTERVIEW_UPCOMING",
  },
  {
    title: "Neuer Job → passende Kandidaten suchen",
    description:
      "Neue Stellen stoßen sofort einen Matching-Lauf über den gesamten Kandidaten-Pool an.",
    trigger: "NEW_JOB",
  },
];

function FlowDiagram() {
  const steps = [
    {
      icon: Zap,
      label: "TRIGGER",
      title: "Wenn etwas passiert",
      text: "z. B. ein neuer Kandidat registriert sich",
    },
    {
      icon: Filter,
      label: "BEDINGUNGEN",
      title: "Nur wenn es passt",
      text: "z. B. Gewerk = Elektro, Region = Bayern",
    },
    {
      icon: Play,
      label: "AKTIONEN",
      title: "Dann automatisch",
      text: "z. B. Aufgabe erstellen und Team benachrichtigen",
    },
  ];
  return (
    <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center">
      {steps.map((step, i) => (
        <div key={step.label} className="contents">
          <div className="flex-1 rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-md bg-primary/10">
                <step.icon className="size-3.5 text-primary" />
              </span>
              <span className="text-[11px] font-semibold tracking-wider text-primary">
                {step.label}
              </span>
            </div>
            <p className="mt-2.5 text-sm font-medium">{step.title}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{step.text}</p>
          </div>
          {i < steps.length - 1 && (
            <>
              <ArrowRight
                className="hidden size-5 shrink-0 text-muted-foreground/50 md:block"
                aria-hidden
              />
              <ArrowDown
                className="mx-auto size-5 shrink-0 text-muted-foreground/50 md:hidden"
                aria-hidden
              />
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export default async function AutomatisierungenPage() {
  const employee = await requireEmployee("automations");
  const canCreate = can(employee, "automations", "create");
  const canEdit = can(employee, "automations", "edit");

  const automations = await sql`
    select id, name, trigger, actions, enabled
    from admin.automation
    where deleted_at is null
    order by name
    limit 100`;

  return (
    <>
      <PageHeader
        title="Automatisierungen"
        description="Wiederkehrende Abläufe nach dem WENN → DANN Prinzip — einmal definieren, immer ausführen."
        actions={canCreate ? <CreateAutomationDialog /> : undefined}
      />

      <div className="space-y-6">
        <FlowDiagram />

        <section>
          <h2 className="mb-3 font-display text-base font-semibold">
            Vordefinierte Rezepte
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {RECIPES.map((recipe) => (
              <Card key={recipe.title}>
                <CardHeader className="pb-0">
                  <Badge variant="secondary" className="w-fit font-mono text-[11px]">
                    {TRIGGER_LABELS[recipe.trigger]}
                  </Badge>
                  <CardTitle className="text-sm leading-snug">
                    {recipe.title}
                  </CardTitle>
                  <CardDescription>{recipe.description}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto flex items-center justify-between pt-4">
                  <Badge
                    variant="outline"
                    className="text-muted-foreground"
                  >
                    Engine folgt
                  </Badge>
                  <Switch
                    disabled
                    aria-label="Rezept aktivieren (folgt mit der Engine)"
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-base font-semibold">
              Angelegte Automationen
            </h2>
            <p className="text-xs text-muted-foreground">
              Regeln werden gespeichert — die Ausführung startet erst mit der
              Automations-Engine.
            </p>
          </div>
          {automations.length === 0 ? (
            <EmptyState
              icon={Workflow}
              title="Noch keine Automationen angelegt"
              description="Lege die erste Regel an — sie wird ausgeführt, sobald die Engine live ist."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Name</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Aktion</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {automations.map((automation) => {
                    const actions = automation.actions as
                      | { type?: string }[]
                      | null;
                    const actionType = actions?.[0]?.type;
                    return (
                      <TableRow key={automation.id as string}>
                        <TableCell className="font-medium">
                          {automation.name as string}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-mono text-[11px]">
                            {TRIGGER_LABELS[
                              automation.trigger as AutomationTrigger
                            ] ?? (automation.trigger as string)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {actionType
                            ? (ACTION_LABELS[
                                actionType as AutomationActionType
                              ] ?? actionType)
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center justify-end gap-2">
                            <span className="text-xs text-muted-foreground">
                              {automation.enabled ? "Aktiv" : "Pausiert"}
                            </span>
                            <AutomationToggle
                              id={automation.id as string}
                              enabled={Boolean(automation.enabled)}
                              disabled={!canEdit}
                            />
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
