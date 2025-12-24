import React, { useState, useEffect, useRef } from 'react';
import { Upload, Music, Trash2, Play, Pause, Volume2, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AudioFile {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploaded_at: string;
  path: string;
}

interface AudioManagerProps {
  onAudioSelect?: (audioFile: AudioFile) => void;
  selectedAudio?: AudioFile | null;
  showPlayer?: boolean;
}

export const AudioManager: React.FC<AudioManagerProps> = ({
  onAudioSelect,
  selectedAudio,
  showPlayer = true
}) => {
  const [files, setFiles] = useState<AudioFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchAudioFiles();
  }, []);

  const fetchAudioFiles = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase.storage
        .from('media')
        .list('audio/', {
          limit: 100,
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (error) throw error;

      const audioFiles: AudioFile[] = (data || [])
        .filter(file => file.name && file.name.match(/\.(mp3|wav|ogg|m4a|aac)$/i))
        .map(file => ({
          id: file.id || file.name,
          name: file.name,
          url: supabase.storage.from('media').getPublicUrl(`audio/${file.name}`).data.publicUrl,
          type: `audio/${file.name.split('.').pop()}`,
          size: file.metadata?.size || 0,
          uploaded_at: file.created_at || new Date().toISOString(),
          path: `audio/${file.name}`
        }));

      setFiles(audioFiles);
    } catch (error) {
      console.error('Error fetching audio files:', error);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('audio/')) {
      alert('Solo se permiten archivos de audio (MP3, WAV, OGG, M4A, AAC)');
      return;
    }

    // Validate file size (max 50MB for audio)
    if (file.size > 50 * 1024 * 1024) {
      alert('El archivo es demasiado grande. Máximo 50MB');
      return;
    }

    setUploading(true);
    try {
      // Sanitize filename
      const sanitizeFileName = (name: string) => {
        return name
          .toLowerCase()
          .replace(/[^a-z0-9.-]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
      };

      const sanitizedFileName = sanitizeFileName(file.name);
      const fileName = `audio/${Date.now()}-${sanitizedFileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(fileName);

      const newFile: AudioFile = {
        id: `audio-${Date.now()}`,
        name: file.name,
        url: publicUrl,
        type: file.type,
        size: file.size,
        uploaded_at: new Date().toISOString(),
        path: fileName
      };

      setFiles(prev => [newFile, ...prev]);
      alert('Archivo de audio subido exitosamente');
    } catch (error) {
      console.error('Error uploading audio file:', error);
      alert('Error al subir el archivo de audio');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const deleteFile = async (fileId: string, filePath: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este archivo de audio?')) return;

    try {
      const { error } = await supabase.storage
        .from('media')
        .remove([filePath]);

      if (error) throw error;

      setFiles(prev => prev.filter(file => file.id !== fileId));
      alert('Archivo de audio eliminado exitosamente');
    } catch (error) {
      console.error('Error deleting audio file:', error);
      alert('Error al eliminar el archivo de audio');
    }
  };

  const playAudio = (audioUrl: string) => {
    if (playingAudio === audioUrl) {
      // Pause current audio
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingAudio(null);
      setCurrentTime(0);
      setDuration(0);
    } else {
      // Play new audio
      setPlayingAudio(audioUrl);
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.play();
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return <div className="p-4 md:p-6">Cargando archivos de audio...</div>;
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="text-xl md:text-2xl font-bold">Gestión de Audio</h2>
        <div className="flex gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            className="hidden"
            id="audio-upload"
          />
          <label
            htmlFor="audio-upload"
            className={`bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 cursor-pointer flex items-center gap-2 ${
              uploading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <Upload size={20} />
            {uploading ? 'Subiendo...' : 'Subir Audio'}
          </label>
        </div>
      </div>

      <div className="mb-4 text-sm text-gray-600">
        <p>Formatos soportados: MP3, WAV, OGG, M4A, AAC</p>
        <p>Tamaño máximo: 50MB por archivo</p>
      </div>

      {/* Audio Player */}
      {showPlayer && playingAudio && (
        <div className="bg-white p-4 rounded-lg shadow-md mb-6 border border-blue-200">
          <div className="flex items-center gap-4">
            <button
              onClick={() => playAudio(playingAudio)}
              className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700"
            >
              {playingAudio ? <Pause size={20} /> : <Play size={20} />}
            </button>

            <div className="flex-1">
              <input
                type="range"
                min="0"
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            <Volume2 size={20} className="text-gray-500" />
          </div>

          <audio
            ref={audioRef}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleTimeUpdate}
            onEnded={() => {
              setPlayingAudio(null);
              setCurrentTime(0);
            }}
            className="hidden"
          />
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">
            Archivos de Audio ({files.length})
          </h3>
        </div>

        {files.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Music size={48} className="mx-auto mb-4 opacity-50" />
            <p>No hay archivos de audio subidos aún</p>
            <p className="text-sm">Haz clic en "Subir Audio" para comenzar</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {files.map((file) => (
              <div key={file.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <button
                      onClick={() => playAudio(file.url)}
                      className={`p-2 rounded-full ${
                        playingAudio === file.url
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {playingAudio === file.url ? <Pause size={16} /> : <Play size={16} />}
                    </button>

                    <div className="flex-1">
                      <p className="font-medium text-sm">{file.name}</p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(file.size)} • {new Date(file.uploaded_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {onAudioSelect && (
                      <button
                        onClick={() => onAudioSelect(file)}
                        className={`px-3 py-1 rounded text-xs font-medium ${
                          selectedAudio?.id === file.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        }`}
                      >
                        {selectedAudio?.id === file.id ? 'Seleccionado' : 'Seleccionar'}
                      </button>
                    )}

                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-gray-500 hover:text-gray-700"
                      title="Descargar"
                    >
                      <Download size={16} />
                    </a>

                    <button
                      onClick={() => deleteFile(file.id, file.path)}
                      className="p-2 text-red-500 hover:text-red-700"
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};