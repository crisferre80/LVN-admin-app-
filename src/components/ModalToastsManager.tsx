import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Edit, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface ModalToastForm {
  id?: number | null;
  title: string;
  body: string;
  image_url?: string | null;
  link_url?: string | null;
  is_active: boolean;
  start_at?: string | null;
  end_at?: string | null;
  repeatable?: boolean;
  show_once?: boolean;
}

export const ModalToastsManager: React.FC = () => {
  const [items, setItems] = useState<ModalToastForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ModalToastForm | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      const { data, error } = await supabase.from('modal_toasts').select('*').order('created_at', { ascending: false }).limit(200);
      if (error) {
        toast.error('Error cargando modal toasts');
        console.error(error);
      } else if (isMounted) {
        setItems(data as ModalToastForm[]);
      }
      setLoading(false);
    }
    load();
    return () => { isMounted = false; };
  }, []);

  const resetForm = () => setEditing(null);

  const handleEdit = (item: ModalToastForm) => {
    setEditing(item);
  };

  const handleDelete = async (id?: number | null) => {
    if (!id) return;
    if (!confirm('Eliminar este modal / toast permanentemente?')) return;
    const { error } = await supabase.from('modal_toasts').delete().eq('id', id);
    if (error) {
      toast.error('Error eliminando');
      console.error(error);
    } else {
      setItems(prev => prev.filter(i => i.id !== id));
      toast.success('Eliminado');
    }
  };

  const save = async (form: ModalToastForm) => {
    const payload = {
      title: form.title,
      body: form.body,
      image_url: form.image_url || null,
      link_url: form.link_url || null,
      is_active: Boolean(form.is_active),
      start_at: form.start_at || null,
      end_at: form.end_at || null,
      repeatable: Boolean(form.repeatable),
      show_once: Boolean(form.show_once),
    };

    try {
      if (form.id) {
        const { error } = await supabase.from('modal_toasts').update(payload).eq('id', form.id);
        if (error) throw error;
        setItems(prev => prev.map(i => (i.id === form.id ? { ...i, ...payload } : i)));
        toast.success('Actualizado');
      } else {
        const { error, data } = await supabase.from('modal_toasts').insert([payload]).select().single();
        if (error) throw error;
        setItems(prev => [data as any, ...prev]);
        toast.success('Creado');
      }
      resetForm();
    } catch (err) {
      console.error(err);
      toast.error('Error guardando');
    }
  };

  const defaultEmpty: ModalToastForm = {
    title: '', body: '', image_url: '', link_url: '', is_active: true, start_at: null, end_at: null, repeatable: false, show_once: true
  };

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Modal / Toasts</h2>
          <p className="text-sm text-slate-500">Mensajes tipo modal o toast para promociones, eventos o suscripciones.</p>
        </div>
        <button onClick={() => setEditing(defaultEmpty)} className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 text-sm text-white">
          <Plus className="h-4 w-4" /> Nuevo
        </button>
      </header>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4 max-h-[600px] overflow-y-auto">
          {loading ? (
            <div className="p-6 rounded-2xl bg-slate-50">Cargando...</div>
          ) : items.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-50">No hay mensajes.</div>
          ) : (
            items.map(item => (
              <div key={String(item.id)} className="border rounded-2xl p-4 bg-white flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{item.title}</div>
                  <div className="text-xs text-slate-500 mt-1 line-clamp-2">{item.body?.substring(0, 120)}</div>
                  <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
                    <div>{item.is_active ? 'Activo' : 'Inactivo'}</div>
                    <div>|</div>
                    <div>{item.show_once ? 'Mostrar una vez' : item.repeatable ? 'Repetible' : 'No repetir'}</div>
                  </div>
                </div>
                <div className="flex flex-col gap-2 ml-3">
                  <button onClick={() => handleEdit(item)} title="Editar" className="rounded-xl p-2 border hover:bg-slate-50"><Edit className="h-4 w-4" /></button>
                  <button onClick={() => handleDelete(item.id)} title="Eliminar" className="rounded-xl p-2 border hover:bg-slate-50"><Trash2 className="h-4 w-4 text-rose-600" /></button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="bg-white rounded-2xl border p-4 sticky top-0">
          {editing ? (
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-semibold">{editing.id ? 'Editar' : 'Nuevo'} modal/toast</h3>
                <button onClick={() => resetForm()} className="p-2 rounded border"><X className="h-4 w-4" /></button>
              </div>
              <div className="space-y-3">
                <input className="w-full p-2 border rounded" placeholder="Título" value={editing.title} onChange={(e) => setEditing({...editing, title: e.target.value})} />
                <textarea className="w-full p-2 border rounded" rows={4} placeholder="Texto / HTML simple" value={editing.body} onChange={(e) => setEditing({...editing, body: e.target.value})} />
                <input className="w-full p-2 border rounded" placeholder="Imagen URL" value={editing.image_url ?? ''} onChange={(e) => setEditing({...editing, image_url: e.target.value})} />
                <input className="w-full p-2 border rounded" placeholder="Link (opcional)" value={editing.link_url ?? ''} onChange={(e) => setEditing({...editing, link_url: e.target.value})} />
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={editing.is_active} onChange={e => setEditing({...editing, is_active: e.target.checked})} /> Activo
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={editing.show_once} onChange={e => setEditing({...editing, show_once: e.target.checked})} /> Mostrar una vez
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={editing.repeatable} onChange={e => setEditing({...editing, repeatable: e.target.checked})} /> Repetible
                  </label>
                </div>

                <div className="grid gap-2">
                  <label className="text-xs text-slate-500">Inicio</label>
                  <input type="datetime-local" value={editing.start_at ?? ''} onChange={e => setEditing({...editing, start_at: e.target.value || null})} className="w-full p-2 border rounded text-sm" />
                  <label className="text-xs text-slate-500">Fin</label>
                  <input type="datetime-local" value={editing.end_at ?? ''} onChange={e => setEditing({...editing, end_at: e.target.value || null})} className="w-full p-2 border rounded text-sm" />
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button onClick={() => resetForm()} className="px-3 py-1 rounded border">Cancelar</button>
                  <button onClick={() => save(editing)} className="px-3 py-1 rounded bg-blue-600 text-white flex items-center gap-2">{editing.id ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />} Guardar</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 text-sm text-slate-600">Selecciona un mensaje para editar o crea uno nuevo.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModalToastsManager;
