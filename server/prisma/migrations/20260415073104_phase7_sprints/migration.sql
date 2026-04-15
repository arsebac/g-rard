/*
  Warnings:

  - A unique constraint covering the columns `[key]` on the table `projects` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX `tasks_fulltext` ON `tasks`;

-- AlterTable
ALTER TABLE `projects` ADD COLUMN `is_public` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `key` VARCHAR(5) NULL;

-- AlterTable
ALTER TABLE `tasks` ADD COLUMN `end_date` DATE NULL,
    ADD COLUMN `number` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `sprint_id` INTEGER NULL,
    ADD COLUMN `start_date` DATE NULL;

-- CreateTable
CREATE TABLE `project_members` (
    `project_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `role` ENUM('admin', 'member') NOT NULL DEFAULT 'member',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`project_id`, `user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sprints` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `project_id` INTEGER NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `goal` TEXT NULL,
    `start_date` DATETIME(3) NULL,
    `end_date` DATETIME(3) NULL,
    `status` ENUM('futur', 'actif', 'terminé') NOT NULL DEFAULT 'futur',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `projects_key_key` ON `projects`(`key`);

-- AddForeignKey
ALTER TABLE `project_members` ADD CONSTRAINT `project_members_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_members` ADD CONSTRAINT `project_members_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_sprint_id_fkey` FOREIGN KEY (`sprint_id`) REFERENCES `sprints`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sprints` ADD CONSTRAINT `sprints_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RedefineIndex
CREATE UNIQUE INDEX `workflow_transitions_project_id_from_status_to_status_key` ON `workflow_transitions`(`project_id`, `from_status`, `to_status`);
DROP INDEX `workflow_transitions_project_id_from_to_key` ON `workflow_transitions`;
