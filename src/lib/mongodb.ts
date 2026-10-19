import { MongoClient, type Db } from "mongodb";

const DB_NAME = process.env.MONGODB_DB ?? "gingerbread";

declare global {
  // Reused across hot reloads in dev and across invocations on the same instance.
  var _gingerbreadMongo: Promise<MongoClient> | undefined;
}

function createClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URL;
  if (!uri) {
    throw new Error(
      "MONGODB_URL is not set. Copy .env.example to .env and fill it in.",
    );
  }
  return new MongoClient(uri, { serverSelectionTimeoutMS: 5000 }).connect();
}

function getClientPromise(): Promise<MongoClient> {
  global._gingerbreadMongo ??= createClientPromise();
  return global._gingerbreadMongo;
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise();
  return client.db(DB_NAME);
}

/** Ping the database. Used by the health/status endpoint. */
export async function pingDb(): Promise<boolean> {
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    return true;
  } catch (err) {
    console.error("[mongodb] ping failed:", err);
    return false;
  }
}
