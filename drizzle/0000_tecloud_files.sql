CREATE TABLE `files` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `original_name` text NOT NULL,
  `mime_type` text NOT NULL,
  `size` integer NOT NULL,
  `telegram_file_id` text NOT NULL,
  `telegram_unique_id` text,
  `message_id` integer NOT NULL,
  `uploaded_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `version` integer NOT NULL
);

CREATE INDEX `files_updated_at_idx` ON `files` (`updated_at`);
