import { Film, ImageIcon } from "lucide-react";
import { requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { AddCreativeDialog, DeleteCreativeButton } from "../_components/creative-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Creatives" };

export default async function CreativesPage() {
  await requireEmployee("communication");
  const creatives = await sql`
    select id, name, typ, tags, url, aspect_ratio, notiz, created_at
    from admin.ads_creative where deleted_at is null
    order by created_at desc`;

  return (
    <div>
      <PageHeader
        title="Creatives"
        description="Bibliothek für Videos und Bilder — benennen, taggen, wiederverwenden."
        actions={<AddCreativeDialog />}
      />

      {creatives.length === 0 ? (
        <EmptyState
          title="Noch keine Creatives"
          description="Lege dein erstes Creative an, z. B. „Elektriker Recruiting Video 01“."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {creatives.map((c) => {
            const tags = (c.tags as string[]) ?? [];
            return (
              <div key={c.id as string} className="group overflow-hidden rounded-lg border bg-card">
                <div className="relative flex aspect-video items-center justify-center bg-muted">
                  {c.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.url as string} alt={c.name as string} className="h-full w-full object-cover" />
                  ) : c.typ === "VIDEO" ? (
                    <Film className="size-8 text-muted-foreground" />
                  ) : (
                    <ImageIcon className="size-8 text-muted-foreground" />
                  )}
                  <span className="absolute left-2 top-2 rounded-md bg-background/80 px-1.5 py-0.5 text-[10px] font-medium">
                    {c.aspect_ratio as string || c.typ as string}
                  </span>
                </div>
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium" title={c.name as string}>{c.name as string}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(c.created_at as string)}</p>
                    </div>
                    <DeleteCreativeButton id={c.id as string} name={c.name as string} />
                  </div>
                  {tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {tags.slice(0, 4).map((t) => (
                        <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
