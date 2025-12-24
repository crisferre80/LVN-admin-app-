import { marked } from 'marked';

// Configurar marked para que maneje párrafos correctamente
marked.setOptions({
  breaks: false, // No convertir saltos de línea simples en <br>
  gfm: true,
});

// Función para convertir Markdown a HTML limpio para Quill
export function markdownToHtml(markdown: string): string {
  if (!markdown) return '';

  try {
    // Limpiar el markdown antes de convertir
    const cleanedMarkdown = markdown
      .replace(/\n{3,}/g, '\n\n') // Máximo dos saltos de línea
      .trim();

    // Dividir en párrafos primero
    const paragraphs = cleanedMarkdown.split(/\n\s*\n/).filter(p => p.trim());

    if (paragraphs.length === 0) {
      return '<p><br></p>';
    }

    // Convertir cada párrafo a HTML
    const htmlParagraphs = paragraphs.map(paragraph => {
      // Conversión manual básica de Markdown a HTML
      let html = paragraph
        // Encabezados (antes de negritas para evitar conflictos)
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        // Negritas
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Cursivas (después de negritas)
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        // Convertir saltos de línea simples en <br>
        .replace(/\n/g, '<br>');

      // Si ya es un encabezado, devolverlo tal cual
      if (html.startsWith('<h')) {
        return html;
      }

      // Envolver en párrafo
      return `<p>${html}</p>`;
    });

    return htmlParagraphs.join('');
  } catch (error) {
    console.error('Error convirtiendo Markdown a HTML:', error);
    // Fallback: conversión simple con párrafos separados
    const paragraphs = markdown.split(/\n\s*\n/).filter(p => p.trim());
    const htmlParagraphs = paragraphs.map(paragraph => {
      const simpleHtml = paragraph
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');
      return `<p>${simpleHtml}</p>`;
    });
    return htmlParagraphs.join('') || '<p><br></p>';
  }
}

// Función para limpiar HTML generado por IA antes de convertir a Markdown
export function cleanAIGeneratedContent(content: string): string {
  if (!content) return '';

  return content
    // Remover texto introductorio común de respuestas de IA
    .replace(/^Claro, aquí tienes[^\n]*\n?/i, '')
    .replace(/^Aquí tienes[^\n]*\n?/i, '')
    .replace(/^Te presento[^\n]*\n?/i, '')
    .replace(/^Esta es una[^\n]*\n?/i, '')
    .replace(/^Basado en[^\n]*\n?/i, '')
    .replace(/^Según la información[^\n]*\n?/i, '')
    // Remover separadores y texto antes/después
    .replace(/^---.*$/gm, '')
    // Remover texto conclusivo común
    .replace(/\n\*\*.*\*\*\s*$/, '')
    .replace(/\n¿Quieres que[^\n]*\?/i, '')
    .replace(/\n¿Te gustaría[^\n]*\?/i, '')
    .replace(/\n¿Necesitas[^\n]*\?/i, '')
    .replace(/\nSi tienes[^\n]*\./i, '')
    .replace(/\nPara cualquier[^\n]*\./i, '')
    // Normalizar saltos de línea: máximo dos consecutivos
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    // Convertir puntos al final de línea en separadores de párrafo (líneas en blanco)
    .replace(/([.!?])\s*\n(?!\n)/g, '$1\n')
    // Asegurar que los párrafos estén separados por líneas en blanco
    .replace(/\n\s+/g, '\n') // Remover espacios al inicio de líneas
    .trim();
}