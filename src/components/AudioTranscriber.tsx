import { useState, useRef } from 'react';
import { Mic, Upload, FileAudio, AlertCircle, CheckCircle, Copy } from 'lucide-react';
import { transcribeAudio, isValidAudioFile, formatFileSize } from '../lib/whisperTranscription';

interface AudioTranscriberProps {
  onTranscriptionComplete?: (text: string) => void;
}

export default function AudioTranscriber({ onTranscriptionComplete }: AudioTranscriberProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState('es');
  const [contextPrompt, setContextPrompt] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!isValidAudioFile(file)) {
      setError('Formato de archivo no válido. Use MP3, WAV, M4A, OGG, WebM o FLAC');
      return;
    }

    // Whisper tiene límite de 25MB
    if (file.size > 25 * 1024 * 1024) {
      setError('El archivo es demasiado grande. Máximo 25MB');
      return;
    }

    setSelectedFile(file);
    setError(null);
    setTranscription(null);
  };

  const handleTranscribe = async () => {
    if (!selectedFile) return;

    setIsTranscribing(true);
    setError(null);
    setTranscription(null);

    try {
      const result = await transcribeAudio(selectedFile, {
        language,
        prompt: contextPrompt || undefined
      });

      if (result) {
        setTranscription(result.text);
        
        if (onTranscriptionComplete) {
          onTranscriptionComplete(result.text);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error al transcribir el audio');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleCopyTranscription = () => {
    if (transcription) {
      navigator.clipboard.writeText(transcription);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setTranscription(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center gap-2 mb-4">
        <Mic className="w-5 h-5 text-indigo-600" />
        <h3 className="text-lg font-semibold">Transcriptor de Audio Whisper</h3>
      </div>

      <div className="space-y-4">
        {!selectedFile ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Seleccionar archivo de audio
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-indigo-500 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm,.flac"
                onChange={handleFileSelect}
                className="hidden"
                id="audio-upload"
              />
              <label
                htmlFor="audio-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <Upload className="w-12 h-12 text-gray-400" />
                <span className="text-sm text-gray-600">
                  Click para seleccionar archivo de audio
                </span>
                <span className="text-xs text-gray-500">
                  MP3, WAV, M4A, OGG, WebM, FLAC (máx. 25MB)
                </span>
              </label>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg flex items-start gap-3">
              <FileAudio className="w-8 h-8 text-indigo-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-gray-500">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
              <button
                onClick={handleReset}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Cambiar
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Idioma del audio
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                disabled={isTranscribing}
              >
                <option value="es">Español</option>
                <option value="en">Inglés</option>
                <option value="pt">Portugués</option>
                <option value="fr">Francés</option>
                <option value="de">Alemán</option>
                <option value="it">Italiano</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contexto (opcional)
              </label>
              <input
                type="text"
                value={contextPrompt}
                onChange={(e) => setContextPrompt(e.target.value)}
                placeholder="Ej: Entrevista sobre política, nombres propios, términos técnicos..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                disabled={isTranscribing}
              />
              <p className="text-xs text-gray-500 mt-1">
                El contexto ayuda a mejorar la precisión de nombres propios y términos técnicos
              </p>
            </div>

            <button
              onClick={handleTranscribe}
              disabled={isTranscribing}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isTranscribing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Transcribiendo audio...
                </>
              ) : (
                <>
                  <Mic className="w-5 h-5" />
                  Transcribir Audio
                </>
              )}
            </button>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {transcription && (
          <div className="space-y-3">
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              <p className="text-sm text-green-700">Transcripción completada</p>
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Texto transcrito
              </label>
              <textarea
                value={transcription}
                onChange={(e) => setTranscription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                rows={10}
              />
              <button
                onClick={handleCopyTranscription}
                className="absolute top-8 right-2 p-2 text-gray-500 hover:text-gray-700 bg-white rounded"
                title="Copiar al portapapeles"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <div className="text-xs text-gray-500 space-y-1">
          <p>💡 <strong>Información:</strong></p>
          <ul className="list-disc list-inside ml-2">
            <li>Costo: ~$0.006 USD por minuto de audio</li>
            <li>Tamaño máximo: 25MB</li>
            <li>Formatos: MP3, WAV, M4A, OGG, WebM, FLAC</li>
            <li>Whisper detecta automáticamente el idioma si no se especifica</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
