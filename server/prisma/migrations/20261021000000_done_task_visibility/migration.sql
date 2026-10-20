-- AlterTable: per-project rule for hiding done tasks from the board
ALTER TABLE `projects`
    ADD COLUMN `done_visibility` ENUM('manual', 'immediate', 'delay', 'sprint_end') NOT NULL DEFAULT 'manual',
    ADD COLUMN `done_visibility_hours` INTEGER NOT NULL DEFAULT 168;

-- AlterTable: completion and manual archive timestamps
ALTER TABLE `tasks`
    ADD COLUMN `completed_at` DATETIME(3) NULL,
    ADD COLUMN `archived_at` DATETIME(3) NULL;

-- Backfill completed_at for done tasks: last move to "termine" in the activity log, else last update
UPDATE `tasks` t
SET t.`completed_at` = COALESCE(
    (SELECT MAX(a.`created_at`) FROM `activity_log` a
     WHERE a.`entity_type` = 'task' AND a.`entity_id` = t.`id`
       AND a.`action` = 'status_changed'
       AND JSON_VALUE(a.`new_value`, '$.status') = 'termine'),
    t.`updated_at`)
WHERE t.`status` = 'terminé';
