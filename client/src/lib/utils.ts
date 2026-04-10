import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const STATUS_LABELS: Record<string, string> = {
  a_faire: "To do",
  en_cours: "In progress",
  termine: "Done",
  bloque: "Blocked",
};

export const STATUS_COLORS: Record<string, string> = {
  a_faire: "bg-gray-100 text-gray-700",
  en_cours: "bg-blue-100 text-blue-700",
  termine: "bg-green-100 text-green-700",
  bloque: "bg-red-100 text-red-700",
};

export const STATUS_COLUMN_COLORS: Record<string, string> = {
  a_faire: "border-t-gray-400",
  en_cours: "border-t-blue-500",
  termine: "border-t-green-500",
  bloque: "border-t-red-500",
};

export const PRIORITY_LABELS: Record<string, string> = {
  basse: "Low",
  normale: "Normal",
  haute: "High",
  urgente: "Urgent",
};

export const PRIORITY_COLORS: Record<string, string> = {
  basse: "text-gray-400",
  normale: "text-blue-500",
  haute: "text-orange-500",
  urgente: "text-red-600",
};

export const STATUSES = ["a_faire", "en_cours", "termine", "bloque"] as const;
export type Status = (typeof STATUSES)[number];

/** Formats a ticket reference: "CUI-5" or "#5" if no project key */
export function taskRef(key: string | null | undefined, number: number): string {
  if (key) return `${key}-${number}`;
  return `#${number || "?"}`;
}

/** Regex to detect a ticket reference */
export const TASK_REF_REGEX = /\b([A-Z]{2,5})-(\d+)\b/g;
