-- Phase 6 : types de tickets, liens entre tickets, hiérarchie Epic/Story

-- CreateTable ticket_types
CREATE TABLE `ticket_types` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `project_id` INTEGER NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `icon` VARCHAR(50) NOT NULL DEFAULT 'square',
  `color` VARCHAR(7) NOT NULL DEFAULT '#6366f1',
  `is_epic` BOOLEAN NOT NULL DEFAULT false,
  `position` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey ticket_types -> projects
ALTER TABLE `ticket_types` ADD CONSTRAINT `ticket_types_project_id_fkey`
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable tasks : add type_id and parent_id
ALTER TABLE `tasks`
  ADD COLUMN `type_id` INTEGER NULL,
  ADD COLUMN `parent_id` INTEGER NULL;

-- AddForeignKey tasks -> ticket_types
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_type_id_fkey`
  FOREIGN KEY (`type_id`) REFERENCES `ticket_types`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey tasks -> tasks (parent)
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_parent_id_fkey`
  FOREIGN KEY (`parent_id`) REFERENCES `tasks`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable task_links
CREATE TABLE `task_links` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `source_id` INTEGER NOT NULL,
  `target_id` INTEGER NOT NULL,
  `link_type` ENUM('blocks','is_blocked_by','relates_to','duplicates','is_duplicated_by','causes','is_caused_by') NOT NULL,
  `created_by` INTEGER NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `task_links_source_id_target_id_link_type_key`(`source_id`, `target_id`, `link_type`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey task_links -> tasks (source)
ALTER TABLE `task_links` ADD CONSTRAINT `task_links_source_id_fkey`
  FOREIGN KEY (`source_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey task_links -> tasks (target)
ALTER TABLE `task_links` ADD CONSTRAINT `task_links_target_id_fkey`
  FOREIGN KEY (`target_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey task_links -> users
ALTER TABLE `task_links` ADD CONSTRAINT `task_links_created_by_fkey`
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
