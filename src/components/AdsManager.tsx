import React, { useState, useEffect, useRef } from 'react';
import { Plus, Edit, Trash2, Image as ImageIcon, MapPin, X, Link2, MonitorSmartphone, ChevronUp, ChevronDown, Upload, FolderOpen, Settings } from 'lucide-react';
import { supabase } from '../lib/supabase';

// Actualización de la interfaz
interface Advertisement {
  id: string;
  title: string;
  image_url: string;
  link_url: string;
  placement: string; // Changed from 'position' to match database column
  width: number;
  height: number;
  is_active: boolean;
  created_at: string;
  order?: number;
}

const placementLabels: Record<string, string> = {
  sidebar: 'Lateral',
  header: 'Encabezado',
  footer: 'Pie de página',
  content: 'Entre artículos',
  home: 'Página principal',
  'Espectaculos': 'Espectáculos',
  'Deportes': 'Deportes',
  'Agro': 'Agro',
  'Medio Ambiente': 'Medio Ambiente',
  'Economia': 'Economía',
  'Salud': 'Salud',
  'Tecnologia': 'Tecnología',
  'Ciencia': 'Ciencia',
  'Internacionales': 'Internacionales',
};

const statusBadgeClasses = (isActive: boolean) =>
  isActive
    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
    : 'bg-slate-200 text-slate-600 border border-slate-300';

const statusLabel = (isActive: boolean) => (isActive ? 'Activo' : 'Pausado');

const formatDimensions = (ad: Advertisement) => `${ad.width} × ${ad.height}px`;

const formatAdDate = (date: string) =>
  new Date(date).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

const DEFAULT_AD_FORM = {
  title: '',
  image_url: '',
  link_url: '',
  placement: 'sidebar',
  width: 300,
  height: 250,
  is_active: true,
  order: 0,
};

export const AdsManager: React.FC = () => {
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAd, setEditingAd] = useState<Advertisement | null>(null);
  const [formData, setFormData] = useState(DEFAULT_AD_FORM);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Controles de carrusel y previsualización por ubicación
  const [placementSettings, setPlacementSettings] = useState<Record<string, {
    carouselEnabled: boolean;
    carouselDurationMs: number;
    maxRotationsPerView: number;
  }>>({});
  const [expandedPlacements, setExpandedPlacements] = useState<Set<string>>(new Set(['home']));
  const [rotationTicks, setRotationTicks] = useState<Record<string, number>>({});
  
  // Galería de imágenes del bucket
  const [showBucketGallery, setShowBucketGallery] = useState(false);
  const [bucketImages, setBucketImages] = useState<string[]>([]);
  const [draggedImage, setDraggedImage] = useState<string | null>(null);

  useEffect(() => {
    fetchAds();
    loadBucketImages();
    initializePlacementSettings();
  }, []);

  const initializePlacementSettings = () => {
    const defaultSettings = {
      carouselEnabled: true,
      carouselDurationMs: 5000,
      maxRotationsPerView: 0,
    };
    const settings: Record<string, typeof defaultSettings> = {};
    Object.keys(placementLabels).forEach((key) => {
      settings[key] = { ...defaultSettings };
    });
    setPlacementSettings(settings);
  };

  const loadBucketImages = async () => {
    try {
      const { data, error } = await supabase.storage.from('advertisements').list('', {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' },
      });
      if (error) throw error;
      const urls = (data || []).map((file) => {
        const { data: publicUrl } = supabase.storage.from('advertisements').getPublicUrl(file.name);
        return publicUrl.publicUrl;
      });
      setBucketImages(urls);
    } catch (error) {
      console.error('Error loading bucket images:', error);
    }
  };

  const fetchAds = async () => {
    try {
      const { data, error } = await supabase
        .from('advertisements')
        .select('*')
        .order('placement', { ascending: true })
        .order('order', { ascending: true });

      if (error) {
        console.error('Error fetching ads:', error);
        alert(`Error al cargar publicidades: ${error.message}`);
        throw error;
      }
      console.log('📊 Publicidades cargadas:', data?.length || 0);
      console.log('📋 Detalle de publicidades:', data);
      
      // Verificar activas vs inactivas
      const activas = data?.filter(ad => ad.is_active === true).length || 0;
      const inactivas = data?.filter(ad => ad.is_active === false).length || 0;
      console.log(`✅ Activas: ${activas}, ⏸️  Pausadas: ${inactivas}`);
      
      setAds(data || []);
    } catch (error) {
      console.error('Error fetching ads:', error);
      setAds([]);
    } finally {
      setLoading(false);
    }
  };

  // Tick de rotación del carrusel por ubicación
  useEffect(() => {
    const intervals: NodeJS.Timeout[] = [];
    Object.entries(placementSettings).forEach(([placement, settings]) => {
      if (!settings.carouselEnabled) return;
      const interval = setInterval(() => {
        setRotationTicks((prev) => {
          const currentTick = prev[placement] || 0;
          const nextTick = settings.maxRotationsPerView > 0 && currentTick >= settings.maxRotationsPerView - 1
            ? 0
            : currentTick + 1;
          return { ...prev, [placement]: nextTick };
        });
      }, Math.max(1000, settings.carouselDurationMs));
      intervals.push(interval);
    });
    return () => intervals.forEach((i) => clearInterval(i));
  }, [placementSettings]);

  // Agrupar anuncios por ubicación
  const groupedByPlacement = React.useMemo(() => {
    const groups: Record<string, Advertisement[]> = {};
    ads.forEach((ad) => {
      const key = ad.placement || 'otros';
      if (!groups[key]) groups[key] = [];
      groups[key].push(ad);
    });
    // Ordenar por `order`
    Object.keys(groups).forEach((k) => {
      groups[k] = groups[k].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    });
    return groups;
  }, [ads]);

  // Seleccionar anuncio activo para carrusel según tick
  const getActiveAdForPlacement = (placement: string): Advertisement | null => {
    const list = groupedByPlacement[placement] || [];
    const active = list.filter((a) => a.is_active);
    if (active.length === 0) return null;
    const settings = placementSettings[placement];
    if (!settings || !settings.carouselEnabled) return active[0];
    const tick = rotationTicks[placement] || 0;
    const idx = tick % active.length;
    return active[idx];
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('border-blue-500', 'bg-blue-50');
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
  };

  const handleDropFile = async (e: React.DragEvent<HTMLDivElement>, placement: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
    
    console.log('🎯 Drop detectado en placement:', placement);
    console.log('📦 draggedImage:', draggedImage);
    console.log('📁 dataTransfer.files:', e.dataTransfer.files);
    
    // Si se arrastra una imagen del bucket
    if (draggedImage) {
      console.log('✅ Creando anuncio desde imagen del bucket');
      await createAdFromImage(draggedImage, placement);
      setDraggedImage(null);
      return;
    }

    // Si se arrastra un archivo del sistema
    const files = Array.from(e.dataTransfer.files);
    console.log('📂 Archivos detectados:', files.length);
    const imageFile = files.find((f) => f.type.startsWith('image/'));
    if (!imageFile) {
      alert('Por favor arrastra un archivo de imagen');
      return;
    }

    try {
      console.log('⬆️ Subiendo archivo:', imageFile.name);
      const sanitizeFileName = (name: string) =>
        name.toLowerCase().replace(/[^a-z0-9.-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      const fileName = `${Date.now()}-${sanitizeFileName(imageFile.name)}`;
      
      const { error: uploadError } = await supabase.storage.from('advertisements').upload(fileName, imageFile);
      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage.from('advertisements').getPublicUrl(fileName);
      console.log('✅ Archivo subido, creando anuncio');
      await createAdFromImage(publicUrl.publicUrl, placement);
      await loadBucketImages();
    } catch (error) {
      console.error('❌ Error uploading file:', error);
      alert('Error al subir archivo');
    }
  };

  const createAdFromImage = async (imageUrl: string, placement: string) => {
    const maxOrder = Math.max(0, ...(groupedByPlacement[placement] || []).map((a) => a.order ?? 0));
    const { error } = await supabase.from('advertisements').insert([{
      title: `Anuncio ${placement} ${Date.now()}`,
      image_url: imageUrl,
      link_url: 'https://example.com',
      placement,
      width: 300,
      height: 250,
      is_active: true,
      order: maxOrder + 1,
    }]);
    if (error) {
      console.error('Error creating ad:', error);
      alert(`Error al crear anuncio: ${error.message}`);
    } else {
      fetchAds();
    }
  };

  const togglePlacementExpanded = (placement: string) => {
    setExpandedPlacements((prev) => {
      const next = new Set(prev);
      if (next.has(placement)) next.delete(placement);
      else next.add(placement);
      return next;
    });
  };

  const updatePlacementSetting = <K extends keyof typeof placementSettings[string]>(
    placement: string,
    key: K,
    value: typeof placementSettings[string][K]
  ) => {
    setPlacementSettings((prev) => ({
      ...prev,
      [placement]: { ...prev[placement], [key]: value },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log('🚀 Iniciando handleSubmit');
    console.log('📋 Estado del formulario:', formData);
    console.log('📝 Modo edición:', !!editingAd, editingAd?.id);

    // Validación básica
    if (!formData.title.trim()) {
      alert('El título del anuncio es obligatorio');
      return;
    }
    if (!formData.image_url.trim()) {
      alert('La URL de la imagen es obligatoria');
      return;
    }
    if (!formData.link_url.trim()) {
      alert('El enlace de destino es obligatorio');
      return;
    }
    if (!formData.width || formData.width <= 0) {
      alert('El ancho debe ser mayor a 0');
      return;
    }
    if (!formData.height || formData.height <= 0) {
      alert('El alto debe ser mayor a 0');
      return;
    }

    try {
      // Asegurar que width y height tengan valores válidos
      const submitData = {
        ...formData,
        width: Number(formData.width) || 300,
        height: Number(formData.height) || 250,
        order: Number(formData.order) || 0
      };

      console.log('📦 Datos a enviar:', submitData);

      if (editingAd) {
        console.log('🔄 Actualizando anuncio existente:', editingAd.id);
        const { data, error } = await supabase
          .from('advertisements')
          .update(submitData)
          .eq('id', editingAd.id)
          .select();

        if (error) {
          console.error('❌ Error al actualizar anuncio:', error);
          alert(`Error al actualizar anuncio: ${error.message}`);
          throw error;
        }
        console.log('✅ Anuncio actualizado exitosamente:', data);
        alert('Anuncio actualizado exitosamente');
      } else {
        console.log('➕ Creando nuevo anuncio');
        const { data, error } = await supabase
          .from('advertisements')
          .insert([submitData])
          .select();

        if (error) {
          console.error('❌ Error al crear anuncio:', error);
          alert(`Error al crear anuncio: ${error.message}`);
          throw error;
        }
        console.log('✅ Anuncio creado exitosamente:', data);
        alert('Anuncio creado exitosamente');
      }

      setShowForm(false);
      setEditingAd(null);
      setFormData({ ...DEFAULT_AD_FORM });
      fetchAds();
    } catch (error) {
      console.error('💥 Error general al guardar anuncio:', error);
      // El alert ya se mostró arriba si fue un error específico de Supabase
    }
  };

  const handleEdit = (ad: Advertisement) => {
    setEditingAd(ad);
    setFormData({
      title: ad.title || '',
      image_url: ad.image_url || '',
      link_url: ad.link_url || '',
      placement: ad.placement || 'sidebar',
      width: ad.width || 300,
      height: ad.height || 250,
      is_active: ad.is_active ?? true,
      order: ad.order ?? 0
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este anuncio?')) return;

    try {
      const { error } = await supabase
        .from('advertisements')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting ad:', error);
        alert(`Error al eliminar: ${error.message}`);
        throw error;
      }
      fetchAds();
      alert('Publicidad eliminada exitosamente');
    } catch (error) {
      console.error('Error deleting ad:', error);
    }
  };

  const moveAd = async (adId: string, direction: 'up' | 'down') => {
    const currentAd = ads.find(ad => ad.id === adId);
    if (!currentAd) return;

    // Find ads with same placement
    const samePlacementAds = ads.filter(ad => ad.placement === currentAd.placement).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const currentIndex = samePlacementAds.findIndex(ad => ad.id === adId);

    if (direction === 'up' && currentIndex > 0) {
      const prevAd = samePlacementAds[currentIndex - 1];
      // Swap orders
      await updateAdOrder(currentAd.id, prevAd.order ?? 0);
      await updateAdOrder(prevAd.id, currentAd.order ?? 0);
    } else if (direction === 'down' && currentIndex < samePlacementAds.length - 1) {
      const nextAd = samePlacementAds[currentIndex + 1];
      // Swap orders
      await updateAdOrder(currentAd.id, nextAd.order ?? 0);
      await updateAdOrder(nextAd.id, currentAd.order ?? 0);
    }

    fetchAds();
  };

  const updateAdOrder = async (adId: string, newOrder: number) => {
    const { error } = await supabase
      .from('advertisements')
      .update({ order: newOrder })
      .eq('id', adId);

    if (error) {
      console.error('Error updating ad order:', error);
      alert(`Error al actualizar orden: ${error.message}`);
    }
  };

  const toggleActive = async (adId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('advertisements')
        .update({ is_active: !currentStatus })
        .eq('id', adId);

      if (error) {
        console.error('Error toggling ad status:', error);
        alert(`Error al cambiar estado: ${error.message}`);
        throw error;
      }
      fetchAds();
    } catch (error) {
      console.error('Error toggling ad status:', error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Sanitize filename to make it URL-safe for Supabase storage
      const sanitizeFileName = (name: string) => {
        return name
          .toLowerCase()
          .replace(/[^a-z0-9.-]/g, '-') // Replace non-alphanumeric chars (except . and -) with -
          .replace(/-+/g, '-') // Replace multiple - with single -
          .replace(/^-|-$/g, ''); // Remove leading/trailing -
      };

      const sanitizedFileName = sanitizeFileName(file.name);
      const fileName = `${Date.now()}-${sanitizedFileName}`;

      const { error } = await supabase.storage
        .from('advertisements')
        .upload(fileName, file);

      if (error) throw error;

      const { data: publicUrl } = supabase.storage
        .from('advertisements')
        .getPublicUrl(fileName);

      setFormData({ ...formData, image_url: publicUrl.publicUrl });
      alert('Archivo subido exitosamente');
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Error al subir el archivo');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <div className="h-8 w-48 rounded-2xl bg-slate-200" />
        <div className="space-y-3">
          {[...Array(3)].map((_, index) => (
            <div key={index} className="h-20 rounded-3xl bg-slate-200" />
          ))}
        </div>
      </div>
    );
  }

  const emptyAdsState = (
    <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
      <MonitorSmartphone className="h-10 w-10 text-blue-400" />
      <p className="text-sm font-semibold text-slate-600">Todavía no hay anuncios configurados.</p>
      <p className="text-sm text-slate-400">Crea una pieza para comenzar a monetizar.</p>
    </div>
  );

  console.log('🎨 Renderizando AdsManager - Total de ads en estado:', ads.length);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Indicador flotante cuando se arrastra una imagen */}
      {draggedImage && !showBucketGallery && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-blue-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-bounce">
          <Upload className="h-5 w-5" />
          <span className="font-semibold">Arrastrando imagen - Suelta en una zona de drop azul</span>
        </div>
      )}
      
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">Gestión de Anuncios</h2>
          <p className="text-sm text-slate-500">
            Controla campañas publicitarias y optimiza sus tamaños desde dispositivos móviles.
          </p>
        </div>
        <button
          onClick={() => {
            setEditingAd(null);
            setFormData({ ...DEFAULT_AD_FORM });
            setShowForm(true);
          }}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          Nuevo anuncio
        </button>
      </header>

      {/* Panel de configuración por sección con drag & drop */}
      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Configuración por ubicación</h3>
            <p className="text-sm text-slate-500">Configura carruseles y arrastra imágenes a cada sección.</p>
          </div>
          <button
            onClick={() => setShowBucketGallery(true)}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300"
          >
            <FolderOpen className="h-4 w-4" />
            Imágenes del bucket ({bucketImages.length})
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {Object.entries(placementLabels).map(([placement, label]) => {
            const isExpanded = expandedPlacements.has(placement);
            const placementAds = groupedByPlacement[placement] || [];
            const settings = placementSettings[placement] || { carouselEnabled: true, carouselDurationMs: 5000, maxRotationsPerView: 0 };
            const activeAd = getActiveAdForPlacement(placement);

            return (
              <div key={placement} className="rounded-2xl border border-slate-200 bg-slate-50">
                <button
                  onClick={() => togglePlacementExpanded(placement)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-slate-500" />
                    <span className="text-sm font-semibold text-slate-900">{label}</span>
                    <span className="text-xs text-slate-500">({placementAds.length} anuncios)</span>
                  </div>
                  <Settings className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </button>
                
                {isExpanded && (
                  <div className="border-t border-slate-200 p-4 space-y-4">
                    {/* Controles de carrusel y botón agregar */}
                    <div className="flex items-end justify-between gap-3">
                      <div className="grid gap-3 sm:grid-cols-3 flex-1">
                        <label className="inline-flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={settings.carouselEnabled}
                            onChange={(e) => updatePlacementSetting(placement, 'carouselEnabled', e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          Carrusel activo
                        </label>
                        <div className="space-y-1">
                          <label className="text-xs text-slate-600">Duración (ms)</label>
                          <input
                            type="number"
                            min={1000}
                            step={500}
                            value={settings.carouselDurationMs}
                            onChange={(e) => updatePlacementSetting(placement, 'carouselDurationMs', parseInt(e.target.value, 10) || 5000)}
                            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-slate-600">Máx. rotaciones (0=∞)</label>
                          <input
                            type="number"
                            min={0}
                            value={settings.maxRotationsPerView}
                            onChange={(e) => updatePlacementSetting(placement, 'maxRotationsPerView', parseInt(e.target.value, 10) || 0)}
                            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setFormData({ ...DEFAULT_AD_FORM, placement });
                          setEditingAd(null);
                          setShowForm(true);
                        }}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                      >
                        <Plus className="h-4 w-4" />
                        Agregar imagen
                      </button>
                    </div>

                    {/* Zona de drop */}
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDropFile(e, placement)}
                      className="relative min-h-[200px] rounded-xl border-2 border-dashed border-slate-300 bg-white p-4 transition-all duration-200"
                    >
                      {activeAd ? (
                        <div className="flex flex-col items-center justify-center gap-3">
                          <img src={activeAd.image_url} alt={activeAd.title} className="max-h-40 rounded-lg object-contain" />
                          <p className="text-xs font-medium text-slate-700">{activeAd.title}</p>
                          <p className="text-xs text-slate-500">
                            {placementAds.filter((a) => a.is_active).length > 1 && settings.carouselEnabled
                              ? `Rotando entre ${placementAds.filter((a) => a.is_active).length} anuncios`
                              : 'Anuncio fijo'}
                          </p>
                        </div>
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                          <Upload className="h-8 w-8 text-slate-300" />
                          <p className="text-sm font-medium text-slate-600">Arrastra una imagen aquí</p>
                          <p className="text-xs text-slate-400">
                            Desde tu sistema o desde la galería del bucket
                          </p>
                        </div>
                      )}
                      {draggedImage && (
                        <div className="absolute inset-0 flex items-center justify-center bg-blue-500/10 backdrop-blur-sm border-2 border-blue-500 rounded-xl pointer-events-none">
                          <div className="bg-white rounded-lg shadow-xl px-4 py-3 flex items-center gap-2">
                            <Upload className="h-5 w-5 text-blue-600 animate-bounce" />
                            <span className="text-sm font-semibold text-blue-900">Suelta aquí para crear anuncio</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Lista de anuncios en esta ubicación */}
                    {placementAds.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-slate-600">Anuncios en esta ubicación:</p>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {placementAds.map((ad) => (
                            <div key={ad.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2">
                              <img src={ad.image_url} alt={ad.title} className="h-12 w-12 rounded object-cover" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-slate-900 truncate">{ad.title}</p>
                                <p className="text-xs text-slate-500">Orden: {ad.order ?? 0}</p>
                              </div>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleEdit(ad)}
                                  className="rounded p-1 text-blue-600 hover:bg-blue-50"
                                  title="Editar"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDelete(ad.id)}
                                  className="rounded p-1 text-red-600 hover:bg-red-50"
                                  title="Eliminar"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Modal de galería de imágenes del bucket */}
      {showBucketGallery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-4xl rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Galería de imágenes</h3>
                <p className="text-sm text-slate-500">
                  <strong>💡 Tip:</strong> Al arrastrar, el modal se cerrará automáticamente para que veas las zonas de drop.
                </p>
              </div>
              <button
                onClick={() => setShowBucketGallery(false)}
                className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-5">
              {bucketImages.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                  <ImageIcon className="h-12 w-12 text-slate-300" />
                  <p className="text-sm text-slate-600">No hay imágenes en el bucket todavía.</p>
                  <p className="text-xs text-slate-400">Sube archivos desde el formulario o arrastra desde tu sistema.</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-slate-600 mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                    💡 <strong>Instrucciones:</strong> Haz clic y arrastra cualquier imagen hacia las zonas de drop en las secciones de arriba. Las zonas se iluminarán en azul cuando estés sobre ellas.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {bucketImages.map((url, idx) => (
                      <div
                        key={idx}
                        draggable
                        onDragStart={() => {
                          setDraggedImage(url);
                          console.log('🎯 Iniciando drag de imagen:', url);
                          // Cerrar modal automáticamente al iniciar drag
                          setTimeout(() => setShowBucketGallery(false), 100);
                        }}
                        onDragEnd={() => {
                          setDraggedImage(null);
                          console.log('✋ Finalizando drag');
                        }}
                        className={`group relative cursor-move overflow-hidden rounded-xl border-2 bg-slate-50 transition-all ${
                          draggedImage === url
                            ? 'border-blue-500 shadow-xl scale-95 opacity-50'
                            : 'border-slate-200 hover:border-blue-400 hover:shadow-lg'
                        }`}
                      >
                        <img src={url} alt={`Bucket ${idx}`} className="h-32 w-full object-cover" />
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/50 group-hover:opacity-100">
                          <Upload className="h-6 w-6 text-white mb-1" />
                          <span className="text-xs text-white font-medium">Arrastra para usar</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                {editingAd ? 'Editar anuncio' : 'Crear nuevo anuncio'}
              </h3>
              <p className="text-sm text-slate-500">Agrega piezas optimizadas para todos los espacios del sitio.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingAd(null);
                setFormData({ ...DEFAULT_AD_FORM });
              }}
              className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
              aria-label="Cerrar formulario"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6 px-5 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600" htmlFor="ad-title">
                  Título del anuncio
                </label>
                <input
                  id="ad-title"
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600" htmlFor="ad-link">
                  Enlace de destino
                </label>
                <div className="relative">
                  <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="ad-link"
                    type="url"
                    value={formData.link_url}
                    onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-9 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600" htmlFor="ad-image-url">
                  URL de imagen
                </label>
                <input
                  id="ad-image-url"
                  type="url"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600" htmlFor="ad-file">
                  Subir archivo desde dispositivo
                </label>
                <input
                  id="ad-file"
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*"
                  className="w-full cursor-pointer rounded-2xl border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 file:mr-4 file:rounded-full file:border-0 file:bg-blue-100 file:px-4 file:py-1.5 file:text-xs file:font-semibold file:text-blue-700 hover:border-slate-400"
                />
              </div>
            </div>

            {formData.image_url && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-600">Previsualización</p>
                <img
                  src={formData.image_url}
                  alt={formData.title || 'Vista previa del anuncio'}
                  className="mt-3 h-32 w-full rounded-xl object-cover"
                  onError={() => setFormData({ ...formData, image_url: '' })}
                />
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600" htmlFor="ad-placement">
                  Ubicación
                </label>
                <select
                  id="ad-placement"
                  value={formData.placement}
                  onChange={(e) => setFormData({ ...formData, placement: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <option value="sidebar">Lateral</option>
                  <option value="header">Encabezado</option>
                  <option value="footer">Pie de página</option>
                  <option value="content">Entre artículos</option>
                  <option value="home">Página principal</option>
                  <option value="Espectaculos">Espectáculos</option>
                  <option value="Deportes">Deportes</option>
                  <option value="Agro">Agro</option>
                  <option value="Medio Ambiente">Medio Ambiente</option>
                  <option value="Economia">Economía</option>
                  <option value="Salud">Salud</option>
                  <option value="Tecnologia">Tecnología</option>
                  <option value="Ciencia">Ciencia</option>
                  <option value="Internacionales">Internacionales</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600" htmlFor="ad-width">
                  Ancho (px)
                </label>
                <input
                  id="ad-width"
                  type="number"
                  value={formData.width}
                  onChange={(e) => setFormData({ ...formData, width: parseInt(e.target.value, 10) || 0 })}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  min={1}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600" htmlFor="ad-height">
                  Alto (px)
                </label>
                <input
                  id="ad-height"
                  type="number"
                  value={formData.height}
                  onChange={(e) => setFormData({ ...formData, height: parseInt(e.target.value, 10) || 0 })}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  min={1}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600" htmlFor="ad-order">
                  Orden
                </label>
                <input
                  id="ad-order"
                  type="number"
                  value={formData.order}
                  onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value, 10) || 0 })}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  min={0}
                  required
                />
              </div>
            </div>

            <label className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Mostrar anuncio activo en el sitio
            </label>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingAd(null);
                  setFormData({ ...DEFAULT_AD_FORM });
                }}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-5 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                {editingAd ? 'Actualizar anuncio' : 'Crear anuncio'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="space-y-4">
        <div className="grid gap-3 md:hidden">
          {ads.length === 0 ? (
            emptyAdsState
          ) : (
            ads.map((ad) => (
              <article key={ad.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                    {ad.image_url ? (
                      <img src={ad.image_url} alt={ad.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-400">
                        <ImageIcon className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-semibold text-slate-900">{ad.title}</h3>
                      <button
                        onClick={() => toggleActive(ad.id, ad.is_active)}
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition ${statusBadgeClasses(ad.is_active)}`}
                      >
                        {statusLabel(ad.is_active)}
                      </button>
                    </div>
                    {/* Se oculta el enlace para evitar desbordes en acciones */}
                    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-3 py-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {placementLabels[ad.placement] ?? ad.placement}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-3 py-1">
                        {formatDimensions(ad)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">Creado: {formatAdDate(ad.created_at)}</p>
                  </div>
                </div>
                <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3">
                  <div className="flex gap-1">
                    <button
                      onClick={() => moveAd(ad.id, 'up')}
                      className="inline-flex items-center justify-center rounded-full border border-slate-200 p-2 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                      title="Mover arriba"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => moveAd(ad.id, 'down')}
                      className="inline-flex items-center justify-center rounded-full border border-slate-200 p-2 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                      title="Mover abajo"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => handleEdit(ad)}
                    className="inline-flex items-center justify-center rounded-full border border-slate-200 p-2 text-blue-600 hover:border-blue-300"
                    title="Editar anuncio"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(ad.id)}
                    className="inline-flex items-center justify-center rounded-full border border-slate-200 p-2 text-red-600 hover:border-red-300"
                    title="Eliminar anuncio"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </article>
            ))
          )}
        </div>

        <div className="hidden md:block">
          {ads.length === 0 ? (
            emptyAdsState
          ) : (
            <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-6 py-4">Título</th>
                      <th className="px-6 py-4">Ubicación</th>
                      <th className="px-6 py-4">Orden</th>
                      <th className="px-6 py-4">Dimensiones</th>
                      <th className="px-6 py-4">Estado</th>
                      <th className="px-6 py-4">Creado</th>
                      <th className="px-6 py-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ads.map((ad) => (
                      <tr key={ad.id} className="hover:bg-slate-50/70">
                        <td className="px-6 py-4 text-slate-900">
                          <div className="flex items-center gap-3">
                            <div className="hidden h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100 lg:block">
                              {ad.image_url ? (
                                <img src={ad.image_url} alt={ad.title} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-slate-400">
                                  <ImageIcon className="h-5 w-5" />
                                </div>
                              )}
                            </div>
                            <div className="space-y-1">
                              <p className="font-medium text-slate-900">{ad.title}</p>
                              {/* Enlace oculto para mantener la tabla compacta */}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">{placementLabels[ad.placement] ?? ad.placement}</td>
                        <td className="px-6 py-4">{ad.order ?? 0}</td>
                        <td className="px-6 py-4">{formatDimensions(ad)}</td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => toggleActive(ad.id, ad.is_active)}
                            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold transition ${statusBadgeClasses(ad.is_active)}`}
                          >
                            {statusLabel(ad.is_active)}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">{formatAdDate(ad.created_at)}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="flex gap-1">
                              <button
                                onClick={() => moveAd(ad.id, 'up')}
                                className="inline-flex items-center justify-center rounded-full border border-slate-200 p-2 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                                title="Mover arriba"
                              >
                                <ChevronUp className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => moveAd(ad.id, 'down')}
                                className="inline-flex items-center justify-center rounded-full border border-slate-200 p-2 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                                title="Mover abajo"
                              >
                                <ChevronDown className="h-4 w-4" />
                              </button>
                            </div>
                            <button
                              onClick={() => handleEdit(ad)}
                              className="inline-flex items-center justify-center rounded-full border border-slate-200 p-2 text-blue-600 hover:border-blue-300"
                              title="Editar anuncio"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(ad.id)}
                              className="inline-flex items-center justify-center rounded-full border border-slate-200 p-2 text-red-600 hover:border-red-300"
                              title="Eliminar anuncio"
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
            </div>
          )}
        </div>
      </section>
    </div>
  );
};