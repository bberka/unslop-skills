import { PrismaClient } from "@prisma/client";

export interface UserCardState {
  loading: boolean;
  error?: string;
  data?: { name: string };
}

const db = new PrismaClient();

export async function userCard(req: { body: unknown }) {
  const input = req.body as UserCardState;
  return db.user.findFirst({ where: { name: input.data?.name } });
}
