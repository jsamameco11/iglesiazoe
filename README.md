# Iglesia Cristiana Zoe

Sitio público, panel de administración y portal de servidores de la Iglesia Cristiana Zoe.

## Carpetas

| Carpeta | Contenido |
| --- | --- |
| `iglesia-zoe-laravel/` | La aplicación en producción: Laravel 13 (PHP 8.3), Inertia 3, React 19, Vite y Tailwind 4. |
| `iglesia-zoe-laravel/deploy/` | Scripts para publicar en el VPS y la configuración de Apache. |
| `docs/` | Documentos del proyecto (inventario de secciones y funcionalidades). |

Las versiones anteriores (Next.js y las plantillas PHP de 2021) se retiraron del repositorio; siguen disponibles en el historial de git hasta el commit `1172e3c`.

## Cómo está organizada la aplicación

Dentro de `iglesia-zoe-laravel/`:

| Ruta | Qué hay |
| --- | --- |
| `app/Domain/<Área>/` | La lógica de negocio, agrupada por área: `Access` (roles y permisos), `Auth`, `Cells`, `Finance`, `Games`, `Geo`, `Inbox`, `Media`, `Radio`, `Reports`, `Servers`, `Site` (contenido y diseño de la web), `Studies` y `Shared`. |
| `app/Http/Controllers/` | Controladores delgados que llaman al dominio: `Web` (sitio público), `Admin` (panel), `Portal` (servidores) y `Auth`. |
| `routes/` | `web.php` (sitio público y acceso), `admin.php` (panel), `cell-leader.php` (portal de servidores) y `media.php` (redirecciones a los archivos de Wasabi y versión del sitio, sin sesión). |
| `resources/js/Pages/` | Una página de Inertia por pantalla; `Admin/`, `Portal/`, `Estudios/` y `Games/` agrupan las de cada zona. |
| `resources/js/Components/` | Componentes por zona: `site`, `admin`, `portal`, `classroom` (aula de la Ruta del Servidor), `radio`, `games`, `auth`, y los genéricos en `ui` y `motion`. |
| `resources/js/lib/` | Tipos, acciones (`actions.ts`), textos editables (`copy.ts`), permisos (`access.ts`), fechas en hora de Lima (`dates.ts`) y la lógica de cliente de cada área (`radio/`, `design/`, `games.ts`, `studies.ts`…). |
| `resources/css/` | `app.css` (base y tema), `sections.css`, y hojas propias de la radio, el aula y la oración. |
| `database/` | Migraciones, seeders y datos fijos en `database/data/` (países y regiones, contenido de los juegos). |
| `scripts/` | `split-geo.mjs` corre antes de cada `npm run build` y genera `public/geo-data/`; `build-geo.mjs` regenera `database/data/geo.json` desde las fuentes (solo si cambian los países). |
| `tests/Feature/` | Pruebas de PHPUnit por área. |

## Producción

- Servidor: VPS `161.132.51.100`, aplicación en `/opt/iglesia-zoe-app`, servida por Apache con PHP 8.3-FPM.
- Dominios: `iglesiacristianazoe.miacademiapreu.com` (diseño Casa), `iglesiacristianazoe2.miacademiapreu.com` (diseño Luz) y `admi-iglesiazoe.miacademiapreu.com`.
- Base de datos: Postgres en Supabase (esquema `zoe`). En local se usa SQLite.
- Fotos, videos, audios y archivos: bucket de Wasabi (variables `WASABI_*`). Sin `WASABI_BUCKET` quedan en el disco local.

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

Pruebas y formato:

```powershell
php artisan test --compact
vendor\bin\pint --dirty
npx tsc --noEmit
```

## Publicar

Cada cambio de código se publica con:

```powershell
powershell -ExecutionPolicy Bypass -File deploy\release.ps1
```

Compila el frontend, sube el código, corre las migraciones pendientes y limpia cachés; nunca toca `.env`, la base de datos ni los archivos subidos. Cada publicación deja en el servidor un respaldo del código anterior en `/root/zoe-code-before-<fecha>.tgz`. Los datos viven en Supabase y se respaldan desde su panel.

`deploy/vps-deploy.sh` es solo para instalar la aplicación en un servidor nuevo (dependencias, `.env`, primera carga de datos, PHP-FPM y Apache). `deploy/apache/iglesia-zoe-storage.conf` impide ejecutar scripts dentro de los archivos subidos; las instrucciones para instalarlo están en el propio archivo.
