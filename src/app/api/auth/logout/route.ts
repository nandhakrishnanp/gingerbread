import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/session";

/** Clear the session cookie. */
export async function POST() {
  await deleteSession();
  return NextResponse.json({ ok: true });
}
