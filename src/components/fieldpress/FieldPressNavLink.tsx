import { FIELDPRESS_URL } from "@/lib/fieldpress";
import { headerNavLinkClass } from "@/components/layout/header-nav-classes";

type Props = {
  className?: string;
};

/** Desktop header link — mobile uses the “More” sheet entry. */
export function FieldPressNavLink({ className }: Props) {
  return (
    <a
      href={FIELDPRESS_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={className ?? `${headerNavLinkClass} hidden items-center gap-1 sm:inline-flex`}
      data-testid="fieldpress-nav-link"
    >
      FieldPress ↗
      <span className="sr-only">(opens in new tab)</span>
    </a>
  );
}
