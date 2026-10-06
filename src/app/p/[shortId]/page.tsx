import { PostDetail } from "@/components/posts/PostDetail";

export default async function PostPage({ params }: { params: Promise<{ shortId: string }> }) {
  const { shortId } = await params;
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PostDetail shortId={shortId} />
    </div>
  );
}
