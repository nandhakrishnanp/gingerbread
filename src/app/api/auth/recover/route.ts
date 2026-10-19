import { NextResponse } from "next/server";
import { getSingleUser, verifyAuthKey } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { recoverSchema } from "@/lib/validation";

/**
 * Start a session using the one-way proof derived from the recovery key. The
 * server never receives the recovery key itself, so it still cannot derive the
 * master key; the client unwraps it locally with the blob we return here.
 */
export async function POST(request: Request) {
  const parsed = recoverSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const user = await getSingleUser();
  if (!user?.recoveryAuthVerifier || !user.recoveryWrappedMasterKey) {
    return NextResponse.json(
      { error: "No recovery key configured" },
      { status: 409 },
    );
  }

  if (!verifyAuthKey(parsed.data.proof, user.recoveryAuthVerifier)) {
    return NextResponse.json({ error: "Invalid recovery key" }, { status: 401 });
  }

  await createSession(user._id);

  return NextResponse.json({
    recoveryWrappedMasterKey: user.recoveryWrappedMasterKey,
  });
}
