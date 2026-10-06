import { redirect } from "next/navigation";

export default function LegacyAiPage() {
  redirect("/studio?tab=generate");
}
