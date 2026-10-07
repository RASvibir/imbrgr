import { FIELDPRESS_INVITE_DISMISS_STORAGE_KEY } from "@/lib/fieldpress";

const listeners = new Set<() => void>();

export function readFieldPressInviteDismissed(): boolean {
  try {
    return localStorage.getItem(FIELDPRESS_INVITE_DISMISS_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function subscribeFieldPressInviteDismissed(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function dismissFieldPressInvite(): void {
  try {
    localStorage.setItem(FIELDPRESS_INVITE_DISMISS_STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
  for (const listener of listeners) listener();
}
