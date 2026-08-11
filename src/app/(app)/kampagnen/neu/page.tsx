import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import { mailerConfigured } from "@/lib/mailer";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { MailerNotice } from "../_components/mailer-notice";
import { CampaignForm, type TemplateOption } from "../_components/campaign-form";

export default async function NewCampaignPage() {
  await requireEmployee("communication", "create");

  const [stateRows, professionRows, cityRows, templateRows] = await Promise.all([
    sql`
      select distinct "federalState" as v
      from public."Application"
      where status <> 'ERASED' and "federalState" is not null and "federalState" <> ''
      order by 1 limit 50`,
    sql`
      select distinct profession as v
      from public."Application"
      where status <> 'ERASED' and profession is not null and profession <> ''
      order by 1 limit 300`,
    sql`
      select distinct ort as v
      from public."Company"
      where ort is not null and ort <> '' and "kontaktEmail" is not null
      order by 1 limit 300`,
    sql`
      select id, name, subject, body
      from admin.template
      where type = 'EMAIL' and deleted_at is null
      order by name limit 100`,
  ]);

  const templates: TemplateOption[] = templateRows.map((t) => ({
    id: t.id as string,
    name: t.name as string,
    subject: (t.subject as string | null) ?? "",
    body: (t.body as string | null) ?? "",
  }));

  return (
    <>
      <PageHeader
        title="Kampagne erstellen"
        description="Zielgruppe wählen, Inhalt verfassen und die Rundmail in Versand geben."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/kampagnen">
              <ArrowLeft className="size-4" />
              Zur Übersicht
            </Link>
          </Button>
        }
      />

      {!mailerConfigured() && <MailerNotice className="mb-5" />}

      <CampaignForm
        bundeslaender={stateRows.map((r) => r.v as string)}
        berufe={professionRows.map((r) => r.v as string)}
        orte={cityRows.map((r) => r.v as string)}
        templates={templates}
        mailerReady={mailerConfigured()}
      />
    </>
  );
}
