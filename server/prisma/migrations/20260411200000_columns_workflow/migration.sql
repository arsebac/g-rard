-- Phase 6 : colonnes personnalisables + workflow

-- CreateTable project_columns
CREATE TABLE `project_columns` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `project_id` INTEGER NOT NULL,
  `status_key` VARCHAR(50) NOT NULL,
  `label` VARCHAR(100) NOT NULL,
  `color` VARCHAR(7) NOT NULL DEFAULT '#94a3b8',
  `position` INTEGER NOT NULL DEFAULT 0,
  `visible` BOOLEAN NOT NULL DEFAULT true,

  UNIQUE INDEX `project_columns_project_id_status_key_key`(`project_id`, `status_key`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `project_columns` ADD CONSTRAINT `project_columns_project_id_fkey`
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable workflow_transitions
CREATE TABLE `workflow_transitions` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `project_id` INTEGER NOT NULL,
  `from_status` VARCHAR(50) NOT NULL,
  `to_status` VARCHAR(50) NOT NULL,

  UNIQUE INDEX `workflow_transitions_project_id_from_to_key`(`project_id`, `from_status`, `to_status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `workflow_transitions` ADD CONSTRAINT `workflow_transitions_project_id_fkey`
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
