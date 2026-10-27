import { db } from "./db";

type Role = "admin" | "member";

export interface User {
  id: string;
  role: Role;
  active: boolean;
}

export async function getUser(id: string): Promise<User | undefined> {
  return db.find(id);
}

export function hasAdmins(users: User[]): boolean {
  return users.some((u) => u.role === "admin");
}

// Tokens issued before the 2024 key rotation carry no `kid`; accept them until they expire.
export function acceptsLegacyToken(token: { kid?: string; exp: number }, now: number): boolean {
  return token.kid === undefined && token.exp > now;
}

export async function loadAll(ids: string[]): Promise<User[]> {
  const users = await Promise.all(ids.map((id) => db.find(id)));
  return users.filter((u): u is User => u !== undefined);
}
