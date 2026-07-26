import { z } from "zod";

const usernameSchema = z
  .string()
  .min(3)
  .max(32)
  .regex(/^[a-zA-Z0-9_]+$/, "username must be alphanumeric/underscore");

export const registerSchema = z.object({
  username: usernameSchema,
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(80),
  locale: z.enum(["en", "id"]).optional(),
});

export const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1).max(128),
});

export const forgotPasswordSchema = z.object({
  username: usernameSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10).max(200),
  password: z.string().min(8).max(128),
});

export const verifyAccountSchema = z.object({
  token: z.string().min(10).max(200),
});

export const resendVerificationSchema = z.object({
  username: usernameSchema,
});

export const profileUpdateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  locale: z.enum(["en", "id"]).optional(),
  currentPassword: z.string().min(1).max(128).optional(),
  newPassword: z.string().min(8).max(128).optional(),
});

export const folderCreateSchema = z.object({
  name: z.string().min(1).max(255),
  parentId: z.string().cuid().nullable().optional(),
});

export const folderUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  parentId: z.string().cuid().nullable().optional(),
  starred: z.boolean().optional(),
});

export const fileUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  folderId: z.string().cuid().nullable().optional(),
  starred: z.boolean().optional(),
});

export const shareSchema = z.object({
  visibility: z.enum(["private", "public", "password"]),
  password: z
    .string()
    .min(4, "Share password must be at least 4 characters")
    .max(128)
    .optional(),
});

export const unlockSchema = z.object({
  password: z.string().min(1).max(128),
});

export const localeSchema = z.object({
  locale: z.enum(["en", "id"]),
});

const themeEnum = z.enum(["light", "dark", "ocean", "forest", "sunset", "campus"]);

export const preferencesSchema = z.object({
  theme: themeEnum.optional(),
  viewMode: z.enum(["list", "grid", "compact"]).optional(),
  locale: z.enum(["en", "id"]).optional(),
});

export const adminUserUpdateSchema = z.object({
  // null = use system default, 0 = unlimited, >0 = custom GB
  quotaGb: z.union([z.number().positive(), z.literal(0), z.null()]).optional(),
  role: z.enum(["user", "admin"]).optional(),
  name: z.string().min(1).max(80).optional(),
  disabled: z.boolean().optional(),
  password: z.string().min(8).max(128).optional(),
});

export const adminSettingsSchema = z.object({
  // 0 = unlimited default for users without custom quota
  defaultQuotaGb: z.union([z.number().positive(), z.literal(0)]).optional(),
  defaultTheme: themeEnum.optional(),
  allowedThemes: z.array(themeEnum).optional(),
});

export const zipSchema = z.object({
  fileIds: z.array(z.string().cuid()).default([]),
  folderIds: z.array(z.string().cuid()).default([]),
  name: z.string().min(1).max(200).optional(),
  folderId: z.string().cuid().nullable().optional(),
});

export const unzipSchema = z.object({
  fileId: z.string().cuid(),
  folderId: z.string().cuid().nullable().optional(),
});

export const starSchema = z.object({
  kind: z.enum(["file", "folder"]),
  id: z.string().cuid(),
  starred: z.boolean(),
});
