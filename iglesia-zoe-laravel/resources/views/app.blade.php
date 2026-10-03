<!DOCTYPE html>
<html lang="es" data-skin="{{ $page['props']['skin'] ?? 'aire' }}" class="h-full antialiased">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">
        <title inertia>{{ isset($share) ? $share['title'].' · '.config('app.name', 'Iglesia Cristiana Zoe') : config('app.name', 'Iglesia Cristiana Zoe') }}</title>
        @isset($share)
            <meta name="description" content="{{ $share['description'] }}">
            <meta property="og:type" content="article">
            <meta property="og:site_name" content="{{ config('app.name', 'Iglesia Cristiana Zoe') }}">
            <meta property="og:title" content="{{ $share['title'] }}">
            <meta property="og:description" content="{{ $share['description'] }}">
            <meta property="og:url" content="{{ $share['url'] }}">
            <meta property="og:image" content="{{ $share['image'] }}">
            <meta property="og:image:type" content="image/jpeg">
            <meta property="og:image:width" content="1080">
            <meta property="og:image:height" content="1080">
            <meta name="twitter:card" content="summary_large_image">
        @endisset
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
