/**
 * Monitor de Conexión a Base de Datos
 * Registra eventos de conexión y desconexión con Supabase
 */

import { supabase } from './supabase';

export interface ConnectionLog {
  timestamp: string;
  event: 'connected' | 'disconnected' | 'error' | 'reconnecting' | 'timeout';
  details?: string;
  errorCode?: string;
  duration?: number;
}

class DatabaseConnectionMonitor {
  private logs: ConnectionLog[] = [];
  private readonly MAX_LOGS = 100;
  private isConnected = false;
  private lastConnectionTime: number | null = null;
  private connectionCheckInterval: NodeJS.Timeout | null = null;
  private listeners: Set<(log: ConnectionLog) => void> = new Set();

  constructor() {
    this.initializeMonitoring();
  }

  /**
   * Inicializa el monitoreo de conexión
   */
  private initializeMonitoring(): void {
    console.log('[DBMonitor] 🚀 Iniciando monitoreo de conexión a base de datos');

    // Verificar conexión inicial
    this.checkConnection();

    // Verificar conexión cada 30 segundos
    this.connectionCheckInterval = setInterval(() => {
      this.checkConnection();
    }, 30000);

    // Escuchar eventos de realtime para detectar desconexiones
    this.monitorRealtimeConnection();
  }

  /**
   * Verifica el estado de la conexión a la base de datos
   */
  private async checkConnection(): Promise<void> {
    const startTime = Date.now();

    try {
      // Hacer una consulta simple para verificar la conexión
      const { error } = await supabase
        .from('articles')
        .select('id')
        .limit(1)
        .maybeSingle();

      const duration = Date.now() - startTime;

      if (error) {
        this.handleDisconnection(error.message, error.code);
      } else {
        this.handleConnection(duration);
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.handleError(error.message || 'Error desconocido', duration);
    }
  }

  /**
   * Monitorea la conexión de realtime
   */
  private monitorRealtimeConnection(): void {
    const channel = supabase.channel('connection-monitor');

    channel
      .on('system', { event: '*' }, (payload) => {
        console.log('[DBMonitor] 📡 Evento del sistema:', payload);
        
        if (payload.status === 'SUBSCRIBED') {
          this.addLog({
            timestamp: new Date().toISOString(),
            event: 'connected',
            details: 'Canal de realtime conectado',
          });
        } else if (payload.status === 'CLOSED') {
          this.addLog({
            timestamp: new Date().toISOString(),
            event: 'disconnected',
            details: 'Canal de realtime cerrado',
          });
        }
      })
      .subscribe((status) => {
        console.log('[DBMonitor] 📊 Estado de suscripción:', status);
      });
  }

  /**
   * Maneja eventos de conexión exitosa
   */
  private handleConnection(duration: number): void {
    if (!this.isConnected) {
      const log: ConnectionLog = {
        timestamp: new Date().toISOString(),
        event: 'connected',
        details: 'Conexión a base de datos establecida',
        duration,
      };
      
      this.isConnected = true;
      this.lastConnectionTime = Date.now();
      this.addLog(log);
      console.log('[DBMonitor] ✅ Conectado a la base de datos en', duration, 'ms');
    }
  }

  /**
   * Maneja eventos de desconexión
   */
  private handleDisconnection(message: string, errorCode?: string): void {
    const log: ConnectionLog = {
      timestamp: new Date().toISOString(),
      event: 'disconnected',
      details: message,
      errorCode,
    };

    this.isConnected = false;
    this.addLog(log);
    console.error('[DBMonitor] ❌ Desconectado de la base de datos:', message, errorCode);
  }

  /**
   * Maneja errores de conexión
   */
  private handleError(message: string, duration?: number): void {
    const log: ConnectionLog = {
      timestamp: new Date().toISOString(),
      event: 'error',
      details: message,
      duration,
    };

    this.addLog(log);
    console.error('[DBMonitor] ⚠️ Error de conexión:', message);
  }

  /**
   * Agrega un log al historial
   */
  private addLog(log: ConnectionLog): void {
    this.logs.unshift(log);

    // Mantener solo los últimos MAX_LOGS registros
    if (this.logs.length > this.MAX_LOGS) {
      this.logs = this.logs.slice(0, this.MAX_LOGS);
    }

    // Notificar a los listeners
    this.listeners.forEach(listener => listener(log));
  }

  /**
   * Obtiene todos los logs
   */
  getLogs(): ConnectionLog[] {
    return [...this.logs];
  }

  /**
   * Obtiene los últimos N logs
   */
  getRecentLogs(count: number = 10): ConnectionLog[] {
    return this.logs.slice(0, count);
  }

  /**
   * Obtiene el estado actual de la conexión
   */
  getConnectionStatus(): {
    isConnected: boolean;
    lastConnectionTime: string | null;
    uptime: number | null;
  } {
    return {
      isConnected: this.isConnected,
      lastConnectionTime: this.lastConnectionTime 
        ? new Date(this.lastConnectionTime).toISOString() 
        : null,
      uptime: this.lastConnectionTime 
        ? Date.now() - this.lastConnectionTime 
        : null,
    };
  }

  /**
   * Suscribe un listener para eventos de conexión
   */
  subscribe(listener: (log: ConnectionLog) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Limpia los logs
   */
  clearLogs(): void {
    console.log('[DBMonitor] 🧹 Limpiando logs de conexión');
    this.logs = [];
  }

  /**
   * Exporta los logs como JSON
   */
  exportLogs(): string {
    return JSON.stringify({
      status: this.getConnectionStatus(),
      logs: this.logs,
      exportedAt: new Date().toISOString(),
    }, null, 2);
  }

  /**
   * Destruye el monitor y limpia recursos
   */
  destroy(): void {
    console.log('[DBMonitor] 🛑 Deteniendo monitoreo de conexión');
    
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }

    this.listeners.clear();
  }
}

// Exportar instancia singleton
export const dbMonitor = new DatabaseConnectionMonitor();

// Hacer accesible desde la consola del navegador para debugging
if (typeof window !== 'undefined') {
  (window as any).dbMonitor = dbMonitor;
  console.log('[DBMonitor] 💡 Monitor disponible en window.dbMonitor');
  console.log('[DBMonitor] 💡 Comandos disponibles:');
  console.log('[DBMonitor]   - dbMonitor.getLogs() - Ver todos los logs');
  console.log('[DBMonitor]   - dbMonitor.getRecentLogs(n) - Ver últimos n logs');
  console.log('[DBMonitor]   - dbMonitor.getConnectionStatus() - Ver estado de conexión');
  console.log('[DBMonitor]   - dbMonitor.exportLogs() - Exportar logs como JSON');
}
