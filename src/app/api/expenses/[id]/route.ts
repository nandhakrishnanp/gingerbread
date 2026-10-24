import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { deleteExpense, updateExpense } from "@/lib/expenses-service";
import { updateExpenseSchema } from "@/lib/validation";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, ctx: RouteParams) {
  const auth = await requireUserId();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const parsed = updateExpenseSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const result = await updateExpense(auth.userId, id, parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 404 });
  }

  return NextResponse.json({ expense: result.expense });
}

export async function DELETE(_request: Request, ctx: RouteParams) {
  const auth = await requireUserId();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const deleted = await deleteExpense(auth.userId, id);
  if (!deleted) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
