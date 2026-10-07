import { EmptyState } from "@/components/ui/EmptyState";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <EmptyState
        title="This page wandered off the menu"
        description="The link might be old, or the post was removed. Head home or open the studio to cook something new."
        actions={[
          { label: "Back to gallery", href: "/", primary: true },
          { label: "Open studio", href: "/studio" },
        ]}
      />
    </div>
  );
}
