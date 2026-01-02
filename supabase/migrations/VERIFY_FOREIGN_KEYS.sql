# 🔍 Verificación en Supabase para Error 23503

## El Problema

Cuando intenta guardar galería, falla con:
```
Error 23503: foreign key constraint "gallery_images_article_id_fkey"
Key is not present in table "articles"
```

---

## 🎯 Verificación Paso a Paso

### Verificación 1: ¿Existe la Tabla articles?

**En Supabase SQL Editor, ejecuta:**

```sql
SELECT * FROM articles LIMIT 5;
```

**Deberías ver:**
```
┌──────────────────┬───────────┬────────────┐
│ id (uuid)        │ title     │ author     │
├──────────────────┼───────────┼────────────┤
│ 550e8400-...     │ Mi título │ Mi nombre  │
│ 650e8400-...     │ Otro art. │ Otro autor │
└──────────────────┴───────────┴────────────┘
```

**Si aparece**: ✅ Tabla existe  
**Si error "table not found"**: ❌ Tabla NO existe (PROBLEMA)

---

### Verificación 2: ¿Existe la Tabla gallery_images?

**En Supabase SQL Editor, ejecuta:**

```sql
SELECT * FROM gallery_images LIMIT 5;
```

**Deberías ver:**
```
┌──────────────────┬──────────────────┬──────────────┐
│ id (uuid)        │ article_id (fk)  │ image_url    │
├──────────────────┼──────────────────┼──────────────┤
│ 750e8400-...     │ 550e8400-...     │ https://...  │
└──────────────────┴──────────────────┴──────────────┘
```

**Si aparece**: ✅ Tabla existe  
**Si error**: ❌ Problema

---

### Verificación 3: ¿Las Foreign Keys Están Bien?

**En Supabase SQL Editor, ejecuta:**

```sql
SELECT 
  constraint_name,
  table_name,
  column_name,
  foreign_table_name,
  foreign_column_name
FROM information_schema.key_column_usage
WHERE table_name IN ('gallery_images', 'ai_gallery_images')
  AND foreign_table_name IS NOT NULL;
```

**Deberías ver:**
```
┌─────────────────────────┬──────────────┬────────────┬───────────────────┬───────────────┐
│ constraint_name         │ table_name   │ column     │ foreign_table     │ foreign_col   │
├─────────────────────────┼──────────────┼────────────┼───────────────────┼───────────────┤
│ gallery_images_article  │ gallery_img  │ article_id │ articles          │ id            │
│ ai_gallery_images_art   │ ai_gallery.. │ article_id │ ai_generated_art..│ id            │
└─────────────────────────┴──────────────┴────────────┴───────────────────┴───────────────┘
```

**Si aparece**: ✅ FK correctas  
**Si no aparece**: ❌ FK NO existen (PROBLEMA)

---

### Verificación 4: ¿El Artículo que Intentas Referenciar Existe?

**Si tu artículo tiene ID `550e8400-e29b-41d4-a716-446655440000`, ejecuta:**

```sql
SELECT id, title, created_at 
FROM articles 
WHERE id = '550e8400-e29b-41d4-a716-446655440000';
```

**Si aparece**: ✅ El artículo existe  
**Si NO aparece**: ❌ El artículo NO existe (PROBLEMA)

---

### Verificación 5: ¿Las RLS Policies Están Correctas?

**En Supabase SQL Editor, ejecuta:**

```sql
SELECT policyname, roles, permissive, cmd
FROM pg_policies
WHERE tablename IN ('gallery_images', 'ai_gallery_images')
ORDER BY tablename, cmd;
```

**Deberías ver algo como:**

```
┌────────────────────────────────┬───────┬──────────┬────────┐
│ policyname                     │ roles │ perm     │ cmd    │
├────────────────────────────────┼───────┼──────────┼────────┤
│ Anyone can view gallery images │ {}    │ true     │ SELECT │
│ Auth users can insert gallery  │ {}    │ true     │ INSERT │
│ Users can update gallery       │ {}    │ true     │ UPDATE │
│ Users can delete gallery       │ {}    │ true     │ DELETE │
└────────────────────────────────┴───────┴──────────┴────────┘
```

**Si ves**:
- ✅ SELECT → Lectura OK
- ✅ INSERT → Escritura OK
- ❌ INSERT falta → PROBLEMA (ejecuta FIX_RLS_POLICIES.sql)

---

### Verificación 6: TEST - Intenta Insertar Manualmente

**Primero, obtén un ID válido:**

```sql
SELECT id FROM articles LIMIT 1;
```

Supongamos que es `550e8400-e29b-41d4-a716-446655440000`

**Intenta insertar:**

```sql
INSERT INTO gallery_images (
  article_id, 
  image_url, 
  alt_text, 
  position, 
  template_type
) VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'https://example.com/test.jpg',
  'Test image',
  0,
  'list'
);
```

**Resultado:**
- ✅ "INSERT 0 1" → Funciona
- ❌ "Error 23503" → FK constraint falla
- ❌ "Error 42501" → RLS bloquea

---

## 🎯 Checklist de Diagnóstico

```
☐ Table articles existe
☐ Table gallery_images existe
☐ Foreign Key constraints definidas
☐ Article_id que intentas usar EXISTE
☐ RLS INSERT policy existe
☐ TEST manual de INSERT funciona
```

Si todos ✅ → El problema está en la APP  
Si alguno ❌ → El problema está en la BD

---

## 🔧 Fixes por Problema

### Problema: RLS INSERT policy falta

**Solución:**
```sql
CREATE POLICY "Authenticated users can insert gallery images"
  ON gallery_images FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
```

**O ejecuta:**
```
FIX_RLS_POLICIES.sql
```

---

### Problema: Foreign Key falta

**Solución:**
```sql
ALTER TABLE gallery_images
ADD CONSTRAINT gallery_images_article_id_fkey
FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE;
```

---

### Problema: article_id es NULL/undefined

**Solución:**
Verificar en ArticlesManager.tsx que `articleId` se asigna correctamente:
```typescript
const { data, error } = await supabase.insert([articleData]);
if (error) throw error;
articleId = data?.id; // ← Debe tener valor aquí
```

---

## 📊 Tabla de Diagnóstico

| Síntoma | Causa Probable | Fix |
|---------|---|---|
| Error 23503 + "Key not present" | article_id no existe | Verifica que artículo se guardó |
| Error 23503 + todo existe | RLS falla en INSERT | Ejecuta FIX_RLS_POLICIES.sql |
| Error 42501 | RLS falta política INSERT | Ejecuta FIX_RLS_POLICIES.sql |
| "undefined" en console | articleId no se asignó | Verifica código ArticlesManager |
| Table not found | Tabla no existe | Verifica migraciones de Supabase |

---

## 🎬 Pasos Recomendados

1. Ejecuta Verificación 3 (FK constraints)
   - ¿Existen? → Sí
   - ¿No? → Hay un problema de esquema

2. Ejecuta TEST (Verificación 6)
   - ¿Funciona? → Problema está en APP
   - ¿Falla? → Problema está en BD

3. Si falla con 42501 → Ejecuta FIX_RLS_POLICIES.sql

4. Si falla con 23503 → Verifica que article_id existe

---

## 📞 Información para Reportar

Si algo está mal, necesito:

```
1. Output de Verificación 3 (FK constraints)
2. Output de Verificación 6 (TEST INSERT)
3. El ID del artículo que intentas usar
4. El error exacto que ves
```

---

**Ejecuta estas verificaciones y cuéntame qué encuentras.** 🔍
