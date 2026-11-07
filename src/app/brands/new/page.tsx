import { BrandEditor } from "@/components/brands/BrandEditor";

export const metadata = {
  title: "New brand kit — imbrgr",
  description: "Create a brand kit with palette, typography, and logo-safe layout locks.",
};

export default function NewBrandPage() {
  return <BrandEditor mode="create" />;
}
