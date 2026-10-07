"use client";

import { useCallback, useState } from "react";

export type Dashboard = {
  users: number;
  posts: number;
  media: number;
  storageBytesSignedIn: string;
  storageBytesAnonymous: string;
  aiGenerationsTodaySignedIn: number;
  aiGenerationsTodayAnonymous: number;
  openReports: number;
  promptCacheEntries: number;
  promptCacheHits24h: number;
  recentSignups: { id: string; username: string; email: string; createdAt: string | Date; role: string }[];
};

type Tab = "dashboard" | "users" | "content" | "reports" | "ai" | "settings" | "audit";

export function AdminConsole({ initialDashboard }: { initialDashboard: Dashboard }) {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [dash, setDash] = useState<Dashboard | null>(initialDashboard);
  const [users, setUsers] = useState<unknown[]>([]);
  const [userQ, setUserQ] = useState("");
  const [content, setContent] = useState<{ posts: unknown[]; media: unknown[] } | null>(null);
  const [reports, setReports] = useState<unknown[]>([]);
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [audit, setAudit] = useState<unknown[]>([]);
  const [msg, setMsg] = useState("");

  const loadTab = useCallback(async (next: Tab) => {
    if (next === "dashboard") {
      const r = await fetch("/api/admin/dashboard");
      setDash(await r.json());
    }
    if (next === "users") {
      const r = await fetch(`/api/admin/users?q=${encodeURIComponent(userQ)}`);
      const d = await r.json();
      setUsers(d.users ?? []);
    }
    if (next === "content") {
      const r = await fetch("/api/admin/content");
      setContent(await r.json());
    }
    if (next === "reports") {
      const r = await fetch("/api/admin/reports");
      const d = await r.json();
      setReports(d.reports ?? []);
    }
    if (next === "settings") {
      const r = await fetch("/api/admin/settings");
      setSettings(await r.json());
    }
    if (next === "audit") {
      const r = await fetch("/api/admin/audit");
      const d = await r.json();
      setAudit(d.logs ?? []);
    }
  }, [userQ]);

  const saveSettings = async () => {
    if (!settings) return;
    const r = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSettings(await r.json());
    setMsg("Site settings saved");
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "dashboard", label: "Dashboard" },
    { id: "users", label: "Users" },
    { id: "content", label: "Content" },
    { id: "reports", label: "Reports" },
    { id: "ai", label: "AI usage" },
    { id: "settings", label: "Site" },
    { id: "audit", label: "Audit log" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-8 border-b border-[var(--border-subtle)] pb-6">
        <h1 className="text-3xl font-bold text-[var(--accent-primary)]">Super admin</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">imbrgr operations console</p>
      </header>

      <nav className="mb-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              void loadTab(t.id);
            }}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              tab === t.id
                ? "bg-[var(--accent-primary)] text-[var(--on-accent)]"
                : "border border-[var(--border-strong)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {msg ? <p className="mb-4 text-sm text-[var(--success)]">{msg}</p> : null}

      {tab === "dashboard" && dash ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Stat label="Users" value={dash.users} />
            <Stat label="Posts" value={dash.posts} />
            <Stat label="Media" value={dash.media} />
            <Stat label="AI today (signed-in)" value={dash.aiGenerationsTodaySignedIn} />
            <Stat label="AI today (guest)" value={dash.aiGenerationsTodayAnonymous} />
            <Stat label="Open reports" value={dash.openReports} />
            <Stat label="Signed-in storage (bytes)" value={dash.storageBytesSignedIn} />
            <Stat label="Guest storage (bytes)" value={dash.storageBytesAnonymous} />
            <Stat label="Prompt cache (24h hits)" value={dash.promptCacheHits24h} />
          </div>
          <div className="max-w-lg rounded-xl border border-[var(--border-subtle)] p-4">
            <h2 className="font-semibold">Thumbnails</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Generate missing WebP thumbnails in safe batches (uses blob storage on Vercel).
            </p>
            <button
              type="button"
              className="mt-3 rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold text-[var(--on-accent)]"
              onClick={async () => {
                const r = await fetch("/api/admin/thumbnails/backfill", { method: "POST" });
                const d = await r.json();
                setMsg(r.ok ? `Thumbnails: updated ${d.updated ?? 0} in this batch` : d.error ?? "Failed");
              }}
            >
              Generate missing thumbnails
            </button>
          </div>
        </div>
      ) : null}

      {tab === "users" ? (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              value={userQ}
              onChange={(e) => setUserQ(e.target.value)}
              placeholder="Search users"
              className="flex-1 rounded-lg border px-3 py-2"
            />
            <button type="button" onClick={() => void loadTab("users")} className="rounded-lg border px-4 py-2 text-sm">
              Search
            </button>
          </div>
          <ul className="divide-y rounded-xl border">
            {(users as { id: string; username: string; email: string; role: string; banned: boolean }[]).map((u) => (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span>@{u.username} · {u.email} · {u.role}{u.banned ? " · banned" : ""}</span>
                <button
                  type="button"
                  className="text-[var(--accent-primary)]"
                  onClick={async () => {
                    await fetch(`/api/admin/users/${u.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ suspended: true }),
                    });
                    setMsg(`Suspended ${u.username}`);
                    void loadTab("users");
                  }}
                >
                  Suspend
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {tab === "content" && content ? (
        <div className="space-y-6">
          <section>
            <h2 className="font-semibold">Posts</h2>
            <ul className="mt-2 divide-y rounded-xl border text-sm">
              {(content.posts as { shortId: string; title: string; visibility: string; hiddenByAdmin: boolean }[]).map((p) => (
                <li key={p.shortId} className="flex justify-between gap-2 p-3">
                  <span>{p.title} · {p.visibility}{p.hiddenByAdmin ? " · hidden" : ""}</span>
                  <button
                    type="button"
                    className="text-[var(--accent-primary)]"
                    onClick={async () => {
                      await fetch(`/api/admin/content/posts/${p.shortId}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ hiddenByAdmin: !p.hiddenByAdmin }),
                      });
                      void loadTab("users");
                    }}
                  >
                    Toggle hide
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}

      {tab === "reports" ? (
        <ul className="divide-y rounded-xl border text-sm">
          {(reports as { id: string; reason: string; targetLabel?: string; post: { shortId: string; title: string } | null }[]).map((r) => (
            <li key={r.id} className="flex justify-between gap-2 p-3">
              <span>{r.targetLabel ?? r.post?.title ?? "Report"} — {r.reason}</span>
              <button
                type="button"
                onClick={async () => {
                  await fetch(`/api/admin/reports/${r.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: "RESOLVED" }),
                  });
                      void loadTab("content");
                }}
              >
                Resolve
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {tab === "settings" && settings ? (
        <div className="max-w-lg space-y-4 rounded-xl border p-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(settings.anonymousUploadsEnabled)}
              onChange={(e) => setSettings({ ...settings, anonymousUploadsEnabled: e.target.checked })}
            />
            Anonymous uploads enabled
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(settings.anonymousAiEnabled)}
              onChange={(e) => setSettings({ ...settings, anonymousAiEnabled: e.target.checked })}
            />
            Anonymous AI enabled
          </label>
          <label className="block text-sm">
            Guest AI daily limit
            <input
              type="number"
              value={Number(settings.anonAiDailyLimit ?? 5)}
              onChange={(e) => setSettings({ ...settings, anonAiDailyLimit: Number(e.target.value) })}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Announcement banner
            <input
              value={String(settings.announcementBanner ?? "")}
              onChange={(e) => setSettings({ ...settings, announcementBanner: e.target.value })}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <button type="button" onClick={saveSettings} className="rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold text-[var(--on-accent)]">
            Save settings
          </button>
        </div>
      ) : null}

      {tab === "audit" ? (
        <ul className="divide-y rounded-xl border text-xs">
          {(audit as { id: string; action: string; targetType: string | null; targetId: string | null; createdAt: string; actor: { username: string } }[]).map((l) => (
            <li key={l.id} className="p-3">
              {l.createdAt} · @{l.actor.username} · {l.action} · {l.targetType}:{l.targetId}
            </li>
          ))}
        </ul>
      ) : null}

      {tab === "ai" ? (
        <p className="text-sm text-[var(--text-muted)]">See dashboard for today&apos;s counts; per-day series available via API.</p>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4">
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
