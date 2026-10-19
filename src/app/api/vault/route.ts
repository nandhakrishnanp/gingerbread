import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { createVaultRecord, listVaultRecords } from "@/lib/vault-service";
import { createVaultSchema, vaultKindSchema } from "@/lib/validation";

export async function GET(request: Request) {
  const auth = await requireUserId();
  if (!auth.ok) return auth.response;

  const requested = new URL(request.url).searchParams.get("kind");
  const kind = requested ? vaultKindSchema.safeParse(requested) : null;
  if (requested && !kind?.success) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }

  return NextResponse.json({
    records: await listVaultRecords(auth.userId, kind?.data),
  });
}

export async function POST(request: Request) {
  const auth = await requireUserId();
  if (!auth.ok) return auth.response;

  const parsed = createVaultSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const record = await createVaultRecord(auth.userId, parsed.data);
  return NextResponse.json({ record }, { status: 201 });
}
