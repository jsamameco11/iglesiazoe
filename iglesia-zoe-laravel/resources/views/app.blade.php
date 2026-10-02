<!DOCTYPE html>
<html lang="es" data-skin="{{ $page['props']['skin'] ?? 'aire' }}" class="h-full antialiased">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">
        <title inertia>{{ config('app.name', 'Iglesia Cristiana Zoe') }}</title>
        @if (! empty($page['props']['design']['fontHref']))
            <link rel="stylesheet" href="{{ $page['props']['design']['fontHref'] }}">
        @endif
        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.tsx', "resources/js/Pages/{$page['component']}.tsx"])
        @inertiaHead
    </head>
    <body class="min-h-full font-sans">
        @inertia
    </body>
</html>
