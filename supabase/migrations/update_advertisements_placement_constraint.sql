-- Actualizar restricción de placement para incluir todos los valores usados en el código
-- Fecha: 2025-12-01

DO $$
BEGIN
    -- Primero eliminar la restricción existente si existe
    ALTER TABLE advertisements DROP CONSTRAINT IF EXISTS advertisements_placement_check;

    -- Crear la nueva restricción con todos los valores permitidos
    ALTER TABLE advertisements ADD CONSTRAINT advertisements_placement_check
        CHECK (placement IN (
            'header',
            'sidebar',
            'footer',
            'content',
            'home',
            'Nacionales',
            'Regionales',
            'Internacionales',
            'Economía',
            'Deportes',
            'Espectáculos',
            'Agro',
            'Turismo',
            'Política',
            'Misceláneas',
            'Medio Ambiente',
            'Opinión',
            'Salud',
            'Tecnologia',
            'Ciencia',
            'Clasificados',
            'Noticias de la Gente'
        ));

    RAISE NOTICE 'Restricción de placement actualizada con todas las categorías del diario';
END $$;