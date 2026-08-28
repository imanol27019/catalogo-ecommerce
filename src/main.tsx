import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { loadCatalog } from './data/catalog';
import { loadSettings } from './data/settings';

/**
 * `./App` (y todo lo que importa, incluido `config/site.config.ts`) se carga recién acá, con
 * `import()` dinámico, a propósito: ese archivo lee valores de `settings`/`catalog` en el momento
 * en que se evalúa el módulo. Si `App` se importara de forma estática arriba de este archivo, se
 * evaluaría antes de que termine el fetch y quedaría con los datos de muestra pegados para
 * siempre en esta pestaña.
 */
async function bootstrap() {
  await Promise.all([loadCatalog(), loadSettings()]);

  // El título y la descripción viven en index.html como valores fijos (para que haya algo
  // razonable antes de que cargue el JS); una vez que tenemos la configuración real de la
  // tienda los reemplazamos, así la pestaña y los links compartidos muestran el nombre correcto.
  const { SITE_META } = await import('./config/site.config');
  document.title = SITE_META.title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', SITE_META.description);

  const { default: App } = await import('./App');

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

bootstrap();
