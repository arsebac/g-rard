import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const STATUS_LABELS: Record<string, string> = {
  a_faire: "À faire",
  en_cours: "En cours",
  termine: "Terminé",
  bloque: "Bloqué",
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
  basse: "Basse",
  normale: "Normale",
  haute: "Haute",
  urgente: "Urgente",
};

export const PRIORITY_COLORS: Record<string, string> = {
  basse: "text-gray-400",
  normale: "text-blue-500",
  haute: "text-orange-500",
  urgente: "text-red-600",
};

export const STATUSES = ["a_faire", "en_cours", "termine", "bloque"] as const;
export type Status = (typeof STATUSES)[number];
