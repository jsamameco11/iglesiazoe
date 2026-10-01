<!DOCTYPE html>
<html lang="es" data-skin="{{ $page['props']['skin'] ?? 'aire' }}" class="h-full antialiased">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">
        <title inertia>{{ config('app.name', 'Iglesia Cristiana Zoe') }}</title>
        <link rel="preconnect" href="https://fonts.bunny.net">
        <link href="https://fonts.bunny.net/css?family=cormorant-garamond:500,500i,600,600i,700|inter:300,400,500,600,700&display=swap" rel="stylesheet" />
        <style>
            :root {
                --font-text: "Inter", ui-sans-serif, system-ui, sans-serif;
                --font-heading: "Cormorant Garamond", Garamond, "Times New Roman", serif;
            }
        </style>
        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.tsx'])
        @inertiaHead
    </head>
    <body class="min-h-full font-sans">
        @inertia
    </body>
</html>
