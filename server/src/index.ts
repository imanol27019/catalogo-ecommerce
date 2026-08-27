import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { connectDb } from './db';
import { requireAdmin } from './auth';

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*';

function readSeedJson<T>(fileName: string): T {
  const filePath = path.join(__dirname, '..', 'src', 'seed-data', fileName);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

async function main() {
  const db = await connectDb();
  const catalogCollection = db.collection('catalog');
  const settingsCollection = db.collection('settings');

  // Primer arranque: si la base está vacía, la poblamos con los datos de muestra del proyecto.
  const existingCatalog = await catalogCollection.findOne({ _id: 'catalog' as never });
  if (!existingCatalog) {
    const seed = readSeedJson<{ updatedAt: string; products: unknown[] }>('products.json');
    await catalogCollection.insertOne({ _id: 'catalog' as never, ...seed });
    console.log(`Catálogo sembrado con ${seed.products.length} productos.`);
  }

  const existingSettings = await settingsCollection.findOne({ _id: 'settings' as never });
  if (!existingSettings) {
    const seed = readSeedJson<Record<string, unknown>>('settings.json');
    await settingsCollection.insertOne({ _id: 'settings' as never, ...seed });
    console.log('Configuración sembrada con los valores de muestra.');
  }

  const app = express();
  app.use(cors({ origin: CORS_ORIGIN }));
  app.use(express.json({ limit: '5mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/products', async (_req, res) => {
    const doc = await catalogCollection.findOne({ _id: 'catalog' as never });
    const { _id, ...rest } = doc ?? { updatedAt: new Date().toISOString(), products: [] };
    res.json(rest);
  });

  app.put('/api/products', requireAdmin, async (req, res) => {
    const { products } = req.body as { products?: unknown[] };
    if (!Array.isArray(products)) {
      res.status(400).json({ error: '"products" debe ser un array.' });
      return;
    }
    const updatedAt = new Date().toISOString();
    await catalogCollection.replaceOne(
      { _id: 'catalog' as never },
      { _id: 'catalog' as never, updatedAt, products },
      { upsert: true },
    );
    res.json({ updatedAt, products });
  });

  app.get('/api/settings', async (_req, res) => {
    const doc = await settingsCollection.findOne({ _id: 'settings' as never });
    const { _id, ...rest } = doc ?? {};
    res.json(rest);
  });

  app.put('/api/settings', requireAdmin, async (req, res) => {
    const settings = req.body as Record<string, unknown>;
    // replaceOne (no $set): un PUT reemplaza el documento entero, así no quedan campos viejos
    // pegados si en algún momento cambia la forma de `settings`.
    await settingsCollection.replaceOne({ _id: 'settings' as never }, { _id: 'settings' as never, ...settings }, { upsert: true });
    res.json(settings);
  });

  app.listen(PORT, () => {
    console.log(`API del catálogo escuchando en el puerto ${PORT}`);
  });
}

main().catch((err) => {
  console.error('No se pudo iniciar el servidor:', err);
  process.exit(1);
});
