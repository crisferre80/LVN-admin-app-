# Nuevas Funcionalidades del Editor de Artículos

## 🎯 Resumen de Cambios

Se han agregado tres características principales al modal de "Generar con IA" en el editor de artículos:

### 1. 📝 Prompts Personalizados

Ahora puedes escribir tus propias instrucciones personalizadas para la IA en lugar de usar los estilos predefinidos.

**Cómo usar:**
- En el modal "Generar con IA", marca la casilla "Usar prompt personalizado"
- Escribe tus instrucciones específicas en el área de texto
- La IA generará el contenido siguiendo exactamente tus indicaciones

**Ejemplo de prompt personalizado:**
```
Escribe un artículo informativo sobre energías renovables en Argentina, 
incluyendo:
- Estadísticas actuales de producción
- Opiniones de al menos 3 expertos del sector
- Análisis de impacto económico y ambiental
- Proyecciones para los próximos 5 años
El tono debe ser profesional pero accesible para el público general.
```

### 2. 💾 Sistema de Plantillas

Guarda tus prompts personalizados favoritos como plantillas reutilizables.

**Funcionalidades:**
- **Guardar:** Cuando escribes un prompt personalizado, haz clic en "💾 Guardar como plantilla"
- **Cargar:** Accede a tus plantillas guardadas haciendo clic en el botón "Plantillas (N)"
- **Eliminar:** Elimina plantillas que ya no necesites
- **Almacenamiento:** Las plantillas se guardan en el navegador (localStorage) y persisten entre sesiones

**Casos de uso:**
- Crear plantillas para diferentes secciones del diario (deportes, economía, etc.)
- Guardar instrucciones específicas para diferentes tonos o estilos
- Compartir plantillas exitosas entre editores (exportando/importando el localStorage)

### 3. 🌐 Investigación Web Automática

La IA puede investigar el tema en otros diarios antes de generar el artículo, creando contenido más informado y preciso.

**Cómo funciona:**
1. Marca la casilla "Investigar en otros diarios"
2. La IA buscará información sobre tu tema en medios reconocidos:
   - Clarín, La Nación, Infobae, Página 12
   - El País, El Mundo, BBC, CNN, Reuters
   - Y otros medios de Latinoamérica
3. Usará esta información como contexto para escribir un artículo más completo

**Beneficios:**
- Artículos más fundamentados con información de múltiples fuentes
- Mejor cobertura de diferentes perspectivas
- Mayor precisión en datos y estadísticas
- Contenido más rico y contextualizado

**Notas:**
- La investigación web funciona mejor con temas específicos y actuales
- Requiere conexión a internet activa
- Puede tardar unos segundos adicionales (se mostrará "Investigando y generando...")

## 🔧 Configuración Opcional

### APIs de Búsqueda (Opcional)

Por defecto, el sistema usa DuckDuckGo (sin API key requerida), pero puedes configurar APIs más potentes:

#### Google Custom Search
Agrega estas variables en tu archivo `.env`:
```env
VITE_GOOGLE_SEARCH_API_KEY=tu_api_key
VITE_GOOGLE_SEARCH_ENGINE_ID=tu_engine_id
```

#### NewsAPI
```env
VITE_NEWS_API_KEY=tu_api_key
```

## 💡 Flujo de Trabajo Recomendado

### Opción 1: Prompt Personalizado
1. Marca "Usar prompt personalizado"
2. Escribe instrucciones específicas
3. (Opcional) Activa "Investigar en otros diarios"
4. Genera el artículo
5. Si te gusta el resultado, guarda el prompt como plantilla

### Opción 2: Estilos Predefinidos
1. Mantén desmarcado "Usar prompt personalizado"
2. Ingresa el tema del artículo
3. Selecciona el proveedor de IA
4. Elige un estilo periodístico
5. (Opcional) Activa "Investigar en otros diarios"
6. Genera el artículo

## 📊 Ejemplos de Plantillas

### Plantilla: Análisis Económico
```
Escribe un análisis económico profesional sobre {tema}, incluyendo:
- Contexto histórico reciente (últimos 6 meses)
- Datos estadísticos con fuentes
- Opiniones de 2-3 economistas reconocidos
- Impacto en diferentes sectores
- Proyecciones y escenarios posibles
Longitud: 800-1000 palabras. Tono: profesional y objetivo.
```

### Plantilla: Nota de Interés Humano
```
Redacta una nota emotiva sobre {tema} que:
- Comience con una anécdota personal
- Incluya citas textuales de los protagonistas
- Describa el contexto social
- Termine con un mensaje inspirador
Longitud: 600-700 palabras. Tono: cercano y empático.
```

### Plantilla: Cobertura Deportiva
```
Escribe una crónica deportiva sobre {tema}:
- Resumen del evento con momentos clave
- Estadísticas y resultados
- Declaraciones de jugadores/técnicos
- Análisis táctico
- Próximos desafíos
Longitud: 500-600 palabras. Tono: dinámico y apasionado.
```

## 🔒 Privacidad y Seguridad

- Las plantillas se almacenan localmente en tu navegador
- La investigación web solo consulta fuentes públicas
- No se comparte información sensible con servicios externos
- Las API keys se manejan de forma segura

## 🐛 Solución de Problemas

**La investigación web no funciona:**
- Verifica tu conexión a internet
- Algunos temas muy específicos pueden no tener resultados
- Intenta reformular el tema de búsqueda

**No se guardan las plantillas:**
- Verifica que tu navegador permita localStorage
- No uses modo incógnito/privado
- Comprueba que no tengas bloqueadores que interfieran

**La generación es muy lenta:**
- La investigación web agrega 5-10 segundos adicionales
- Desactívala si necesitas resultados más rápidos
- Considera cambiar de proveedor de IA

## 🚀 Próximas Mejoras

- Exportar/importar plantillas
- Compartir plantillas entre usuarios
- Más fuentes de noticias configurables
- Análisis de sentimiento de las fuentes investigadas
- Sugerencias automáticas de prompts basadas en la categoría
