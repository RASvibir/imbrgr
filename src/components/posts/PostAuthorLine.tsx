import Link from "next/link";
import { postAuthorLabel, isAnonymousGuestPost } from "@/lib/post-author";

type Props = {
  user: { username: string } | null;
  media?: { voterKey?: string | null }[];
  className?: string;
};

export function PostAuthorLine({ user, media, className }: Props) {
  const label = postAuthorLabel({ user, media });
  if (user) {
    return (
      <Link href={`/u/${user.username}`} className={className}>
        @{user.username}
      </Link>
    );
  }
  if (isAnonymousGuestPost({ user, media })) {
    return <span className={className}>anonymous</span>;
  }
  return (
    <span className={className} data-testid="post-author-deleted">
      {label}
    </span>
  );
}
