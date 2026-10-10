/**
 * Ключ localStorage, принадлежащий одному пользователю: «ai-auto:car:v1:<userId>».
 * Каждый аккаунт читает и пишет только свои ключи.
 */
export const userKey = (baseKey: string, userId: string) => `${baseKey}:${userId}`
