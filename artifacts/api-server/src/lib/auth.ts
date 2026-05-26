import crypto from "crypto";

export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "gudang_salt_2024").digest("hex");
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

export function generateToken(userId: number, username: string): string {
  const payload = `${userId}:${username}:${Date.now()}`;
  return Buffer.from(payload).toString("base64url");
}

export function parseToken(token: string): { userId: number; username: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(":");
    if (parts.length < 2) return null;
    const userId = parseInt(parts[0], 10);
    const username = parts[1];
    if (isNaN(userId)) return null;
    return { userId, username };
  } catch {
    return null;
  }
}
