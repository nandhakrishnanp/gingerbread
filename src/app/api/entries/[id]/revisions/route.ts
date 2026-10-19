import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { listRevisions } from "@/lib/entries-service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, ctx: RouteParams) {
  const auth = await requireUserId();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  return NextResponse.json({ revisions: await listRevisions(auth.userId, id) });
}
