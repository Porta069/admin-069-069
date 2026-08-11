"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, ExternalLink, Eye, Loader2 } from "lucide-react";

/**
 * Zeilen-Aktionen für Dokumente: Ansehen (neuer Tab), Download und — bei
 * Bildern — eine Inline-Vorschau. Alle Wege laufen über /api/dokumente/[id]
 * (auditierter 307-Redirect auf eine 5 Minuten gültige signierte URL).
 */
export function DocumentActions({
  id,
  name,
  mimeType,
}: {
  id: string;
  name: string;
  mimeType: string | null;
}) {
  const isImage = Boolean(mimeType?.startsWith("image/"));
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const url = `/api/dokumente/${id}`;

  return (
    <span
      className="flex items-center justify-end gap-0.5"
      onClick={(e) => e.stopPropagation()}
    >
      {isImage && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            title="Vorschau"
            aria-label={`Vorschau von ${name}`}
            onClick={() => {
              setLoaded(false);
              setFailed(false);
              setPreviewOpen(true);
            }}
          >
            <Eye className="size-4" />
          </Button>
          <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle className="truncate pr-6">{name}</DialogTitle>
                <DialogDescription>
                  Vorschau über einen 5 Minuten gültigen, auditierten Link.
                </DialogDescription>
              </DialogHeader>
              <div className="relative flex min-h-40 items-center justify-center overflow-hidden rounded-md border bg-muted/40">
                {previewOpen && !failed && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt={`Vorschau: ${name}`}
                    className="max-h-[70vh] w-auto max-w-full object-contain"
                    onLoad={() => setLoaded(true)}
                    onError={() => setFailed(true)}
                  />
                )}
                {!loaded && !failed && (
                  <Loader2 className="absolute size-5 animate-spin text-muted-foreground" />
                )}
                {failed && (
                  <p className="px-6 py-10 text-center text-sm text-muted-foreground">
                    Die Vorschau konnte nicht geladen werden — der
                    Dokumenten-Speicher ist eventuell gerade nicht erreichbar.
                    Bitte später erneut versuchen.
                  </p>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
      <Button
        asChild
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground hover:text-foreground"
        title="Ansehen (neuer Tab)"
      >
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          aria-label={`${name} ansehen`}
        >
          <ExternalLink className="size-4" />
        </a>
      </Button>
      <Button
        asChild
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground hover:text-foreground"
        title="Download"
      >
        <a href={`${url}?download=1`} aria-label={`${name} herunterladen`}>
          <Download className="size-4" />
        </a>
      </Button>
    </span>
  );
}
