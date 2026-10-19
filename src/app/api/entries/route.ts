import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { createEntry, listEntries } from "@/lib/entries-service";
import { createEntrySchema } from "@/lib/validation";

export async function GET() {
  const auth = await requireUserId();
  if (!auth.ok) return auth.response;
  return NextResponse.json({ entries: await listEntries(auth.userId) });
}

export async function POST(request: Request) {
  const auth = await requireUserId();
  if (!auth.ok) return auth.response;

  const parsed = createEntrySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const entry = await createEntry(auth.userId, parsed.data);
  return NextResponse.json({ entry }, { status: 201 });
}
