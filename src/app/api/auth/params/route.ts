import { NextResponse } from "next/server";
import { getSingleUser } from "@/lib/auth";

/**
 * Public bootstrap parameters needed *before* authentication: whether the
 * single user exists, and the public KDF salts. Salts are not secrets — they
 * only need to be unique per account.
 */
export async function GET() {
  const user = await getSingleUser();

  if (!user) {
    return NextResponse.json({ configured: false });
  }

  return NextResponse.json({
    configured: true,
    saltAuth: user.saltAuth,
    saltEnc: user.saltEnc,
    kdf: user.kdf ?? "argon2id",
    cryptoVersion: user.cryptoVersion,
  });
}
