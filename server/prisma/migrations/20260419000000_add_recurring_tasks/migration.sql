-- AlterTable
ALTER TABLE `tasks` ADD COLUMN `recurring_task_id` INTEGER NULL;

-- CreateTable
CREATE TABLE `recurring_tasks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `project_id` INTEGER NOT NULL,
    `title` VARCHAR(500) NOT NULL,
    `description` TEXT NULL,
    `priority` ENUM('basse', 'normale', 'haute', 'urgente') NOT NULL DEFAULT 'normale',
    `assignee_id` INTEGER NULL,
    `type_id` INTEGER NULL,
    `recurrence_type` ENUM('EVERY_N_WEEKS', 'MONTHLY_BEFORE_END', 'CUSTOM_DATES') NOT NULL,
    `interval_weeks` INTEGER NULL,
    `days_before_end_of_month` INTEGER NULL,
    `custom_dates` JSON NULL,
    `created_by` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `recurring_tasks` ADD CONSTRAINT `recurring_tasks_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recurring_tasks` ADD CONSTRAINT `recurring_tasks_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recurring_tasks` ADD CONSTRAINT `recurring_tasks_assignee_id_fkey` FOREIGN KEY (`assignee_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_recurring_task_id_fkey` FOREIGN KEY (`recurring_task_id`) REFERENCES `recurring_tasks`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
