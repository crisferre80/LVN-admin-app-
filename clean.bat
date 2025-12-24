@echo off
REM Eliminar archivos SQL
del *.sql

REM Eliminar scripts JS, MJS, CJS, SH, PS1 (excepto configs si es necesario, pero asumiendo limpieza total)
del *.js
del *.mjs
del *.cjs
del *.sh
del *.ps1

REM Eliminar directorio emails
rmdir /s /q src\components\emails

REM Eliminar componentes públicos
del src\components\AdBanner.tsx
del src\components\AdCarousel.tsx
del src\components\ArticleCard.tsx
del src\components\ArticleDetail.tsx
del src\components\ClassifiedCard.tsx
del src\components\ClassifiedDetail.tsx
del src\components\ClassifiedDetailPage.tsx
del src\components\ClassifiedForm.tsx
del src\components\ClassifiedsSection.tsx
del src\components\CommentsSection.tsx
del src\components\ConnectionMonitor.tsx
del src\components\DailyHoroscope.tsx
del src\components\DollarTicker.tsx
del src\components\Editor.tsx
del src\components\Footer.tsx
del src\components\Header.tsx
del src\components\ImageGenerator.tsx
del src\components\LiveStreamDisplay.tsx
del src\components\LotteryResults.tsx
del src\components\MediaSelector.tsx
del src\components\ModalToastRenderer.tsx
del src\components\NewsCarousel.tsx
del src\components\NewsSection.tsx
del src\components\NewsTicker.tsx
del src\components\Sidebar.tsx
del src\components\SportsResults.tsx
del src\components\Todos.tsx
del src\components\UserNewsCard.tsx
del src\components\UserNewsForm.tsx
del src\components\UserNewsSection.tsx
del src\components\VideoDisplay.tsx
del src\components\WeatherWidget.tsx
del src\components\VideoManager_backup.tsx.bak
del src\components\ArticlesManager.tsx.backup

REM Eliminar archivo de ejemplo
del src\EXAMPLES_ONAUTH_STATE_CHANGE.tsx

REM Eliminar archivos de documentación y temporales
del CURRENT_STATUS.md
del COMMENTS_README.md
del COMPRESSION_CHANGES.md
del DEPLOYMENT_PROCESS_LOCAL_RSS.md
del INICIO_AQUI.txt
del RESUMEN_RAPIDO_FIX_RLS.txt
del temp_videomanager.txt

REM Eliminar directorios innecesarios
rmdir /s /q .bolt
rmdir /s /q .github
rmdir /s /q netlify
rmdir /s /q supabase
del deno.lock

echo Limpieza completada.