import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import {
  createExpense,
  listExpenses,
  listExpensesPage,
} from "@/lib/expenses-service";
import { createExpenseSchema } from "@/lib/validation";
import { EXPENSE_KINDS } from "@/lib/types";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const auth = await requireUserId();
  if (!auth.ok) return auth.response;

  const params = new URL(request.url).searchParams;
  const from = params.get("from") ?? undefined;
  const to = params.get("to") ?? undefined;
  if ((from && !DATE.test(from)) || (to && !DATE.test(to))) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  const limitParam = params.get("limit");
  if (!limitParam) {
    return NextResponse.json({
      expenses: await listExpenses(auth.userId, { from, to }),
    });
  }

  const limit = Number(limitParam);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return NextResponse.json({ error: "Invalid limit" }, { status: 400 });
  }

  const kindParam = params.get("kind");
  if (
    kindParam &&
    !(EXPENSE_KINDS as readonly string[]).includes(kindParam)
  ) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }

  const result = await listExpensesPage(auth.userId, {
    from,
    to,
    kind: kindParam
      ? (kindParam as (typeof EXPENSE_KINDS)[number])
      : undefined,
    limit,
    cursor: params.get("cursor") ?? undefined,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }

  return NextResponse.json({
    expenses: result.expenses,
    nextCursor: result.nextCursor,
    total: result.total,
  });
}

export async function POST(request: Request) {
  const auth = await requireUserId();
  if (!auth.ok) return auth.response;

  const parsed = createExpenseSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const expense = await createExpense(auth.userId, parsed.data);
  return NextResponse.json({ expense }, { status: 201 });
}
