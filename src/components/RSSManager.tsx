import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit, Trash2, ExternalLink, ToggleLeft, ToggleRight, Loader } from 'lucide-react';
import toast from 'react-hot-toast';

interface RSSSource {
  id: string;
  name: string;
  url: string;
  country: string;
  category: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  'Nacionales',
  'Regionales',
  'Internacionales',
  'Economía',
  'Deportes',
  'Espectáculos',
  'Política',
  'Sociedad',
  'Medio Ambiente',
  'Tecnología',
  'Salud',
  'Educación',
  'Cultura',
  'Opinión',
  'Ciencia',
  'Turismo',
  'Justicia',
  'Seguridad'
];

const COUNTRIES = [
  'Argentina',
  'Chile',
  'Uruguay',
  'Paraguay',
  'Bolivia',
  'Perú',
  'Colombia',
  'Venezuela',
  'Ecuador',
  'Brasil',
  'México',
  'Estados Unidos',
  'España',
  'Otro'
];

export const RSSManager: React.FC = () => {
  const [sources, setSources] = useState<RSSSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingSource, setEditingSource] = useState<RSSSource | null>(null);
  const [user, setUser] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: '',
    url: '',
    country: 'Argentina',
    category: 'Nacionales',
    is_active: true
  });

  useEffect(() => {
    // Verificar estado de autenticación
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      console.log('Usuario actual:', user?.email || 'No autenticado');
    };

    checkAuth();
    loadSources();
  }, []);

  const loadSources = async () => {
    try {
      setLoading(true);
      console.log('Cargando fuentes RSS...');

      const { data, error } = await supabase
        .from('rss_sources')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading RSS sources:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);

        // Si es error de permisos, mostrar mensaje específico
        if (error.code === 'PGRST301' || error.message?.includes('permission') || error.message?.includes('policy')) {
          alert('Error de permisos: No tienes permisos para acceder a las fuentes RSS. Contacta al administrador.');
        } else {
          alert('Error al cargar fuentes RSS: ' + error.message);
        }
        return;
      }

      console.log('Fuentes RSS cargadas:', data?.length || 0);
      setSources(data || []);
    } catch (err) {
      console.error('Error inesperado loading RSS sources:', err);
      alert('Error inesperado al cargar fuentes RSS');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      url: '',
      country: 'Argentina',
      category: 'Nacionales',
      is_active: true
    });
    setEditingSource(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error('Debes estar autenticado para realizar esta acción');
      return;
    }

    if (!formData.name.trim() || !formData.url.trim()) {
      toast.error('Nombre y URL son obligatorios');
      return;
    }

    // Crear un timeout para evitar que quede colgado
    let timeoutId: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('La operación tardó demasiado tiempo. Por favor, inténtalo nuevamente.'));
      }, 30000); // 30 segundos timeout
    });

    try {
      setSaving(true);
      console.log('Iniciando guardado de fuente RSS...');

      const saveOperation = async () => {
        if (editingSource) {
          console.log('Actualizando fuente RSS existente:', editingSource.id);
          // Update
          const { error } = await supabase
            .from('rss_sources')
            .update({
              name: formData.name.trim(),
              url: formData.url.trim(),
              country: formData.country,
              category: formData.category,
              is_active: formData.is_active,
              updated_at: new Date().toISOString()
            })
            .eq('id', editingSource.id);

          if (error) throw error;
          console.log('Fuente RSS actualizada exitosamente');
          toast.success('Fuente RSS actualizada correctamente');
        } else {
          console.log('Creando nueva fuente RSS');
          // Create
          const { error } = await supabase
            .from('rss_sources')
            .insert([{
              name: formData.name.trim(),
              url: formData.url.trim(),
              country: formData.country,
              category: formData.category,
              is_active: formData.is_active
            }]);

          if (error) throw error;
          console.log('Fuente RSS creada exitosamente');
          toast.success('Fuente RSS creada correctamente');
        }

        resetForm();
        await loadSources();
      };

      // Ejecutar la operación con timeout
      await Promise.race([saveOperation(), timeoutPromise]);

    } catch (error: any) {
      console.error('Error saving RSS source:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);

      // Manejar errores específicos
      if (error.message?.includes('tardó demasiado')) {
        toast.error('La operación tardó demasiado tiempo. Verifica tu conexión e inténtalo nuevamente.');
      } else if (error.code === 'PGRST301' || error.message?.includes('permission') || error.message?.includes('policy')) {
        toast.error('Error de permisos: No tienes permisos para modificar fuentes RSS. Contacta al administrador.');
      } else if (error.code === '23505') {
        toast.error('Ya existe una fuente RSS con esta URL');
      } else {
        toast.error(`Error al guardar fuente RSS: ${error.message}`);
      }
    } finally {
      setSaving(false);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      console.log('Estado de guardado reseteado');
    }
  };

  const handleEdit = (source: RSSSource) => {
    setEditingSource(source);
    setFormData({
      name: source.name,
      url: source.url,
      country: source.country,
      category: source.category,
      is_active: source.is_active
    });
    setShowForm(true);
  };

  const handleDelete = async (source: RSSSource) => {
    if (!user) {
      toast.error('Debes estar autenticado para realizar esta acción');
      return;
    }

    if (!confirm(`¿Estás seguro de que quieres eliminar la fuente "${source.name}"? Esto también eliminará todos los artículos asociados.`)) {
      return;
    }

    try {
      console.log('Eliminando fuente RSS:', source.id);
      const { error } = await supabase
        .from('rss_sources')
        .delete()
        .eq('id', source.id);

      if (error) throw error;
      console.log('Fuente RSS eliminada exitosamente');
      toast.success('Fuente RSS eliminada correctamente');
      loadSources();
    } catch (error: any) {
      console.error('Error deleting RSS source:', error);
      if (error.code === 'PGRST301' || error.message?.includes('permission') || error.message?.includes('policy')) {
        toast.error('Error de permisos: No tienes permisos para eliminar fuentes RSS.');
      } else {
        toast.error('Error al eliminar fuente RSS: ' + error.message);
      }
    }
  };

  const toggleActive = async (source: RSSSource) => {
    if (!user) {
      toast.error('Debes estar autenticado para realizar esta acción');
      return;
    }

    try {
      console.log('Cambiando estado de fuente RSS:', source.id, 'a', !source.is_active);
      const { error } = await supabase
        .from('rss_sources')
        .update({
          is_active: !source.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', source.id);

      if (error) throw error;
      console.log('Estado de fuente RSS cambiado exitosamente');
      toast.success(`Fuente RSS ${!source.is_active ? 'activada' : 'desactivada'}`);
      loadSources();
    } catch (error: any) {
      console.error('Error toggling RSS source:', error);
      if (error.code === 'PGRST301' || error.message?.includes('permission') || error.message?.includes('policy')) {
        toast.error('Error de permisos: No tienes permisos para modificar fuentes RSS.');
      } else {
        toast.error('Error al cambiar estado: ' + error.message);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Cargando fuentes RSS...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Fuentes RSS</h2>
          <p className="text-slate-600">Gestiona las fuentes de noticias RSS para la automatización</p>
          {user ? (
            <p className="text-xs text-green-600 mt-1">✅ Autenticado como: {user.email}</p>
          ) : (
            <p className="text-xs text-red-600 mt-1">❌ No autenticado</p>
          )}
        </div>
        <button
          onClick={() => setShowForm(true)}
          disabled={!user}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="h-4 w-4" />
          Agregar Fuente
        </button>
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            {editingSource ? 'Editar Fuente RSS' : 'Nueva Fuente RSS'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="Ej: La Nación"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  URL del Feed RSS *
                </label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="https://example.com/rss"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  País
                </label>
                <select
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  {COUNTRIES.map(country => (
                    <option key={country} value={country}>{country}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Categoría
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  {CATEGORIES.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="is_active" className="text-sm text-slate-700">
                Fuente activa (se incluirá en la recolección automática)
              </label>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving && <Loader className="h-4 w-4 animate-spin" />}
                {saving ? 'Guardando...' : (editingSource ? 'Actualizar' : 'Crear')}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de fuentes */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        {sources.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <p>No hay fuentes RSS configuradas</p>
            <p className="text-sm mt-1">Agrega tu primera fuente para comenzar a recolectar artículos automáticamente</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Fuente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    País/Categoría
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sources.map((source) => (
                  <tr key={source.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-slate-900">{source.name}</div>
                        <div className="text-sm text-slate-500 flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" />
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-blue-600 truncate max-w-xs"
                          >
                            {source.url}
                          </a>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <div className="text-slate-900">{source.country}</div>
                        <div className="text-slate-500">{source.category}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleActive(source)}
                        disabled={!user}
                        className={`inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs font-medium ${
                          source.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        } ${!user ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        title={user ? "Cambiar estado" : "Requiere autenticación"}
                      >
                        {source.is_active ? (
                          <>
                            <ToggleRight className="h-3 w-3" />
                            Activa
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="h-3 w-3" />
                            Inactiva
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(source)}
                          disabled={!user}
                          className="text-blue-600 hover:text-blue-800 p-1 disabled:opacity-50 disabled:cursor-not-allowed"
                          title={user ? "Editar" : "Requiere autenticación"}
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(source)}
                          disabled={!user}
                          className="text-red-600 hover:text-red-800 p-1 disabled:opacity-50 disabled:cursor-not-allowed"
                          title={user ? "Eliminar" : "Requiere autenticación"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};