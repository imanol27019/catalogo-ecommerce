import fs from 'node:fs';
import path from 'node:path';
import dns from 'node:dns';
import express from 'express';
import cors from 'cors';
import { connectDb } from './db';
import { requireAdmin, requireStaff, roleOf, sellerNameOf } from './auth';
import { DEFAULT_LOW_STOCK_THRESHOLD, normalizeCatalogStock } from './stock';
import { OrderValidationError, type CatalogProduct } from './orders';
import { ClientValidationError } from './clients';
import { SalesConfigValidationError } from './salesConfig';
import { registerSalesRoutes } from './salesRoutes';
import { asyncRoute, HttpError } from './http';
import { ALLOWED_IMAGE_TYPES, ImageValidationError, MAX_IMAGE_BYTES, storeImage } from './images';

// Muchos entornos de contenedores en la nube (Render incluido) resuelven DNS pero no tienen
// salida IPv6 funcional. Node prioriza IPv6 por defecto, lo que puede romper el handshake TLS
// contra MongoDB Atlas a mitad de camino (funciona en local, falla solo en la nube). Forzamos
// IPv4 primero para evitar esa ruta rota.
dns.setDefaultResultOrder('ipv4first');

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
  const ordersCollection = db.collection('orders');
  const imagesCollection = db.collection('images');
  const suppliersCollection = db.collection('suppliers');
  const clientsCollection = db.collection('clients');
  const salesConfigCollection = db.collection('salesConfig');

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

  async function getLowStockThreshold(): Promise<number> {
    const doc = await settingsCollection.findOne({ _id: 'settings' as never });
    const value = doc?.lowStockThreshold;
    return typeof value === 'number' && value >= 0 ? value : DEFAULT_LOW_STOCK_THRESHOLD;
  }

  async function getCatalogProducts(): Promise<CatalogProduct[]> {
    const doc = await catalogCollection.findOne({ _id: 'catalog' as never });
    return (doc?.products ?? []) as CatalogProduct[];
  }

  async function getCategoryLabels(): Promise<Record<string, string>> {
    const doc = await settingsCollection.findOne({ _id: 'settings' as never });
    const labels = doc?.categoryLabels;
    return labels && typeof labels === 'object' ? (labels as Record<string, string>) : {};
  }

  const app = express();
  app.use(cors({ origin: CORS_ORIGIN }));
  app.use(express.json({ limit: '5mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  /**
   * Verifica la contraseña sin modificar nada: lo usa el login del panel. Devuelve el rol para que
   * el panel muestre solo las secciones que corresponden (la dueña ve todo; las vendedoras, ventas
   * y clientas).
   */
  app.get('/api/admin/verify', requireStaff, (_req, res) => {
    res.json({ ok: true, role: roleOf(res), sellerName: sellerNameOf(res) });
  });

  // --- Imágenes de producto -------------------------------------------------

  /**
   * Recibe el archivo crudo (sin multipart ni dependencias nuevas) y lo guarda tal cual, para no
   * degradar la calidad de la foto.
   */
  app.post(
    '/api/images',
    requireAdmin,
    express.raw({ type: ALLOWED_IMAGE_TYPES, limit: MAX_IMAGE_BYTES }),
    asyncRoute(async (req, res) => {
      try {
        const saved = await storeImage(imagesCollection, req.body as Buffer, req.header('content-type') ?? '');
        res.status(201).json(saved);
      } catch (err) {
        if (err instanceof ImageValidationError) {
          res.status(400).json({ error: err.message });
          return;
        }
        throw err;
      }
    }),
  );

  app.get(
    '/api/images/:id',
    asyncRoute(async (req, res) => {
      const doc = await imagesCollection.findOne({ _id: req.params.id as never });
      if (!doc) {
        res.status(404).json({ error: 'Imagen no encontrada.' });
        return;
      }
      // Las fotos son inmutables (cada subida crea un id nuevo), así que se cachean fuerte.
      res.setHeader('Content-Type', String(doc.contentType));
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.send(Buffer.from((doc.data as { buffer: ArrayBufferLike }).buffer));
    }),
  );

  // --- Catálogo -------------------------------------------------------------

  /**
   * El estado de cada variante (en stock / poco / sin stock) se deriva de las unidades al leer:
   * las ventas mueven solo las unidades, con operaciones atómicas, y así el estado nunca queda
   * desfasado aunque se registren varias ventas a la vez.
   */
  app.get(
    '/api/products',
    asyncRoute(async (_req, res) => {
      const doc = await catalogCollection.findOne({ _id: 'catalog' as never });
      const { _id, ...rest } = doc ?? { updatedAt: new Date().toISOString(), products: [] };
      const threshold = await getLowStockThreshold();
      res.json({ ...rest, products: normalizeCatalogStock((rest.products ?? []) as never[], threshold) });
    }),
  );

  app.put(
    '/api/products',
    requireAdmin,
    asyncRoute(async (req, res) => {
      const { products } = req.body as { products?: unknown[] };
      if (!Array.isArray(products)) {
        res.status(400).json({ error: 'El catálogo enviado no tiene el formato esperado.' });
        return;
      }
      const threshold = await getLowStockThreshold();
      // Se normaliza al guardar para que el estado siempre coincida con las unidades.
      const normalized = normalizeCatalogStock(products as never[], threshold);
      const updatedAt = new Date().toISOString();
      await catalogCollection.replaceOne(
        { _id: 'catalog' as never },
        { _id: 'catalog' as never, updatedAt, products: normalized },
        { upsert: true },
      );
      res.json({ updatedAt, products: normalized });
    }),
  );

  app.get(
    '/api/settings',
    asyncRoute(async (_req, res) => {
      const doc = await settingsCollection.findOne({ _id: 'settings' as never });
      const { _id, ...rest } = doc ?? {};
      res.json(rest);
    }),
  );

  app.put(
    '/api/settings',
    requireAdmin,
    asyncRoute(async (req, res) => {
      const settings = req.body as Record<string, unknown>;
      if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
        res.status(400).json({ error: 'La configuración enviada no tiene el formato esperado.' });
        return;
      }
      // replaceOne (no $set): un PUT reemplaza el documento entero, así no quedan campos viejos
      // pegados si en algún momento cambia la forma de `settings`.
      await settingsCollection.replaceOne(
        { _id: 'settings' as never },
        { _id: 'settings' as never, ...settings },
        { upsert: true },
      );
      res.json(settings);
    }),
  );

  // --- Proveedores ----------------------------------------------------------

  /**
   * Datos internos del negocio: ambas rutas piden contraseña. El catálogo público solo lleva el
   * `supplierId` en el producto, que por sí solo no revela ningún dato de contacto.
   */
  app.get(
    '/api/suppliers',
    requireAdmin,
    asyncRoute(async (_req, res) => {
      const doc = await suppliersCollection.findOne({ _id: 'suppliers' as never });
      const { _id, ...rest } = doc ?? { updatedAt: new Date().toISOString(), suppliers: [] };
      res.json(rest);
    }),
  );

  app.put(
    '/api/suppliers',
    requireAdmin,
    asyncRoute(async (req, res) => {
      const { suppliers } = req.body as { suppliers?: unknown[] };
      if (!Array.isArray(suppliers)) {
        res.status(400).json({ error: 'La lista de proveedores no tiene el formato esperado.' });
        return;
      }
      const updatedAt = new Date().toISOString();
      await suppliersCollection.replaceOne(
        { _id: 'suppliers' as never },
        { _id: 'suppliers' as never, updatedAt, suppliers },
        { upsert: true },
      );
      res.json({ updatedAt, suppliers });
    }),
  );

  await registerSalesRoutes(app, {
    ordersCollection,
    clientsCollection,
    salesConfigCollection,
    catalogCollection,
    getCatalogProducts,
    getCategoryLabels,
  });

  app.use((req, res) => {
    res.status(404).json({ error: `No existe la ruta ${req.method} ${req.path}.` });
  });

  /**
   * Red de contención: cualquier error que se escape de una ruta (incluido un body demasiado
   * grande, que Express marca con `type: entity.too.large`) sale como JSON y no como la página
   * HTML por defecto, que el panel no sabría interpretar.
   */
  app.use(
    (
      err: Error & { type?: string; status?: number },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (err?.type === 'entity.too.large') {
        res.status(413).json({ error: 'El archivo es demasiado grande.' });
        return;
      }
      if (err instanceof HttpError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      if (
        err instanceof OrderValidationError ||
        err instanceof ClientValidationError ||
        err instanceof SalesConfigValidationError
      ) {
        res.status(400).json({ error: err.message });
        return;
      }
      console.error('Error no controlado:', err);
      res.status(500).json({ error: 'Error interno del servidor. Volvé a intentar en un momento.' });
    },
  );

  app.listen(PORT, () => {
    console.log(`API del catálogo escuchando en el puerto ${PORT}`);
  });
}

main().catch((err) => {
  console.error('No se pudo iniciar el servidor:', err);
  process.exit(1);
});
