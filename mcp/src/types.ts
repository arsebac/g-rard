/** Shapes returned by the Gerard API, limited to the fields the tools read. */

export interface Project {
  id: number;
  name: string;
  key: string | null;
  description: string | null;
  color: string;
  doneVisibility?: string;
  doneVisibilityHours?: number;
  _count?: { tasks: number };
}

export interface Task {
  id: number;
  projectId: number;
  number: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeId: number | null;
  dueDate: string | null;
  projectKey?: string | null;
  assignee?: { id: number; name: string } | null;
  labels?: { label: { name: string; color: string } }[];
  comments?: Comment[];
  typeId?: number | null;
  type?: { id: number; name: string; isEpic: boolean } | null;
  parentId?: number | null;
  parent?: { id: number; number: number; title: string; project?: { key: string | null } } | null;
  archived?: boolean;
}

export interface WikiPage {
  id: number;
  projectId: number | null;
  parentId: number | null;
  title: string;
  slug: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface Comment {
  id: number;
  taskId: number;
  body: string;
  createdAt: string;
  author: { id: number; name: string };
}

export interface ActivityLog {
  id: number;
  entityType: string;
  entityId: number;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  actor: { id: number; name: string };
}

export interface Sprint {
  id: number;
  projectId: number;
  name: string;
  goal: string | null;
  status: "futur" | "actif" | "termine";
  startDate: string | null;
  endDate: string | null;
  _count?: { tasks: number };
}

export interface Label {
  id: number;
  projectId: number;
  name: string;
  color: string;
}

export interface RecurringTask {
  id: number;
  projectId: number;
  title: string;
  recurrenceType: "EVERY_N_WEEKS" | "MONTHLY_BEFORE_END" | "CUSTOM_DATES";
  intervalWeeks: number | null;
  daysBeforeEndOfMonth: number | null;
  customDates: string[] | null;
  priority: string;
  _count?: { tasks: number };
}

export interface Attachment {
  id: number;
  entityType: string;
  entityId: number;
  filename: string;
  mimeType: string;
  createdAt: string;
  uploader: { id: number; name: string };
}

export interface DocumentSpace {
  id: number;
  name: string;
  color: string;
  description: string | null;
  parentId: number | null;
  _count?: { documents: number; children: number };
  members?: SpaceMember[];
}

export interface SpaceMember {
  userId: number;
  role: string;
  user: { id: number; name: string; email: string };
}

export interface Document {
  id: number;
  spaceId: number;
  title: string;
  description: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploader?: { id: number; name: string };
}
