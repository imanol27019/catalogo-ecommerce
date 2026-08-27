import { lazy, Suspense, useEffect, useState } from 'react';
import { CartProvider } from './context/CartContext';
import { Storefront } from './Storefront';

const AdminApp = lazy(() => import('./components/admin/AdminApp').then((m) => ({ default: m.AdminApp })));

function useIsAdminRoute(): boolean {
  const [isAdmin, setIsAdmin] = useState(() => window.location.hash.startsWith('#/admin'));

  useEffect(() => {
    function onHashChange() {
      setIsAdmin(window.location.hash.startsWith('#/admin'));
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return isAdmin;
}

function App() {
  const isAdmin = useIsAdminRoute();

  if (isAdmin) {
    return (
      <Suspense fallback={<div className="p-6 text-sm text-stone-500">Cargando panel...</div>}>
        <AdminApp />
      </Suspense>
    );
  }

  return (
    <CartProvider>
      <Storefront />
    </CartProvider>
  );
}

export default App;
