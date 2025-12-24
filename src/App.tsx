import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { AdminPanel } from './components/AdminPanel';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { ArticleEditor } from './components/ArticleEditor';
import { BulkArticleGenerator } from './components/BulkArticleGenerator';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { Toaster } from 'react-hot-toast';

function AppRoutes() {
  const { user, loading } = useAuth();
  const [authTimeout, setAuthTimeout] = useState(false);

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
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/admin"
        element={user ? <AdminPanel /> : <Navigate to="/login" />}
      />
      <Route
        path="/admin/article/new"
        element={user ? <ArticleEditor /> : <Navigate to="/login" />}
      />
      <Route
        path="/admin/article/edit/:id"
        element={user ? <ArticleEditor /> : <Navigate to="/login" />}
      />
      <Route
        path="/admin/bulk-generator"
        element={user ? <BulkArticleGenerator onComplete={() => window.location.href = '/admin'} /> : <Navigate to="/login" />}
      />
      <Route path="/" element={<Navigate to={user ? "/admin" : "/login"} />} />
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
