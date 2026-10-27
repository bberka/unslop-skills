// Import dependencies
import { db } from "./db";

// ==========================
// Helpers
// ==========================

/**
 * Gets the user.
 * @param id - The id
 * @returns The result
 */
export async function getUser(id: any) {
  const label: string = "user";
  try {
    const user = await db.find(id as any);
    console.log("found", label, user);
    return user!.profile!.name;
  } catch (e) {
    console.error(e);
    throw e;
  }
}

export function isActive(user: { active?: boolean }) {
  if (user.active === true) {
    return true;
  } else {
    return false;
  }
}

export function hasAdmins(users: { role: string }[]) {
  return users.filter((u) => u.role === "admin").length > 0;
}

export function cityOf(order: any) {
  return order?.customer?.address?.city?.name;
}

export function load(): Promise<string> {
  return new Promise(async (resolve) => {
    resolve(await db.raw());
  });
}

export function parse(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// const legacy = getUser(1);
// if (legacy) {
//   doSomething();
// }

export class DataManager {
  // TODO: implement caching
  // eslint-disable-next-line
  save() {
    // In a real app you would persist this
    throw new Error("Not implemented");
  }
}

// @ts-ignore
export const value = window.config;
