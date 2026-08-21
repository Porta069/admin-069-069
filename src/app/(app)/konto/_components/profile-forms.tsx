"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmployeeAvatar } from "@/components/common/employee-avatar";
import { Camera, Loader2, Trash2 } from "lucide-react";
import {
  removeAvatarAction,
  updateProfileAction,
  uploadAvatarAction,
} from "../actions";

const MAX_BYTES = 3 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

export function AvatarUpload({
  name,
  color,
  imageUrl,
  storageAktiv,
}: {
  name: string;
  color: string | null;
  imageUrl: string | null;
  storageAktiv: boolean;
}) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [pending, setPending] = React.useState(false);
  // Lokale Vorschau bis der Server refresht.
  const [preview, setPreview] = React.useState<string | null>(imageUrl);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // erneutes Auswählen derselben Datei erlauben
    if (!file) return;
    if (!TYPES.includes(file.type)) {
      toast.error("Nur JPG, PNG oder WebP.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Bild zu groß (max. 3 MB).");
      return;
    }
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setPending(true);
    const fd = new FormData();
    fd.append("file", file);
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
            ? "JPG, PNG oder WebP · bis 3 MB. Quadratisch sieht am besten aus."
            : "Bild-Speicher ist nicht konfiguriert — Profilbilder sind derzeit deaktiviert."}
        </p>
      </div>
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
