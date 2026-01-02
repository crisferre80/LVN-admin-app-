import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { AdminPanel } from './components/AdminPanel';
import { Register } from './components/Register';
import { BulkArticleGenerator } from './components/BulkArticleGenerator';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { Toaster } from 'react-hot-toast';

function AppRoutes() {
  const { user, loading } = useAuth();
  const [authTimeout, setAuthTimeout] = useState(false);

  // Componente para redirigir rutas antiguas del editor
  function EditorRedirector() {
    const navigate = useNavigate();
    const { id } = useParams<{ id?: string }>();
    const location = useLocation();

    useEffect(() => {
      const searchParams = new URLSearchParams(location.search);
      const rewrite = searchParams.get('rewrite');

      if (id) {
        // Redirigir edición con ID
        navigate(`/admin?edit=${id}${rewrite ? '&rewrite=true' : ''}`, { replace: true });
      } else {
        // Redirigir creación nueva
        navigate('/admin?new=true', { replace: true });
      }
    }, [id, location.search, navigate]);

    return null;
  }

  // Timeout de seguridad para evitar loading infinito
  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        console.warn('Auth loading timeout - forzando carga completada');
        setAuthTimeout(true);
      }, 10000); // 10 segundos timeout

      return () => clearTimeout(timer);
    } else {
      setAuthTimeout(false);
    }
  }, [loading]);

  if (loading && !authTimeout) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Cargando aplicación...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/register" element={<Register />} />
      <Route
        path="/admin"
        element={user ? <AdminPanel /> : <Navigate to="/" />}
      />
      <Route
        path="/admin/article/new"
        element={user ? <EditorRedirector /> : <Navigate to="/" />}
      />
      <Route
        path="/admin/article/edit/:id"
        element={user ? <EditorRedirector /> : <Navigate to="/" />}
      />
      <Route
        path="/admin/bulk-generator"
        element={user ? <BulkArticleGenerator onComplete={() => window.location.href = '/admin'} /> : <Navigate to="/" />}
      />
      <Route path="/login" element={<Navigate to="/" />} />
      <Route path="/" element={<Dashboard />} />
    </Routes>
  );
}

function AppContent() {
  // Siempre usar BrowserRouter para evitar problemas de navegación con hash
  const RouterComponent = BrowserRouter;

  return (
    <AuthProvider>
      <RouterComponent>
        <AppRoutes />
      </RouterComponent>
    </AuthProvider>
  );
}

function App() {
  return (
    <>
      <AppContent />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
        }}
      />
    </>
  );
}

export default App;
