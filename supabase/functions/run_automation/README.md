# Edge Function: run_automation

## 📝 Descripción

Esta Edge Function ejecuta la automatización de generación de artículos con IA según la configuración del panel de administración.

## 🚀 Despliegue

### 1. Instalar Supabase CLI (si no lo tienes)

```bash
npm install -g supabase
```

### 2. Login en Supabase

```bash
supabase login
```

### 3. Link al proyecto

```bash
cd /workspaces/Diario-Santiago
supabase link --project-ref eafpqpfzadpyhmidjwff
```

### 4. Desplegar la función

```bash
supabase functions deploy run_automation
```

## ⚙️ Configurar Variables de Entorno

En Supabase Dashboard:

1. Ve a **Edge Functions** → **run_automation** → **Settings**
2. Agrega las siguientes variables:

```bash
AI_PROVIDER=gemini
GEMINI_API_KEY=tu-api-key-aqui
```

**Obtener Gemini API Key** (Gratis):
- Ve a https://makersuite.google.com/app/apikey
- Crea una nueva API key
- Cópiala y pégala en Supabase

**Alternativa: Usar OpenAI**:
```bash
AI_PROVIDER=openai
OPENAI_API_KEY=tu-api-key-de-openai
```

## 🧪 Probar la Función

### Opción 1: Desde el terminal

```bash
# Configurar variables de entorno
export SUPABASE_URL="https://eafpqpfzadpyhmidjwff.supabase.co"
export SUPABASE_SERVICE_KEY="tu-service-role-key"

# Ejecutar el script de prueba
./test-automation.sh
```

### Opción 2: Con curl directo

```bash
curl -X POST \
  'https://eafpqpfzadpyhmidjwff.supabase.co/functions/v1/run_automation?force=true' \
  -H "Authorization: Bearer TU_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

### Opción 3: Desde el Panel Admin

1. Ve a **Admin** → **Automatización**
2. Click en **"Ejecutar Ahora"**

## 📊 Parámetros

### Query Parameters

- `force=true`: Ejecuta la automatización inmediatamente sin verificar el horario

**Ejemplo**:
```
POST /functions/v1/run_automation?force=true
```

Sin el parámetro `force`, la función solo ejecutará si coincide con el horario configurado (±5 minutos).

## 📋 Response

### Success Response

```json
{
  "success": true,
  "message": "5 artículos generados exitosamente",
  "articlesGenerated": 5,
  "executed": true
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message here"
}
```

### Not Time Response

```json
{
  "success": true,
  "message": "No es hora de ejecutar. Programado para 08:00",
  "executed": false
}
```

## 🔍 Logs

### Ver logs en tiempo real

```bash
supabase functions logs run_automation --tail
```

### Ver logs en Dashboard

1. Ve a **Edge Functions** → **run_automation** → **Logs**
2. Filtra por fecha/hora

### Ver logs en la base de datos

```sql
SELECT * FROM automation_logs 
ORDER BY created_at DESC 
LIMIT 20;
```

## 🐛 Debugging

### Verificar configuración

```sql
SELECT * FROM automation_config 
WHERE enabled = true 
ORDER BY created_at DESC 
LIMIT 1;
```

### Verificar artículos RSS disponibles

```sql
SELECT category, COUNT(*) as total
FROM articles 
WHERE rss_source_id IS NOT NULL
GROUP BY category;
```

### Verificar API key configurada

```bash
supabase functions env list
```

## 🔧 Solución de Problemas

### Error: "GEMINI_API_KEY no configurada"

1. Ve a Supabase Dashboard → Edge Functions → run_automation → Settings
2. Agrega la variable `GEMINI_API_KEY`
3. Redespliega la función: `supabase functions deploy run_automation`

### Error: "No hay artículos RSS disponibles"

1. Ejecuta primero el script de RSS: `node fetch-rss.js`
2. O llama a la función: `supabase functions invoke process_rss`
3. Verifica que las fuentes RSS estén configuradas

### Error: "Gemini API error: 429"

Has excedido la cuota de Gemini. Opciones:
1. Espera unos minutos
2. Usa OpenAI: Cambia `AI_PROVIDER` a `openai` y configura `OPENAI_API_KEY`
3. Reduce `articles_per_category` en la configuración

## 📁 Estructura de la Función

```
run_automation/
├── index.ts          # Código principal
└── README.md         # Esta documentación
```

## 🔄 Flujo de Ejecución

1. ✅ Verificar configuración activa
2. ✅ Verificar horario (si no es `force=true`)
3. ✅ Procesar RSS (llamar a `process_rss`)
4. ✅ Para cada categoría configurada:
   - Obtener artículos RSS
   - Reescribir con IA (Gemini/OpenAI)
   - Guardar en `ai_generated_articles`
5. ✅ Registrar resultado en `automation_logs`

## 📝 Notas

- **TypeScript Errors**: Los errores de TypeScript en VS Code son normales. Deno tiene su propio sistema de tipos.
- **Service Role Key**: Nunca expongas tu service role key en el cliente. Esta función usa el key del servidor automáticamente.
- **Rate Limits**: Gemini tiene límites de uso. Para producción considera OpenAI o aumenta el delay entre artículos.

## 🎯 Próximos Pasos

1. ✅ Desplegada la función
2. ⬜ Configurar variables de entorno
3. ⬜ Probar con `force=true`
4. ⬜ Configurar cron job (GitHub Actions o pg_cron)
5. ⬜ Monitorear logs

## 📚 Recursos

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Deno Deploy](https://deno.com/deploy)
- [Gemini API Docs](https://ai.google.dev/docs)
