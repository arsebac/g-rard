-- CreateTable: document_space_members
CREATE TABLE `document_space_members` (
    `space_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `role` ENUM('owner', 'editor', 'viewer') NOT NULL DEFAULT 'viewer',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`space_id`, `user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `document_space_members` ADD CONSTRAINT `document_space_members_space_id_fkey`
    FOREIGN KEY (`space_id`) REFERENCES `document_spaces`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `document_space_members` ADD CONSTRAINT `document_space_members_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
