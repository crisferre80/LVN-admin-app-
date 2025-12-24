// Centraliza categorías, opciones para selects y mapeo de colores.
// Usar esta utilidad desde cualquier componente para garantizar consistencia.
export type CategoryColor = { border: string; bg: string; badge: string; footer: string; icon: string; pastelbg: string };

const COLORS: Record<string, CategoryColor> = {
  'Nacionales': { border: 'border-blue-600', bg: 'from-blue-50', badge: 'bg-blue-100 text-blue-800', footer: 'bg-gradient-to-r from-blue-400 to-blue-500', icon: 'text-blue-500', pastelbg: 'from-blue-100' },
  'Regionales': { border: 'border-blue-600', bg: 'from-blue-50', badge: 'bg-green-100 text-green-800', footer: 'bg-gradient-to-r from-blue-400 to-green-500', icon: 'text-green-500', pastelbg: 'from-green-100' },
  'Internacionales': { border: 'border-pink-600', bg: 'from-pink-50', badge: 'bg-pink-100 text-pink-800', footer: 'bg-gradient-to-r from-pink-400 to-pink-500', icon: 'text-pink-500', pastelbg: 'from-pink-100' },
  'Economía': { border: 'border-yellow-600', bg: 'from-yellow-50', badge: 'bg-yellow-100 text-yellow-800', footer: 'bg-gradient-to-r from-yellow-600 to-yellow-500', icon: 'text-yellow-500', pastelbg: 'from-yellow-100' },
  'Deportes': { border: 'border-orange-600', bg: 'from-orange-50', badge: 'bg-orange-100 text-orange-800', footer: 'bg-gradient-to-r from-orange-400 to-orange-500', icon: 'text-orange-500', pastelbg: 'from-orange-100' },
  'Espectáculos': { border: 'border-purple-600', bg: 'from-purple-50', badge: 'bg-purple-100 text-purple-800', footer: 'bg-gradient-to-r from-purple-400 to-purple-500', icon: 'text-purple-500', pastelbg: 'from-purple-100' },
  'Medio Ambiente': { border: 'border-green-600', bg: 'from-green-50', badge: 'bg-green-100 text-green-800', footer: 'bg-gradient-to-r from-green-400 to-green-500', icon: 'text-green-500', pastelbg: 'from-green-100' },
  'Opinión': { border: 'border-indigo-600', bg: 'from-indigo-50', badge: 'bg-indigo-100 text-indigo-800', footer: 'bg-gradient-to-r from-indigo-400 to-indigo-500', icon: 'text-indigo-500', pastelbg: 'from-indigo-100' },
  'Agro': { border: 'border-emerald-600', bg: 'from-emerald-50', badge: 'bg-emerald-100 text-emerald-800', footer: 'bg-gradient-to-r from-emerald-400 to-emerald-500', icon: 'text-emerald-500', pastelbg: 'from-emerald-100' },
  'Tecnología': { border: 'border-cyan-600', bg: 'from-cyan-50', badge: 'bg-cyan-100 text-cyan-800', footer: 'bg-gradient-to-r from-cyan-400 to-cyan-500', icon: 'text-cyan-500', pastelbg: 'from-cyan-100' },
  'Salud': { border: 'border-red-600', bg: 'from-red-50', badge: 'bg-red-100 text-red-800', footer: 'bg-gradient-to-r from-red-400 to-red-500', icon: 'text-red-500', pastelbg: 'from-red-100' },
  'Cultura': { border: 'border-violet-600', bg: 'from-violet-50', badge: 'bg-violet-100 text-violet-800', footer: 'bg-gradient-to-r from-violet-400 to-violet-500', icon: 'text-violet-500', pastelbg: 'from-violet-100' },
  'Misceláneas': { border: 'border-slate-600', bg: 'from-slate-50', badge: 'bg-slate-100 text-slate-800', footer: 'bg-gradient-to-r from-slate-400 to-slate-500', icon: 'text-slate-500', pastelbg: 'from-slate-100' },
  'Cine': { border: 'border-rose-600', bg: 'from-rose-50', badge: 'bg-rose-100 text-rose-800', footer: 'bg-gradient-to-r from-rose-400 to-rose-500', icon: 'text-rose-500', pastelbg: 'from-rose-100' },
  'Educación': { border: 'border-amber-600', bg: 'from-amber-50', badge: 'bg-amber-100 text-amber-800', footer: 'bg-gradient-to-r from-amber-400 to-amber-500', icon: 'text-amber-500', pastelbg: 'from-amber-100' },
  'Turismo': { border: 'border-teal-600', bg: 'from-teal-50', badge: 'bg-teal-100 text-teal-800', footer: 'bg-gradient-to-r from-teal-400 to-teal-500', icon: 'text-teal-500', pastelbg: 'from-teal-100' },
  'Local': { border: 'border-teal-600', bg: 'from-teal-50', badge: 'bg-teal-100 text-teal-800', footer: 'bg-gradient-to-r from-teal-400 to-teal-500', icon: 'text-teal-500', pastelbg: 'from-teal-100' },
  'Clasificados': { border: 'border-amber-600', bg: 'from-amber-50', badge: 'bg-amber-100 text-amber-800', footer: 'bg-gradient-to-r from-amber-400 to-amber-500', icon: 'text-amber-500', pastelbg: 'from-amber-100' },
  'Noticias de la Gente': { border: 'border-emerald-600', bg: 'from-emerald-50', badge: 'bg-emerald-100 text-emerald-800', footer: 'bg-gradient-to-r from-emerald-400 to-emerald-500', icon: 'text-emerald-500', pastelbg: 'from-emerald-100' },
  'Política': { border: 'border-red-700', bg: 'from-red-50', badge: 'bg-red-100 text-red-800', footer: 'bg-gradient-to-r from-red-600 to-red-700', icon: 'text-red-500', pastelbg: 'from-red-100' },
  'Policiales': { border: 'border-red-600', bg: 'from-red-50', badge: 'bg-red-100 text-red-800', footer: 'bg-gradient-to-r from-red-500 to-red-600', icon: 'text-red-500', pastelbg: 'from-red-100' },
  'Ciencia': { border: 'border-cyan-700', bg: 'from-cyan-50', badge: 'bg-cyan-100 text-cyan-800', footer: 'bg-gradient-to-r from-cyan-400 to-cyan-700', icon: 'text-cyan-500', pastelbg: 'from-cyan-100' }
};

const ALIASES: Record<string, string> = {
  'espectaculos': 'Espectáculos',
  'tecnologia': 'Tecnología',
  'tecnológica': 'Tecnología',
  'tecnología': 'Tecnología',
  'politica': 'Política',
  'politíca': 'Política',
  'policiales': 'Policiales',
  'clasificados': 'Clasificados',
  'noticias de la gente': 'Noticias de la Gente',
  'miscelaneas': 'Misceláneas',
  'misceláneas': 'Misceláneas',
  'economia': 'Economía'
};

export const CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'Nacionales', label: 'Nacionales' },
  { value: 'Regionales', label: 'Regionales' },
  { value: 'Internacionales', label: 'Internacionales' },
  { value: 'Política', label: 'Política' },
  { value: 'Economía', label: 'Economía' },
  { value: 'Clasificados', label: 'Clasificados' },
  { value: 'Deportes', label: 'Deportes' },
  { value: 'Espectáculos', label: 'Espectáculos' },
  { value: 'Medio Ambiente', label: 'Medio Ambiente' },
  { value: 'Opinión', label: 'Opinión' },
  { value: 'Agro', label: 'Agro' },
  { value: 'Policiales', label: 'Policiales' },
  { value: 'Tecnología', label: 'Tecnología' },
  { value: 'Salud', label: 'Salud' },
  { value: 'Cultura', label: 'Cultura' },
  { value: 'Misceláneas', label: 'Misceláneas' },
  { value: 'Cine', label: 'Cine' },
  { value: 'Educación', label: 'Educación' },
  { value: 'Turismo', label: 'Turismo' },
  { value: 'Noticias de la Gente', label: 'Noticias de la Gente' },
  { value: 'Ciencia', label: 'Ciencia' }
];

export function normalizeCategory(input?: string | null): string {
  if (!input) return 'Nacionales';
  const trimmed = input.trim();
  const key = trimmed.toLowerCase();
  if (ALIASES[key]) return ALIASES[key];
  // Try to match canonical keys ignoring case
  for (const k of Object.keys(COLORS)) {
    if (k.toLowerCase() === key) return k;
  }
  // Fallback: return input as-is
  return trimmed;
}

export function getCategoryColor(category?: string | null): CategoryColor {
  const normalized = normalizeCategory(category);
  return COLORS[normalized] || {
    border: 'border-gray-500',
    bg: 'from-gray-50',
    badge: 'bg-gray-100 text-gray-800',
    footer: 'bg-gradient-to-r from-gray-400 to-gray-500',
    icon: 'text-gray-500',
    pastelbg: 'from-gray-100'
  };
}

// Nota: al actualizar la categoría de un artículo, emitir el evento DOM
// `articleCategoryChanged` con detalle { id, newCategory } para que otros
// componentes (detalle, carrusel, s, etc.) se sincronicen.
