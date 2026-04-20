-- Add 'viewer' to the ProjectMemberRole enum
ALTER TABLE `project_members`
  MODIFY COLUMN `role` ENUM('admin', 'member', 'viewer') NOT NULL DEFAULT 'member';
