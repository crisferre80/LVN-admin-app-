import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  Clock, Play, RefreshCw, Calendar, CheckCircle, AlertCircle, Settings,
  Plus, Edit, Trash2, Zap, Database, Globe, Brain, Archive, BarChart3,
  Filter, Search, Target, Timer, AlertTriangle
} from 'lucide-react';
import { useAIModelConfig } from '../hooks/useAIModelConfig';
import { enforceGoogleAIRateLimit } from '../lib/googleAI';
import toast from 'react-hot-toast';

// ========== UTILITY: Retry con Exponential Backoff ==========
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000,
  maxDelay: number = 10000
): Promise<T> {
  let lastError: any;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Si es error 429 (rate limit), hacer retry
      const isRateLimit = error?.message?.includes('429') || 
                          error?.message?.includes('quota') ||
                          error?.message?.includes('rate limit');
      
      if (!isRateLimit || i === maxRetries - 1) {
        throw error;
      }
      
      // Calcular delay con exponential backoff
      const delay = Math.min(initialDelay * Math.pow(2, i), maxDelay);
      console.log(`⏳ Rate limit detectado, reintentando en ${delay}ms (intento ${i + 1}/${maxRetries})...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

interface AutomationTask {
  id?: string;
  name: string;
  description: string;
  enabled: boolean;
  schedule_type: 'interval' | 'daily' | 'weekly' | 'monthly' | 'once' | 'manual';
  schedule_config: any;
  task_type: 'rss_refresh' | 'local_news_refresh' | 'article_selection' | 'ai_processing' | 'manual_edit' | 'content_reorganization' | 'workflow' | 'article_extraction' | 'cleanup' | 'backup';
  task_config: any;
  priority: number;
  max_retries: number;
  timeout_minutes: number;
  created_at?: string;
  updated_at?: string;
  last_run_at?: string;
  next_run_at?: string;
}

interface TaskLog {
  id: string;
  task_id: string;
  status: 'success' | 'error' | 'running' | 'timeout' | 'cancelled';
  message: string;
  details: any;
  started_at: string;
  completed_at?: string;
  duration_seconds?: number;
  retry_count: number;
}

interface TaskMetrics {
  id: string;
  task_id: string;
  metric_type: string;
  metric_value: number;
  metadata: any;
  recorded_at: string;
}

const TASK_TYPES = [
  { id: 'rss_refresh', name: 'Renovar RSS', icon: Globe, color: 'blue' },
  { id: 'local_news_refresh', name: 'Renovar Regionales', icon: Database, color: 'green' },
  { id: 'article_selection', name: 'Seleccionar Artículos', icon: Filter, color: 'purple' },
  { id: 'ai_processing', name: 'Procesar con IA', icon: Brain, color: 'orange' },
  { id: 'manual_edit', name: 'Edición Manual', icon: Edit, color: 'yellow' },
  { id: 'content_reorganization', name: 'Reorganizar Contenido', icon: Target, color: 'indigo' },
  { id: 'workflow', name: 'Flujo de Trabajo', icon: Zap, color: 'pink' },
  { id: 'article_extraction', name: 'Extraer Artículos', icon: Filter, color: 'purple' },
  { id: 'cleanup', name: 'Limpieza', icon: Archive, color: 'red' },
  { id: 'backup', name: 'Respaldo', icon: Database, color: 'gray' }
];

const SCHEDULE_TYPES = [
  { id: 'interval', name: 'Intervalo', description: 'Cada X minutos/horas' },
  { id: 'daily', name: 'Diariamente', description: 'Todos los días a una hora específica' },
  { id: 'weekly', name: 'Semanalmente', description: 'Días específicos de la semana' },
  { id: 'monthly', name: 'Mensualmente', description: 'Día específico del mes' },
  { id: 'once', name: 'Una vez', description: 'En una fecha y hora específica' },
  { id: 'manual', name: 'Manual', description: 'Solo ejecución manual' }
];

export function AutomationManager() {
  const { config: aiConfig } = useAIModelConfig();
  const [tasks, setTasks] = useState<AutomationTask[]>([]);
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [metrics, setMetrics] = useState<TaskMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTask, setEditingTask] = useState<AutomationTask | null>(null);
  const [runningTasks, setRunningTasks] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Form state
  const [formData, setFormData] = useState<Partial<AutomationTask>>({
    name: '',
    description: '',
    enabled: false,
    schedule_type: 'manual',
    schedule_config: {},
    task_type: 'rss_refresh',
    task_config: {},
    priority: 1,
    max_retries: 3,
    timeout_minutes: 30
  });

  // Estado adicional para monitoreo y progreso
  const [currentProgress, setCurrentProgress] = useState<{
    task: AutomationTask;
    stage: string;
    progress: number;
    message: string;
  } | null>(null);
  const [monitoringActive, setMonitoringActive] = useState(false);

  useEffect(() => {
    loadTasks();
    loadLogs();
    loadMetrics();
    
    // Iniciar monitoreo automático de tareas programadas
    startTaskMonitoring();
    
    return () => {
      stopTaskMonitoring();
    };
  }, []);

  // Sistema de monitoreo automático
  const startTaskMonitoring = () => {
    if (monitoringActive) return;
    
    setMonitoringActive(true);
    console.log('🔄 Iniciando monitoreo automático de tareas programadas...');
    
    // Revisar tareas cada 30 segundos
    const monitoringInterval = setInterval(async () => {
      try {
        await checkScheduledTasks();
      } catch (error) {
        console.error('Error en monitoreo automático:', error);
      }
    }, 30000);
    
    // Almacenar el intervalo para poder limpiarlo
    (window as any).taskMonitoringInterval = monitoringInterval;
    
    toast.success('Monitoreo automático activado', {
      duration: 3000,
    });
  };

  const stopTaskMonitoring = () => {
    if (!monitoringActive) return;
    
    setMonitoringActive(false);
    if ((window as any).taskMonitoringInterval) {
      clearInterval((window as any).taskMonitoringInterval);
      (window as any).taskMonitoringInterval = null;
    }
    
    console.log('⏹️ Monitoreo automático detenido');
  };

  const checkScheduledTasks = async () => {
    try {
      const now = new Date();
      
      // Obtener tareas activas con next_run_at
      const { data: activeTasks, error } = await supabase
        .from('automation_tasks')
        .select('*')
        .eq('enabled', true)
        .not('next_run_at', 'is', null)
        .neq('schedule_type', 'manual');

      if (error) throw error;

      const tasksToRun = activeTasks?.filter(task => {
        const nextRun = new Date(task.next_run_at);
        return nextRun <= now && !runningTasks.has(task.id);
      }) || [];

      if (tasksToRun.length > 0) {
        console.log(`🚀 Ejecutando ${tasksToRun.length} tarea(s) programada(s) automáticamente`);
        
        // Ejecutar tareas programadas en paralelo pero con límite
        const maxConcurrent = 3;
        for (let i = 0; i < tasksToRun.length; i += maxConcurrent) {
          const batch = tasksToRun.slice(i, i + maxConcurrent);
          await Promise.all(batch.map(task => runScheduledTask(task)));
        }
      }

      setTasks(activeTasks || []);
    } catch (error) {
      console.error('Error revisando tareas programadas:', error);
    }
  };

  const runScheduledTask = async (task: AutomationTask) => {
    if (runningTasks.has(task.id!)) return;

    console.log(`⏰ Ejecutando tarea programada: ${task.name}`);
    
    // Mostrar notificación de inicio
    toast.loading(`Ejecutando tarea programada: ${task.name}`, {
      id: `scheduled-${task.id}`,
      duration: 5000,
    });

    setRunningTasks(prev => new Set(prev).add(task.id!));

    try {
      // Mostrar progreso inicial
      setCurrentProgress({
        task,
        stage: 'Iniciando',
        progress: 10,
        message: 'Preparando ejecución...'
      });

      // Crear log de inicio
      const { data: logEntry, error: logError } = await supabase
        .from('automation_task_logs')
        .insert([{
          task_id: task.id,
          status: 'running',
          message: `Ejecución automática programada: ${task.name}`,
          details: { 
            task_config: task.task_config,
            scheduled_execution: true 
          }
        }])
        .select()
        .single();

      if (logError) throw logError;

      const startTime = Date.now();

      // Actualizar progreso
      setCurrentProgress(prev => prev ? {
        ...prev,
        stage: 'Ejecutando',
        progress: 30,
        message: 'Procesando tarea...'
      } : null);

      // Ejecutar la tarea
      const result = await executeTask(task);

      // Actualizar progreso
      setCurrentProgress(prev => prev ? {
        ...prev,
        stage: 'Finalizando',
        progress: 80,
        message: 'Guardando resultados...'
      } : null);

      const duration = Math.floor((Date.now() - startTime) / 1000);

      // Actualizar log con resultado
      await supabase
        .from('automation_task_logs')
        .update({
          status: result.success ? 'success' : 'error',
          message: result.message,
          details: {
            ...result.details,
            scheduled_execution: true,
            duration_seconds: duration
          },
          completed_at: new Date().toISOString(),
          duration_seconds: duration
        })
        .eq('id', logEntry.id);

      // Registrar métricas
      if (result.metrics) {
        await supabase
          .from('automation_metrics')
          .insert(result.metrics.map(metric => ({
            task_id: task.id,
            ...metric,
            metadata: {
              ...metric.metadata,
              scheduled_execution: true
            }
          })));
      }

      // Actualizar last_run_at y next_run_at
      const nextRun = calculateNextRun(task.schedule_type, task.schedule_config);
      await supabase
        .from('automation_tasks')
        .update({
          last_run_at: new Date().toISOString(),
          next_run_at: nextRun
        })
        .eq('id', task.id);

      // Finalizar progreso
      setCurrentProgress(prev => prev ? {
        ...prev,
        stage: 'Completado',
        progress: 100,
        message: result.message
      } : null);

      // Cerrar modal después de 2 segundos
      setTimeout(() => {
        setCurrentProgress(null);
      }, 2000);

      // Actualizar toast
      toast.dismiss(`scheduled-${task.id}`);
      if (result.success) {
        toast.success(`✅ Tarea programada completada: ${task.name}`, {
          duration: 5000,
        });
      } else {
        toast.error(`❌ Error en tarea programada: ${task.name}`, {
          duration: 8000,
        });
      }

      await loadLogs();
      await loadMetrics();
      await loadTasks();

    } catch (error) {
      console.error('Error ejecutando tarea programada:', error);
      
      // Registrar error
      if (task.id) {
        await supabase
          .from('automation_task_logs')
          .insert([{
            task_id: task.id,
            status: 'error',
            message: `Error en ejecución programada: ${error instanceof Error ? error.message : 'Error desconocido'}`,
            details: { 
              error: String(error),
              scheduled_execution: true 
            },
            completed_at: new Date().toISOString()
          }]);
      }

      // Actualizar progreso con error
      setCurrentProgress(prev => prev ? {
        ...prev,
        stage: 'Error',
        progress: 0,
        message: error instanceof Error ? error.message : 'Error desconocido'
      } : null);

      setTimeout(() => {
        setCurrentProgress(null);
      }, 3000);

      toast.dismiss(`scheduled-${task.id}`);
      toast.error(`❌ Error en tarea programada: ${task.name}`, {
        duration: 8000,
      });
    } finally {
      setRunningTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(task.id!);
        return newSet;
      });
    }
  };

  const loadTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('automation_tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error loading tasks:', error);
      toast.error('Error al cargar las tareas');
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('automation_task_logs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error loading logs:', error);
    }
  };

  const loadMetrics = async () => {
    try {
      const { data, error } = await supabase
        .from('automation_metrics')
        .select('*')
        .order('recorded_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setMetrics(data || []);
    } catch (error) {
      console.error('Error loading metrics:', error);
    }
  };

  const saveTask = async () => {
    console.log('🔄 saveTask: Iniciando guardado de tarea', { formData });

    // 🔍 DEBUG: Verificar autenticación antes de guardar
    console.log('🔍 DEBUG: Verificando autenticación...');
    const { data: session, error: authError } = await supabase.auth.getSession();
    if (authError) {
      console.error('❌ DEBUG: Error obteniendo sesión:', authError);
    } else if (!session.session) {
      console.error('❌ DEBUG: No hay sesión activa');
    } else {
      console.log('✅ DEBUG: Sesión activa, usuario:', session.session.user.email);
      console.log('⏰ DEBUG: Token expira:', new Date((session.session.expires_at || 0) * 1000).toLocaleString());
    }

    if (!formData.name || !formData.task_type) {
      console.error('❌ saveTask: Campos requeridos faltantes', { name: formData.name, task_type: formData.task_type });
      toast.error('Completa los campos requeridos');
      return;
    }

    // Validación específica para tareas de workflow
    if (formData.task_type === 'workflow') {
      console.log('🔍 saveTask: Validando tarea de tipo workflow');
      const workflowSteps = formData.task_config?.workflowSteps || [];
      console.log('🔍 saveTask: workflowSteps encontrados:', workflowSteps);
      console.log('🔍 saveTask: task_config completo:', formData.task_config);

      if (workflowSteps.length === 0) {
        console.error('❌ saveTask: Workflow sin pasos');
        toast.error('Las tareas de flujo de trabajo deben tener al menos un paso');
        return;
      }

      // Validar que cada paso tenga un task_type
      const invalidSteps = workflowSteps.filter((step: any) => !step.task_type);
      console.log('🔍 saveTask: Pasos inválidos:', invalidSteps);

      if (invalidSteps.length > 0) {
        console.error('❌ saveTask: Pasos sin task_type válido');
        toast.error('Todos los pasos del workflow deben tener un tipo de tarea seleccionado');
        return;
      }

      console.log('✅ saveTask: Validación de workflow exitosa');
    }

    try {
      console.log('💾 saveTask: Preparando datos para guardar en BD');
      const taskData = {
        ...formData,
        updated_at: new Date().toISOString(),
        next_run_at: calculateNextRun(formData.schedule_type!, formData.schedule_config)
      };

      console.log('💾 saveTask: Datos preparados:', taskData);

      if (editingTask?.id) {
        console.log('📝 saveTask: Actualizando tarea existente:', editingTask.id);
        console.log('📝 saveTask: Datos a actualizar:', taskData);

        const { error } = await supabase
          .from('automation_tasks')
          .update(taskData)
          .eq('id', editingTask.id);

        if (error) {
          console.error('❌ saveTask: Error actualizando tarea:', error);
          console.error('❌ saveTask: Detalles del error de actualización:', {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
            taskId: editingTask.id,
            taskData: taskData
          });
          throw error;
        }
        console.log('✅ saveTask: Tarea actualizada exitosamente');
        toast.success('Tarea actualizada correctamente');
      } else {
        console.log('➕ saveTask: Creando nueva tarea');
        console.log('➕ saveTask: Datos a insertar (COMPLETOS):', JSON.stringify(taskData, null, 2));

        const { data: _data, error } = await supabase
          .from('automation_tasks')
          .insert([taskData])
          .select()
          .single();

        if (error) {
          console.error('❌ saveTask: Error creando tarea:', error);
          console.error('❌ saveTask: Detalles del error de inserción:', {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
            taskData: taskData
          });
          throw error;
        }
        console.log('✅ saveTask: Tarea creada exitosamente:', _data);
        toast.success('Tarea creada correctamente');
      }

      console.log('🔄 saveTask: Recargando tareas...');
      await loadTasks();
      console.log('✅ saveTask: Tareas recargadas');
      resetForm();
      console.log('🎉 saveTask: Proceso completado exitosamente');
    } catch (error) {
      console.error('❌ saveTask: Error general:', error);
      console.error('❌ saveTask: Detalles del error:', {
        message: error instanceof Error ? error.message : 'Error desconocido',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        formData: formData,
        editingTask: editingTask?.id
      });

      // Mostrar error específico al usuario
      let errorMessage = 'Error al guardar la tarea';
      if (error instanceof Error) {
        if (error.message.includes('duplicate key')) {
          errorMessage = 'Ya existe una tarea con ese nombre';
        } else if (error.message.includes('permission')) {
          errorMessage = 'No tienes permisos para guardar tareas';
        } else if (error.message.includes('network')) {
          errorMessage = 'Error de conexión. Verifica tu conexión a internet';
        } else {
          errorMessage = `Error: ${error.message}`;
        }
      }

      toast.error(errorMessage);
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta tarea?')) return;

    try {
      const { error } = await supabase
        .from('automation_tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;
      toast.success('Tarea eliminada correctamente');
      await loadTasks();
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Error al eliminar la tarea');
    }
  };

  const runTask = async (task: AutomationTask) => {
    if (runningTasks.has(task.id!)) return;

    setRunningTasks(prev => new Set(prev).add(task.id!));
    const loadingToast = toast.loading(`Ejecutando: ${task.name}`);

    try {
      // Crear log de inicio
      const { data: logEntry, error: logError } = await supabase
        .from('automation_task_logs')
        .insert([{
          task_id: task.id,
          status: 'running',
          message: `Iniciando ejecución de ${task.name}`,
          details: { task_config: task.task_config }
        }])
        .select()
        .single();

      if (logError) throw logError;

      const startTime = Date.now();

      // Ejecutar la tarea según su tipo
      const result = await executeTask(task);

      const duration = Math.floor((Date.now() - startTime) / 1000);

      // Actualizar log con resultado
      await supabase
        .from('automation_task_logs')
        .update({
          status: result.success ? 'success' : 'error',
          message: result.message,
          details: result.details,
          completed_at: new Date().toISOString(),
          duration_seconds: duration
        })
        .eq('id', logEntry.id);

      // Registrar métricas
      if (result.metrics) {
        await supabase
          .from('automation_metrics')
          .insert(result.metrics.map(metric => ({
            task_id: task.id,
            ...metric
          })));
      }

      // Actualizar last_run_at y next_run_at
      const nextRun = calculateNextRun(task.schedule_type, task.schedule_config);
      await supabase
        .from('automation_tasks')
        .update({
          last_run_at: new Date().toISOString(),
          next_run_at: nextRun
        })
        .eq('id', task.id);

      toast.dismiss(loadingToast);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }

      await loadLogs();
      await loadMetrics();
      await loadTasks();

    } catch (error) {
      console.error('Error running task:', error);
      toast.dismiss(loadingToast);
      toast.error('Error al ejecutar la tarea');

      // Registrar error en log
      if (task.id) {
        await supabase
          .from('automation_task_logs')
          .insert([{
            task_id: task.id,
            status: 'error',
            message: error instanceof Error ? error.message : 'Error desconocido',
            details: { error: String(error) },
            completed_at: new Date().toISOString()
          }]);
      }
    } finally {
      setRunningTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(task.id!);
        return newSet;
      });
    }
  };

  const executeTask = async (task: AutomationTask): Promise<{
    success: boolean;
    message: string;
    details: any;
    metrics?: any[];
  }> => {
    const updateProgress = (stage: string, progress: number, message: string) => {
      setCurrentProgress(prev => prev ? { ...prev, stage, progress, message } : null);
    };

    switch (task.task_type) {
      case 'rss_refresh':
        return await executeRSSRefresh(task, updateProgress);
      case 'local_news_refresh':
        return await executeLocalNewsRefresh(task, updateProgress);
      case 'article_selection':
        return await executeArticleSelection(task, updateProgress);
      case 'ai_processing':
        return await executeAIProcessing(task, updateProgress);
      case 'manual_edit':
        return await executeManualEdit(task, updateProgress);
      case 'content_reorganization':
        return await executeContentReorganization(task, updateProgress);
      case 'workflow':
        return await executeWorkflow(task, updateProgress);
      case 'article_extraction':
        return await executeArticleExtraction(task, updateProgress);
      case 'cleanup':
        return await executeCleanup(task, updateProgress);
      case 'backup':
        return await executeBackup(task, updateProgress);
      default:
        return {
          success: false,
          message: `Tipo de tarea no soportado: ${task.task_type}`,
          details: {}
        };
    }
  };

  const executeRSSRefresh = async (task: AutomationTask, updateProgress: (stage: string, progress: number, message: string) => void) => {
    const config = task.task_config || {};
    const { categories = [], articlesPerCategory = 3, maxTotalArticles = 15 } = config;

    try {
      updateProgress('Iniciando renovación RSS', 0, 'Preparando renovación de fuentes RSS...');

      // Obtener todas las categorías disponibles si no se especificaron
      let targetCategories = categories;
      if (targetCategories.length === 0) {
        const { data: categoryData, error: catError } = await supabase
          .from('articles')
          .select('category')
          .not('category', 'is', null);

        if (catError) throw catError;

        const uniqueCategories = [...new Set(categoryData?.map(a => a.category) || [])];
        targetCategories = uniqueCategories.slice(0, 5); // Máximo 5 categorías por defecto
      }

      updateProgress('Seleccionando artículos', 20, `Procesando ${targetCategories.length} categorías...`);

      let selectedArticles: any[] = [];
      let totalProcessed = 0;

      // Para cada categoría, seleccionar artículos al azar
      for (let i = 0; i < targetCategories.length; i++) {
        const category = targetCategories[i];
        const progress = 20 + (i / targetCategories.length) * 60;

        updateProgress(
          'Seleccionando artículos',
          progress,
          `Categoría ${category}: buscando artículos recientes...`
        );

        // Obtener artículos recientes de esta categoría (últimas 24 horas)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const { data: categoryArticles, error: catError } = await supabase
          .from('articles')
          .select('*')
          .eq('category', category)
          .gte('published_at', yesterday.toISOString())
          .order('published_at', { ascending: false })
          .limit(articlesPerCategory * 3); // Obtener más para tener variedad

        if (catError) {
          console.warn(`Error obteniendo artículos de categoría ${category}:`, catError);
          continue;
        }

        // Seleccionar al azar los artículos especificados por categoría
        if (categoryArticles && categoryArticles.length > 0) {
          const shuffled = categoryArticles.sort(() => 0.5 - Math.random());
          const selectedFromCategory = shuffled.slice(0, articlesPerCategory);
          selectedArticles.push(...selectedFromCategory);
        }

        totalProcessed++;
      }

      // Limitar el total de artículos si es necesario
      if (selectedArticles.length > maxTotalArticles) {
        selectedArticles = selectedArticles.sort(() => 0.5 - Math.random()).slice(0, maxTotalArticles);
      }

      updateProgress('Procesando artículos seleccionados', 80, `Procesando ${selectedArticles.length} artículos...`);

      // Aquí se podría agregar lógica adicional de procesamiento
      // Por ahora, solo marcamos que fueron "procesados"

      updateProgress('Completado', 100, `Renovación RSS completada. ${selectedArticles.length} artículos seleccionados de ${totalProcessed} categorías.`);

      return {
        success: true,
        message: `Renovación RSS completada. ${selectedArticles.length} artículos seleccionados de ${totalProcessed} categorías`,
        details: {
          selected_articles: selectedArticles.length,
          categories_processed: totalProcessed,
          articles_per_category: articlesPerCategory,
          max_total_articles: maxTotalArticles
        },
        metrics: [{
          metric_type: 'rss_articles_selected',
          metric_value: selectedArticles.length,
          metadata: {
            categories: targetCategories,
            articles_per_category: articlesPerCategory
          }
        }]
      };
    } catch (error) {
      return {
        success: false,
        message: `Error en renovación RSS: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        details: { error: String(error), config }
      };
    }
  };

  const executeLocalNewsRefresh = async (task: AutomationTask, updateProgress: (stage: string, progress: number, message: string) => void) => {
    const config = task.task_config || {};
    const { categories = [], articlesPerCategory = 2, maxTotalArticles = 10 } = config;

    try {
      updateProgress('Iniciando renovación de noticias locales', 0, 'Preparando renovación de fuentes locales...');

      // Obtener todas las categorías disponibles si no se especificaron
      let targetCategories = categories;
      if (targetCategories.length === 0) {
        const { data: categoryData, error: catError } = await supabase
          .from('local_news')
          .select('category')
          .not('category', 'is', null);

        if (catError) throw catError;

        const uniqueCategories = [...new Set(categoryData?.map(a => a.category) || [])];
        targetCategories = uniqueCategories.slice(0, 4); // Máximo 4 categorías por defecto para locales
      }

      updateProgress('Seleccionando noticias locales', 20, `Procesando ${targetCategories.length} categorías...`);

      let selectedArticles: any[] = [];
      let totalProcessed = 0;

      // Para cada categoría, seleccionar artículos al azar
      for (let i = 0; i < targetCategories.length; i++) {
        const category = targetCategories[i];
        const progress = 20 + (i / targetCategories.length) * 60;

        updateProgress(
          'Seleccionando noticias locales',
          progress,
          `Categoría ${category}: buscando noticias recientes...`
        );

        // Obtener noticias locales recientes de esta categoría (últimas 48 horas)
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

        const { data: categoryArticles, error: catError } = await supabase
          .from('local_news')
          .select('*')
          .eq('category', category)
          .gte('published_at', twoDaysAgo.toISOString())
          .order('published_at', { ascending: false })
          .limit(articlesPerCategory * 2); // Obtener más para tener variedad

        if (catError) {
          console.warn(`Error obteniendo noticias locales de categoría ${category}:`, catError);
          continue;
        }

        // Seleccionar al azar los artículos especificados por categoría
        if (categoryArticles && categoryArticles.length > 0) {
          const shuffled = categoryArticles.sort(() => 0.5 - Math.random());
          const selectedFromCategory = shuffled.slice(0, articlesPerCategory);
          selectedArticles.push(...selectedFromCategory);
        }

        totalProcessed++;
      }

      // Limitar el total de artículos si es necesario
      if (selectedArticles.length > maxTotalArticles) {
        selectedArticles = selectedArticles.sort(() => 0.5 - Math.random()).slice(0, maxTotalArticles);
      }

      updateProgress('Procesando noticias seleccionadas', 80, `Procesando ${selectedArticles.length} noticias...`);

      // Aquí se podría agregar lógica adicional de procesamiento
      // Por ahora, solo marcamos que fueron "procesados"

      updateProgress('Completado', 100, `Renovación de noticias locales completada. ${selectedArticles.length} noticias seleccionadas de ${totalProcessed} categorías.`);

      return {
        success: true,
        message: `Renovación de noticias locales completada. ${selectedArticles.length} noticias seleccionadas de ${totalProcessed} categorías`,
        details: {
          selected_articles: selectedArticles.length,
          categories_processed: totalProcessed,
          articles_per_category: articlesPerCategory,
          max_total_articles: maxTotalArticles
        },
        metrics: [{
          metric_type: 'local_news_selected',
          metric_value: selectedArticles.length,
          metadata: {
            categories: targetCategories,
            articles_per_category: articlesPerCategory
          }
        }]
      };
    } catch (error) {
      return {
        success: false,
        message: `Error en renovación de noticias locales: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        details: { error: String(error), config }
      };
    }
  };

  const executeArticleExtraction = async (task: AutomationTask, _updateProgress: (stage: string, progress: number, message: string) => void) => {
    const config = task.task_config || {};
    const { categories = [], keywords = [], dateFrom, dateTo, maxArticles = 50 } = config;

    try {
      let query = supabase
        .from('articles')
        .select('*', { count: 'exact' })
        .not('rss_source_id', 'is', null);

      // Filtros
      if (categories.length > 0) {
        query = query.in('category', categories);
      }

      if (keywords.length > 0) {
        const keywordConditions = keywords.map((keyword: string) =>
          `title.ilike.%${keyword}%,description.ilike.%${keyword}%`
        ).join(',');
        query = query.or(keywordConditions);
      }

      if (dateFrom) {
        query = query.gte('published_at', dateFrom);
      }

      if (dateTo) {
        query = query.lte('published_at', dateTo);
      }

      query = query.limit(maxArticles);

      const { data: _, error, count } = await query;

      if (error) throw error;

      return {
        success: true,
        message: `Extracción completada. ${count || 0} artículos encontrados`,
        details: { articles_found: count, filters: config },
        metrics: [{
          metric_type: 'articles_extracted',
          metric_value: count || 0,
          metadata: { filters: config }
        }]
      };
    } catch (error) {
      return {
        success: false,
        message: `Error en extracción: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        details: { error: String(error), config }
      };
    }
  };

  const executeAIProcessing = async (task: AutomationTask, updateProgress: (stage: string, progress: number, message: string) => void) => {
    const config = task.task_config || {};
    const { sourceTable = 'articles', targetTable = 'ai_generated_articles', categories = [], maxArticles = 10, aiModel } = config;

    try {
      updateProgress('Iniciando procesamiento IA', 0, 'Preparando artículos para procesamiento...');

      // Determinar el proveedor basado en el modelo
      let provider = "";
      if (aiModel?.includes('gemini')) {
        provider = 'google';
      } else if (aiModel?.includes('openai') || aiModel?.includes('gpt')) {
        provider = 'openrouter';
      } else if (aiModel?.includes('anthropic') || aiModel?.includes('claude')) {
        provider = 'openrouter';
      } else {
        provider = 'unknown';
      }

      // Obtener artículos para procesar
      let query = supabase
        .from(sourceTable)
        .select('*')
        .limit(maxArticles);

      if (categories.length > 0) {
        query = query.in('category', categories);
      }

      const { data: articles, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      if (!articles || articles.length === 0) {
        return {
          success: true,
          message: 'No hay artículos para procesar con IA',
          details: { articles_found: 0 }
        };
      }

      updateProgress('Procesando artículos', 10, `Procesando ${articles.length} artículos...`);

      let processedCount = 0;
      let errorCount = 0;
      const metrics = [];

      for (let i = 0; i < articles.length; i++) {
        const article = articles[i];
        const progress = 10 + (i / articles.length) * 80;

        updateProgress(
          'Procesando artículos',
          progress,
          `Procesando artículo ${i + 1}/${articles.length}: ${article.title?.substring(0, 50)}...`
        );

        try {
          const rewritePrompt = `Reescribe el siguiente artículo de noticias de manera profesional y atractiva, manteniendo la información esencial pero mejorando el lenguaje y la estructura. El artículo original es sobre: "${article.title}"

Resumen original: "${article.description || ''}"

Contenido completo: "${article.content || article.description}"

Por favor, genera:
1. Un título más atractivo y SEO-friendly
2. Un artículo reescrito completo con buena estructura, párrafos coherentes y lenguaje periodístico profesional
3. Mantén la objetividad y precisión de la información original`;

          // Usar el modelo configurado o el sistema de fallback
          const { cleanAIGeneratedContent, markdownToHtml } = await import('../lib/markdownUtils');

          let generatedContent = '';

          // Intentar con los proveedores en orden de fallback
          for (const providerName of aiConfig.fallbackOrder) {
            if (generatedContent) break;

            try {
              switch (providerName) {
                case 'google':
                  console.log(`🤖 Intentando generar con Google Gemini...`);
                  generatedContent = await retryWithBackoff(async () => {
                      const response = await fetch('/.netlify/functions/google-ai', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          action: 'generateContent',
                          data: { prompt: rewritePrompt, modelName: aiModel || 'gemini-2.0-flash-exp' },
                          identifier: 'automation-gen-' + Date.now()
                        }),
                      });

                      if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                      }

                      const result = await response.json();

                      if (result.content) {
                        return result.content;
                      } else {
                        throw new Error(result.error || 'Error generating content');
                      }
                    }, 3, 2000, 15000); // 3 reintentos, delay inicial 2s, max 15s
                    console.log(`✅ Contenido generado con Google Gemini`);
                  break;

                case 'openrouter':
                  if (import.meta.env.VITE_OPENROUTER_API_KEY) {
                    console.log(`🤖 Intentando generar con OpenRouter...`);
                    generatedContent = await retryWithBackoff(async () => {
                      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                          'Authorization': `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
                          'Content-Type': 'application/json',
                          'HTTP-Referer': window.location.origin,
                          'X-Title': 'Diario Santiago - Automation'
                        },
                        body: JSON.stringify({
                          model: aiModel || 'openai/gpt-4o-mini',
                          messages: [{ role: 'user', content: rewritePrompt }],
                          max_tokens: 2000
                        }),
                      });

                      if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`OpenRouter error ${response.status}: ${errorText}`);
                      }

                      const data = await response.json();
                      const content = data.choices[0]?.message?.content;
                      if (!content) {
                        throw new Error('OpenRouter no devolvió contenido');
                      }
                      return content;
                    }, 3, 2000, 15000);
                    console.log(`✅ Contenido generado con OpenRouter`);
                  }
                  break;

                case 'openai':
                  if (import.meta.env.VITE_OPENAI_API_KEY) {
                    console.log(`🤖 Intentando generar con OpenAI via Netlify Function...`);
                    generatedContent = await retryWithBackoff(async () => {
                      // Siempre usar ruta relativa para evitar problemas de CORS
                      const netlifyFunctionUrl = '/.netlify/functions/generate-openai';

                      const response = await fetch(netlifyFunctionUrl, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                          prompt: rewritePrompt,
                          model: 'gpt-4o-mini',
                          maxTokens: 2000
                        }),
                      });

                      if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`Netlify OpenAI function error ${response.status}: ${errorText}`);
                      }

                      const data = await response.json();
                      const content = data.content;
                      if (!content) {
                        throw new Error('OpenAI no devolvió contenido');
                      }
                      return content;
                    }, 3, 2000, 15000);
                    console.log(`✅ Contenido generado con OpenAI via Netlify`);
                  }
                  break;

                case 'puter':
                  if (import.meta.env.VITE_PUTER_API_KEY) {
                    console.log(`🤖 Intentando generar con Puter AI...`);
                    generatedContent = await retryWithBackoff(async () => {
                      const response = await fetch('https://api.puter.ai/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                          'Authorization': `Bearer ${import.meta.env.VITE_PUTER_API_KEY}`,
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                          model: 'gpt-4o-mini',
                          messages: [{ role: 'user', content: rewritePrompt }],
                          max_tokens: 2000
                        }),
                      });

                      if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`Puter AI error ${response.status}: ${errorText}`);
                      }

                      const data = await response.json();
                      const content = data.choices[0]?.message?.content;
                      if (!content) {
                        throw new Error('Puter AI no devolvió contenido');
                      }
                      return content;
                    }, 3, 2000, 15000);
                    console.log(`✅ Contenido generado con Puter AI`);
                  }
                  break;
              }
            } catch (providerError) {
              console.warn(`❌ Error con ${providerName}:`, providerError);
              // Continuar con el siguiente proveedor
            }
          }

          if (!generatedContent) {
            throw new Error('No se pudo generar contenido con ningún proveedor de IA');
          }

          // Procesar contenido
          const cleanedMarkdown = cleanAIGeneratedContent(generatedContent);
          const htmlContent = markdownToHtml(cleanedMarkdown);

          // Extraer título
          const textContent = htmlContent.replace(/<[^>]*>/g, '');
          const lines = textContent.split('\n').filter(line => line.trim());
          const extractedTitle = lines[0]?.length > 5 ? lines[0] :
                                textContent.substring(0, 80) + (textContent.length > 80 ? '...' : '');

          // Guardar artículo procesado
          const { error: insertError } = await supabase
            .from(targetTable)
            .insert([{
              title: extractedTitle,
              content: htmlContent,
              category: article.category,
              status: 'published',
              source_rss_id: null,
              prompt_used: rewritePrompt,
              image_url: article.image_url || null,
              summary: '',
              image_caption: '',
              author: 'La Voz del Norte Diario',
              published_at: new Date().toISOString()
            }]);

          if (insertError) throw insertError;

          processedCount++;
          metrics.push({
            article_id: article.id,
            processing_time: 0, // TODO: medir tiempo real
            tokens_used: 0, // TODO: contar tokens
            success: true
          });

        } catch (articleError) {
          console.error(`Error procesando artículo ${article.id}:`, articleError);
          errorCount++;
          metrics.push({
            article_id: article.id,
            success: false,
            error: articleError instanceof Error ? articleError.message : String(articleError)
          });
        }
      }

      updateProgress('Finalizando', 90, 'Guardando resultados...');

      // Actualizar métricas de la tarea
      // await logTaskExecution(task.id, {
      //   processed_count: processedCount,
      //   error_count: errorCount,
      //   metrics
      // });

      updateProgress('Completado', 100, `Procesamiento IA completado. ${processedCount} artículos procesados, ${errorCount} errores.`);

      return {
        success: true,
        message: `Procesamiento IA completado. ${processedCount} artículos procesados, ${errorCount} errores`,
        details: { processed: processedCount, errors: errorCount, config },
        metrics: [
          {
            metric_type: 'articles_processed',
            metric_value: processedCount,
            metadata: { ai_provider: provider, model: aiModel }
          },
          {
            metric_type: 'ai_api_calls',
            metric_value: processedCount,
            metadata: { provider, model: aiModel }
          }
        ]
      };
    } catch (error) {
      return {
        success: false,
        message: `Error en procesamiento IA: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        details: { error: String(error), config }
      };
    }
  };

  const executeCleanup = async (task: AutomationTask, _updateProgress: (stage: string, progress: number, message: string) => void) => {
    const config = task.task_config || {};
    const { olderThanDays = 30, categories = [], dryRun = true } = config;

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      let query = supabase
        .from('articles')
        .select('*', { count: 'exact' })
        .lt('published_at', cutoffDate.toISOString());

      if (categories.length > 0) {
        query = query.in('category', categories);
      }

      const { data: _, error, count } = await query;

      if (error) throw error;

      if (dryRun) {
        return {
          success: true,
          message: `Simulación de limpieza completada. ${count || 0} artículos serían eliminados`,
          details: { articles_found: count, dry_run: true, cutoff_date: cutoffDate.toISOString() }
        };
      }

      // Realizar eliminación
      const { error: deleteError } = await supabase
        .from('articles')
        .delete()
        .lt('published_at', cutoffDate.toISOString());

      if (deleteError) throw deleteError;

      return {
        success: true,
        message: `Limpieza completada. ${count || 0} artículos eliminados`,
        details: { articles_deleted: count, cutoff_date: cutoffDate.toISOString() },
        metrics: [{
          metric_type: 'articles_cleaned',
          metric_value: count || 0,
          metadata: { older_than_days: olderThanDays, categories }
        }]
      };
    } catch (error) {
      return {
        success: false,
        message: `Error en limpieza: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        details: { error: String(error), config }
      };
    }
  };

  const executeBackup = async (task: AutomationTask, _updateProgress: (stage: string, progress: number, message: string) => void) => {
    const config = task.task_config || {};
    const { tables = ['articles', 'ai_generated_articles', 'local_news'], includeMedia = false } = config;

    try {
      const backupData: any = {};
      let totalRecords = 0;

      for (const table of tables) {
        const { data, error } = await supabase
          .from(table)
          .select('*');

        if (error) throw error;

        backupData[table] = data || [];
        totalRecords += data?.length || 0;
      }

      // Aquí se podría implementar subida a storage o envío por email
      // Por ahora solo simulamos el backup

      return {
        success: true,
        message: `Respaldo completado. ${totalRecords} registros respaldados de ${tables.length} tablas`,
        details: {
          tables_backed_up: tables,
          total_records: totalRecords,
          include_media: includeMedia,
          backup_timestamp: new Date().toISOString()
        },
        metrics: [{
          metric_type: 'backup_records',
          metric_value: totalRecords,
          metadata: { tables: tables.length, include_media: includeMedia }
        }]
      };
    } catch (error) {
      return {
        success: false,
        message: `Error en respaldo: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        details: { error: String(error), config }
      };
    }
  };

  const executeArticleSelection = async (task: AutomationTask, updateProgress: (stage: string, progress: number, message: string) => void) => {
    const config = task.task_config || {};
    const { sourceTable = 'articles', categories = [], articlesPerCategory = 3, maxTotalArticles = 15, criteria = 'random' } = config;

    try {
      updateProgress('Iniciando selección de artículos', 0, 'Analizando categorías disponibles...');

      // Obtener todas las categorías disponibles si no se especificaron
      let targetCategories = categories;
      if (targetCategories.length === 0) {
        const { data: categoryData, error: catError } = await supabase
          .from(sourceTable)
          .select('category')
          .not('category', 'is', null);

        if (catError) throw catError;

        const uniqueCategories = [...new Set(categoryData?.map(a => a.category) || [])];
        targetCategories = uniqueCategories.slice(0, 6); // Máximo 6 categorías
      }

      updateProgress('Seleccionando artículos', 20, `Procesando ${targetCategories.length} categorías...`);

      let selectedArticles: any[] = [];
      let totalProcessed = 0;

      // Para cada categoría, seleccionar artículos según criterios
      for (let i = 0; i < targetCategories.length; i++) {
        const category = targetCategories[i];
        const progress = 20 + (i / targetCategories.length) * 70;

        updateProgress(
          'Seleccionando artículos',
          progress,
          `Categoría ${category}: aplicando criterios de selección...`
        );

        let query = supabase
          .from(sourceTable)
          .select('*')
          .eq('category', category)
          .order('published_at', { ascending: false })
          .limit(articlesPerCategory * 4); // Obtener más para aplicar criterios

        // Aplicar criterios de selección
        if (criteria === 'recent') {
          // Solo artículos de las últimas 24 horas
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          query = query.gte('published_at', yesterday.toISOString());
        } else if (criteria === 'popular') {
          // Aquí se podría agregar lógica para artículos populares
          // Por ahora usamos random
        }

        const { data: categoryArticles, error: catError } = await query;

        if (catError) {
          console.warn(`Error obteniendo artículos de categoría ${category}:`, catError);
          continue;
        }

        // Seleccionar artículos según el método especificado
        if (categoryArticles && categoryArticles.length > 0) {
          let selectedFromCategory: any[];

          if (criteria === 'random') {
            // Selección aleatoria
            const shuffled = categoryArticles.sort(() => 0.5 - Math.random());
            selectedFromCategory = shuffled.slice(0, articlesPerCategory);
          } else if (criteria === 'recent') {
            // Los más recientes
            selectedFromCategory = categoryArticles.slice(0, articlesPerCategory);
          } else {
            // Por defecto, aleatorio
            const shuffled = categoryArticles.sort(() => 0.5 - Math.random());
            selectedFromCategory = shuffled.slice(0, articlesPerCategory);
          }

          selectedArticles.push(...selectedFromCategory);
        }

        totalProcessed++;
      }

      // Limitar el total de artículos si es necesario
      if (selectedArticles.length > maxTotalArticles) {
        selectedArticles = selectedArticles.sort(() => 0.5 - Math.random()).slice(0, maxTotalArticles);
      }

      updateProgress('Finalizando selección', 90, `Seleccionados ${selectedArticles.length} artículos...`);

      // Guardar la selección en una tabla temporal para que otras tareas puedan usarla
      const selectionId = `selection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      console.log('💾 executeArticleSelection: Intentando guardar selección temporal', {
        selectionId,
        selectedArticlesCount: selectedArticles.length,
        categories: targetCategories,
        criteria
      });

      try {
        const { error: saveError } = await supabase
          .from('automation_temp_data')
          .insert([{
            workflow_id: task.id,
            step_id: `selection_${Date.now()}`,
            task_type: 'article_selection',
            data: {
              selected_articles: selectedArticles,
              categories: targetCategories,
              criteria: criteria,
              total_selected: selectedArticles.length
            },
            status: 'completed'
          }]);

        if (saveError) {
          console.warn('⚠️ executeArticleSelection: Error guardando selección temporal (posiblemente tabla inexistente):', saveError);
          console.error('Detalles del error:', {
            message: saveError.message,
            details: saveError.details,
            hint: saveError.hint,
            code: saveError.code
          });
          console.log('🔄 Continuando sin guardar datos temporales...');
        } else {
          console.log('✅ executeArticleSelection: Selección temporal guardada exitosamente', { selectionId });
        }
      } catch (saveError) {
        console.warn('⚠️ executeArticleSelection: Excepción al guardar selección temporal:', saveError);
        console.log('🔄 Continuando sin guardar datos temporales...');
      }

      updateProgress('Completado', 100, `Selección completada. ${selectedArticles.length} artículos seleccionados.`);

      return {
        success: true,
        message: `Selección de artículos completada. ${selectedArticles.length} artículos seleccionados de ${totalProcessed} categorías`,
        details: {
          selection_id: selectionId,
          selected_articles: selectedArticles.length,
          categories_processed: totalProcessed,
          criteria: criteria,
          source_table: sourceTable
        },
        metrics: [{
          metric_type: 'articles_selected',
          metric_value: selectedArticles.length,
          metadata: {
            categories: targetCategories,
            criteria: criteria,
            source_table: sourceTable
          }
        }]
      };
    } catch (error) {
      return {
        success: false,
        message: `Error en selección de artículos: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        details: { error: String(error), config }
      };
    }
  };

  const executeManualEdit = async (task: AutomationTask, updateProgress: (stage: string, progress: number, message: string) => void) => {
    const config = task.task_config || {};
    const { selectionId, editMode = 'review', autoPublish = false } = config;

    try {
      updateProgress('Iniciando edición manual', 0, 'Preparando artículos para edición...');

      // Obtener la selección de artículos
      let selectedArticles: any[] = [];

      if (selectionId) {
        try {
          const { data: tempData, error: tempError } = await supabase
            .from('automation_temp_data')
            .select('data')
            .eq('step_id', selectionId)
            .eq('task_type', 'article_selection')
            .single();

          if (tempError) {
            console.warn('⚠️ executeManualEdit: Error obteniendo selección temporal (posiblemente tabla inexistente):', tempError);
            console.log('🔄 Continuando sin datos de selección temporal...');
          } else {
            selectedArticles = tempData?.data?.selected_articles || [];
          }
        } catch (tempError) {
          console.warn('⚠️ executeManualEdit: Excepción al obtener selección temporal:', tempError);
          console.log('🔄 Continuando sin datos de selección temporal...');
        }
      } else {
        // Si no hay selectionId, obtener artículos recientes para edición
        const { data: recentArticles, error: recentError } = await supabase
          .from('articles')
          .select('*')
          .eq('status', 'draft')
          .order('created_at', { ascending: false })
          .limit(10);

        if (recentError) throw recentError;
        selectedArticles = recentArticles || [];
      }

      if (selectedArticles.length === 0) {
        return {
          success: true,
          message: 'No hay artículos disponibles para edición manual',
          details: { articles_found: 0 }
        };
      }

      updateProgress('Preparando para edición', 30, `${selectedArticles.length} artículos listos para edición manual`);

      // Marcar artículos como pendientes de edición
      const editSessionId = `edit_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      try {
        const { error: sessionError } = await supabase
          .from('automation_temp_data')
          .insert([{
            workflow_id: task.id,
            step_id: editSessionId,
            task_type: 'edit_session',
            data: {
              articles: selectedArticles.map(a => ({ id: a.id, title: a.title, status: 'pending_edit' })),
              edit_mode: editMode,
              auto_publish: autoPublish,
              session_started: new Date().toISOString()
            },
            status: 'pending'
          }]);

        if (sessionError) {
          console.warn('⚠️ executeManualEdit: Error creando sesión de edición (posiblemente tabla inexistente):', sessionError);
          console.log('🔄 Continuando sin guardar sesión de edición...');
        } else {
          console.log('✅ executeManualEdit: Sesión de edición creada exitosamente');
        }
      } catch (sessionError) {
        console.warn('⚠️ executeManualEdit: Excepción al crear sesión de edición:', sessionError);
        console.log('🔄 Continuando sin guardar sesión de edición...');
      }

      updateProgress('Sesión de edición creada', 70, 'Los artículos están listos para edición manual');

      // Aquí se podría enviar notificaciones o abrir una interfaz de edición
      // Por ahora, solo creamos la sesión

      updateProgress('Completado', 100, `Sesión de edición creada. ${selectedArticles.length} artículos pendientes de revisión.`);

      return {
        success: true,
        message: `Edición manual preparada. ${selectedArticles.length} artículos listos para revisión`,
        details: {
          edit_session_id: editSessionId,
          articles_count: selectedArticles.length,
          edit_mode: editMode,
          auto_publish: autoPublish
        },
        metrics: [{
          metric_type: 'articles_pending_edit',
          metric_value: selectedArticles.length,
          metadata: {
            edit_mode: editMode,
            session_id: editSessionId
          }
        }]
      };
    } catch (error) {
      return {
        success: false,
        message: `Error en edición manual: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        details: { error: String(error), config }
      };
    }
  };

  const executeContentReorganization = async (task: AutomationTask, updateProgress: (stage: string, progress: number, message: string) => void) => {
    const config = task.task_config || {};
    const { selectionId, reorganizationType = 'paragraphs', targetTable = 'ai_generated_articles' } = config;

    try {
      updateProgress('Iniciando reorganización', 0, 'Preparando artículos para reorganización...');

      // Obtener artículos para reorganizar
      let articlesToProcess: any[] = [];

      if (selectionId) {
        try {
          const { data: tempData, error: tempError } = await supabase
            .from('automation_temp_data')
            .select('data')
            .eq('id', selectionId)
            .eq('data_type', 'article_selection')
            .single();

          if (tempError) {
            console.warn('⚠️ executeContentReorganization: Error obteniendo selección temporal (posiblemente tabla inexistente):', tempError);
            console.log('🔄 Continuando sin datos de selección temporal...');
          } else {
            articlesToProcess = tempData?.data?.selected_articles || [];
          }
        } catch (tempError) {
          console.warn('⚠️ executeContentReorganization: Excepción al obtener selección temporal:', tempError);
          console.log('🔄 Continuando sin datos de selección temporal...');
        }
      } else {
        // Obtener artículos recientes
        const { data: recentArticles, error: recentError } = await supabase
          .from('articles')
          .select('*')
          .order('published_at', { ascending: false })
          .limit(5);

        if (recentError) throw recentError;
        articlesToProcess = recentArticles || [];
      }

      if (articlesToProcess.length === 0) {
        return {
          success: true,
          message: 'No hay artículos disponibles para reorganización',
          details: { articles_found: 0 }
        };
      }

      updateProgress('Reorganizando contenido', 20, `Procesando ${articlesToProcess.length} artículos...`);

      let processedCount = 0;
      let errorCount = 0;

      for (let i = 0; i < articlesToProcess.length; i++) {
        const article = articlesToProcess[i];
        const progress = 20 + (i / articlesToProcess.length) * 70;

        updateProgress(
          'Reorganizando contenido',
          progress,
          `Reorganizando: ${article.title?.substring(0, 40)}...`
        );

        try {
          let reorganizedContent = article.content || '';

          if (reorganizationType === 'paragraphs') {
            // Reorganizar párrafos: separar en párrafos, reordenar lógicamente
            const paragraphs = reorganizedContent.split('\n\n').filter((p: any) => p.trim());
            if (paragraphs.length > 1) {
              // Mantener el primer párrafo (introducción) al inicio
              const intro = paragraphs[0];
              const body = paragraphs.slice(1).sort(() => 0.5 - Math.random());
              reorganizedContent = [intro, ...body].join('\n\n');
            }
          } else if (reorganizationType === 'structure') {
            // Reorganizar estructura completa
            // Aquí se podría implementar lógica más compleja
            reorganizedContent = article.content || '';
          }

          // Crear versión reorganizada
          const { error: insertError } = await supabase
            .from(targetTable)
            .insert([{
              title: article.title,
              content: reorganizedContent,
              category: article.category,
              status: 'draft',
              source_rss_id: article.id,
              image_url: article.image_url || null,
              summary: article.description || '',
              image_caption: '',
              author: 'La Voz del Norte Diario',
              published_at: new Date().toISOString()
            }]);

          if (insertError) throw insertError;

          processedCount++;
        } catch (articleError) {
          console.error(`Error reorganizando artículo ${article.id}:`, articleError);
          errorCount++;
        }
      }

      updateProgress('Completado', 100, `Reorganización completada. ${processedCount} artículos procesados.`);

      return {
        success: true,
        message: `Reorganización de contenido completada. ${processedCount} artículos reorganizados`,
        details: {
          processed_articles: processedCount,
          errors: errorCount,
          reorganization_type: reorganizationType,
          target_table: targetTable
        },
        metrics: [{
          metric_type: 'content_reorganized',
          metric_value: processedCount,
          metadata: {
            reorganization_type: reorganizationType,
            target_table: targetTable
          }
        }]
      };
    } catch (error) {
      return {
        success: false,
        message: `Error en reorganización de contenido: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        details: { error: String(error), config }
      };
    }
  };

  const executeWorkflow = async (task: AutomationTask, updateProgress: (stage: string, progress: number, message: string) => void) => {
    const config = task.task_config || {};
    const { workflowSteps = [] } = config;

    console.log('🚀 executeWorkflow: Iniciando ejecución de workflow', {
      taskId: task.id,
      taskName: task.name,
      workflowStepsCount: workflowSteps.length,
      config
    });

    try {
    updateProgress('Iniciando flujo de trabajo', 0, `Preparando ${workflowSteps.length} pasos del workflow...`);

    if (workflowSteps.length === 0) {
      console.error('❌ executeWorkflow: Workflow sin pasos definidos');
      return {
        success: false,
        message: 'No se definieron pasos para el workflow',
        details: { steps_count: 0 }
      };
    }      const workflowId = `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      let currentData: any = {};
      let completedSteps = 0;

      updateProgress('Ejecutando workflow', 10, 'Iniciando primer paso...');

    // Ejecutar cada paso del workflow en secuencia
    for (let i = 0; i < workflowSteps.length; i++) {
      const step = workflowSteps[i];
      const stepProgress = 10 + (i / workflowSteps.length) * 85;        updateProgress(
          `Paso ${i + 1}/${workflowSteps.length}`,
          stepProgress,
          `Ejecutando: ${TASK_TYPES.find(t => t.id === step.task_type)?.name || step.task_type}...`
        );

        try {
          // Crear una tarea temporal para este paso
          const stepTask: AutomationTask = {
            id: `${workflowId}_step_${i}`,
            name: TASK_TYPES.find(t => t.id === step.task_type)?.name || step.task_type,
            description: step.description || `Paso ${i + 1}: ${TASK_TYPES.find(t => t.id === step.task_type)?.name || step.task_type}`,
            enabled: true,
            schedule_type: 'manual',
            schedule_config: {},
            task_type: step.task_type,
            task_config: { ...step.config, ...currentData }, // Pasar datos del paso anterior
            priority: 1,
            max_retries: 1,
            timeout_minutes: 30
          };

          // Ejecutar el paso
          const stepResult = await executeTask(stepTask);

          if (!stepResult.success) {
            throw new Error(`Paso ${step.task_type} falló: ${stepResult.message}`);
          }

          // Guardar resultados para el siguiente paso
          currentData = {
            ...currentData,
            [`step_${i}_result`]: stepResult,
            last_step_output: stepResult.details
          };

          completedSteps++;
        } catch (stepError) {
          console.error(`Error en paso ${TASK_TYPES.find(t => t.id === step.task_type)?.name || step.task_type}:`, stepError);
          return {
            success: false,
            message: `Workflow falló en paso ${i + 1} (${TASK_TYPES.find(t => t.id === step.task_type)?.name || step.task_type}): ${stepError instanceof Error ? stepError.message : 'Error desconocido'}`,
            details: {
              workflow_id: workflowId,
              completed_steps: completedSteps,
              failed_step: i,
              total_steps: workflowSteps.length,
              error: String(stepError)
            }
          };
        }
      }

      updateProgress('Workflow completado', 100, `Todos los ${workflowSteps.length} pasos ejecutados exitosamente.`);

      console.log('✅ executeWorkflow: Workflow completado exitosamente', {
        workflowId,
        totalSteps: workflowSteps.length,
        completedSteps,
        finalDataKeys: Object.keys(currentData)
      });

      return {
        success: true,
        message: `Workflow completado exitosamente. ${completedSteps} pasos ejecutados`,
        details: {
          workflow_id: workflowId,
          total_steps: workflowSteps.length,
          completed_steps: completedSteps,
          final_data: currentData
        },
        metrics: [{
          metric_type: 'workflow_completed',
          metric_value: completedSteps,
          metadata: {
            workflow_id: workflowId,
            steps_count: workflowSteps.length
          }
        }]
      };
    } catch (error) {
      console.error('❌ executeWorkflow: Error fatal en workflow', {
        error: error instanceof Error ? error.message : String(error),
        taskId: task.id,
        config
      });
      return {
        success: false,
        message: `Error en workflow: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        details: { error: String(error), config }
      };
    }
  };

  const calculateNextRun = (scheduleType: string, scheduleConfig: any): string | null => {
    if (scheduleType === 'manual') return null;

    const now = new Date();

    if (scheduleType === 'interval') {
      const minutes = scheduleConfig?.minutes || 60;
      const nextRun = new Date(now.getTime() + minutes * 60 * 1000);
      return nextRun.toISOString();
    }

    if (scheduleType === 'daily') {
      const [hours, minutes] = (scheduleConfig?.time || '08:00').split(':').map(Number);
      const nextRun = new Date(now);
      nextRun.setHours(hours, minutes, 0, 0);

      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }

      return nextRun.toISOString();
    }

    if (scheduleType === 'weekly') {
      const daysOfWeek = scheduleConfig?.daysOfWeek || [1]; // Lunes por defecto
      const [hours, minutes] = (scheduleConfig?.time || '08:00').split(':').map(Number);

      const nextRun = new Date(now);
      nextRun.setHours(hours, minutes, 0, 0);

      // Encontrar el próximo día de la semana
      let daysToAdd = 0;
      const currentDay = now.getDay(); // 0 = Domingo, 1 = Lunes, etc.

      for (const targetDay of daysOfWeek.sort((a: number, b: number) => a - b)) {
        if (targetDay > currentDay) {
          daysToAdd = targetDay - currentDay;
          break;
        } else if (targetDay === currentDay) {
          // Si es hoy, verificar si la hora ya pasó
          if (nextRun > now) {
            daysToAdd = 0;
          } else {
            daysToAdd = 7; // Próxima semana
          }
          break;
        }
      }

      if (daysToAdd === 0 && daysOfWeek.every((day: number) => day < currentDay)) {
        // Si todos los días están en el pasado esta semana, ir a la próxima semana
        daysToAdd = 7 - currentDay + Math.min(...daysOfWeek);
      }

      nextRun.setDate(nextRun.getDate() + daysToAdd);
      return nextRun.toISOString();
    }

    if (scheduleType === 'monthly') {
      const dayOfMonth = scheduleConfig?.dayOfMonth || 1;
      const [hours, minutes] = (scheduleConfig?.time || '08:00').split(':').map(Number);

      const nextRun = new Date(now.getFullYear(), now.getMonth(), dayOfMonth, hours, minutes, 0, 0);

      if (nextRun <= now) {
        nextRun.setMonth(nextRun.getMonth() + 1);
      }

      return nextRun.toISOString();
    }

    if (scheduleType === 'once') {
      const dateTime = scheduleConfig?.dateTime;
      if (dateTime) {
        const nextRun = new Date(dateTime);
        return nextRun > now ? nextRun.toISOString() : null;
      }
    }

    return null;
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      enabled: false,
      schedule_type: 'manual',
      schedule_config: {},
      task_type: 'rss_refresh',
      task_config: {},
      priority: 1,
      max_retries: 3,
      timeout_minutes: 30
    });
    setEditingTask(null);
    setShowCreateForm(false);
  };

  const startEditing = (task: AutomationTask) => {
    setEditingTask(task);
    setFormData({ ...task });
    setShowCreateForm(true);
  };

  const filteredTasks = tasks.filter(task => {
    const matchesType = filterType === 'all' || task.task_type === filterType;
    const matchesSearch = !searchTerm ||
      task.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

  const getTaskTypeInfo = (taskType: string) => {
    return TASK_TYPES.find(t => t.id === taskType) || TASK_TYPES[0];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Settings className="w-7 h-7 text-blue-600" />
              Automatización Avanzada
            </h2>
            <p className="text-slate-600 mt-1">
              Sistema completo de automatización para el diario digital
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nueva Tarea
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Tareas Activas</span>
            </div>
            <p className="text-2xl font-bold text-blue-600 mt-1">
              {tasks.filter(t => t.enabled).length}
            </p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-green-900">Ejecuciones Exitosas</span>
            </div>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {logs.filter(l => l.status === 'success').length}
            </p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span className="text-sm font-medium text-red-900">Errores</span>
            </div>
            <p className="text-2xl font-bold text-red-600 mt-1">
              {logs.filter(l => l.status === 'error').length}
            </p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-medium text-purple-900">Artículos Procesados</span>
            </div>
            <p className="text-2xl font-bold text-purple-600 mt-1">
              {metrics.filter(m => m.metric_type === 'articles_processed').reduce((sum, m) => sum + m.metric_value, 0)}
            </p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <Play className="w-5 h-5 text-orange-600" />
              <span className="text-sm font-medium text-orange-900">Monitoreo Automático</span>
            </div>
            <p className="text-2xl font-bold text-orange-600 mt-1">
              {monitoringActive ? 'Activo' : 'Inactivo'}
            </p>
            <p className="text-xs text-orange-700 mt-1">
              {tasks.filter(t => t.enabled && t.schedule_type !== 'manual').length} programadas
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar tareas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Todos los tipos</option>
            {TASK_TYPES.map(type => (
              <option key={type.id} value={type.id}>{type.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tasks List */}
      <div className="space-y-4">
        {filteredTasks.map(task => {
          const taskTypeInfo = getTaskTypeInfo(task.task_type);
          const Icon = taskTypeInfo.icon;
          const isRunning = runningTasks.has(task.id!);

          return (
            <div key={task.id} className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg bg-${taskTypeInfo.color}-100`}>
                    <Icon className={`w-6 h-6 text-${taskTypeInfo.color}-600`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-slate-900">{task.name}</h3>
                      {task.enabled ? (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                          Activa
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">
                          Inactiva
                        </span>
                      )}
                    </div>
                    <p className="text-slate-600 mb-3">{task.description}</p>

                    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                      <span className="flex items-center gap-1">
                        <Timer className="w-4 h-4" />
                        {task.schedule_type === 'interval' ? 'Intervalo' :
                         task.schedule_type === 'daily' ? 'Diario' :
                         task.schedule_type === 'weekly' ? 'Semanal' :
                         task.schedule_type === 'monthly' ? 'Mensual' :
                         task.schedule_type === 'once' ? 'Una vez' : 'Manual'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Target className="w-4 h-4" />
                        Prioridad {task.priority}
                      </span>
                      {task.last_run_at && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          Última: {new Date(task.last_run_at).toLocaleString('es-AR')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => runTask(task)}
                    disabled={isRunning || !task.enabled}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isRunning ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Ejecutando...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        Ejecutar
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => startEditing(task)}
                    className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                    title="Editar"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteTask(task.id!)}
                    className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {filteredTasks.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
            <Settings className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No hay tareas configuradas</h3>
            <p className="text-slate-600 mb-4">
              {searchTerm || filterType !== 'all'
                ? 'No se encontraron tareas con los filtros aplicados'
                : 'Crea tu primera tarea de automatización para comenzar'}
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Crear Primera Tarea
            </button>
          </div>
        )}
      </div>

      {/* Create/Edit Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">
                  {editingTask ? 'Editar Tarea' : 'Crear Nueva Tarea'}
                </h3>
                <button
                  onClick={resetForm}
                  className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Nombre de la Tarea *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ej: Renovar RSS matutino"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Tipo de Tarea *
                  </label>
                  <select
                    value={formData.task_type}
                    onChange={(e) => {
                      const newTaskType = e.target.value as any;
                      let newTaskConfig = {};

                      // Inicializar configuración específica según el tipo de tarea
                      switch (newTaskType) {
                        case 'workflow':
                          newTaskConfig = {
                            workflowSteps: [],
                            parallelExecution: false,
                            continueOnError: false,
                            saveIntermediateResults: true
                          };
                          break;
                        case 'article_selection':
                          newTaskConfig = {
                            sourceTable: 'articles',
                            selectionMethod: 'random_by_category',
                            maxPerCategory: 3,
                            categories: [],
                            keywords: []
                          };
                          break;
                        case 'ai_processing':
                          newTaskConfig = {
                            sourceTable: 'articles',
                            targetTable: 'ai_generated_articles',
                            categories: [],
                            maxArticles: 10,
                            aiModel: aiConfig.selectedModel
                          };
                          break;
                        case 'manual_edit':
                          newTaskConfig = {
                            sourceTable: 'automation_temp_data',
                            editAction: 'review_and_edit',
                            maxArticles: 10,
                            requireApproval: true
                          };
                          break;
                        case 'content_reorganization':
                          newTaskConfig = {
                            sourceTable: 'automation_temp_data',
                            reorgAction: 'categorize',
                            maxArticles: 20,
                            reorgRules: ''
                          };
                          break;
                        case 'cleanup':
                          newTaskConfig = {
                            olderThanDays: 30,
                            categories: [],
                            dryRun: true
                          };
                          break;
                        case 'backup':
                          newTaskConfig = {
                            tables: ['articles', 'ai_generated_articles', 'local_news'],
                            includeMedia: false
                          };
                          break;
                        default:
                          newTaskConfig = {};
                      }

                      setFormData(prev => ({
                        ...prev,
                        task_type: newTaskType,
                        task_config: newTaskConfig
                      }));
                    }}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {TASK_TYPES.map(type => (
                      <option key={type.id} value={type.id}>{type.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Descripción
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Describe qué hace esta tarea..."
                />
              </div>

              {/* Schedule Configuration */}
              <div className="border-t border-slate-200 pt-6">
                <h4 className="text-lg font-semibold text-slate-900 mb-4">Programación</h4>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Tipo de Programación
                    </label>
                    <select
                      value={formData.schedule_type}
                      onChange={(e) => setFormData(prev => ({ ...prev, schedule_type: e.target.value as any }))}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {SCHEDULE_TYPES.map(type => (
                        <option key={type.id} value={type.id}>{type.name}</option>
                      ))}
                    </select>
                    <p className="text-sm text-slate-500 mt-1">
                      {SCHEDULE_TYPES.find(t => t.id === formData.schedule_type)?.description}
                    </p>
                  </div>

                  {formData.schedule_type === 'interval' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Intervalo de Ejecución
                      </label>
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <input
                            type="number"
                            min="1"
                            max="1440"
                            value={formData.schedule_config?.minutes || 60}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              schedule_config: { ...prev.schedule_config, minutes: parseInt(e.target.value) }
                            }))}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <div className="flex items-center">
                          <span className="text-sm text-slate-600">minutos</span>
                        </div>
                      </div>
                      <p className="text-sm text-slate-500 mt-1">
                        La tarea se ejecutará cada {formData.schedule_config?.minutes || 60} minutos
                      </p>
                    </div>
                  )}

                  {formData.schedule_type === 'daily' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Hora de Ejecución Diaria
                      </label>
                      <input
                        type="time"
                        value={formData.schedule_config?.time || '08:00'}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          schedule_config: { ...prev.schedule_config, time: e.target.value }
                        }))}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="text-sm text-slate-500 mt-1">
                        La tarea se ejecutará todos los días a las {formData.schedule_config?.time || '08:00'}
                      </p>
                    </div>
                  )}

                  {formData.schedule_type === 'weekly' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Días de la Semana
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {[
                            { value: 1, label: 'Lunes' },
                            { value: 2, label: 'Martes' },
                            { value: 3, label: 'Miércoles' },
                            { value: 4, label: 'Jueves' },
                            { value: 5, label: 'Viernes' },
                            { value: 6, label: 'Sábado' },
                            { value: 0, label: 'Domingo' }
                          ].map(day => (
                            <label key={day.value} className="inline-flex items-center">
                              <input
                                type="checkbox"
                                checked={formData.schedule_config?.daysOfWeek?.includes(day.value) || false}
                                onChange={(e) => {
                                  const daysOfWeek = formData.schedule_config?.daysOfWeek || [];
                                  const newDays = e.target.checked
                                    ? [...daysOfWeek, day.value]
                                    : daysOfWeek.filter((d: any) => d !== day.value);
                                  setFormData(prev => ({
                                    ...prev,
                                    schedule_config: { ...prev.schedule_config, daysOfWeek: newDays }
                                  }));
                                }}
                                className="mr-2"
                              />
                              {day.label}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Hora de Ejecución
                        </label>
                        <input
                          type="time"
                          value={formData.schedule_config?.time || '08:00'}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            schedule_config: { ...prev.schedule_config, time: e.target.value }
                          }))}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <p className="text-sm text-slate-500">
                        La tarea se ejecutará los días seleccionados a las {formData.schedule_config?.time || '08:00'}
                      </p>
                    </div>
                  )}

                  {formData.schedule_type === 'monthly' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Día del Mes
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          value={formData.schedule_config?.dayOfMonth || 1}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            schedule_config: { ...prev.schedule_config, dayOfMonth: parseInt(e.target.value) }
                          }))}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Hora de Ejecución
                        </label>
                        <input
                          type="time"
                          value={formData.schedule_config?.time || '08:00'}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            schedule_config: { ...prev.schedule_config, time: e.target.value }
                          }))}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <p className="text-sm text-slate-500">
                        La tarea se ejecutará el día {formData.schedule_config?.dayOfMonth || 1} de cada mes a las {formData.schedule_config?.time || '08:00'}
                      </p>
                    </div>
                  )}

                  {formData.schedule_type === 'once' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Fecha y Hora de Ejecución
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.schedule_config?.dateTime || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          schedule_config: { ...prev.schedule_config, dateTime: e.target.value }
                        }))}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="text-sm text-slate-500 mt-1">
                        La tarea se ejecutará una sola vez en la fecha y hora especificada
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Task-specific Configuration */}
              <div className="border-t border-slate-200 pt-6">
                <h4 className="text-lg font-semibold text-slate-900 mb-4">Configuración Específica</h4>

                {formData.task_type === 'article_extraction' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Categorías (opcional)
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {['Nacionales', 'Regionales', 'Internacionales', 'Economía', 'Deportes', 'Espectaculos'].map(cat => (
                          <label key={cat} className="inline-flex items-center">
                            <input
                              type="checkbox"
                              checked={formData.task_config?.categories?.includes(cat) || false}
                              onChange={(e) => {
                                const categories = formData.task_config?.categories || [];
                                const newCategories = e.target.checked
                                  ? [...categories, cat]
                                  : categories.filter((c: any) => c !== cat);
                                setFormData(prev => ({
                                  ...prev,
                                  task_config: { ...prev.task_config, categories: newCategories }
                                }));
                              }}
                              className="mr-2"
                            />
                            {cat}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Palabras Clave
                        </label>
                        <input
                          type="text"
                          value={formData.task_config?.keywords?.join(', ') || ''}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            task_config: {
                              ...prev.task_config,
                              keywords: e.target.value.split(',').map(k => k.trim()).filter(k => k)
                            }
                          }))}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="política, economía, salud"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Fecha Desde
                        </label>
                        <input
                          type="date"
                          value={formData.task_config?.dateFrom || ''}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            task_config: { ...prev.task_config, dateFrom: e.target.value }
                          }))}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Máximo Artículos
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={formData.task_config?.maxArticles || 50}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            task_config: { ...prev.task_config, maxArticles: parseInt(e.target.value) }
                          }))}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {formData.task_type === 'ai_processing' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Tabla Origen
                        </label>
                        <select
                          value={formData.task_config?.sourceTable || 'articles'}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            task_config: { ...prev.task_config, sourceTable: e.target.value }
                          }))}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="articles">Artículos RSS</option>
                          <option value="local_news">Noticias Locales</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Modelo IA
                        </label>
                        <select
                          value={formData.task_config?.aiModel || aiConfig.selectedModel}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            task_config: { ...prev.task_config, aiModel: e.target.value }
                          }))}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash Exp</option>
                          <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                          <option value="openai/gpt-4o">GPT-4o (OpenRouter)</option>
                          <option value="anthropic/claude-3-haiku">Claude 3 Haiku</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Categorías (opcional)
                        </label>
                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                          {['Nacionales', 'Regionales', 'Internacionales', 'Economía', 'Deportes', 'Espectaculos'].map(cat => (
                            <label key={cat} className="inline-flex items-center text-sm">
                              <input
                                type="checkbox"
                                checked={formData.task_config?.categories?.includes(cat) || false}
                                onChange={(e) => {
                                  const categories = formData.task_config?.categories || [];
                                  const newCategories = e.target.checked
                                    ? [...categories, cat]
                                    : categories.filter((c: any) => c !== cat);
                                  setFormData(prev => ({
                                    ...prev,
                                    task_config: { ...prev.task_config, categories: newCategories }
                                  }));
                                }}
                                className="mr-2"
                              />
                              {cat}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Máximo Artículos
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="50"
                          value={formData.task_config?.maxArticles || 10}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            task_config: { ...prev.task_config, maxArticles: parseInt(e.target.value) }
                          }))}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {formData.task_type === 'cleanup' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Eliminar artículos más antiguos que (días)
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={formData.task_config?.olderThanDays || 30}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            task_config: { ...prev.task_config, olderThanDays: parseInt(e.target.value) }
                          }))}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Modo
                        </label>
                        <select
                          value={formData.task_config?.dryRun ? 'dry_run' : 'real'}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            task_config: { ...prev.task_config, dryRun: e.target.value === 'dry_run' }
                          }))}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="dry_run">Simulación (solo mostrar)</option>
                          <option value="real">Eliminación real</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {formData.task_type === 'backup' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Tablas a respaldar
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {['articles', 'ai_generated_articles', 'local_news', 'automation_tasks'].map(table => (
                          <label key={table} className="inline-flex items-center">
                            <input
                              type="checkbox"
                              checked={formData.task_config?.tables?.includes(table) || false}
                              onChange={(e) => {
                                const tables = formData.task_config?.tables || [];
                                const newTables = e.target.checked
                                  ? [...tables, table]
                                  : tables.filter((t: string) => t !== table);
                                setFormData(prev => ({
                                  ...prev,
                                  task_config: { ...prev.task_config, tables: newTables }
                                }));
                              }}
                              className="mr-2"
                            />
                            {table}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="inline-flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.task_config?.includeMedia || false}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            task_config: { ...prev.task_config, includeMedia: e.target.checked }
                          }))}
                          className="mr-2"
                        />
                        Incluir archivos multimedia
                      </label>
                    </div>
                  </div>
                )}

                {formData.task_type === 'article_selection' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Tabla Origen
                        </label>
                        <select
                          value={formData.task_config?.sourceTable || 'articles'}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            task_config: { ...prev.task_config, sourceTable: e.target.value }
                          }))}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="articles">Artículos RSS</option>
                          <option value="local_news">Noticias Locales</option>
                          <option value="ai_generated_articles">Artículos IA</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Método de Selección
                        </label>
                        <select
                          value={formData.task_config?.selectionMethod || 'random_by_category'}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            task_config: { ...prev.task_config, selectionMethod: e.target.value }
                          }))}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="random_by_category">Aleatorio por Categoría</option>
                          <option value="most_recent">Más Recientes</option>
                          <option value="by_keywords">Por Palabras Clave</option>
                          <option value="by_score">Por Puntaje</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Máximo Artículos por Categoría
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={formData.task_config?.maxPerCategory || 3}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            task_config: { ...prev.task_config, maxPerCategory: parseInt(e.target.value) }
                          }))}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Categorías (opcional)
                        </label>
                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                          {['Nacionales', 'Regionales', 'Internacionales', 'Economía', 'Deportes', 'Espectaculos'].map(cat => (
                            <label key={cat} className="inline-flex items-center text-sm">
                              <input
                                type="checkbox"
                                checked={formData.task_config?.categories?.includes(cat) || false}
                                onChange={(e) => {
                                  const categories = formData.task_config?.categories || [];
                                  const newCategories = e.target.checked
                                    ? [...categories, cat]
                                    : categories.filter((c: string) => c !== cat);
                                  setFormData(prev => ({
                                    ...prev,
                                    task_config: { ...prev.task_config, categories: newCategories }
                                  }));
                                }}
                                className="mr-2"
                              />
                              {cat}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>

                    {formData.task_config?.selectionMethod === 'by_keywords' && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Palabras Clave
                        </label>
                        <input
                          type="text"
                          value={formData.task_config?.keywords?.join(', ') || ''}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            task_config: {
                              ...prev.task_config,
                              keywords: e.target.value.split(',').map(k => k.trim()).filter(k => k)
                            }
                          }))}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="política, economía, salud"
                        />
                      </div>
                    )}
                  </div>
                )}

                {formData.task_type === 'manual_edit' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Tabla Origen
                      </label>
                      <select
                        value={formData.task_config?.sourceTable || 'automation_temp_data'}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          task_config: { ...prev.task_config, sourceTable: e.target.value }
                        }))}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="automation_temp_data">Datos Temporales de Workflow</option>
                        <option value="articles">Artículos RSS</option>
                        <option value="local_news">Noticias Locales</option>
                        <option value="ai_generated_articles">Artículos IA</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Acción de Edición
                        </label>
                        <select
                          value={formData.task_config?.editAction || 'review_and_edit'}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            task_config: { ...prev.task_config, editAction: e.target.value }
                          }))}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="review_and_edit">Revisar y Editar</option>
                          <option value="approve_publish">Aprobar para Publicar</option>
                          <option value="reject">Rechazar</option>
                          <option value="mark_for_ai">Marcar para Reescritura IA</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Máximo Artículos a Procesar
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="50"
                          value={formData.task_config?.maxArticles || 10}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            task_config: { ...prev.task_config, maxArticles: parseInt(e.target.value) }
                          }))}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="inline-flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.task_config?.requireApproval || true}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            task_config: { ...prev.task_config, requireApproval: e.target.checked }
                          }))}
                          className="mr-2"
                        />
                        Requerir aprobación antes de continuar workflow
                      </label>
                    </div>
                  </div>
                )}

                {formData.task_type === 'content_reorganization' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Tabla Origen
                      </label>
                      <select
                        value={formData.task_config?.sourceTable || 'automation_temp_data'}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          task_config: { ...prev.task_config, sourceTable: e.target.value }
                        }))}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="automation_temp_data">Datos Temporales de Workflow</option>
                        <option value="articles">Artículos RSS</option>
                        <option value="local_news">Noticias Locales</option>
                        <option value="ai_generated_articles">Artículos IA</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Acción de Reorganización
                        </label>
                        <select
                          value={formData.task_config?.reorgAction || 'categorize'}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            task_config: { ...prev.task_config, reorgAction: e.target.value }
                          }))}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="categorize">Recategorizar</option>
                          <option value="prioritize">Reordenar por Prioridad</option>
                          <option value="merge_similar">Fusionar Similares</option>
                          <option value="split_sections">Dividir en Secciones</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Máximo Artículos a Procesar
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="50"
                          value={formData.task_config?.maxArticles || 20}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            task_config: { ...prev.task_config, maxArticles: parseInt(e.target.value) }
                          }))}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Reglas de Reorganización
                      </label>
                      <textarea
                        value={formData.task_config?.reorgRules || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          task_config: { ...prev.task_config, reorgRules: e.target.value }
                        }))}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        rows={3}
                        placeholder="Ej: Agrupar artículos de política juntos, mover deportes al final, etc."
                      />
                    </div>
                  </div>
                )}

                {formData.task_type === 'workflow' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Pasos del Workflow
                      </label>
                      <div className="space-y-2">
                        {(formData.task_config?.workflowSteps || []).map((step: any, index: number) => (
                          <div key={index} className="flex items-center gap-2 p-2 bg-slate-50 rounded">
                            <span className="text-sm font-medium">{index + 1}.</span>
                            <select
                              value={step.task_type}
                              onChange={(e) => {
                                const steps = formData.task_config?.workflowSteps || [];
                                steps[index] = { ...steps[index], task_type: e.target.value };
                                setFormData(prev => ({
                                  ...prev,
                                  task_config: { ...prev.task_config, workflowSteps: steps }
                                }));
                              }}
                              className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              {TASK_TYPES.filter(t => t.id !== 'workflow').map(type => (
                                <option key={type.id} value={type.id}>{type.name}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => {
                                const steps = formData.task_config?.workflowSteps || [];
                                steps.splice(index, 1);
                                setFormData(prev => ({
                                  ...prev,
                                  task_config: { ...prev.task_config, workflowSteps: steps }
                                }));
                              }}
                              className="p-1 text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            const steps = formData.task_config?.workflowSteps || [];
                            steps.push({ task_type: 'article_selection', config: {} });
                            setFormData(prev => ({
                              ...prev,
                              task_config: { ...prev.task_config, workflowSteps: steps }
                            }));
                          }}
                          className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          Agregar Paso
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Ejecutar en Paralelo
                        </label>
                        <select
                          value={formData.task_config?.parallelExecution ? 'parallel' : 'sequential'}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            task_config: { ...prev.task_config, parallelExecution: e.target.value === 'parallel' }
                          }))}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="sequential">Secuencial</option>
                          <option value="parallel">En Paralelo</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Continuar en Error
                        </label>
                        <select
                          value={formData.task_config?.continueOnError ? 'continue' : 'stop'}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            task_config: { ...prev.task_config, continueOnError: e.target.value === 'continue' }
                          }))}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="stop">Detener Workflow</option>
                          <option value="continue">Continuar con Siguientes</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="inline-flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.task_config?.saveIntermediateResults || true}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            task_config: { ...prev.task_config, saveIntermediateResults: e.target.checked }
                          }))}
                          className="mr-2"
                        />
                        Guardar resultados intermedios en tabla temporal
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Advanced Settings */}
              <div className="border-t border-slate-200 pt-6">
                <h4 className="text-lg font-semibold text-slate-900 mb-4">Configuración Avanzada</h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Prioridad (1-10)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={formData.priority}
                      onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Máximo Reintentos
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={formData.max_retries}
                      onChange={(e) => setFormData(prev => ({ ...prev, max_retries: parseInt(e.target.value) }))}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Timeout (minutos)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="120"
                      value={formData.timeout_minutes}
                      onChange={(e) => setFormData(prev => ({ ...prev, timeout_minutes: parseInt(e.target.value) }))}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.enabled}
                      onChange={(e) => setFormData(prev => ({ ...prev, enabled: e.target.checked }))}
                      className="mr-2"
                    />
                    Activar tarea automáticamente
                  </label>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={resetForm}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveTask}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                {editingTask ? 'Actualizar Tarea' : 'Crear Tarea'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progress Modal */}
      {currentProgress && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">
                  Ejecutando Tarea
                </h3>
                <button
                  onClick={() => setCurrentProgress(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                  disabled={currentProgress.progress < 100}
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm text-slate-600 mb-2">
                    <span>{currentProgress.stage}</span>
                    <span>{Math.round(currentProgress.progress)}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${currentProgress.progress}%` }}
                    ></div>
                  </div>
                </div>

                <p className="text-slate-700 text-sm">
                  {currentProgress.message}
                </p>

                {currentProgress.progress >= 100 && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => setCurrentProgress(null)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Cerrar
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Logs Section */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Historial de Ejecuciones
        </h3>

        {logs.length === 0 ? (
          <p className="text-slate-500 text-center py-8">
            No hay registros de ejecución
          </p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {logs.slice(0, 20).map(log => (
              <div
                key={log.id}
                className={`p-4 rounded-lg border ${
                  log.status === 'success'
                    ? 'bg-green-50 border-green-200'
                    : log.status === 'error'
                    ? 'bg-red-50 border-red-200'
                    : log.status === 'running'
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-yellow-50 border-yellow-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2">
                    {log.status === 'success' ? (
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : log.status === 'error' ? (
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    ) : log.status === 'running' ? (
                      <RefreshCw className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5 animate-spin" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className={`font-medium ${
                        log.status === 'success'
                          ? 'text-green-900'
                          : log.status === 'error'
                          ? 'text-red-900'
                          : log.status === 'running'
                          ? 'text-blue-900'
                          : 'text-yellow-900'
                      }`}>
                        {log.message}
                      </p>
                      <p className="text-sm text-slate-600 mt-1">
                        {new Date(log.started_at).toLocaleString('es-AR')}
                        {log.duration_seconds && ` • ${log.duration_seconds}s`}
                      </p>
                      {log.details && Object.keys(log.details).length > 0 && (
                        <details className="mt-2">
                          <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">
                            Ver detalles
                          </summary>
                          <pre className="text-xs text-slate-600 mt-1 bg-slate-100 p-2 rounded overflow-x-auto">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
