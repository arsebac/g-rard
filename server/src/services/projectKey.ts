import { db } from "../db";

/** Generates a short key from the project name */
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

/** Returns a unique key by adding a numeric suffix if there is a collision */
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

/** 
 * Returns the next task number for a project.
 * Uses a transaction to prevent race conditions during concurrent task creations.
 */
export async function nextTaskNumber(projectId: number): Promise<number> {
  return await db.$transaction(async (tx) => {
    // Lock the rows to prevent concurrent increments from reading the same max value
    const result = await tx.$queryRaw<any[]>`
      SELECT MAX(number) as maxNumber FROM tasks WHERE project_id = ${projectId} FOR UPDATE
    `;
    const max = result[0]?.maxNumber ?? 0;
    return max + 1;
  });
}
