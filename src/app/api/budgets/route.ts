import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { listBudgets, upsertBudget } from "@/lib/budgets-service";
import { upsertBudgetSchema } from "@/lib/validation";

export async function GET() {
  const auth = await requireUserId();
  if (!auth.ok) return auth.response;
  return NextResponse.json({ budgets: await listBudgets(auth.userId) });
}

export async function PUT(request: Request) {
  const auth = await requireUserId();
  if (!auth.ok) return auth.response;

  const parsed = upsertBudgetSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const budget = await upsertBudget(auth.userId, parsed.data);
  return NextResponse.json({ budget });
}
