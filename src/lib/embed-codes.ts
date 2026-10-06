import { imagePageUrl, mediaUrl, siteUrl } from "@/lib/urls";

export function buildShareCodes(shortId: string, storageKey: string, mimeType: string, title = "image") {
  const page = siteUrl(imagePageUrl(shortId));
  const direct = siteUrl(mediaUrl(storageKey, mimeType));
  const safeTitle = title.replace(/"/g, "&quot;");
  return {
    pageUrl: page,
    directUrl: direct,
    markdown: `![${title}](${direct})`,
    html: `<a href="${page}"><img src="${direct}" alt="${safeTitle}" loading="lazy" /></a>`,
    bbcode: `[url=${page}][img]${direct}[/img][/url]`,
  };
}
