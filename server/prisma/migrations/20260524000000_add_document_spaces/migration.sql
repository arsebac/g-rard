-- CreateTable: document_spaces
CREATE TABLE `document_spaces` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `icon` VARCHAR(50) NOT NULL DEFAULT 'folder',
    `color` VARCHAR(7) NOT NULL DEFAULT '#6366f1',
    `description` TEXT NULL,
    `parent_id` INTEGER NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: documents
CREATE TABLE `documents` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `space_id` INTEGER NOT NULL,
    `title` VARCHAR(500) NOT NULL,
    `description` TEXT NULL,
    `uploaded_by` INTEGER NOT NULL,
    `filename` VARCHAR(255) NOT NULL,
    `stored_path` VARCHAR(500) NOT NULL,
    `mime_type` VARCHAR(100) NOT NULL,
    `size_bytes` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey: document_spaces.parent_id -> document_spaces.id
ALTER TABLE `document_spaces` ADD CONSTRAINT `document_spaces_parent_id_fkey`
    FOREIGN KEY (`parent_id`) REFERENCES `document_spaces`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: documents.space_id -> document_spaces.id
ALTER TABLE `documents` ADD CONSTRAINT `documents_space_id_fkey`
    FOREIGN KEY (`space_id`) REFERENCES `document_spaces`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: documents.uploaded_by -> users.id
ALTER TABLE `documents` ADD CONSTRAINT `documents_uploaded_by_fkey`
    FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
