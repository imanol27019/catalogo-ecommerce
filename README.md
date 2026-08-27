# Catálogo mayorista — checkout por WhatsApp

Catálogo web de indumentaria con lógica de e-commerce (grilla, filtros, variantes talle/color,
stock, carrito, destacados, FAQ) pero sin pasarela de pago: el pedido se arma en el carrito y el
botón final abre WhatsApp con el mensaje ya redactado. El catálogo y la configuración de la tienda
se guardan en **MongoDB**, servidos por una API propia (`server/`) — el panel admin publica
cambios en el momento, sin tocar código ni redeployar.

## Arquitectura

```
Frontend (React/Vite, puerto 5173 en dev)  →  API (Express, puerto 4000)  →  MongoDB (puerto 27017)
```

- `src/` — el sitio (catálogo público + panel `/#/admin`). Se sigue desarrollando con `npm run dev`
  como hasta ahora, fuera de Docker.
- `server/` — API mínima (Express + MongoDB) que expone el catálogo y la configuración. Corre en
  Docker.
- `docker-compose.yml` — levanta MongoDB + la API con un solo comando.

Si la API no está disponible (por ejemplo, se te olvidó levantar Docker), el sitio igual carga con
los datos de muestra empaquetados en `src/data/*.json`, para que nunca quede una pantalla rota —
pero **los cambios del admin no se guardan** hasta que la API esté arriba.

## Requisitos

- Node.js 20 o superior (se desarrolló con Node 24 LTS) — para el frontend.
- Docker y Docker Compose — para MongoDB + la API.

## Cómo correr todo en desarrollo

```bash
cp .env.example .env        # completar ADMIN_PASSWORD si querés uno propio (ver abajo)
docker compose up --build -d    # levanta MongoDB + API en :4000
npm install
npm run dev                     # levanta el sitio en :5173
```

La primera vez que la API arranca con la base vacía, la siembra automáticamente con los productos
y la configuración de muestra (`server/src/seed-data/`).

Para ver logs de la API o pararla: `docker compose logs -f api` / `docker compose down` (agregar
`-v` a `down` borra también los datos de Mongo — solo usarlo a propósito).

## Panel de administración (`/#/admin`)

Pide una contraseña (`ADMIN_PASSWORD` del `.env`) antes de mostrar el editor. Dos pestañas:

- **Productos**: alta/edición/borrado, precio, **precio de oferta** (si es menor al de lista se
  muestra tachado + badge "Oferta"), categoría, descripción, talles, colores, mínimos, precio por
  bulto, si aparece en **Destacados** (la vidriera de la portada), y una grilla para marcar el
  stock de cada combinación talle×color.
- **Configuración**: nombre del negocio, WhatsApp, contacto, métodos de envío, los dos mínimos de
  compra (cantidad y monto), banner de portada, FAQ y newsletter — ver detalle de cada campo más
  abajo.

El botón **"Publicar cambios"** de cada pestaña guarda directo en MongoDB — se ve reflejado al
instante para cualquiera que entre al sitio, sin rebuild ni redeploy. **"Exportar backup (JSON)"**
sigue estando como respaldo manual (por ejemplo, antes de un cambio grande), pero ya no hace falta
para que los cambios se publiquen.

**Sobre la contraseña de admin**: es la única protección de escritura — no hay usuarios ni
permisos por rol. Cambiala en `.env` (`ADMIN_PASSWORD`) antes de exponer el sitio más allá de tu
propia máquina, y no compartas esa URL/contraseña más de lo necesario. Los endpoints de **lectura**
del catálogo son públicos a propósito (son los mismos datos que ya se ven en la web).

## Configuración del negocio

Los mismos campos de la pestaña Configuración viven en Mongo (colección `settings`, sembrada la
primera vez desde **[server/src/seed-data/settings.json](server/src/seed-data/settings.json)**).
Campos clave:

- **`whatsappNumber`**: solo dígitos, sin `+` ni espacios. Para celulares de Argentina el formato
  es `549` + código de área sin el `0` + número sin el `15`. Ejemplo: un celular que se marca
  "011 15-1234-5678" se escribe acá como `5491112345678`.
  **Importante: probar el link generado en un teléfono real antes de publicar el sitio** — si este
  número está mal formateado, se rompe todo el flujo de pedidos.
- `shippingMethods`: las opciones de envío que ve el comprador (retiro en local, transporte,
  envío a domicilio, etc.).
- **`minOrderQty`** y **`minOrderTotal`**: mínimo para poder finalizar el pedido — alcanza con
  cumplir UNA de las dos condiciones (cantidad de prendas O monto total). Un valor en `0`
  desactiva esa condición puntual; si ambos están en `0` no hay mínimo. Mientras no se llega al
  mínimo, el botón "Finalizar por WhatsApp" queda deshabilitado (carrito y checkout).
- `announcementMessage`: texto manual de la barra superior. En `null`, se arma solo a partir de
  `minOrderQty`/`minOrderTotal`.
- `hero`: contenido del banner de portada (texto chico, título, subtítulo, botón, imagen de fondo
  opcional — sin imagen se usa un degradé con los colores de marca).
- `faq`: preguntas frecuentes (acordeón, antes del footer).
- `newsletter`: activa/desactiva el formulario de suscripción del footer. Arma un WhatsApp al
  negocio con el mail cargado — es el canal más simple para que ese dato realmente llegue, dado
  que sigue sin haber envío de mails propiamente dicho.

La paleta de colores está en **[src/index.css](src/index.css)** (`@theme`). Tipografías (Jost para
títulos/precios, Montserrat para el resto) se cargan desde Google Fonts en `index.html`.

## Cómo actualizar productos, precios, talles, colores y stock

Igual que la configuración: por el panel admin (recomendado) o editando
**[server/src/seed-data/products.json](server/src/seed-data/products.json)** y re-sembrando la
base (solo relevante para volver a un estado "de fábrica" — el uso normal es el panel admin).
Forma de cada producto:

```json
{
  "id": "rem-001",
  "slug": "remera-basica-oversize",
  "name": "Remera Básica Oversize",
  "category": "remeras",
  "description": "Remera de algodón peinado 24/1, corte oversize.",
  "images": ["/images/products/remera-basica-oversize.svg"],
  "unitPrice": 4500,
  "salePrice": 3999,
  "featured": true,
  "bulkPricing": [{ "minQty": 6, "price": 3800 }],
  "minQtyPerVariant": 3,
  "minQtyPerProduct": 12,
  "sizes": ["S", "M", "L", "XL"],
  "colors": [{ "name": "Negro", "hex": "#111111" }],
  "variants": [
    { "id": "rem-001-S-negro", "size": "S", "color": "Negro", "colorHex": "#111111", "stockStatus": "in_stock", "stockQty": 33 }
  ],
  "status": "active"
}
```

Puntos importantes del formato:

- `variants` tiene que tener **una entrada por cada combinación de talle × color** declarada en
  `sizes` y `colors` (aunque esté sin stock) — si falta una combinación, esa opción no va a
  aparecer bien en el selector de talle/color.
- `stockStatus` acepta `"in_stock"`, `"low_stock"` o `"out_of_stock"`.
- `salePrice`, `featured`, `bulkPricing` y `minQtyPerProduct` son todos opcionales.
- Las fotos van en `public/images/products/`. Podés reemplazar los SVG de muestra por fotos reales
  (`.jpg`/`.png`/`.webp`) y actualizar la ruta en `images`. Se recomienda una relación de aspecto
  vertical (3:4 o 4:5) para que se vean bien recortadas en la grilla.

## Cómo compilar y desplegar a producción

**Frontend** (estático, se sirve igual que antes):

```bash
npm run build      # genera dist/
npm run preview    # para probarlo localmente antes de subirlo
```

`dist/` se sube a cualquier hosting estático (Netlify, Vercel, Cloudflare Pages, el hosting que ya
tenga el negocio, etc.). Antes de compilar, `VITE_API_URL` en `.env` tiene que apuntar a la URL
pública de tu API (no `localhost`) — Vite la incrusta en el build en ese momento.

**Backend**: `docker compose up --build -d` funciona igual en un servidor/VPS propio. Para
producción real conviene además:

- Cambiar `ADMIN_PASSWORD` por algo fuerte y único.
- Restringir `CORS_ORIGIN` al dominio real del sitio (no dejar `*`).
- No exponer el puerto de MongoDB (27017) públicamente — en `docker-compose.yml` ese puerto está
  mapeado al host por comodidad para inspeccionar la base en desarrollo; en un servidor público
  conviene quitar ese mapeo (Mongo solo necesita ser alcanzable por el contenedor `api`, no desde
  afuera) y/o sumarle usuario y contraseña.

## Datos de muestra

El catálogo viene con 16 productos de ejemplo e imágenes placeholder generadas (sin fotos reales),
usados solo para la siembra inicial de Mongo. Para regenerarlos como referencia de cómo armar más
productos (esto NO toca la base ya sembrada, solo los archivos de semilla):

```bash
npm run seed:products   # regenera src/data/products.json y server/src/seed-data/products.json
npm run seed:images     # regenera las imágenes placeholder desde el products.json actual
```

## Estructura del proyecto

```
src/                           # frontend (React + Vite)
├── config/site.config.ts      # puente de compatibilidad -> re-exporta data/settings.ts
├── data/{catalog,settings}.ts # objetos con los datos + loadX()/saveX() contra la API
├── data/*.json                # datos de muestra empaquetados (fallback si la API no responde)
├── types/                     # tipos de producto, carrito, pedido, configuración
├── context/ hooks/ utils/     # estado del carrito, filtros, precios, mínimo de compra, WhatsApp
└── components/
    ├── layout/ catalog/ product/ cart/ checkout/   # sitio público
    ├── admin/                                      # panel /#/admin (carga separada del sitio)
    └── ui/                                          # botones, modal, drawer, íconos

server/                        # API (Express + MongoDB)
├── src/index.ts                # rutas, conexión a Mongo, siembra inicial
├── src/auth.ts                 # chequeo de ADMIN_PASSWORD en las rutas de escritura
├── src/seed-data/               # copia de los datos de muestra, para poblar Mongo la primera vez
└── Dockerfile

docker-compose.yml              # mongodb + api
.env.example                    # variables de entorno (copiar a .env)
```

## Qué NO incluye (a propósito)

- Pasarela de pago o checkout con tarjeta: el pedido siempre se cierra por WhatsApp.
- Login de comprador o cuentas de cliente.
- Roles o usuarios de admin — una sola contraseña compartida protege las escrituras de la API.
