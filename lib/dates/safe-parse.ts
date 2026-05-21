import { isValid, parseISO } from "date-fns";

/** Parse an ISO date string; returns null for missing or invalid values. */
export function safeParseISO(value: string | null | undefined): Date | null {
  if (!value || typeof value !== "string") return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}
