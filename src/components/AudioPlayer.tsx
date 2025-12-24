import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward } from 'lucide-react';

interface AudioPlayerProps {
  audioUrl: string;
  audioTitle?: string;
  autoPlay?: boolean;
  showControls?: boolean;
  className?: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioUrl,
  audioTitle = 'Audio del artículo',
  autoPlay = false,
  showControls = true,
  className = ''
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 2;
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Validar URL antes de intentar cargar
    if (!audioUrl || audioUrl.trim() === '') {
      console.error('❌ URL de audio vacía o inválida:', audioUrl);
      setIsLoading(false);
      setError('URL de audio no válida.');
      return;
    }

    // Reset states when URL changes
    setIsLoading(true);
    setError(null);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setRetryCount(0);

    // Reset audio element
    audio.pause();
    audio.currentTime = 0;
    audio.src = audioUrl;

    console.log('🎵 Configurando audio con URL:', audioUrl);

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
      setError(null);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleCanPlay = () => {
      console.log('✅ Audio puede reproducirse:', audioUrl);
      setIsLoading(false);
      setError(null);
      if (autoPlay) {
        audio.play().catch(err => {
          console.error('Error al reproducir automáticamente:', err);
          setError('Error al reproducir automáticamente');
        });
        setIsPlaying(true);
      }
    };

    const handleLoadStart = () => {
      console.log('🎵 Iniciando carga de audio:', audioUrl);
    };

    const handleLoadedData = () => {
      console.log('📊 Datos de audio cargados:', audioUrl);
    };

    const handleAbort = () => {
      console.log('🛑 Carga de audio abortada:', audioUrl);
      setIsLoading(false);
      setError('Carga de audio cancelada.');
    };

    const handleStalled = () => {
      console.log('⏳ Carga de audio detenida:', audioUrl);
      // No cambiamos el estado aquí, podría reanudarse
    };

    const handleError = (e: Event) => {
      console.error('❌ Error cargando audio:', e);
      console.error('URL del audio:', audioUrl);
      console.error('Elemento audio:', audio);
      console.error('Intentos restantes:', maxRetries - retryCount);

      if (retryCount < maxRetries) {
        console.log('🔄 Reintentando carga de audio...');
        setRetryCount(prev => prev + 1);
        // Reset audio element y reintentar
        setTimeout(() => {
          if (audio) {
            audio.load();
          }
        }, 1000);
      } else {
        setIsLoading(false);
        setError('Error al cargar el audio después de varios intentos. Verifica la URL.');
      }
    };

    // Timeout para evitar carga infinita (más tiempo para archivos de audio)
    const timeoutId = setTimeout(() => {
      if (isLoading) {
        console.error('⏰ Timeout: Audio no cargó en 30 segundos:', audioUrl);
        setIsLoading(false);
        setError('Tiempo de carga agotado. El audio podría no estar disponible.');
      }
    }, 30000); // 30 segundos timeout para archivos de audio

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('error', handleError);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('loadeddata', handleLoadedData);
    audio.addEventListener('abort', handleAbort);
    audio.addEventListener('stalled', handleStalled);

    return () => {
      clearTimeout(timeoutId);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('loadeddata', handleLoadedData);
      audio.removeEventListener('abort', handleAbort);
      audio.removeEventListener('stalled', handleStalled);
    };
  }, [audioUrl, autoPlay]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const time = parseFloat(e.target.value);
    audio.currentTime = time;
    setCurrentTime(time);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newVolume = parseFloat(e.target.value);
    audio.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isMuted) {
      audio.volume = volume;
      setIsMuted(false);
    } else {
      audio.volume = 0;
      setIsMuted(true);
    }
  };

  const skipTime = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = Math.max(0, Math.min(duration, audio.currentTime + seconds));
  };

  const retryLoad = () => {
    const audio = audioRef.current;
    if (!audio) return;

    console.log('🔄 Reintento manual de carga de audio:', audioUrl);
    setIsLoading(true);
    setError(null);
    setRetryCount(0);
    audio.load();
  };

  const formatTime = (time: number): string => {
    if (!isFinite(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!showControls) {
    return (
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        className="hidden"
      />
    );
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 shadow-sm ${className}`}>
      {error && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600 mb-2">{error}</p>
          <button
            onClick={retryLoad}
            className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
          >
            Reintentar carga
          </button>
        </div>
      )}
      
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center gap-2 flex-1">
          <button
            onClick={togglePlay}
            disabled={isLoading || !!error}
            className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : isPlaying ? (
              <Pause size={16} />
            ) : (
              <Play size={16} />
            )}
          </button>

          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900 truncate">{audioTitle}</p>
            <p className="text-xs text-gray-500">
              {error ? 'Error de carga' : formatTime(currentTime) + ' / ' + formatTime(duration)}
            </p>
          </div>
        </div>

        {!error && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => skipTime(-10)}
              className="p-1 text-gray-500 hover:text-gray-700"
              title="Retroceder 10s"
            >
              <SkipBack size={16} />
            </button>

            <button
              onClick={() => skipTime(10)}
              className="p-1 text-gray-500 hover:text-gray-700"
              title="Avanzar 10s"
            >
              <SkipForward size={16} />
            </button>

            <button
              onClick={toggleMute}
              className="p-1 text-gray-500 hover:text-gray-700"
            >
              {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>

            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-16 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        )}
      </div>

      {!error && (
        <input
          type="range"
          min="0"
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          disabled={isLoading}
        />
      )}

      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        className="hidden"
      />
    </div>
  );
};