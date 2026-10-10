"use client";

import { useState } from "react";
import { friendlyError } from "@/lib/user-messages";
import { MobileBottomSheet } from "@/components/layout/MobileBottomSheet";

type Target = {
  type: "POST" | "MEDIA" | "COLLECTION" | "USER";
  id: string;
  label: string;
};

export function ReportButton({ target }: { target: Target }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");

  const submit = async () => {
    setMsg("");
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType: target.type, targetId: target.id, reason }),
    });
    if (res.ok) {
      setMsg("Thanks — we'll take a look.");
      setReason("");
      setOpen(false);
    } else {
      const data = await res.json();
      setMsg(friendlyError(data.error ?? "Could not send report"));
    }
  };

  return (
    <>
      <button
        type="button"
        className="tap-target text-sm text-[var(--text-muted)] hover:text-[var(--accent-primary)]"
        onClick={() => setOpen(true)}
      >
        Report
      </button>
      <MobileBottomSheet open={open} onClose={() => setOpen(false)} title={`Report ${target.label}`}>
        <p className="text-sm text-[var(--text-muted)]">Tell us what feels off. No need to be formal.</p>
        <textarea
          className="mt-3 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-base)] p-3"
          rows={4}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="What's wrong with this?"
          aria-label="Report reason"
        />
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="tap-target rounded-lg border px-4 py-2 text-sm" onClick={() => setOpen(false)}>
            Cancel
          </button>
          <button
            type="button"
            className="tap-target rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold text-[var(--on-accent)]"
            onClick={submit}
            disabled={reason.trim().length < 3}
          >
            Send
          </button>
        </div>
        {msg ? <p className="mt-3 text-sm text-[var(--accent-primary)]">{msg}</p> : null}
      </MobileBottomSheet>
    </>
  );
}
