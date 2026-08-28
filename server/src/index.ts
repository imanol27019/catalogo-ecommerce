import fs from 'node:fs';
import path from 'node:path';
import dns from 'node:dns';
import express from 'express';
import cors from 'cors';
import { connectDb } from './db';
import { requireAdmin } from './auth';
import { DEFAULT_LOW_STOCK_THRESHOLD, normalizeCatalogStock } from './stock';
import { applyStockForOrder, buildOrder, OrderValidationError } from './orders';
import type { Order, OrderStatus } from './orders';
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

type AsyncRoute = (req: express.Request, res: express.Response) => Promise<unknown>;

/**
 * Express 4 no captura promesas rechazadas: sin esto, un error de Mongo dentro de una ruta async
 * deja la petición colgada hasta que expira. Acá se derivan al manejador de errores.
 */
function asyncRoute(handler: AsyncRoute): express.RequestHandler {
  return (req, res, next) => {
    handler(req, res).catch(next);
  };
}

async function main() {
  const db = await connectDb();
  const catalogCollection = db.collection('catalog');
  const settingsCollection = db.collection('settings');
  const ordersCollection = db.collection('orders');
  const imagesCollection = db.collection('images');
  await ordersCollection.createIndex({ createdAt: -1 });

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

  async function getCatalogProducts(): Promise<Record<string, unknown>[]> {
    const doc = await catalogCollection.findOne({ _id: 'catalog' as never });
    return (doc?.products ?? []) as Record<string, unknown>[];
  }

  const app = express();
  app.use(cors({ origin: CORS_ORIGIN }));
  app.use(express.json({ limit: '5mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  /** Verifica la contraseña sin modificar nada: lo usa el login del panel. */
  app.get('/api/admin/verify', requireAdmin, (_req, res) => {
    res.json({ ok: true });
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

  app.get(
    '/api/products',
    asyncRoute(async (_req, res) => {
      const doc = await catalogCollection.findOne({ _id: 'catalog' as never });
      const { _id, ...rest } = doc ?? { updatedAt: new Date().toISOString(), products: [] };
      res.json(rest);
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

  // --- Ventas ---------------------------------------------------------------

  /** Público: lo llama el navegador al finalizar el pedido. Queda pendiente hasta que el negocio confirme. */
  app.post(
    '/api/orders',
    asyncRoute(async (req, res) => {
      try {
        const products = await getCatalogProducts();
        const order = buildOrder(req.body, products as never[], 'whatsapp', 'pending');
        await ordersCollection.insertOne({ _id: order.id as never, ...order });
        res.status(201).json(order);
      } catch (err) {
        if (err instanceof OrderValidationError) {
          res.status(400).json({ error: err.message });
          return;
        }
        throw err;
      }
    }),
  );

  /** Venta cargada a mano desde el panel (mostrador): entra ya confirmada y descuenta stock. */
  app.post(
    '/api/sales',
    requireAdmin,
    asyncRoute(async (req, res) => {
      try {
        const products = await getCatalogProducts();
        const order = buildOrder(req.body, products as never[], 'manual', 'confirmed');
        await ordersCollection.insertOne({ _id: order.id as never, ...order });
        await applyStockForOrder(catalogCollection, order, await getLowStockThreshold());
        res.status(201).json(order);
      } catch (err) {
        if (err instanceof OrderValidationError) {
          res.status(400).json({ error: err.message });
          return;
        }
        throw err;
      }
    }),
  );

  app.get(
    '/api/orders',
    requireAdmin,
    asyncRoute(async (_req, res) => {
      const docs = await ordersCollection.find({}).sort({ createdAt: -1 }).limit(300).toArray();
      res.json(docs.map(({ _id, ...rest }) => rest));
    }),
  );

  /** Confirmar descuenta stock una sola vez; cancelar no lo toca. */
  app.patch(
    '/api/orders/:id',
    requireAdmin,
    asyncRoute(async (req, res) => {
      const { status } = req.body as { status?: OrderStatus };
      if (status !== 'confirmed' && status !== 'cancelled') {
        res.status(400).json({ error: 'El estado debe ser "confirmed" o "cancelled".' });
        return;
      }

      const doc = await ordersCollection.findOne({ _id: req.params.id as never });
      if (!doc) {
        res.status(404).json({ error: 'No encontramos esa venta. Puede que se haya borrado.' });
        return;
      }

      const { _id, ...order } = doc as unknown as Order & { _id: unknown };
      if (order.status !== 'pending') {
        res.status(409).json({
          error: `Esta venta ya figura como ${order.status === 'confirmed' ? 'vendida' : 'descartada'}.`,
        });
        return;
      }

      const resolvedAt = new Date().toISOString();
      await ordersCollection.updateOne({ _id: req.params.id as never }, { $set: { status, resolvedAt } });

      if (status === 'confirmed') {
        await applyStockForOrder(catalogCollection, order, await getLowStockThreshold());
      }

      res.json({ ...order, status, resolvedAt });
    }),
  );

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
