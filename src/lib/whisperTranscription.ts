/**
 * Librería para transcribir audio con Whisper vía Netlify Functions
 */

export interface TranscriptionOptions {
  language?: string; // Código ISO 639-1 (ej: 'es', 'en')
  prompt?: string; // Contexto opcional para mejorar la transcripción
}

export interface TranscriptionResult {
  text: string;
}

/**
 * Transcribe un archivo de audio usando Whisper
 */
export async function transcribeAudio(
  audioFile: File,
  options: TranscriptionOptions = {}
): Promise<TranscriptionResult | null> {
  const {
    language = 'es',
    prompt
  } = options;

  try {
    console.log('🎙️ Transcribiendo audio con Whisper:', { 
      fileName: audioFile.name,
      size: audioFile.size,
      language 
    });

    const configuredBaseUrl = (import.meta.env.VITE_NETLIFY_FUNCTIONS_URL || '').trim();
    const fallbackBaseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const normalizedBaseUrl = (configuredBaseUrl || fallbackBaseUrl).replace(/\/$/, '');
    const netlifyFunctionUrl = normalizedBaseUrl
      ? `${normalizedBaseUrl}/.netlify/functions/transcribe-audio`
      : '/.netlify/functions/transcribe-audio';

    // Convertir archivo a base64
    const arrayBuffer = await audioFile.arrayBuffer();
    const base64Audio = btoa(
      new Uint8Array(arrayBuffer)
        .reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    const response = await fetch(netlifyFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audioData: base64Audio,
        fileName: audioFile.name,
        mimeType: audioFile.type,
        language,
        prompt
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('❌ Error transcribiendo audio:', errorData);
      throw new Error(`Error de Whisper: ${errorData.error || 'Unknown error'}`);
    }

    const data = await response.json();

    if (!data?.text) {
      throw new Error('No se recibió transcripción');
    }

    console.log('✅ Audio transcrito exitosamente');
    
    return {
      text: data.text
    };

  } catch (error: any) {
    console.error('❌ Error transcribiendo audio con Whisper:', error.message);
    throw error;
  }
}

/**
 * Verifica si un archivo es de audio válido
 */
export function isValidAudioFile(file: File): boolean {
  const validTypes = [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/m4a',
    'audio/ogg',
    'audio/webm',
    'audio/flac'
  ];
  
  return validTypes.some(type => file.type.includes(type)) || 
         /\.(mp3|wav|m4a|ogg|webm|flac)$/i.test(file.name);
}

/**
 * Formatea el tamaño de archivo
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
