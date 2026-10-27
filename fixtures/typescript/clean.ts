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

// `animate` defaults to on, so only an explicit false disables it.
export function shouldAnimate(opts?: { animate?: boolean }): boolean {
  return opts?.animate !== false;
}

export function regionOf(order: { customer?: { address?: { region?: string } } }) {
  // TODO(berg): fall back to the billing address once the API exposes it.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- the API omits address for guests
  return order.customer?.address?.region ?? "unknown";
}

// Probes and parse guards: the catch's default is the handling.
export function isTracked(path: string): boolean {
  try {
    execFileSync("git", ["ls-files", "--error-unmatch", "--", path], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function readPrefs(key: string): { theme?: string } | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

export function onMessage(type: string, data: unknown): void {
  try {
    handlers[type](data);
    metrics.count(type);
  } catch (error) {
    console.warn(`dropped a bad "${type}" message`, error);
  }
}

export const SILENCER = `<script>try{a();b()}catch(e){}</script>`;
