// lib/mongodb.ts — MongoDB singleton client for Next.js serverless functions
// Lazy initialization: connection is created only at request time, not at module load.
// This prevents build-time errors when MONGODB_URI is not set locally.

import { MongoClient, MongoClientOptions } from "mongodb";

const options: MongoClientOptions = {};
const dbName = () => process.env.MONGODB_DB_NAME || "interviewsignal";

declare global {
  // Allow re-use across hot module reloads in development
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function getClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Missing environment variable: "MONGODB_URI"');
  }

  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      const client = new MongoClient(uri, options);
      global._mongoClientPromise = client.connect();
    }
    return global._mongoClientPromise!;
  }

  // In production, create a new client per module instance (serverless-safe)
  const client = new MongoClient(uri, options);
  return client.connect();
}

export async function getDb() {
  const client = await getClientPromise();
  return client.db(dbName());
}

export async function getQuestionsCollection() {
  const db = await getDb();
  return db.collection("questions");
}
