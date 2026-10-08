import argon2 from 'argon2';
import { passwordSchema } from '../../shared/auth.js';
export function hashPassword(password: string) {
  return argon2.hash(passwordSchema.parse(password), { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
}
export async function verifyPassword(hash: string, password: string) {
  try { return await argon2.verify(hash, password); } catch { return false; }
}
// Misma función costosa para email inexistente; nunca hash rápido para comparar passwords.
let dummy: Promise<string> | undefined;
export function dummyPasswordHash() { return dummy ??= hashPassword('not-an-account-password'); }
