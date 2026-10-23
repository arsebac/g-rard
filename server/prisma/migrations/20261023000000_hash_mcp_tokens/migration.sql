-- MCP tokens are stored as SHA-256 hashes only; existing tokens are hashed in place and keep working.
ALTER TABLE `users` ADD COLUMN `mcp_token_hash` CHAR(64) NULL;

UPDATE `users` SET `mcp_token_hash` = SHA2(`mcp_token`, 256) WHERE `mcp_token` IS NOT NULL;

CREATE UNIQUE INDEX `users_mcp_token_hash_key` ON `users`(`mcp_token_hash`);

DROP INDEX `users_mcp_token_key` ON `users`;

ALTER TABLE `users` DROP COLUMN `mcp_token`;
