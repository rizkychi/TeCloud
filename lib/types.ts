export type StoredFile = {
  id: string;
  ownerId: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  telegramFileId: string;
  telegramUniqueId?: string;
  messageId: number;
  uploadedAt: string;
  updatedAt: string;
  version: number;
  shareMode: ShareMode;
  shareToken?: string;
  downloadCount: number;
  folderPath: string;
  isFavorite: boolean;
  tags: string[];
  deletedAt?: string;
  deleteExpiresAt?: string;
  shareExpiresAt?: string;
  shareDownloadLimit?: number;
  shareDownloadCount: number;
};

export type ShareMode = "private" | "public" | "password";

export type UserRole = "admin" | "user";

export type UserStatus = "pending" | "active" | "suspended";

export type AppUser = {
  id: string;
  name: string;
  username: string;
  telegramChatId: string;
  role: UserRole;
  status: UserStatus;
  quotaBytes: number;
  usedBytes: number;
  createdAt: string;
  updatedAt: string;
  verifiedAt?: string;
};

export type TelegramConfig = {
  botToken: string;
  chatId: string;
};

export type SessionUser = Pick<
  AppUser,
  | "id"
  | "name"
  | "username"
  | "telegramChatId"
  | "role"
  | "status"
  | "quotaBytes"
  | "usedBytes"
>;
