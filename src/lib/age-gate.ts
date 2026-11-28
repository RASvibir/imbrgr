import { prisma } from "@/lib/db";

const MIN_ADULT_AGE = 18;
const MIN_BIRTH_YEAR = 1900;

/** Returns true if `birthDate` represents a person at least 18 years old as of `now` (UTC calendar). */
export function isAtLeast18(birthDate: Date, now: Date = new Date()): boolean {
  if (Number.isNaN(birthDate.getTime())) return false;
  const yearDiff = now.getUTCFullYear() - birthDate.getUTCFullYear();
  if (yearDiff > MIN_ADULT_AGE) return true;
  if (yearDiff < MIN_ADULT_AGE) return false;
  const monthDiff = now.getUTCMonth() - birthDate.getUTCMonth();
  if (monthDiff > 0) return true;
  if (monthDiff < 0) return false;
  return now.getUTCDate() >= birthDate.getUTCDate();
}

/** Parses an ISO `YYYY-MM-DD` birth date string into a UTC Date, rejecting invalid/future dates. */
export function parseBirthDate(raw: string): Date | null {
  const match = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < MIN_BIRTH_YEAR || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return null;
  }
  if (dt.getTime() > Date.now()) return null;
  return dt;
}

export type ViewerAgeStatus = {
  signedIn: boolean;
  ageVerified: boolean;
  birthDate: string | null;
  adultVerifiedAt: string | null;
};

/** Checks whether a signed-in user has a stored, valid 18+ verification. */
export async function getViewerAgeStatus(userId: string | null): Promise<ViewerAgeStatus> {
  if (!userId) {
    return { signedIn: false, ageVerified: false, birthDate: null, adultVerifiedAt: null };
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { birthDate: true, adultVerifiedAt: true },
  });
  if (!user) {
    return { signedIn: false, ageVerified: false, birthDate: null, adultVerifiedAt: null };
  }
  const ageVerified = Boolean(user.adultVerifiedAt && user.birthDate && isAtLeast18(user.birthDate));
  return {
    signedIn: true,
    ageVerified,
    birthDate: user.birthDate ? user.birthDate.toISOString().slice(0, 10) : null,
    adultVerifiedAt: user.adultVerifiedAt ? user.adultVerifiedAt.toISOString() : null,
  };
}

export async function isUserAgeVerified(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const status = await getViewerAgeStatus(userId);
  return status.ageVerified;
}
