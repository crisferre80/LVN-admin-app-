# Mejoras en la Generación de Contenido con IA

## 🎯 Problema Identificado

El artículo generado con la IA no se enfocaba bien en el tema solicitado, comparado con ChatGPT que generaba respuestas más completas y precisas con el mismo prompt.

## 🔍 Causas del Problema

1. **Prompt sobrecargado**: El prompt incluía demasiada información irrelevante del artículo existente
2. **Estructura confusa**: Mezcla de system prompt y user prompt sin clara separación
3. **Investigación web sin formato**: Los datos de otros diarios saturaban el contexto
4. **Parámetros conservadores**: Temperature y maxTokens muy bajos
5. **Falta de instrucciones claras**: El prompt no era lo suficientemente directo

## ✅ Soluciones Implementadas

### 1. Reestructuración del Prompt

#### Antes:
```typescript
generationPrompt = `${selectedPrompt.systemPrompt}

INFORMACIÓN DEL ARTÍCULO ACTUAL:
- Título: "${formData.title || 'Sin título'}"
- Descripción: "${formData.description || 'Sin descripción disponible'}"
- Categoría: ${formData.category}
- Contenido existente: "${formData.content ? formData.content.replace(/<[^>]*>/g, '').substring(0, 1000) : 'Sin contenido previo'}"
- Fuente: ${formData.rss_source_id ? `Fuente RSS ID: ${formData.rss_source_id}` : 'Artículo propio'}

${researchData ? `INFORMACIÓN INVESTIGADA EN LA WEB:\n${researchData}\n\n` : ''}

${selectedPrompt.userPromptTemplate.replace('{topic}', baseTopic)...}`;
```

#### Después:
```typescript
// Para prompts personalizados
systemPromptForAI = 'Eres un periodista profesional experto. Genera contenido de alta calidad siguiendo exactamente las instrucciones del usuario.';

generationPrompt = `INSTRUCCIONES DEL USUARIO:\n${customPrompt.trim()}\n\n`;
generationPrompt += `TEMA PRINCIPAL: ${baseTopic}\n`;
generationPrompt += `CATEGORÍA: ${formData.category}\n\n`;

if (researchData) {
  generationPrompt += `INFORMACIÓN DE REFERENCIA (usa como contexto pero NO copies literalmente):\n${researchData}\n\n`;
}

generationPrompt += `IMPORTANTE: Concéntrate en el tema principal "${baseTopic}" y sigue las instrucciones del usuario...`;

// Para estilos predefinidos
generationPrompt = `TEMA DEL ARTÍCULO: ${baseTopic}\n`;
generationPrompt += `CATEGORÍA: ${formData.category}\n`;
generationPrompt += `ESTILO REQUERIDO: ${selectedPrompt.name}\n\n`;

// Instrucciones claras y numeradas
generationPrompt += `INSTRUCCIONES:\n`;
generationPrompt += `- Escribe un artículo periodístico completo sobre "${baseTopic}"\n`;
generationPrompt += `- Longitud: ${selectedPrompt.minWords}-${selectedPrompt.maxWords} palabras\n`;
generationPrompt += `- Mantén el foco en el tema principal en todo momento\n`;
```

### 2. Optimización de la Investigación Web

#### Antes:
```typescript
function formatResearchResults(results: ResearchResult[]): string {
  let formatted = '## Información de referencia de otros medios:\n\n';
  
  results.forEach((result, index) => {
    formatted += `### Fuente ${index + 1}: ${result.source}\n`;
    formatted += `**${result.title}**\n`;
    formatted += `${result.snippet}\n`;
    if (result.url) {
      formatted += `URL: ${result.url}\n`;
    }
    formatted += '\n';
  });
  
  return formatted;
}
```

#### Después:
```typescript
function formatResearchResults(results: ResearchResult[]): string {
  // Limitar a los 3 resultados más relevantes
  const topResults = results.slice(0, 3);
  
  let formatted = '📰 INFORMACIÓN DE CONTEXTO (resumida de medios reconocidos):\n\n';

  topResults.forEach((result, index) => {
    formatted += `${index + 1}. ${result.source}: ${result.snippet}\n\n`;
  });

  formatted += '⚠️ IMPORTANTE: Esta información es solo CONTEXTO y REFERENCIA. Debes:\n';
  formatted += '- Escribir el artículo con tus propias palabras\n';
  formatted += '- Mantener objetividad periodística\n';
  formatted += '- Enfocarte en el tema principal solicitado\n';

  return formatted;
}
```

**Beneficios:**
- Reduce de ~5-10 resultados a solo 3 más relevantes
- Formato más limpio y conciso
- Instrucciones claras de cómo usar la información
- Reduce el riesgo de que la IA copie textualmente

### 3. Ajuste de Parámetros de OpenAI

#### Antes:
```typescript
{
  model: 'gpt-4o-mini',
  systemPrompt: useCustomPrompt ? '' : selectedPrompt.systemPrompt,
  temperature: 0.7,
  maxTokens: Math.min(selectedPrompt.maxWords * 4, 16000)
}
```

#### Después:
```typescript
{
  model: 'gpt-4o-mini',
  systemPrompt: systemPromptForAI, // Siempre presente y optimizado
  temperature: 0.8, // Aumentado para más creatividad
  maxTokens: Math.min(selectedPrompt.maxWords * 5, 16000) // Más tokens
}
```

**Cambios:**
- **Temperature**: 0.7 → 0.8 (más creatividad y variedad)
- **MaxTokens**: palabras × 4 → palabras × 5 (25% más espacio)
- **SystemPrompt**: Siempre presente, nunca vacío

### 4. Logging Mejorado para Debugging

Se agregó logging detallado en múltiples puntos:

**En ArticleEditor.tsx:**
```typescript
console.log('📋 Parámetros:', { 
  useCustomPrompt, 
  useWebResearch, 
  customTopic,
  selectedProvider,
  selectedStyle 
});

console.log('✅ Información de investigación obtenida:', 
  researchData.length, 'caracteres');

console.log('📝 Prompt generado:', {
  systemPrompt: systemPromptForAI.substring(0, 100) + '...',
  promptLength: generationPrompt.length,
  hasResearch: !!researchData
});

console.log('📄 Prompt completo:\n', generationPrompt);
```

**En generate-openai.ts (Netlify Function):**
```typescript
console.log('📥 Request recibido:', {
  model,
  temperature,
  maxTokens,
  promptLength: prompt?.length || 0,
  systemPromptLength: systemPrompt?.length || 0
});

console.log('✅ Contenido generado exitosamente:', {
  contentLength: generatedContent.length,
  usage: data.usage,
  model: data.model
});
```

### 5. Separación Clara de System y User Prompts

Ahora hay una clara separación entre:

**System Prompt** (Define el rol y comportamiento):
- Modo personalizado: "Eres un periodista profesional experto..."
- Modo estándar: Usa el prompt del estilo seleccionado

**User Prompt** (Instrucciones específicas):
- Tema principal
- Categoría
- Estilo requerido
- Información de referencia (si existe)
- Instrucciones numeradas y claras

## 📊 Comparación de Resultados

### Antes:
- Prompt largo y confuso (~3000-5000 caracteres)
- Información irrelevante del artículo existente
- Investigación web sin estructura (hasta 2000 caracteres)
- La IA se desviaba del tema principal
- Respuestas genéricas o incompletas

### Después:
- Prompt optimizado y enfocado (~1500-2500 caracteres)
- Solo información relevante
- Investigación web resumida (máx 3 fuentes, ~500 caracteres)
- La IA se mantiene en el tema solicitado
- Respuestas completas y detalladas

## 🧪 Cómo Probar las Mejoras

1. **Abrir el editor de artículos**
2. **Click en "Generar con IA"**
3. **Ingresar un tema específico**: Ej: "Impacto de la inteligencia artificial en el periodismo argentino"
4. **Opciones recomendadas:**
   - Usar prompt personalizado: NO (para probar estilos predefinidos)
   - Investigar en otros diarios: SÍ
   - Proveedor: OpenAI
   - Estilo: Noticia Objetiva
5. **Abrir la consola del navegador (F12)** para ver los logs
6. **Generar el artículo**

### Qué observar:

En la **consola del navegador** verás:
```
📋 Parámetros: {...}
🔍 Investigando en la web...
✅ Información de investigación obtenida: X caracteres
📝 Prompt generado: {...}
📄 Prompt completo: [aquí verás el prompt exacto enviado]
🚀 Llamando a Netlify Function de OpenAI...
✅ Contenido generado exitosamente
```

En los **logs de Netlify** (si tienes acceso):
```
📥 Request recibido: {...}
✅ API key encontrada
📝 System prompt agregado
🚀 Llamando a OpenAI API...
✅ Contenido generado exitosamente: {...}
```

## 💡 Recomendaciones de Uso

### Para Mejores Resultados:

1. **Temas específicos son mejores**
   - ❌ "Economía"
   - ✅ "Nuevas medidas económicas del gobierno argentino en 2026"

2. **Usa la investigación web selectivamente**
   - Para temas actuales y de noticias: SÍ
   - Para análisis de opinión: NO necesariamente
   - Para temas técnicos: Puede ayudar

3. **Prompt personalizado vs Estilos predefinidos**
   - Prompts personalizados: Para control total
   - Estilos predefinidos: Para rapidez y consistencia

4. **Ajusta según el proveedor**
   - OpenAI (gpt-4o-mini): Mejor balance calidad/costo
   - Google Gemini: Bueno para análisis largos
   - OpenRouter: Acceso a múltiples modelos

## 🐛 Solución de Problemas

### Si el artículo aún no se enfoca en el tema:

1. **Verifica el prompt en la consola**
   - Busca `📄 Prompt completo:`
   - Asegúrate de que el tema principal esté claro

2. **Revisa si hay demasiada información de investigación**
   - Si ves >1000 caracteres de research, puede estar saturando

3. **Prueba sin investigación web primero**
   - Desactiva "Investigar en otros diarios"
   - Si funciona bien, el problema es el formato de la investigación

4. **Prueba con prompt personalizado**
   - Escribe instrucciones muy específicas
   - Ejemplo: "Escribe SOLO sobre el impacto económico, no menciones aspectos sociales"

5. **Aumenta maxTokens si la respuesta se corta**
   - Edita el código si es necesario
   - Considera usar gpt-4 para respuestas más largas

## 📈 Próximas Mejoras

- [ ] Sistema de templates para research sources
- [ ] Caché de investigación web para evitar búsquedas repetidas
- [ ] Modo "strict focus" que penaliza desviaciones del tema
- [ ] Análisis post-generación para verificar relevancia
- [ ] Feedback loop para mejorar prompts automáticamente
