"use client";

import Link from "next/link";
import { useState } from "react";
import { btnPrimary } from "@/lib/ui/button-classes";

type Props = {
  signedIn: boolean;
  callbackUrl: string;
  onVerified?: () => void;
  title?: string;
  description?: string;
};

export function AgeGateCard({
  signedIn,
  callbackUrl,
  onVerified,
  title = "18+ Age Verification Required",
  description = "Uncensored shares are hidden from public feeds and require a signed-in 18+ verified account.",
}: Props) {
  const [birthDate, setBirthDate] = useState("");
  const [confirmAdult, setConfirmAdult] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!birthDate || !confirmAdult) {
      setError("Enter your birth date and confirm you are at least 18 years old.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/me/age-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ birthDate, confirmAdult: true }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; ageVerified?: boolean };
      if (!res.ok || !data.ageVerified) {
        setError(data.error ?? "Age verification failed.");
        return;
      }
      onVerified?.();
    } catch {
      setError("Could not reach verification service.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-raised)] p-6 text-center shadow-sm"
      data-testid="age-gate-card"
    >
      <div className="mx-auto max-w-md space-y-3">
        <p className="text-2xl" aria-hidden>
          🔞
        </p>
        <h2 className="text-lg font-bold text-[var(--text-primary)]">{title}</h2>
        <p className="text-sm text-[var(--text-muted)]">{description}</p>

        {!signedIn ? (
          <div className="pt-2">
            <Link
              href={`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`}
              data-testid="age-gate-signin"
              className={`${btnPrimary} inline-flex px-5 py-2 text-sm font-semibold`}
            >
              Sign in to verify age
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-3 text-left">
            <label className="block text-xs font-medium text-[var(--text-secondary)]">
              Date of birth
              <input
                type="date"
                required
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                data-testid="age-gate-birthdate"
                className="mt-1 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)]"
              />
            </label>
            <label className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={confirmAdult}
                onChange={(e) => setConfirmAdult(e.target.checked)}
                data-testid="age-gate-confirm"
                className="mt-0.5 rounded border-[var(--border-strong)]"
              />
              <span>I confirm that I am at least 18 years old and choose to view uncensored content.</span>
            </label>
            {error ? (
              <p className="text-xs text-[var(--danger)]" data-testid="age-gate-error">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={submitting}
              data-testid="age-gate-submit"
              className={`${btnPrimary} w-full py-2 text-sm font-semibold disabled:opacity-50`}
            >
              {submitting ? "Verifying…" : "Verify 18+ & Unlock"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
