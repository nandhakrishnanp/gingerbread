import { NextResponse } from "next/server";
import { getSingleUser, verifyAuthKey } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { loginSchema } from "@/lib/validation";

/** Verify the client-derived auth key and start a session. */
export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const user = await getSingleUser();
  if (!user) {
    return NextResponse.json({ error: "Not configured" }, { status: 409 });
  }

  if (!verifyAuthKey(parsed.data.authKey, user.authVerifier)) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  await createSession(user._id);

  return NextResponse.json({ userId: user._id });
}
