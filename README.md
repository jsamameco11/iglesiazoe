# Iglesia Cristiana Zoe

Sitio público y sistema de grupos celulares de Iglesia Cristiana Zoe (Chiclayo).

## Qué incluye

- Sitio público: inicio, conócenos, ministerios, bautismos, prédicas, dar y contacto.
- Portal de líderes: temas, informe semanal, historial propio y seguimiento de la red.
- Administrador: contenido, ministerios, prédicas, bautismos, generosidad, células, usuarios, temas e informes.

Las redes van de la A a la L. Cada red nace con seis células (`01A` … `06A`). Una célula hija de `06A` se llama `0106A`: la primera hija de `06A`.

## Puesta en marcha

```bash
npm install
cp .env.example .env.local
npm run setup
npm run dev
```

`npm run setup` crea las tablas en Supabase y carga redes, células, temas y usuarios. Necesita `DATABASE_URL`, `ADMIN_PASSWORD` y, si quieres el líder de ejemplo, `LEADER_USER` y `LEADER_PASSWORD`.

## Producción

Publica el proyecto en Vercel (o el hosting que ya usan) y define:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

El dominio `admi-…` abre el administrador. El dominio público abre el sitio. Los dos usan la misma aplicación.

La clave de la base de datos no va en el sitio publicado. Solo hace falta para `npm run setup`.
