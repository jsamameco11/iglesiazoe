# Iglesia Cristiana Zoe

Sitio público, panel de administración y portal de servidores de la Iglesia Cristiana Zoe.

## Carpetas

| Carpeta | Contenido |
| --- | --- |
| `iglesia-zoe-laravel/` | La aplicación en producción: Laravel 13, Inertia, React 19, Vite y Tailwind 4. |
| `iglesia-zoe-laravel/deploy/` | Scripts para publicar en el VPS y la configuración de Apache. |
| `docs/` | Documentos del proyecto (inventario de secciones y funcionalidades). |

Las versiones anteriores (Next.js y las plantillas PHP de 2021) se retiraron del repositorio; siguen disponibles en el historial de git hasta el commit `1172e3c`.

## Producción

- Servidor: VPS `161.132.51.100`, aplicación en `/opt/iglesia-zoe-app`, servida por Apache con PHP 8.3-FPM.
- Dominios: `iglesiacristianazoe.miacademiapreu.com` (diseño Casa), `iglesiacristianazoe2.miacademiapreu.com` (diseño Luz) y `admi-iglesiazoe.miacademiapreu.com`.
- Base de datos: Postgres en Supabase (esquema `zoe`). En local se usa SQLite.

## Trabajo diario

Desde `iglesia-zoe-laravel/`:

```powershell
composer install
npm install
copy .env.example .env      # completar SEED_PASSWORD
php artisan key:generate
php artisan migrate --seed
php artisan db:seed --class=AccessSeeder   # opcional: cuentas de prueba (requiere TEST_ACCOUNTS_PASSWORD)
composer run dev
```

Para publicar (compila el frontend, sube el código, corre las migraciones pendientes y limpia cachés; no toca los archivos subidos):

```powershell
powershell -ExecutionPolicy Bypass -File deploy\release.ps1
```

Cada publicación deja en el servidor un respaldo del código anterior en `/root/zoe-code-before-<fecha>.tgz`. Los datos viven en Supabase y se respaldan desde su panel.
