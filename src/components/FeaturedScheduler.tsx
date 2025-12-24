import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Edit, X } from 'lucide-react';

type ContentType = 'article' | 'advertisement' | 'video' | 'other';

interface ScheduleItem {
  id: string;
  content_type: string;
  content_id: string;
  ref_table: string;
  start_at: string;
  end_at?: string | null;
  position?: string;
  priority?: number;
  metadata?: any;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export const FeaturedScheduler: React.FC = () => {
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [contentType, setContentType] = useState<ContentType>('article');
  const [contentRef, setContentRef] = useState('');
  const [refTable, setRefTable] = useState('articles');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [position, setPosition] = useState('home_top');
  const [priority, setPriority] = useState(0);
  const [active, setActive] = useState(true);
  const [metadata, setMetadata] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Available content lists
  const [articles, setArticles] = useState<Array<{id:string; title:string}>>([]);
  const [aiArticles, setAiArticles] = useState<Array<{id:string; title:string}>>([]);
  const [ads, setAds] = useState<Array<{id:string; title:string}>>([]);
  const [videos, setVideos] = useState<Array<{id:string; title:string}>>([]);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      // Load scheduler items
      const { data, error } = await supabase
        .from('featured_schedule')
        .select('*')
        .order('start_at', { ascending: false });

      if (error) throw error;
      setItems((data || []) as any);

      // Load content lists
      const [aRes, aiRes, adRes, vRes] = await Promise.all([
        // Traer únicamente artículos marcados como destacados
        supabase.from('articles').select('id,title').eq('is_featured', true).order('published_at', { ascending: false }).limit(100),
        // Artículos generados por IA destacados
        supabase.from('ai_generated_articles').select('id,title').eq('is_featured', true).order('published_at', { ascending: false }).limit(100),
        supabase.from('advertisements').select('id,title').order('created_at', { ascending: false }).limit(100),
        // Solo videos marcados como featured (placement)
        supabase.from('videos').select('id,title').eq('placement', 'featured').order('created_at', { ascending: false }).limit(100),
      ] as any);

      setArticles(aRes.data || []);
      setAiArticles(aiRes.data || []);
      setAds(adRes.data || []);
      setVideos(vRes.data || []);
    } catch (error) {
      console.error('Error loading featured scheduler:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setContentType('article');
    setContentRef('');
    setRefTable('articles');
    setStartAt('');
    setEndAt('');
    setPosition('home_top');
    setPriority(0);
    setActive(true);
    setMetadata('');
    setEditingId(null);
  };

  const handleCreateOrUpdate = async () => {
    if (!contentRef || !startAt) {
      alert('Completa al menos el contenido y la fecha de inicio');
      return;
    }

    setSaving(true);
    try {
      // contentRef may be prefixed like "table:id" when selecting from lists
      let resolvedTable = refTable;
      let resolvedId = contentRef;
      if (contentRef.includes(':')) {
        const [tbl, id] = contentRef.split(':');
        resolvedTable = tbl;
        resolvedId = id;
      }

      const payload = {
        content_type: contentType,
        content_id: resolvedId,
        ref_table: resolvedTable,
        start_at: new Date(startAt).toISOString(),
        end_at: endAt ? new Date(endAt).toISOString() : null,
        position,
        priority,
        metadata: metadata ? JSON.parse(metadata) : null,
        active,
      } as any;

      if (editingId) {
        const { error } = await supabase.from('featured_schedule').update(payload).eq('id', editingId);
        if (error) throw error;
        alert('Programación actualizada');
      } else {
        const { error } = await supabase.from('featured_schedule').insert([payload]);
        if (error) throw error;
        alert('Programación creada');
      }

      await loadAll();
      resetForm();
    } catch (err) {
      console.error('Error saving schedule:', err);
      alert('Error guardando la programación: ' + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item: ScheduleItem) => {
    setEditingId(item.id);
    setContentType(item.content_type as ContentType);
    // store as table:id so the picker can restore the selection correctly
    setContentRef(`${item.ref_table}:${item.content_id}`);
    setRefTable(item.ref_table);
    setStartAt(item.start_at ? new Date(item.start_at).toISOString().slice(0,16) : '');
    setEndAt(item.end_at ? new Date(item.end_at).toISOString().slice(0,16) : '');
    setPosition(item.position || 'home_top');
    setPriority(item.priority || 0);
    setActive(item.active);
    setMetadata(item.metadata ? JSON.stringify(item.metadata, null, 2) : '');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta programación?')) return;
    try {
      const { error } = await supabase.from('featured_schedule').delete().eq('id', id);
      if (error) throw error;
      await loadAll();
      alert('Programación eliminada');
    } catch (err) {
      console.error('Error deleting schedule:', err);
      alert('Error eliminando programación');
    }
  };

  const renderPicker = () => {
    switch (contentType) {
      case 'article':
        return (
          <select className="w-full border p-2 rounded" value={contentRef} onChange={(e) => { setContentRef(e.target.value); /* refTable is included in the value for ai articles */ }}>
            <option value="">-- Seleccionar artículo destacado --</option>
            {articles.length > 0 && (
              <optgroup label="Artículos">
                {articles.map(a => <option key={`articles:${a.id}`} value={`articles:${a.id}`}>{a.title}</option>)}
              </optgroup>
            )}
            {aiArticles.length > 0 && (
              <optgroup label="Artículos IA">
                {aiArticles.map(a => <option key={`ai_generated_articles:${a.id}`} value={`ai_generated_articles:${a.id}`}>{a.title}</option>)}
              </optgroup>
            )}
          </select>
        );
      case 'advertisement':
        return (
          <select className="w-full border p-2 rounded" value={contentRef} onChange={(e) => { setContentRef(e.target.value); setRefTable('advertisements'); }}>
            <option value="">-- Seleccionar publicidad --</option>
            {ads.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
          </select>
        );
      case 'video':
        return (
          <select className="w-full border p-2 rounded" value={contentRef} onChange={(e) => { setContentRef(e.target.value); /* value format: videos:id */ }}>
            <option value="">-- Seleccionar video destacado --</option>
            {videos.map(v => <option key={`videos:${v.id}`} value={`videos:${v.id}`}>{v.title}</option>)}
          </select>
        );
      default:
        return (
          <input className="w-full border p-2 rounded" placeholder="ID o URL de referencia" value={contentRef} onChange={(e) => setContentRef(e.target.value)} />
        );
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Programador de Contenidos Destacados</h2>
          <p className="text-sm text-slate-500 mt-1">Programa artículos, publicidades, videos u otros contenidos para mostrarlos en posiciones destacadas del sitio.</p>
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tipo</label>
            <select className="w-full border border-slate-300 p-2 rounded-xl" value={contentType} onChange={(e) => setContentType(e.target.value as ContentType)}>
              <option value="article">Artículo</option>
              <option value="advertisement">Publicidad</option>
              <option value="video">Video</option>
              <option value="other">Otro</option>
            </select>
          </div>

          <div className="lg:col-span-1 xl:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Contenido</label>
            {renderPicker()}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Posición</label>
            <select className="w-full border border-slate-300 p-2 rounded-xl" value={position} onChange={(e) => setPosition(e.target.value)}>
              <option value="home_top">Home - Top</option>
              <option value="category_feature">Category - Featured</option>
              <option value="sidebar">Sidebar</option>
              <option value="hero">Hero (Portada)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Inicio</label>
            <input type="datetime-local" className="w-full border border-slate-300 p-2 rounded-xl" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Fin (opcional)</label>
            <input type="datetime-local" className="w-full border border-slate-300 p-2 rounded-xl" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Prioridad</label>
            <input type="number" className="w-full border border-slate-300 p-2 rounded-xl" value={priority} onChange={(e) => setPriority(Number(e.target.value))} />
          </div>

          <div className="lg:col-span-2 xl:col-span-3">
            <label className="block text-xs font-medium text-slate-600 mb-1">Meta / JSON (opcional)</label>
            <textarea rows={2} className="w-full border border-slate-300 p-2 rounded-xl text-sm" value={metadata} onChange={(e) => setMetadata(e.target.value)} placeholder='{"class":"highlight","campaign":"navidad"}' />
          </div>

          <div className="lg:col-span-2 xl:col-span-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="rounded" />
              Activo
            </label>
            <div className="flex gap-2">
              {editingId && (
                <button onClick={resetForm} className="px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-600 hover:bg-white flex items-center gap-2"><X size={14} /> Cancelar</button>
              )}
              <button onClick={handleCreateOrUpdate} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50">
                <Plus size={14} /> {editingId ? 'Actualizar' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <h3 className="text-base font-semibold mb-4">Programaciones existentes</h3>
        {loading ? (
          <div className="text-sm text-slate-500">Cargando programaciones...</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-slate-500">No hay programaciones. Crea una desde arriba.</div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {items.map(item => (
              <div key={item.id} className="border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-500 uppercase">{item.content_type}</span>
                    <strong className="text-sm truncate">{item.ref_table}:{item.content_id}</strong>
                    <span className="text-xs text-slate-400">{item.position} {item.priority ? `· P:${item.priority}` : ''}</span>
                    {!item.active && <span className="text-xs text-red-500">(inactivo)</span>}
                  </div>
                  <div className="text-xs text-slate-600 mt-1">Inicio: {new Date(item.start_at).toLocaleString()}</div>
                  {item.end_at && <div className="text-xs text-slate-600">Fin: {new Date(item.end_at).toLocaleString()}</div>}
                  {item.metadata && <div className="text-xs text-slate-500 mt-2 truncate">Meta: {JSON.stringify(item.metadata)}</div>}
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={() => handleEdit(item as ScheduleItem)} className="px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"><Edit size={14}/> Editar</button>
                  <button onClick={() => handleDelete(item.id)} className="px-3 py-2 border border-red-300 rounded-xl text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"><Trash2 size={14}/></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FeaturedScheduler;
