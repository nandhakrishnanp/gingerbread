import { NextResponse } from "next/server";
import { users } from "@/lib/collections";
import { pingDb } from "@/lib/mongodb";
import { readSession } from "@/lib/session";

/**
 * Reports the app's bootstrap state:
 * - `dbOk`         — can we reach MongoDB?
 * - `configured`   — has the single user account been created yet?
 * - `authenticated`— is there a valid session cookie on this request?
 */
export async function GET() {
  const dbOk = await pingDb();

  let configured = false;
  if (dbOk) {
    configured = (await (await users()).estimatedDocumentCount()) > 0;
  }

  const session = await readSession();

  return NextResponse.json({
    app: "gingerbread",
    dbOk,
    configured,
    authenticated: session !== null,
  });
}
