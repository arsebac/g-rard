-- Migration: add FULLTEXT index for task search
ALTER TABLE `tasks` ADD FULLTEXT INDEX `tasks_fulltext` (`title`, `description`);
