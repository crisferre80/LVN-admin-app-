import { useState, useEffect, useCallback } from 'react';
import { X, Music, Loader, Search, Upload, Download, ChevronDown, Play, Pause } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AudioFile {
  name: string;
  url: string;
  size: number;
  created_at: string;
}

interface AudioSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
  bucket?: string;
}

export function AudioSelector({ isOpen, onClose, onSelect, bucket = 'media' }: AudioSelectorProps) {
  const [files, setFiles] = useState<AudioFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const PAGE_SIZE = 50;

  const loadFiles = async (loadMore = false) => {
    if (loadMore && !hasMore) return;

    const isInitialLoad = !loadMore;
    if (isInitialLoad) {
      setLoading(true);
      setPage(0);
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const currentPage = loadMore ? page + 1 : 0;
      const offset = currentPage * PAGE_SIZE;

      console.log(`📋 Cargando archivos de audio del bucket '${bucket}' (página ${currentPage}, offset ${offset})...`);

      const { data, error } = await supabase.storage
        .from(bucket)
        .list('audio/', {
          limit: PAGE_SIZE,
          offset: offset,
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (error) {
        console.error('❌ Error al cargar archivos de audio:', error);
        throw error;
      }

      console.log(`✅ Archivos de audio recibidos: ${data?.length || 0}`);

      // Filtrar archivos de audio válidos
      const audioFiles = data?.filter(file =>
        file.name &&
        !file.name.startsWith('.') &&
        file.name !== '.emptyFolderPlaceholder' &&
        file.name.match(/\.(mp3|wav|ogg|m4a|aac)$/i)
      ) || [];

      console.log(`🎵 Archivos de audio válidos: ${audioFiles.length}`);

      const filesWithUrls = audioFiles.map(file => {
        const publicUrl = supabase.storage.from(bucket).getPublicUrl(`audio/${file.name}`).data.publicUrl;

        return {
          name: file.name,
          url: publicUrl,
          size: file.metadata?.size || 0,
          created_at: file.created_at || ''
        };
      });

      if (isInitialLoad) {
        setFiles(filesWithUrls);
      } else {
        setFiles(prev => [...prev, ...filesWithUrls]);
        setPage(currentPage);
      }

      // Si cargamos menos archivos que el límite, no hay más
      setHasMore(audioFiles.length === PAGE_SIZE);
    } catch (error) {
      console.error('❌ Error loading audio files:', error);
      alert('Error al cargar archivos de audio. Verifica la consola para más detalles.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadFiles();
    } else {
      // Reset state when closing
      setFiles([]);
      setSearchTerm('');
      setPage(0);
      setHasMore(true);
      setPlayingAudio(null);
    }
  }, [isOpen, bucket]);

  const loadMoreFiles = useCallback(() => {
    if (!loadingMore && hasMore) {
      loadFiles(true);
    }
  }, [loadingMore, hasMore, page]);

  const handleDownload = async (file: AudioFile) => {
    try {
      const link = document.createElement('a');
      link.href = file.url;
      link.download = file.name;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading audio file:', error);
      alert('Error al descargar el archivo de audio');
    }
  };

  const togglePlay = (audioUrl: string) => {
    if (playingAudio === audioUrl) {
      setPlayingAudio(null);
    } else {
      setPlayingAudio(audioUrl);
    }
  };

  const filteredFiles = files.filter(file =>
    file.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('audio/')) {
      alert('Solo se permiten archivos de audio (MP3, WAV, OGG, M4A, AAC)');
      return;
    }

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      alert('El archivo es demasiado grande. Máximo 50MB');
      return;
    }

    setUploading(true);
    try {
      const fileName = `audio/uploaded_${Date.now()}_${file.name}`;
      const { error } = await supabase.storage
        .from(bucket)
        .upload(fileName, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      onSelect(publicUrl);
      onClose();
    } catch (error) {
      console.error('Error uploading audio file:', error);
      alert('Error al subir el archivo de audio');
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-4xl max-h-[80vh] overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Seleccionar audio
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search and Upload */}
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar archivos de audio..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>
            <div>
              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer">
                <Upload className="h-4 w-4" />
                Subir nuevo
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="h-8 w-8 animate-spin text-blue-600" />
              <span className="ml-2 text-slate-600">Cargando archivos de audio...</span>
            </div>
          ) : uploading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="h-8 w-8 animate-spin text-blue-600" />
              <span className="ml-2 text-slate-600">Subiendo archivo de audio...</span>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Music className="h-12 w-12 text-slate-300" />
              <p className="mt-4 text-slate-500">
                {searchTerm ? 'No se encontraron archivos de audio con esa búsqueda' : 'No hay archivos de audio en el bucket'}
              </p>
              <p className="mt-2 text-sm text-slate-400">
                Los archivos deben estar en la carpeta 'audio/' y tener extensión MP3, WAV, OGG, M4A o AAC
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-slate-600">
                Mostrando {filteredFiles.length} archivo{filteredFiles.length !== 1 ? 's' : ''} de audio
                {files.length > filteredFiles.length && ` (filtrados de ${files.length} totales)`}
              </div>

              <div
                className="max-h-96 overflow-y-auto"
                onScroll={(e) => {
                  const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
                  if (scrollTop + clientHeight >= scrollHeight - 100 && !loadingMore && hasMore) {
                    loadMoreFiles();
                  }
                }}
              >
                <div className="space-y-2">
                  {filteredFiles.map((file) => (
                    <div
                      key={file.name}
                      className="flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
                    >
                      {/* Play button */}
                      <button
                        onClick={() => togglePlay(file.url)}
                        className={`flex-shrink-0 rounded-full p-3 ${
                          playingAudio === file.url
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-slate-600 hover:bg-slate-100'
                        } transition-colors`}
                      >
                        {playingAudio === file.url ? (
                          <Pause className="h-5 w-5" />
                        ) : (
                          <Play className="h-5 w-5" />
                        )}
                      </button>

                      {/* Audio preview (hidden) */}
                      {playingAudio === file.url && (
                        <audio
                          src={file.url}
                          autoPlay
                          onEnded={() => setPlayingAudio(null)}
                          className="hidden"
                        />
                      )}

                      {/* File info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">
                          {file.name}
                        </p>
                        <p className="text-sm text-slate-500">
                          {formatFileSize(file.size)}
                          {file.created_at && (
                            <> • {new Date(file.created_at).toLocaleDateString('es-ES')}</>
                          )}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            console.log('🎵 Audio seleccionado:', file.url);
                            onSelect(file.url);
                          }}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                        >
                          Seleccionar
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(file);
                          }}
                          className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 transition-colors"
                          title="Descargar archivo"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {loadingMore && (
                  <div className="flex items-center justify-center py-4">
                    <Loader className="h-6 w-6 animate-spin text-blue-600" />
                    <span className="ml-2 text-sm text-slate-600">Cargando más archivos...</span>
                  </div>
                )}

                {!hasMore && files.length > 0 && (
                  <div className="text-center py-4">
                    <p className="text-sm text-slate-500">Has visto todos los archivos de audio disponibles</p>
                  </div>
                )}

                {hasMore && !loadingMore && (
                  <div className="text-center py-4">
                    <button
                      onClick={loadMoreFiles}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <ChevronDown className="h-4 w-4" />
                      Cargar más archivos
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}