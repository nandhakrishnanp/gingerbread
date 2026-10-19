import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { deleteEntry, updateEntry } from "@/lib/entries-service";
import { updateEntrySchema } from "@/lib/validation";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, ctx: RouteParams) {
  const auth = await requireUserId();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const parsed = updateEntrySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const result = await updateEntry(auth.userId, id, parsed.data);
  if (!result.ok) {
    const status = result.reason === "not-found" ? 404 : 409;
    return NextResponse.json({ error: result.reason }, { status });
  }

  return NextResponse.json({ entry: result.entry });
}

export async function DELETE(_request: Request, ctx: RouteParams) {
  const auth = await requireUserId();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const deleted = await deleteEntry(auth.userId, id);
  if (!deleted) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
