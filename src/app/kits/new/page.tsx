import { KitEditor } from "@/components/kits/KitEditor";

export const metadata = {
  title: "New character kit — imbrgr",
  description: "Create a reusable character kit with refs, palette, and style lock.",
};

export default function NewKitPage() {
  return <KitEditor mode="create" />;
}
