import { db } from "../db";

/** Génère une clé courte à partir du nom du projet */
function buildKey(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return words[0].substring(0, 3).toUpperCase().replace(/[^A-Z]/g, "X");
  }
  return words
    .map((w) => (w[0] ?? "X").toUpperCase())
    .join("")
    .replace(/[^A-Z]/g, "")
    .substring(0, 5);
}

/** Retourne une clé unique en ajoutant un suffixe numérique si collision */
export async function generateUniqueKey(name: string, excludeId?: number): Promise<string> {
  let key = buildKey(name);
  if (!key) key = "PRJ";

  let candidate = key;
  let i = 2;
  while (true) {
    const existing = await db.project.findFirst({
      where: { key: candidate, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    if (!existing) return candidate;
    candidate = (key + i).substring(0, 5);
    i++;
  }
}

/** Prochain numéro de tâche pour un projet */
export async function nextTaskNumber(projectId: number): Promise<number> {
  const max = await db.task.findFirst({
    where: { projectId },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  return (max?.number ?? 0) + 1;
}
