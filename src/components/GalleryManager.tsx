import { useState, useRef } from 'react';
import { X, Upload, Image as ImageIcon, Grid3x3, List, Maximize2, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import imageCompression from 'browser-image-compression';

export type GalleryTemplate = 'list' | 'grid-2' | 'grid-3' | 'carousel' | 'masonry';

interface GalleryImage {
  url: string;
  caption?: string;
  alt?: string;
}

interface GalleryManagerProps {
  images: GalleryImage[];
  template: GalleryTemplate;
  onImagesChange: (images: GalleryImage[]) => void;
  onTemplateChange: (template: GalleryTemplate) => void;
  maxImages?: number;
}

export function GalleryManager({
  images,
  template,
  onImagesChange,
  onTemplateChange,
  maxImages = 20
}: GalleryManagerProps) {
  const [uploading, setUploading] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const remainingSlots = maxImages - images.length;
    if (remainingSlots <= 0) {
      alert(`Máximo ${maxImages} imágenes permitidas`);
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    setUploading(true);

    try {
      const uploadedImages: GalleryImage[] = [];

      for (const file of filesToUpload) {
        try {
          // Comprimir imagen
          const compressedFile = await imageCompression(file, {
            maxSizeMB: 0.5,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
            initialQuality: 0.8,
          });

          const fileExt = file.name.split('.').pop();
          const fileName = `gallery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
          const storagePath = `articles/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('media')
            .upload(storagePath, compressedFile);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('media')
            .getPublicUrl(storagePath);

          uploadedImages.push({
            url: publicUrl,
            caption: '',
            alt: file.name.replace(/\.[^/.]+$/, '')
          });

          console.log(`Imagen comprimida: ${file.name} → ${compressedFile.size} bytes`);
        } catch (fileError) {
          console.error(`Error procesando ${file.name}:`, fileError);
        }
      }

      onImagesChange([...images, ...uploadedImages]);
      alert(`${uploadedImages.length} imagen(es) agregada(s)`);
    } catch (error) {
      console.error('Error subiendo imágenes:', error);
      alert('Error al subir imágenes');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const updateCaption = (index: number, caption: string) => {
    const updated = [...images];
    updated[index] = { ...updated[index], caption };
    onImagesChange(updated);
  };

  const removeImage = (index: number) => {
    if (!confirm('¿Eliminar esta imagen de la galería?')) return;
    const updated = images.filter((_, i) => i !== index);
    onImagesChange(updated);
  };

  const moveImage = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= images.length) return;
    const updated = [...images];
    const [movedItem] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, movedItem);
    onImagesChange(updated);
  };

  const renderPreview = () => {
    if (images.length === 0) return null;

    switch (template) {
      case 'carousel':
        return (
          <div className="relative rounded-2xl bg-slate-100 p-4">
            <div className="aspect-video overflow-hidden rounded-xl bg-white">
              {images[0] && (
                <img
                  src={images[0].url}
                  alt={images[0].alt || 'Imagen de galería'}
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <div className="mt-2 flex items-center justify-center gap-2">
              {images.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-2 w-2 rounded-full ${idx === 0 ? 'bg-blue-600' : 'bg-slate-300'}`}
                />
              ))}
            </div>
          </div>
        );

      case 'grid-2':
        return (
          <div className="grid grid-cols-2 gap-3">
            {images.slice(0, 4).map((img, idx) => (
              <div key={idx} className="aspect-video overflow-hidden rounded-xl bg-slate-100">
                <img src={img.url} alt={img.alt || ''} className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        );

      case 'grid-3':
        return (
          <div className="grid grid-cols-3 gap-2">
            {images.slice(0, 6).map((img, idx) => (
              <div key={idx} className="aspect-square overflow-hidden rounded-xl bg-slate-100">
                <img src={img.url} alt={img.alt || ''} className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        );

      case 'masonry':
        return (
          <div className="columns-2 gap-3 space-y-3">
            {images.slice(0, 6).map((img, idx) => (
              <div key={idx} className="break-inside-avoid overflow-hidden rounded-xl bg-slate-100">
                <img src={img.url} alt={img.alt || ''} className="w-full" />
              </div>
            ))}
          </div>
        );

      case 'list':
      default:
        return (
          <div className="space-y-3">
            {images.slice(0, 3).map((img, idx) => (
              <div key={idx} className="aspect-video overflow-hidden rounded-xl bg-slate-100">
                <img src={img.url} alt={img.alt || ''} className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Selector de plantilla */}
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-slate-700">Diseño de galería:</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onTemplateChange('list')}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
              template === 'list'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <List className="h-3.5 w-3.5" />
            Lista
          </button>
          <button
            type="button"
            onClick={() => onTemplateChange('grid-2')}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
              template === 'grid-2'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Grid3x3 className="h-3.5 w-3.5" />
            Grid 2x2
          </button>
          <button
            type="button"
            onClick={() => onTemplateChange('grid-3')}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
              template === 'grid-3'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Grid3x3 className="h-3.5 w-3.5" />
            Grid 3x3
          </button>
          <button
            type="button"
            onClick={() => onTemplateChange('carousel')}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
              template === 'carousel'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Maximize2 className="h-3.5 w-3.5" />
            Carrusel
          </button>
          <button
            type="button"
            onClick={() => onTemplateChange('masonry')}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
              template === 'masonry'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <ImageIcon className="h-3.5 w-3.5" />
            Mosaico
          </button>
        </div>
      </div>

      {/* Vista previa */}
      {images.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Vista previa
          </p>
          {renderPreview()}
        </div>
      )}

      {/* Subir imágenes */}
      <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-6 text-center">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
          id="gallery-upload"
        />
        <label
          htmlFor="gallery-upload"
          className="inline-flex cursor-pointer flex-col items-center gap-2"
        >
          <Upload className="h-8 w-8 text-slate-400" />
          <p className="text-sm font-medium text-slate-600">
            {uploading ? 'Subiendo...' : 'Haz clic para agregar imágenes'}
          </p>
          <p className="text-xs text-slate-400">
            {images.length} / {maxImages} imágenes
          </p>
        </label>
      </div>

      {/* Lista de imágenes */}
      {images.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Imágenes en galería
          </p>
          {images.map((img, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3"
            >
              <img
                src={img.url}
                alt={img.alt || ''}
                className="h-16 w-16 flex-shrink-0 cursor-pointer rounded-lg object-cover"
                onClick={() => setPreviewIndex(idx)}
              />
              <div className="flex-1 space-y-2">
                <input
                  type="text"
                  placeholder="Descripción opcional"
                  value={img.caption || ''}
                  onChange={(e) => updateCaption(idx, e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => moveImage(idx, idx - 1)}
                    disabled={idx === 0}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveImage(idx, idx + 1)}
                    disabled={idx === images.length - 1}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <span className="ml-auto text-xs text-slate-400">#{idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de vista previa */}
      {previewIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setPreviewIndex(null)}
        >
          <button
            onClick={() => setPreviewIndex(null)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={images[previewIndex].url}
            alt={images[previewIndex].alt || ''}
            className="max-h-[90vh] max-w-[90vw] rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          {images[previewIndex].caption && (
            <p className="absolute bottom-8 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 text-sm text-white">
              {images[previewIndex].caption}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
