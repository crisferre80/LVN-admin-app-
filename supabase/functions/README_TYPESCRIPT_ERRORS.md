# ⚠️ Sobre los Errores de TypeScript en Edge Functions

## Errores Esperados en VS Code

Si ves estos errores en las Edge Functions:

```
No se encuentra el módulo "https://deno.land/std@0.168.0/http/server.ts"
No se encuentra el módulo "npm:resend@6.5.2"
No se encuentra el módulo "https://esm.sh/@supabase/supabase-js@2"
```

**¡No te preocupes! Esto es completamente normal.**

## ¿Por qué ocurren estos errores?

1. **VS Code usa TypeScript, no Deno**: El editor intenta validar el código con TypeScript estándar
2. **Deno usa URLs para importaciones**: TypeScript tradicional no entiende las importaciones desde URLs
3. **Los archivos funcionarán perfectamente** cuando se desplieguen en Supabase

## ✅ Solución

Estos errores **NO afectan** el funcionamiento de las Edge Functions. Para eliminarlos del editor:

### Opción 1: Instalar Deno (Recomendado)

```powershell
# Instalar Deno
irm https://deno.land/install.ps1 | iex

# Instalar extensión de Deno para VS Code
# Busca "Deno" en la tienda de extensiones
```

Luego en VS Code:
1. Presiona `Ctrl+Shift+P`
2. Escribe "Deno: Initialize Workspace Configuration"
3. Acepta

### Opción 2: Ignorar los Errores

Los errores son solo visuales. Las funciones funcionarán correctamente al desplegarse.

## 🧪 Validar las Funciones

Para validar que el código es correcto antes de desplegar:

```powershell
# Con Deno instalado
deno check supabase/functions/send-email/index.ts
deno check supabase/functions/send-bulk-email/index.ts
```

## 🚀 Despliegue

Los errores de TypeScript en VS Code **NO afectan** el despliegue. Puedes desplegar con confianza:

```powershell
.\deploy-edge-functions.ps1
```

O manualmente:

```powershell
supabase functions deploy send-email
supabase functions deploy send-bulk-email
```

## 📝 Notas Técnicas

- **Deno runtime**: Las Edge Functions se ejecutan en Deno, no en Node.js
- **Imports desde URLs**: Es la forma estándar de Deno de importar módulos
- **TypeScript nativo**: Deno ejecuta TypeScript directamente sin compilación
- **Validación en el deploy**: Supabase valida el código al desplegarlo

## ✅ Conclusión

**Estos errores son cosméticos y no afectan la funcionalidad.**

Si quieres eliminarlos del editor, instala Deno y la extensión de VS Code. Si no, simplemente ignóralos - las funciones funcionarán perfectamente al desplegarse en Supabase.
