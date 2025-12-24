/**
 * Sistema de Caché para Artículos
 * Mantiene los artículos en memoria para evitar llamadas excesivas a la base de datos
 */

import type { CombinedArticle } from '../hooks/useArticles';

interface CacheEntry {
  data: CombinedArticle[];
  timestamp: number;
  totalCount: number;
}

interface CacheKey {
  category?: string;
  page: number;
  pageSize: number;
}

class ArticlesCache {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly TTL = 5 * 60 * 1000; // 5 minutos de tiempo de vida
  private readonly MAX_ENTRIES = 50; // Máximo de entradas en caché

  /**
   * Genera una clave única para el caché basada en los parámetros
   */
  private generateKey(params: CacheKey): string {
    return `${params.category || 'all'}_${params.page}_${params.pageSize}`;
  }

  /**
   * Verifica si una entrada del caché aún es válida
   */
  private isValid(entry: CacheEntry): boolean {
    const now = Date.now();
    return now - entry.timestamp < this.TTL;
  }

  /**
   * Obtiene datos del caché si están disponibles y válidos
   */
  get(params: CacheKey): { data: CombinedArticle[]; totalCount: number } | null {
    const key = this.generateKey(params);
    const entry = this.cache.get(key);

    if (!entry) {
      console.log('[ArticlesCache] ❌ Cache miss para:', key);
      return null;
    }

    if (!this.isValid(entry)) {
      console.log('[ArticlesCache] ⏰ Cache expirado para:', key);
      this.cache.delete(key);
      return null;
    }

    console.log('[ArticlesCache] ✅ Cache hit para:', key, '- Artículos:', entry.data.length);
    return { data: entry.data, totalCount: entry.totalCount };
  }

  /**
   * Guarda datos en el caché
   */
  set(params: CacheKey, data: CombinedArticle[], totalCount: number): void {
    const key = this.generateKey(params);
    
    // Si el caché está lleno, eliminar la entrada más antigua
    if (this.cache.size >= this.MAX_ENTRIES) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        console.log('[ArticlesCache] 🗑️ Eliminando entrada antigua del caché:', firstKey);
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      totalCount,
    });

    console.log('[ArticlesCache] 💾 Guardado en caché:', key, '- Artículos:', data.length);
  }

  /**
   * Invalida todas las entradas del caché
   */
  invalidateAll(): void {
    console.log('[ArticlesCache] 🧹 Limpiando todo el caché');
    this.cache.clear();
  }

  /**
   * Invalida entradas específicas por categoría
   */
  invalidateCategory(category?: string): void {
    const keysToDelete: string[] = [];
    const searchPrefix = category || 'all';

    for (const key of this.cache.keys()) {
      if (key.startsWith(searchPrefix)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => {
      console.log('[ArticlesCache] 🗑️ Invalidando caché para:', key);
      this.cache.delete(key);
    });
  }

  /**
   * Obtiene estadísticas del caché
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Limpia entradas expiradas del caché
   */
  cleanup(): void {
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (!this.isValid(entry)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => {
      console.log('[ArticlesCache] 🧹 Limpiando entrada expirada:', key);
      this.cache.delete(key);
    });

    if (keysToDelete.length > 0) {
      console.log(`[ArticlesCache] ✨ Limpieza completada. ${keysToDelete.length} entradas eliminadas`);
    }
  }
}

// Exportar instancia singleton
export const articlesCache = new ArticlesCache();

// Limpiar caché expirado cada 2 minutos
if (typeof window !== 'undefined') {
  setInterval(() => {
    articlesCache.cleanup();
  }, 2 * 60 * 1000);
}
