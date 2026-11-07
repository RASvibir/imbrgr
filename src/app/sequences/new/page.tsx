import { redirect } from "next/navigation";

export const metadata = {
  title: "New shot sequence — imbrgr",
};

/**
 * Do not insert on GET/prefetch. Deep links land on the list with prefilled
 * fields; create happens only on explicit user action via POST /api/sequences
 * (which persists the guest cookie correctly).
 */
export default async function NewSequencePage({
  searchParams,
}: {
  searchParams: Promise<{ title?: string; kit?: string }>;
}) {
  const { title, kit } = await searchParams;
  const qs = new URLSearchParams();
  if (title?.trim()) qs.set("title", title.trim().slice(0, 80));
  if (kit?.trim()) qs.set("kit", kit.trim().slice(0, 20));
  const suffix = qs.toString();
  redirect(suffix ? `/sequences?${suffix}` : "/sequences");
}
