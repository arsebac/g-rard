import { db } from "../db";
import { ActivityType } from "@prisma/client";

export async function logActivity(params: {
  entityType: ActivityType;
  entityId: number;
  actorId: number;
  action: string;
  oldValue?: unknown;
  newValue?: unknown;
}) {
  await db.activityLog.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      actorId: params.actorId,
      action: params.action,
      oldValue: params.oldValue ? JSON.stringify(params.oldValue) : null,
      newValue: params.newValue ? JSON.stringify(params.newValue) : null,
    },
  });
}
