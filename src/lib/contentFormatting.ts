// @ts-ignore
import DOMPurify from 'dompurify';

const htmlEntitiesMap: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#x27;': "'",
  '&#x2F;': '/',
  '&#x60;': '`',
  '&#x3D;': '=',
  '&apos;': "'",
  '&hellip;': '…',
  '&mdash;': '—',
  '&ndash;': '–',
  '&lsquo;': "'",
  '&rsquo;': "'",
  '&ldquo;': '"',
  '&rdquo;': '"',
  '&bull;': '•',
  '&deg;': '°',
  '&frac12;': '½',
  '&frac14;': '¼',
  '&frac34;': '¾'
};

const allowedHtmlTags = new Set([
  'p',
  'br',
  'strong',
  'em',
  'b',
  'i',
  'u',
  'span',
  'blockquote',
  'ul',
  'ol',
  'li',
  'a',
  'img',
  'figure',
  'figcaption',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'code',
  'pre',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'div',
]);

const sanitizeHtmlConfig = {
  ALLOWED_TAGS: Array.from(allowedHtmlTags),
  ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'src', 'alt', 'title', 'width', 'height', 'class'],
  ALLOW_DATA_ATTR: false,
};

const sanitizeHtmlContent = (html: string): string => {
  if (!html) {
    return '';
  }

  return DOMPurify.sanitize(html, sanitizeHtmlConfig) as string;
};

export const normalizeTextContent = (content: string): string => {
  if (!content) return '';

  let normalized = content;

  normalized = normalized.replace(/\r\n/g, '\n');
  normalized = normalized.replace(/\r/g, '\n');
  normalized = normalized.replace(/[ \t]+/g, ' ');
  normalized = normalized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  normalized = normalized.replace(/[„“”]/g, '"');
  normalized = normalized.replace(/[‚‘’]/g, "'");
  normalized = normalized.replace(/–/g, '-');
  normalized = normalized.replace(/—/g, '-');
  normalized = normalized.replace(/…/g, '...');

  // Compact excessive blank lines but keep deliberate paragraph spacing
  normalized = normalized.replace(/\n{3,}/g, '\n\n');

  return normalized.trim();
};

export const convertHtmlToDocument = (htmlContent: string): string => {
  if (!htmlContent || htmlContent.trim() === '<p><br></p>' || htmlContent.trim() === '<p></p>') {
    return '';
  }

  let content = sanitizeHtmlContent(htmlContent);

  content = content.replace(/<style[\s\S]*?<\/style>/gi, '');
  content = content.replace(/<script[\s\S]*?<\/script>/gi, '');

  content = content.replace(/<\/p>\s*<p>/gi, '</p>\n\n<p>');
  content = content.replace(/<\/p><p>/gi, '</p>\n\n<p>');

  content = content.replace(/<br\s*\/?>(\s|&nbsp;)*<br\s*\/?>(?=<\/p>)/gi, '\n\n');
  content = content.replace(/<br\s*\/?>(\s|&nbsp;)*<br\s*\/?>(?!\n)/gi, '\n\n');
  content = content.replace(/<br\s*\/?>(?!\n)/gi, '\n');
  content = content.replace(/<\/p><p>/gi, '\n\n');
  content = content.replace(/<\/p>\s*$/gi, '\n');

  content = content.replace(/<\/?p[^>]*>/gi, '');

  for (const [entity, char] of Object.entries(htmlEntitiesMap)) {
    content = content.replace(new RegExp(entity, 'g'), char);
  }

  content = content.replace(/&#(\d+);/g, (_match, dec) => String.fromCharCode(parseInt(dec, 10)));
  content = content.replace(/&#x([0-9a-fA-F]+);/g, (_match, hex) => String.fromCharCode(parseInt(hex, 16)));

  content = content.replace(/&[a-zA-Z0-9#]+;/g, '');

  return normalizeTextContent(content);
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const convertDocumentToHtml = (documentContent: string): string => {
  if (!documentContent || documentContent.trim() === '') {
    return '<p><br></p>';
  }

  if (isHtmlContent(documentContent)) {
    const sanitized = sanitizeHtmlContent(documentContent);
    const normalized = normalizeHtmlContent(sanitized);
    return normalized || '<p><br></p>';
  }

  let content = normalizeTextContent(documentContent);
  if (!content) {
    return '<p><br></p>';
  }

  const paragraphs = content
    .split(/\n\s*\n/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean);

  let html = '';

  if (paragraphs.length > 1) {
    html = paragraphs
      .map(paragraph => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
      .join('');
  } else {
    const sentenceSplit = content
      .split(/(?<=\.)\s+(?=[A-ZÁÉÍÓÚÑ])|(?<=\.|\?|!)\s*$/)
      .map(part => part.trim())
      .filter(Boolean);

    if (sentenceSplit.length > 1) {
      const grouped: string[] = [];
      sentenceSplit.forEach((sentence, index) => {
        const targetIndex = Math.floor(index / 2);
        if (!grouped[targetIndex]) {
          grouped[targetIndex] = sentence;
        } else {
          grouped[targetIndex] += ` ${sentence}`;
        }
      });

      html = grouped
        .map(paragraph => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
        .join('');
    } else {
      const escaped = escapeHtml(content).replace(/\n/g, '<br>');
      html = `<p>${escaped}</p>`;
    }
  }

  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/<p><br><\/p>/g, '');

  return html || '<p><br></p>';
};

export const isHtmlContent = (value: string): boolean => /<[^>]*>/.test(value);

export const normalizeHtmlContent = (content: string): string => {
  if (!content) return content;

  let html = sanitizeHtmlContent(content);

  // Remove inline styles to prevent conflicts
  html = html.replace(/ style="[^"]*"/gi, '');

  html = html.replace(/<div(\s[^>]*)?>/gi, '<p$1>');
  html = html.replace(/<\/div>/gi, '</p>');
  html = html.replace(/(<br\s*\/?>(\s|&nbsp;)*?){2,}/gi, '</p><p>');

  // Fix nested p tags
  html = html.replace(/<p>\s*<p([^>]*)>/gi, '<p$1>');
  html = html.replace(/<\/p>\s*<\/p>/gi, '</p>');

  if (!/<(p|ul|ol|blockquote|h[1-6]|figure|table)[^>]*>/i.test(html)) {
    html = `<p>${html}</p>`;
  }

  html = html.replace(/<p[^>]*>\s*<\/p>/gi, '');

  return html;
};

export const prepareContentForDisplay = (content: string): string => {
  if (!content) {
    return '<p><br></p>';
  }

  try {
    if (isHtmlContent(content)) {
      // Para contenido HTML, solo sanitizar mínimamente sin remover clases o estilos
      return sanitizeHtmlContent(content);
    } else {
      return convertDocumentToHtml(content);
    }
  } catch (error) {
    console.error('Error procesando contenido:', error);
    // Fallback: devolver contenido sin procesar si es HTML, o convertir mínimamente
    if (isHtmlContent(content)) {
      return content;
    } else {
      return `<p>${content.replace(/\n/g, '<br>')}</p>`;
    }
  }
};

export { sanitizeHtmlContent };
