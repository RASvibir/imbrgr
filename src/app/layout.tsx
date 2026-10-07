import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Header } from "@/components/layout/Header";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { ThemeScript } from "@/components/theme/ThemeScript";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://imbrgr.website";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "imbrgr",
    template: "%s · imbrgr",
  },
  description:
    "images, served hot — community image hosting by ChloReform Studios for Irie Pharm.",
  applicationName: "imbrgr",
  authors: [{ name: "ChloReform Studios", url: "https://imbrgr.website" }],
  creator: "Victor Birkle · Irie Pharm",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "imbrgr",
    title: "imbrgr — images, served hot",
    description: "The internet's visual snack. Upload, share, and discover images and short clips.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "imbrgr — ember-themed image sharing",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "imbrgr",
    description: "Image hosting with an ember glow.",
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf7f4" },
    { media: "(prefers-color-scheme: dark)", color: "#141210" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full flex flex-col">
        <SessionProvider>
          <Header />
          <main className="page-main flex-1 min-w-0">{children}</main>
          <MobileBottomNav />
        <footer className="hidden border-t border-[var(--border-subtle)] py-8 text-center text-sm text-[var(--text-muted)] lg:block">
          © {new Date().getFullYear()} imbrgr · ChloReform Studios · Irie Pharm
        </footer>
        </SessionProvider>
      </body>
    </html>
  );
}
