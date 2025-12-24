/**
 * Sistema de simulación inteligente de visitas para artículos
 * Las visitas aumentan gradualmente durante la semana y se detienen al final
 */

const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000; // 7 días en milisegundos

interface VisitSimulationConfig {
  publishedAt: string;
  baseVisits: number;
  isFeatured?: boolean;
}

/**
 * Calcula las visitas simuladas para un artículo basado en su antigüedad
 * @param config Configuración del artículo
 * @returns Número de visitas simuladas a agregar
 */
export function calculateSimulatedVisits(config: VisitSimulationConfig): number {
  const { publishedAt, baseVisits, isFeatured = false } = config;
  
  const publishDate = new Date(publishedAt);
  const now = new Date();
  const ageInMs = now.getTime() - publishDate.getTime();
  
  // Si el artículo tiene más de 7 días, no simular más visitas
  if (ageInMs > WEEK_IN_MS) {
    return 0;
  }
  
  // Calcular el progreso dentro de la semana (0 a 1)
  const weekProgress = Math.min(ageInMs / WEEK_IN_MS, 1);
  
  // Determinar el rango de visitas basado en si es destacado
  // Números más realistas y creíbles para un diario local
  const minVisits = isFeatured ? 80 : 25;
  const maxVisits = isFeatured ? 190 : 95;
  
  // Usar una curva logarítmica para crecimiento más natural
  // Los primeros días crecen más rápido, luego se desacelera
  const growthFactor = Math.log(1 + weekProgress * 9) / Math.log(10); // 0 a 1
  
  // Agregar variabilidad aleatoria para que cada artículo tenga números únicos
  const randomFactor = 0.8 + Math.random() * 0.4; // 0.8 a 1.2
  
  // Calcular visitas simuladas totales
  const simulatedTotal = Math.floor(
    (minVisits + (maxVisits - minVisits) * growthFactor) * randomFactor
  );
  
  // Retornar solo la diferencia con las visitas base
  return Math.max(0, simulatedTotal - baseVisits);
}

/**
 * Obtiene el incremento de visitas en tiempo real para animación
 * Solo incrementa si el artículo está dentro de la semana
 * @param publishedAt Fecha de publicación del artículo
 * @returns Número de visitas a incrementar (0 si ya pasó la semana)
 */
export function getRealtimeVisitIncrement(publishedAt: string): number {
  const publishDate = new Date(publishedAt);
  const now = new Date();
  const ageInMs = now.getTime() - publishDate.getTime();
  
  // Si pasó la semana, no incrementar
  if (ageInMs > WEEK_IN_MS) {
    return 0;
  }
  
  // Incrementos más pequeños mientras más viejo es el artículo
  const ageInDays = ageInMs / (24 * 60 * 60 * 1000);
  
  if (ageInDays < 1) {
    // Primer día: 0-2 visitas cada 15 segundos (más sutil)
    return Math.random() > 0.3 ? Math.floor(Math.random() * 2) + 1 : 0;
  } else if (ageInDays < 3) {
    // Días 2-3: 0-1 visitas (muy ocasional)
    return Math.random() > 0.6 ? 1 : 0;
  } else if (ageInDays < 7) {
    // Días 4-7: muy raramente incrementa
    return Math.random() > 0.85 ? 1 : 0;
  }
  
  return 0;
}

/**
 * Formatea el número de visitas con separadores de miles
 * @param visits Número de visitas
 * @returns String formateado (ej: "1.234")
 */
export function formatVisitsCount(visits: number): string {
  return visits.toLocaleString('es-AR');
}

/**
 * Calcula las visitas totales a mostrar (reales + simuladas)
 * @param config Configuración del artículo
 * @returns Número total de visitas a mostrar
 */
export function getTotalVisitsToDisplay(config: VisitSimulationConfig): number {
  const { baseVisits } = config;
  const simulated = calculateSimulatedVisits(config);
  return baseVisits + simulated;
}
