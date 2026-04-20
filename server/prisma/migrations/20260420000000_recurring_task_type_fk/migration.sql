-- AddForeignKey
ALTER TABLE `recurring_tasks` ADD CONSTRAINT `recurring_tasks_type_id_fkey` FOREIGN KEY (`type_id`) REFERENCES `ticket_types`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
