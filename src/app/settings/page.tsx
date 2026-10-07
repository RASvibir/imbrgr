"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ImageEditor } from "@/components/editor/ImageEditor";
import { CollectionSettings } from "@/components/collections/CollectionSettings";
import { StorageMeter } from "@/components/storage/StorageMeter";
import { profileImageUrlBusted } from "@/lib/urls";

type LinkItem = { label: string; url: string };

type Profile = {
  email: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarKey: string | null;
  bannerKey: string | null;
  links: LinkItem[] | null;
  favoritesPublic: boolean;
  defaultPostVisibility: string;
};

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [crop, setCrop] = useState<{ kind: "avatar" | "banner"; src: string } | null>(null);
  const [imageCacheBust, setImageCacheBust] = useState<{ avatar?: number; banner?: number }>({});

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin?callbackUrl=/settings");
  }, [status, router]);

  useEffect(() => {
    if (!session?.user) return;
    void fetch("/api/me")
      .then((r) => r.json())
      .then((data) => {
        setProfile({
          ...data,
          links: (data.links as LinkItem[] | null) ?? [],
        });
      });
  }, [session?.user]);

  const saveProfile = async () => {
    if (!profile) return;
    setErr("");
    setMsg("");
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: profile.username,
        displayName: profile.displayName,
        bio: profile.bio,
        links: profile.links?.filter((l) => l.label && l.url) ?? [],
        favoritesPublic: profile.favoritesPublic,
        defaultPostVisibility: profile.defaultPostVisibility,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErr(data.error ?? "Save failed");
      return;
    }
    setMsg("Profile saved");
    if (data.username !== session?.user?.username) {
      router.push(`/settings`);
    }
  };

  const uploadProfileImage = async (kind: "avatar" | "banner", blob: Blob) => {
    const form = new FormData();
    form.set("file", blob, `${kind}.jpg`);
    const res = await fetch(`/api/me/${kind}`, { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) {
      setErr(data.error ?? "Upload failed");
      return;
    }
    setProfile((p) =>
      p
        ? {
            ...p,
            avatarKey: kind === "avatar" ? data.avatarKey : p.avatarKey,
            bannerKey: kind === "banner" ? data.bannerKey : p.bannerKey,
          }
        : p,
    );
    setImageCacheBust((b) => ({ ...b, [kind]: Date.now() }));
    setCrop(null);
    setMsg(kind === "avatar" ? "Profile photo updated" : "Banner updated");
  };

  const deleteAccount = async () => {
    if (
      !confirm(
        "Delete your account? Your public gallery posts stay up as “Deleted user”; private and unlisted posts are removed. This cannot be undone.",
      )
    )
      return;
    const res = await fetch("/api/me/delete", { method: "POST" });
    if (res.ok) {
      await signOut({ callbackUrl: "/" });
    } else {
      const data = await res.json();
      setErr(data.error ?? "Delete failed");
    }
  };

  if (!profile) {
    return <p className="p-8 text-center text-[var(--text-muted)]">Loading settings…</p>;
  }

  const avatarSrc = profileImageUrlBusted(profile.avatarKey, imageCacheBust.avatar);
  const bannerSrc = profileImageUrlBusted(profile.bannerKey, imageCacheBust.banner);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-bold">Settings</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        <Link href={`/u/${profile.username}`} className="text-[var(--accent-primary)]">View public profile</Link>
      </p>

      <div className="mt-6">
        <StorageMeter />
      </div>

      <section className="mt-8 space-y-4 rounded-xl border border-[var(--border-subtle)] p-4">
        <h2 className="font-semibold">Profile images</h2>
        <div className="relative h-32 overflow-hidden rounded-lg bg-[var(--surface-sunken)]">
          {bannerSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bannerSrc} alt="" className="h-full w-full object-cover" />
          ) : null}
        </div>
        <div className="flex items-end gap-4">
          <div className="h-20 w-20 overflow-hidden rounded-full border-2 border-[var(--border-strong)] bg-[var(--surface-sunken)]">
            {avatarSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarSrc}
                alt=""
                data-testid="settings-avatar-preview"
                className="h-full w-full object-cover"
              />
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="cursor-pointer rounded-lg border px-3 py-2 text-sm">
              Avatar
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setCrop({ kind: "avatar", src: URL.createObjectURL(f) });
                }}
              />
            </label>
            <label className="cursor-pointer rounded-lg border px-3 py-2 text-sm">
              Banner
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setCrop({ kind: "banner", src: URL.createObjectURL(f) });
                }}
              />
            </label>
          </div>
        </div>
      </section>

      <section className="mt-6 space-y-3">
        <label className="block text-sm">
          Username
          <input
            value={profile.username}
            onChange={(e) => setProfile({ ...profile, username: e.target.value })}
            className="mt-1 w-full rounded-lg border px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Display name
          <input
            value={profile.displayName ?? ""}
            onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
            className="mt-1 w-full rounded-lg border px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Bio
          <textarea
            value={profile.bio ?? ""}
            onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
            rows={4}
            className="mt-1 w-full rounded-lg border px-3 py-2"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={profile.favoritesPublic}
            onChange={(e) => setProfile({ ...profile, favoritesPublic: e.target.checked })}
          />
          Show favorites on public profile
        </label>
        <label className="block text-sm">
          Default visibility for new uploads
          <select
            value={profile.defaultPostVisibility}
            onChange={(e) => setProfile({ ...profile, defaultPostVisibility: e.target.value })}
            className="mt-1 w-full rounded-lg border px-3 py-2"
          >
            <option value="PUBLIC">Public</option>
            <option value="UNLISTED">Unlisted</option>
            <option value="PRIVATE">Private</option>
          </select>
        </label>
        <div>
          <p className="text-sm font-medium">Links (up to 5)</p>
          {(profile.links ?? []).map((link, i) => (
            <div key={i} className="mt-2 flex gap-2">
              <input
                placeholder="Label"
                value={link.label}
                onChange={(e) => {
                  const links = [...(profile.links ?? [])];
                  links[i] = { ...links[i], label: e.target.value };
                  setProfile({ ...profile, links });
                }}
                className="w-1/3 rounded border px-2 py-1 text-sm"
              />
              <input
                placeholder="https://"
                value={link.url}
                onChange={(e) => {
                  const links = [...(profile.links ?? [])];
                  links[i] = { ...links[i], url: e.target.value };
                  setProfile({ ...profile, links });
                }}
                className="flex-1 rounded border px-2 py-1 text-sm"
              />
            </div>
          ))}
          <button
            type="button"
            className="mt-2 text-sm text-[var(--accent-primary)]"
            onClick={() =>
              setProfile({
                ...profile,
                links: [...(profile.links ?? []), { label: "", url: "" }].slice(0, 5),
              })
            }
          >
            + Add link
          </button>
        </div>
      </section>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={saveProfile}
          className="rounded-xl bg-[var(--accent-primary)] px-5 py-2 font-semibold text-[var(--on-accent)]"
        >
          Save profile
        </button>
      </div>

      <CollectionSettings />

      <section className="mt-10 rounded-xl border border-[var(--danger)]/40 p-4">
        <h2 className="font-semibold text-[var(--danger)]">Delete account</h2>
        <button type="button" onClick={deleteAccount} className="mt-3 rounded-lg border border-[var(--danger)] px-4 py-2 text-sm text-[var(--danger)]">
          Delete my account
        </button>
      </section>

      {msg ? <p className="mt-4 text-sm text-[var(--accent-primary)]">{msg}</p> : null}
      {err ? <p className="mt-4 text-sm text-[var(--danger)]">{err}</p> : null}

      {crop ? (
        <ImageEditor
          imageSrc={crop.src}
          aspectPreset={crop.kind === "avatar" ? 1 : 3}
          onCancel={() => setCrop(null)}
          onExport={(blob) => uploadProfileImage(crop.kind, blob)}
        />
      ) : null}
    </div>
  );
}
