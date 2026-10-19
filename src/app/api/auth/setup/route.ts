import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { hashAuthKey } from "@/lib/auth";
import { ensureIndexes, users } from "@/lib/collections";
import { createSession } from "@/lib/session";
import { setupSchema } from "@/lib/validation";

/**
 * One-time account creation. Only succeeds while the database has no users, so
 * the app stays single-user and first-run only.
 */
export async function POST(request: Request) {
  const parsed = setupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const collection = await users();
  if ((await collection.estimatedDocumentCount()) > 0) {
    return NextResponse.json(
      { error: "Account already exists" },
      { status: 409 },
    );
  }

  await ensureIndexes();

  const userId = randomUUID();
  const {
    saltAuth,
    saltEnc,
    authKey,
    kdf,
    recoveryWrappedMasterKey,
    recoveryProof,
    cryptoVersion,
  } = parsed.data;

  await collection.insertOne({
    _id: userId,
    saltAuth,
    saltEnc,
    authVerifier: hashAuthKey(authKey),
    kdf,
    cryptoVersion,
    recoveryWrappedMasterKey,
    recoveryAuthVerifier: recoveryProof
      ? hashAuthKey(recoveryProof)
      : undefined,
    createdAt: new Date(),
  });

  await createSession(userId);

  return NextResponse.json({ userId }, { status: 201 });
}
