import { activityTools } from "./activity.js";
import { attachmentTools } from "./attachments.js";
import { authTools } from "./auth.js";
import { commentTools } from "./comments.js";
import { documentTools } from "./documents.js";
import { labelTools } from "./labels.js";
import { projectTools } from "./projects.js";
import { recurringTaskTools } from "./recurringTasks.js";
import { sprintTools } from "./sprints.js";
import { taskTools } from "./tasks.js";
import type { Tool } from "./types.js";
import { userTools } from "./users.js";
import { wikiTools } from "./wiki.js";

export const tools: Tool[] = [
  ...authTools,
  ...projectTools,
  ...taskTools,
  ...wikiTools,
  ...sprintTools,
  ...commentTools,
  ...userTools,
  ...labelTools,
  ...attachmentTools,
  ...activityTools,
  ...recurringTaskTools,
  ...documentTools,
];
