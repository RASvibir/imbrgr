import Link from "next/link";
import { postAuthorLabel } from "@/lib/post-author";

type Props = {
  user: { username: string } | null;
  authorDeleted?: boolean | null;
  className?: string;
  /** Set false when rendered inside another link (e.g. a feed card) to avoid nested anchors. */
  linkProfile?: boolean;
};

export function PostAuthorLine({ user, authorDeleted, className, linkProfile = true }: Props) {
  const label = postAuthorLabel({ user, authorDeleted });
  if (user && linkProfile) {
    return (
      <Link href={`/u/${user.username}`} className={className}>
        {label}
      </Link>
    );
  }
  if (!user && authorDeleted) {
    return (
      <span className={className} data-testid="post-author-deleted">
        {label}
      </span>
    );
  }
  return <span className={className}>{label}</span>;
}
