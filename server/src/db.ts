import { MongoClient, type Db } from 'mongodb';

let dbInstance: Db | null = null;

export async function connectDb(): Promise<Db> {
  if (dbInstance) return dbInstance;

  const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017';
  const dbName = process.env.MONGODB_DB ?? 'catalogo';

  const client = new MongoClient(uri);
  await client.connect();
  dbInstance = client.db(dbName);
  console.log(`Conectado a MongoDB (${dbName})`);
  return dbInstance;
}
