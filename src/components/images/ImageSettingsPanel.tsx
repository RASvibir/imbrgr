"use client";

import { VISIBILITY_OPTIONS, type Visibility } from "@/lib/visibility";

export type ImageSettingsValues = {
  title?: string;
  description?: string;
  tags?: string;
  altText?: string;
  mature?: boolean;
  visibility?: Visibility;
};

type Props = {
  values: ImageSettingsValues;
  onChange: (next: ImageSettingsValues) => void;
  signedIn: boolean;
  compact?: boolean;
};

export function ImageSettingsPanel({ values, onChange, signedIn, compact }: Props) {
  const visOptions = signedIn
    ? VISIBILITY_OPTIONS
    : VISIBILITY_OPTIONS.filter((v) => v.value !== "PRIVATE");

  return (
    <div className={`space-y-3 ${compact ? "text-sm" : ""}`}>
      {values.title !== undefined ? (
        <label className="block">
          Title
          <input
            value={values.title}
            onChange={(e) => onChange({ ...values, title: e.target.value })}
            className="mt-1 w-full rounded-lg border px-3 py-2"
          />
        </label>
      ) : null}
      {values.description !== undefined ? (
        <label className="block">
          Description
          <textarea
            value={values.description}
            onChange={(e) => onChange({ ...values, description: e.target.value })}
            rows={compact ? 2 : 3}
            className="mt-1 w-full rounded-lg border px-3 py-2"
          />
        </label>
      ) : null}
      {values.tags !== undefined ? (
        <label className="block">
          Tags
          <input
            value={values.tags}
            onChange={(e) => onChange({ ...values, tags: e.target.value })}
            placeholder="comma or # separated"
            className="mt-1 w-full rounded-lg border px-3 py-2"
          />
        </label>
      ) : null}
      {values.altText !== undefined ? (
        <label className="block">
          Alt text
          <input
            value={values.altText}
            onChange={(e) => onChange({ ...values, altText: e.target.value })}
            className="mt-1 w-full rounded-lg border px-3 py-2"
          />
        </label>
      ) : null}
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={values.mature ?? false}
          onChange={(e) => onChange({ ...values, mature: e.target.checked })}
        />
        Mature / sensitive content
      </label>
      {values.visibility !== undefined ? (
        <div>
          <p className="font-medium">Visibility</p>
          <div className="mt-2 space-y-2">
            {visOptions.map((opt) => (
              <label key={opt.value} className="flex cursor-pointer gap-2 rounded-lg border p-2">
                <input
                  type="radio"
                  name="visibility"
                  checked={values.visibility === opt.value}
                  onChange={() => onChange({ ...values, visibility: opt.value })}
                />
                <span>
                  <span className="font-medium">{opt.label}</span>
                  <span className="block text-xs text-[var(--text-muted)]">{opt.hint}</span>
                </span>
              </label>
            ))}
          </div>
          {!signedIn ? (
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              Guest uploads are public or unlisted only.{" "}
              <a href="/auth/signup" className="text-[var(--accent-primary)]">Sign up</a> to keep images private.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
