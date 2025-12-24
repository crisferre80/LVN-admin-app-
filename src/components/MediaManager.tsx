import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Upload, Image, Trash2, Copy, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';
import imageCompression from 'browser-image-compression';

interface MediaFile {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploaded_at: string;
  path: string;
}


type MediaSource = 'supabase'; // Removed 'google-drive' to prevent API key exposure
type BucketType = 'media' | 'advertisements';

export const MediaManager: React.FC = () => {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<MediaFile | null>(null);
  const [currentSource, setCurrentSource] = useState<MediaSource>('supabase');
  const [currentBucket, setCurrentBucket] = useState<BucketType>('media');
  // Removed Google Drive state variables to prevent API key exposure
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Removed Google Drive API credentials - functionality disabled to prevent key exposure



  useEffect(() => {
    // Load files from Supabase only (Google Drive disabled to prevent API key exposure)
    loadFiles();
  }, [currentBucket]);

  const loadFiles = async () => {
    try {
      setLoading(true);

      const bucketName = currentBucket;
      let targetPath = '';
      let fallbackPath = '';

      // Configurar rutas según el bucket
      if (currentBucket === 'media') {
        targetPath = 'articles/';
        fallbackPath = '';
      } else if (currentBucket === 'advertisements') {
        targetPath = ''; // Cargar de la raíz del bucket advertisements
        fallbackPath = '';
      }

      // Intentar cargar de la ruta específica primero
      const { data: targetFiles, error: targetError } = await supabase.storage
        .from(bucketName)
        .list(targetPath, {
          limit: 100,
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (targetError) {
        console.warn(`Error loading ${targetPath} folder from ${bucketName}:`, targetError);
        // Si hay error, intentar cargar de la raíz como fallback
        const { data: rootFiles, error: rootError } = await supabase.storage
          .from(bucketName)
          .list(fallbackPath, {
            limit: 100,
            sortBy: { column: 'created_at', order: 'desc' }
          });

        if (rootError) throw rootError;

        const mediaFiles: MediaFile[] = (rootFiles || [])
          .filter(file => file.name && file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i))
          .map(file => ({
            id: file.id || file.name,
            name: file.name,
            url: supabase.storage.from(bucketName).getPublicUrl(file.name).data.publicUrl,
            type: `image/${file.name.split('.').pop()}`,
            size: file.metadata?.size || 0,
            uploaded_at: file.created_at || new Date().toISOString(),
            path: file.name
          }));

        setFiles(mediaFiles);
        return;
      }

      // Procesar archivos de la ruta específica
      const mediaFiles: MediaFile[] = (targetFiles || [])
        .filter(file => file.name && file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i))
        .map(file => ({
          id: file.id || `${targetPath}${file.name}`,
          name: `${targetPath}${file.name}`,
          url: supabase.storage.from(bucketName).getPublicUrl(`${targetPath}${file.name}`).data.publicUrl,
          type: `image/${file.name.split('.').pop()}`,
          size: file.metadata?.size || 0,
          uploaded_at: file.created_at || new Date().toISOString(),
          path: `${targetPath}${file.name}`
        }));

      // Ordenar por fecha de subida (más recientes primero)
      mediaFiles.sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());

      setFiles(mediaFiles);
    } catch (error) {
      console.error('Error fetching Supabase files:', error);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Solo se permiten archivos de imagen');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('El archivo es demasiado grande. Máximo 5MB');
      return;
    }

    setUploading(true);
    try {
      // Compress image with timeout
      const compressionPromise = imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      });

      const compressionTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout en compresión de imagen')), 30000)
      );

      const compressedFile = await Promise.race([compressionPromise, compressionTimeout]) as File;

      const targetPath = currentBucket === 'media' ? 'articles/' : '';

      // Sanitize filename to make it URL-safe for Supabase storage
      const sanitizeFileName = (name: string) => {
        return name
          .toLowerCase()
          .replace(/[^a-z0-9.-]/g, '-') // Replace non-alphanumeric chars (except . and -) with -
          .replace(/-+/g, '-') // Replace multiple - with single -
          .replace(/^-|-$/g, ''); // Remove leading/trailing -
      };

      const sanitizedFileName = sanitizeFileName(file.name);
      const fileName = `${targetPath}${Date.now()}-${sanitizedFileName}`;

      // Upload to Supabase Storage with timeout
      const uploadPromise = supabase.storage
        .from(currentBucket)
        .upload(fileName, compressedFile);

      const uploadTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout en subida de imagen')), 45000)
      );

      const uploadResult = await Promise.race([uploadPromise, uploadTimeout]) as any;
      const { error: uploadError } = uploadResult;

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(currentBucket)
        .getPublicUrl(fileName);

      const newFile: MediaFile = {
        id: `file-${Date.now()}`,
        name: file.name,
        url: publicUrl,
        type: file.type,
        size: compressedFile.size,
        uploaded_at: new Date().toISOString(),
        path: fileName
      };

      setFiles(prev => [newFile, ...prev]);
      alert('Archivo subido exitosamente');
    } catch (error) {
      console.error('Error uploading file:', error);

      if (error instanceof Error) {
        if (error.message.includes('Timeout')) {
          alert('La imagen es demasiado grande o lenta la conexión. Inténtalo con una imagen más pequeña.');
        } else {
          alert(`Error al procesar la imagen: ${error.message}`);
        }
      } else {
        alert('Error al subir el archivo');
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      alert('URL copiada al portapapeles');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('URL copiada al portapapeles');
    }
  };

  const deleteFile = async (fileId: string, filePath?: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este archivo?')) return;

    try {
      if (currentSource === 'supabase' && filePath) {
        // Delete from Supabase Storage
        const { error } = await supabase.storage
          .from(currentBucket)
          .remove([filePath]);

        if (error) throw error;
      }

      // Remove from local state
      setFiles(prev => prev.filter(file => file.id !== fileId));
      alert('Archivo eliminado exitosamente');
    } catch (error) {
      console.error('Error deleting file:', error);
      alert('Error al eliminar el archivo');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return <div className="p-4 md:p-6">Cargando archivos...</div>;
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="text-xl md:text-2xl font-bold">Gestión de Medios</h2>
        <div className="flex gap-3 w-full md:w-auto">
          {/* Bucket selector */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setCurrentBucket('media')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                currentBucket === 'media'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              📷 Media
            </button>
            <button
              onClick={() => setCurrentBucket('advertisements')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                currentBucket === 'advertisements'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              📢 Anuncios
            </button>
          </div>

          {/* Source selector */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setCurrentSource('supabase')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                currentSource === 'supabase'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Upload size={16} className="inline mr-1" />
              Supabase
            </button>
          </div>

          {currentSource === 'supabase' && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className={`bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 cursor-pointer flex items-center gap-2 w-full md:w-auto justify-center ${
                  uploading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <Upload size={20} />
                {uploading ? 'Subiendo...' : 'Subir Imagen'}
              </label>
            </>
          )}
        </div>
      </div>

      <div className="mb-4 text-sm text-gray-600">
        <p>Formatos soportados: JPG, PNG, GIF, WebP (se suben a {currentBucket === 'media' ? 'articles/' : 'la raíz de '} {currentBucket})</p>
        <p>Tamaño máximo: 5MB por archivo (se comprimirá automáticamente)</p>
      </div>

      {selectedFile && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-semibold">Vista Previa</h3>
            <button
              onClick={() => setSelectedFile(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          <div className="text-center">
            <img
              src={selectedFile.url}
              alt={selectedFile.name}
              className="max-w-full max-h-96 mx-auto rounded-lg shadow-md"
            />
            <div className="mt-4 space-y-2">
              <p className="font-medium">{selectedFile.name}</p>
              <p className="text-sm text-gray-600">
                Tamaño: {formatFileSize(selectedFile.size)} | Tipo: {selectedFile.type}
              </p>
              <p className="text-sm text-gray-600">
                Subido: {new Date(selectedFile.uploaded_at).toLocaleString()}
              </p>
              <div className="flex justify-center gap-2 mt-4">
                <button
                  onClick={() => copyToClipboard(selectedFile.url)}
                  className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 flex items-center gap-1"
                >
                  <Copy size={14} />
                  Copiar URL
                </button>
                <a
                  href={selectedFile.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 flex items-center gap-1"
                >
                  <Eye size={14} />
                  Ver Original
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">
            {currentSource === 'supabase'
              ? `${currentBucket === 'media' ? 'Imágenes de artículos' : 'Archivos de anuncios'} (${files.length})`
              : `Archivos en Google Drive (${googleDriveFiles.length})`
            }
          </h3>
        </div>

        {currentSource === 'supabase' ? (
          files.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Image size={48} className="mx-auto mb-4 opacity-50" />
              <p>No hay archivos subidos aún</p>
              <p className="text-sm">Haz clic en "Subir Imagen" para comenzar</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
              {files.map((file) => (
                <div key={file.id} className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                  <div className="aspect-video bg-gray-100 relative">
                    <img
                      src={file.url}
                      alt={file.name}
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => setSelectedFile(file)}
                    />
                    <div className="absolute top-2 right-2 flex gap-1">
                      <button
                        onClick={() => copyToClipboard(file.url)}
                        className="bg-black bg-opacity-50 text-white p-1 rounded hover:bg-opacity-70"
                        title="Copiar URL"
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        onClick={() => deleteFile(file.id, file.path)}
                        className="bg-red-600 bg-opacity-80 text-white p-1 rounded hover:bg-opacity-100"
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="font-medium text-sm truncate" title={file.name}>
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatFileSize(file.size)} • {new Date(file.uploaded_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          !isGoogleDriveAuthenticated ? (
            <div className="p-8 text-center text-gray-500">
              <Cloud size={48} className="mx-auto mb-4 opacity-50" />
              <p>No conectado a Google Drive</p>
              <p className="text-sm">Haz clic en "Conectar Google Drive" para acceder a tus imágenes</p>
            </div>
          ) : loadingGoogleDrive ? (
            <div className="p-8 text-center text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p>Cargando archivos de Google Drive...</p>
            </div>
          ) : googleDriveFiles.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <HardDrive size={48} className="mx-auto mb-4 opacity-50" />
              <p>No se encontraron imágenes en Google Drive</p>
              <p className="text-sm">Sube algunas imágenes a tu Google Drive</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
              {googleDriveFiles.map((file: GoogleDriveFile) => (
                <div key={file.id} className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                  <div className="aspect-video bg-gray-100 relative">
                    <img
                      src={file.thumbnailLink}
                      alt={file.name}
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => copyToClipboard(file.webContentLink)}
                    />
                    <div className="absolute top-2 right-2">
                      <button
                        onClick={() => copyToClipboard(file.webContentLink)}
                        className="bg-black bg-opacity-50 text-white p-1 rounded hover:bg-opacity-70"
                        title="Copiar URL de Google Drive"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="font-medium text-sm truncate" title={file.name}>
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatFileSize(parseInt(file.size))} • Google Drive
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
};