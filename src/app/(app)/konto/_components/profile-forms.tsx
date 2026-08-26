"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmployeeAvatar } from "@/components/common/employee-avatar";
import { Camera, Crop, Loader2, Trash2 } from "lucide-react";
import {
  removeAvatarAction,
  updateProfileAction,
  uploadAvatarAction,
} from "../actions";
import { AvatarCropper, type AvatarCropTransform } from "./avatar-cropper";

const SOURCE_MAX = 12 * 1024 * 1024; // großzügiger Quell-Upload (wird verkleinert)
const ZIEL_KANTE = 512; // Zielkante des quadratischen Avatars
const QUELL_KANTE = 1200; // längste Kante der (unbeschnittenen) Quell-Version
const TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Verkleinert ein Bild clientseitig auf ein scharfes, quadratisches WebP
 * (mittiger Zuschnitt) — damit auch große Uploads klein & knackig gespeichert
 * werden. Fällt bei Fehlern auf die Originaldatei zurück.
 */
async function downscaleZuAvatar(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const kante = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - kante) / 2;
    const sy = (bitmap.height - kante) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = ZIEL_KANTE;
    canvas.height = ZIEL_KANTE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, sx, sy, kante, kante, 0, 0, ZIEL_KANTE, ZIEL_KANTE);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/webp", 0.9),
    );
    if (!blob) return file;
    return new File([blob], "avatar.webp", { type: "image/webp" });
  } catch {
    return file;
  }
}

/**
 * Erzeugt die Quell-Version fürs spätere Neu-Positionieren: nur proportional
 * verkleinert (längste Kante {@link QUELL_KANTE}), NICHT beschnitten — so bleibt
 * genug Bild übrig, um den Ausschnitt frei neu zu wählen. Fällt bei Fehlern auf
 * die Originaldatei zurück.
 */
async function downscaleSource(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, QUELL_KANTE / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/webp", 0.82),
    );
    if (!blob) return file;
    return new File([blob], "source.webp", { type: "image/webp" });
  } catch {
    return file;
  }
}

export function AvatarUpload({
  name,
  color,
  imageUrl,
  sourceUrl,
  crop,
  storageAktiv,
}: {
  name: string;
  color: string | null;
  imageUrl: string | null;
  sourceUrl: string | null;
  crop: AvatarCropTransform | null;
  storageAktiv: boolean;
}) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [pending, setPending] = React.useState(false);
  // Lokale Vorschau bis der Server refresht.
  const [preview, setPreview] = React.useState<string | null>(imageUrl);
  // Was gerade im Positionier-Dialog liegt: eine NEU gewählte Datei (isNew)
  // oder die gespeicherte Quelle zum reinen Neu-Positionieren.
  const [cropState, setCropState] = React.useState<{
    file: File;
    transform: AvatarCropTransform | null;
    isNew: boolean;
  } | null>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // erneutes Auswählen derselben Datei erlauben
    if (!file) return;
    if (!TYPES.includes(file.type)) {
      toast.error("Nur JPG, PNG oder WebP.");
      return;
    }
    if (file.size > SOURCE_MAX) {
      toast.error("Bild zu groß (max. 12 MB).");
      return;
    }
    // Erst positionieren/zoomen lassen — Upload folgt beim „Übernehmen".
    setCropState({ file, transform: null, isNew: true });
  }

  // Bestehendes Bild nachträglich neu positionieren: gespeicherte Quelle laden
  // und den Cropper an der zuletzt gewählten Stelle wieder öffnen.
  async function onReposition() {
    const quelle = sourceUrl ?? imageUrl;
    if (!quelle) return;
    setPending(true);
    try {
      const res = await fetch(quelle, { mode: "cors", cache: "no-store" });
      if (!res.ok) throw new Error("fetch");
      const blob = await res.blob();
      const typ = TYPES.includes(blob.type) ? blob.type : "image/webp";
      const datei = new File([blob], "quelle", { type: typ });
      // Gespeicherten Ausschnitt nur anwenden, wenn wir die echte Quelle laden
      // (nicht den bereits zugeschnittenen Avatar als Notbehelf).
      setCropState({ file: datei, transform: sourceUrl ? crop : null, isNew: false });
    } catch {
      toast.error("Bild konnte nicht geladen werden — bitte neu hochladen.");
    } finally {
      setPending(false);
    }
  }

  async function ladeHoch(result: File, transform: AvatarCropTransform) {
    const state = cropState;
    setCropState(null);
    const localUrl = URL.createObjectURL(result);
    setPreview(localUrl);
    setPending(true);
    // Sicherheitsnetz: falls der Cropper auf die Originaldatei zurückfiel,
    // trotzdem auf ein 512px-Quadrat verkleinern.
    const optimiert =
      result.type === "image/webp" && result.name === "avatar.webp"
        ? result
        : await downscaleZuAvatar(result);
    const fd = new FormData();
    fd.append("file", optimiert);
    fd.append("crop", JSON.stringify(transform));
    // Nur bei einer NEU gewählten Datei eine frische Quell-Version mitschicken;
    // beim reinen Neu-Positionieren bleibt die gespeicherte Quelle erhalten.
    if (state?.isNew) {
      fd.append("source", await downscaleSource(state.file));
    }
    const res = await uploadAvatarAction(fd);
    setPending(false);
    URL.revokeObjectURL(localUrl);
    if (res.ok) {
      setPreview(res.url);
      toast.success("Profilbild aktualisiert.");
      router.refresh();
    } else {
      setPreview(imageUrl);
      toast.error(res.message);
    }
  }

  async function onRemove() {
    setPending(true);
    const res = await removeAvatarAction();
    setPending(false);
    if (res.ok) {
      setPreview(null);
      toast.success("Profilbild entfernt.");
      router.refresh();
    } else {
      toast.error(res.message);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <EmployeeAvatar name={name} color={color} imageUrl={preview} size="xl" />
        {pending && (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-background/60">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </span>
        )}
      </div>
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={onPick}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending || !storageAktiv}
            onClick={() => inputRef.current?.click()}
          >
            <Camera className="size-4" />
            {preview ? "Bild ändern" : "Bild hochladen"}
          </Button>
          {preview && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending || !storageAktiv}
              onClick={onReposition}
            >
              <Crop className="size-4" />
              Ausschnitt ändern
            </Button>
          )}
          {preview && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={onRemove}
              className="text-muted-foreground"
            >
              <Trash2 className="size-4" />
              Entfernen
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {storageAktiv
            ? "JPG, PNG oder WebP · bis 12 MB. Ausschnitt im Kreis verschieben und zoomen — auch später jederzeit über „Ausschnitt ändern“."
            : "Bild-Speicher ist nicht konfiguriert — Profilbilder sind derzeit deaktiviert."}
        </p>
      </div>

      {cropState && (
        <AvatarCropper
          file={cropState.file}
          initialTransform={cropState.transform}
          onCancel={() => setCropState(null)}
          onConfirm={ladeHoch}
        />
      )}
    </div>
  );
}

export function ProfileForm({
  defaults,
}: {
  defaults: { name: string; firstName: string; lastName: string; phone: string };
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setPending(true);
        const res = await updateProfileAction({
          name: String(data.get("name") ?? ""),
          firstName: String(data.get("firstName") ?? ""),
          lastName: String(data.get("lastName") ?? ""),
          phone: String(data.get("phone") ?? ""),
        });
        setPending(false);
        if (res.ok) {
          toast.success("Profil gespeichert.");
          router.refresh();
        } else {
          toast.error(res.message);
        }
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="name">Anzeigename</Label>
        <Input id="name" name="name" defaultValue={defaults.name} required minLength={2} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="firstName">Vorname</Label>
          <Input id="firstName" name="firstName" defaultValue={defaults.firstName} autoComplete="given-name" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lastName">Nachname</Label>
          <Input id="lastName" name="lastName" defaultValue={defaults.lastName} autoComplete="family-name" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone">Telefon</Label>
        <Input id="phone" name="phone" type="tel" defaultValue={defaults.phone} autoComplete="tel" placeholder="+49 …" />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        Profil speichern
      </Button>
    </form>
  );
}
