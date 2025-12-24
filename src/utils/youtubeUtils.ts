// Utilidad global para sanitizar URLs de YouTube
export const sanitizeYouTubeUrl = (url: string | null | undefined): string => {
  // Manejar valores nulos, undefined o vacíos
  if (!url || typeof url !== 'string' || url.trim() === '') {
    console.warn('URL vacía, nula o inválida:', url);
    return '';
  }

  const trimmedUrl = url.trim();
  
  // Si es solo la URL raíz de YouTube, devolver cadena vacía
  if (trimmedUrl === 'https://www.youtube.com/' || 
      trimmedUrl === 'https://youtube.com/' || 
      trimmedUrl === 'https://www.youtube.com' ||
      trimmedUrl === 'youtube.com' ||
      trimmedUrl === 'www.youtube.com' ||
      trimmedUrl === 'https://youtu.be/' ||
      trimmedUrl === 'youtu.be') {
    console.warn('URL de YouTube raíz detectada, retornando vacío:', trimmedUrl);
    return '';
  }

  // Si ya es una URL embed, devolverla tal como está
  if (trimmedUrl.includes('/embed/')) {
    console.log('URL embed de YouTube ya válida:', trimmedUrl);
    return trimmedUrl;
  }

  // Patrones para extraer ID de video de YouTube
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([^&\n?#]+)/,     // youtube.com/watch?v=VIDEO_ID
    /(?:youtube\.com\/embed\/)([^&\n?#]+)/,       // youtube.com/embed/VIDEO_ID
    /(?:youtube\.com\/v\/)([^&\n?#]+)/,           // youtube.com/v/VIDEO_ID
    /(?:youtu\.be\/)([^&\n?#]+)/,                 // youtu.be/VIDEO_ID
    /(?:youtube\.com\/shorts\/)([^&\n?#]+)/,      // youtube.com/shorts/VIDEO_ID
    /(?:youtube\.com\/live\/)([^&\n?#]+)/         // youtube.com/live/VIDEO_ID
  ];

  // Intentar extraer ID de video
  for (const pattern of patterns) {
    const match = trimmedUrl.match(pattern);
    if (match && match[1]) {
      const videoId = match[1];
      // Validar que el ID del video tenga el formato correcto (11 caracteres alfanuméricos)
      if (/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
        const embedUrl = `https://www.youtube.com/embed/${videoId}`;
        console.log('URL de YouTube convertida:', trimmedUrl, '->', embedUrl);
        return embedUrl;
      } else {
        console.warn('ID de YouTube inválido encontrado:', videoId);
      }
    }
  }

  // Si es un ID de YouTube directo (11 caracteres)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmedUrl)) {
    const embedUrl = `https://www.youtube.com/embed/${trimmedUrl}`;
    console.log('ID de YouTube convertido a embed:', trimmedUrl, '->', embedUrl);
    return embedUrl;
  }

  // Si contiene youtube.com pero no pudimos extraer un ID válido, retornar vacío para evitar errores
  if (trimmedUrl.toLowerCase().includes('youtube.com') || trimmedUrl.toLowerCase().includes('youtu.be')) {
    console.warn('URL de YouTube inválida, no se pudo extraer ID:', trimmedUrl);
    return '';
  }

  // Si no es YouTube, devolver la URL original
  console.log('URL no es de YouTube, retornando original:', trimmedUrl);
  return trimmedUrl;
};