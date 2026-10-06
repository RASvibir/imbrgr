import { createHash, randomBytes } from "node:crypto";

export function newDeleteToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashDeleteToken(token: string): string {
  const secret = process.env.AUTH_SECRET ?? "dev";
  return createHash("sha256").update(`${secret}:del:${token}`).digest("hex");
}

export function verifyDeleteToken(token: string, hash: string | null | undefined): boolean {
  if (!hash || !token) return false;
  return hashDeleteToken(token) === hash;
}
