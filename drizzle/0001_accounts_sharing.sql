CREATE TABLE IF NOT EXISTS `users` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `username` text NOT NULL UNIQUE,
  `telegram_chat_id` text NOT NULL,
  `password_hash` text NOT NULL,
  `password_salt` text NOT NULL,
  `role` text NOT NULL,
  `status` text NOT NULL,
  `quota_bytes` integer NOT NULL,
  `used_bytes` integer NOT NULL DEFAULT 0,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `verified_at` text
);

CREATE TABLE IF NOT EXISTS `sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `token_hash` text NOT NULL UNIQUE,
  `user_id` text NOT NULL,
  `created_at` text NOT NULL,
  `expires_at` text NOT NULL
);

CREATE TABLE IF NOT EXISTS `auth_codes` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `purpose` text NOT NULL,
  `code_hash` text NOT NULL,
  `created_at` text NOT NULL,
  `expires_at` text NOT NULL,
  `consumed_at` text
);

CREATE TABLE IF NOT EXISTS `activity_events` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text,
  `file_id` text,
  `type` text NOT NULL,
  `bytes` integer NOT NULL DEFAULT 0,
  `metadata` text,
  `created_at` text NOT NULL
);

ALTER TABLE `files` ADD COLUMN `owner_id` text;
ALTER TABLE `files` ADD COLUMN `share_mode` text NOT NULL DEFAULT 'private';
ALTER TABLE `files` ADD COLUMN `share_token` text;
ALTER TABLE `files` ADD COLUMN `share_password_hash` text;
ALTER TABLE `files` ADD COLUMN `share_password_salt` text;
ALTER TABLE `files` ADD COLUMN `download_count` integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS `users_role_idx` ON `users` (`role`);
CREATE INDEX IF NOT EXISTS `files_owner_idx` ON `files` (`owner_id`);
CREATE INDEX IF NOT EXISTS `files_share_token_idx` ON `files` (`share_token`);
CREATE INDEX IF NOT EXISTS `sessions_token_idx` ON `sessions` (`token_hash`);
CREATE INDEX IF NOT EXISTS `activity_created_idx` ON `activity_events` (`created_at`);
