<?php

return [
    /*
     * Families offered in the editor. "local" ones ship with the site (resources/css/fonts.css);
     * the rest load from fonts.bunny.net only when a page uses them.
     */
    'fonts' => [
        ['name' => 'Fraunces', 'slug' => 'fraunces', 'kind' => 'serif', 'local' => true],
        ['name' => 'Young Serif', 'slug' => 'young-serif', 'kind' => 'serif'],
        ['name' => 'DM Serif Display', 'slug' => 'dm-serif-display', 'kind' => 'serif'],
        ['name' => 'Playfair Display', 'slug' => 'playfair-display', 'kind' => 'serif'],
        ['name' => 'Lora', 'slug' => 'lora', 'kind' => 'serif'],
        ['name' => 'Cormorant Garamond', 'slug' => 'cormorant-garamond', 'kind' => 'serif'],
        ['name' => 'EB Garamond', 'slug' => 'eb-garamond', 'kind' => 'serif'],
        ['name' => 'Libre Baskerville', 'slug' => 'libre-baskerville', 'kind' => 'serif'],
        ['name' => 'Merriweather', 'slug' => 'merriweather', 'kind' => 'serif'],
        ['name' => 'Inter', 'slug' => 'inter', 'kind' => 'sans', 'local' => true],
        ['name' => 'DM Sans', 'slug' => 'dm-sans', 'kind' => 'sans'],
        ['name' => 'Manrope', 'slug' => 'manrope', 'kind' => 'sans'],
        ['name' => 'Plus Jakarta Sans', 'slug' => 'plus-jakarta-sans', 'kind' => 'sans'],
        ['name' => 'Montserrat', 'slug' => 'montserrat', 'kind' => 'sans'],
        ['name' => 'Poppins', 'slug' => 'poppins', 'kind' => 'sans'],
        ['name' => 'Outfit', 'slug' => 'outfit', 'kind' => 'sans'],
        ['name' => 'Raleway', 'slug' => 'raleway', 'kind' => 'sans'],
        ['name' => 'Work Sans', 'slug' => 'work-sans', 'kind' => 'sans'],
        ['name' => 'Fredoka', 'slug' => 'fredoka', 'kind' => 'round', 'local' => true],
        ['name' => 'Nunito', 'slug' => 'nunito', 'kind' => 'round'],
        ['name' => 'Quicksand', 'slug' => 'quicksand', 'kind' => 'round'],
        ['name' => 'Varela Round', 'slug' => 'varela-round', 'kind' => 'round'],
        ['name' => 'Baloo 2', 'slug' => 'baloo-2', 'kind' => 'round'],
        ['name' => 'Comfortaa', 'slug' => 'comfortaa', 'kind' => 'round'],
        ['name' => 'M PLUS Rounded 1c', 'slug' => 'm-plus-rounded-1c', 'kind' => 'round'],
    ],

    /* Every public page, keyed by its Inertia component. "slug" pages preview their first published item. */
    'pages' => [
        'Home' => ['label' => 'Inicio', 'path' => '/'],
        'About' => ['label' => 'Conócenos', 'path' => '/conocenos'],
        'Ministries' => ['label' => 'Ministerios', 'path' => '/ministerios'],
        'Ministry' => ['label' => 'Ministerio (detalle)', 'path' => '/ministerios/{slug}', 'slug' => 'ministry'],
        'Visit' => ['label' => 'Planifica tu visita', 'path' => '/visita'],
        'Baptisms' => ['label' => 'Bautismos', 'path' => '/bautismos'],
        'Sermons' => ['label' => 'Prédicas', 'path' => '/predicas'],
        'Teachings' => ['label' => 'Recursos', 'path' => '/recursos'],
        'Events' => ['label' => 'Eventos', 'path' => '/eventos'],
        'Galleries' => ['label' => 'Galería', 'path' => '/galeria'],
        'Gallery' => ['label' => 'Álbum de galería', 'path' => '/galeria/{slug}', 'slug' => 'gallery'],
        'Devotionals' => ['label' => 'Devocionales', 'path' => '/devocionales'],
        'Devotional' => ['label' => 'Devocional (lectura)', 'path' => '/devocionales/{slug}', 'slug' => 'devotional'],
        'Serve' => ['label' => 'Involúcrate', 'path' => '/involucrate'],
        'ServeArea' => ['label' => 'Área de servicio', 'path' => '/involucrate/{slug}', 'slug' => 'serve'],
        'ServerRoute' => ['label' => 'Ruta del servidor', 'path' => '/ruta-del-servidor'],
        'Radio' => ['label' => 'Radio', 'path' => '/radio'],
        'Give' => ['label' => 'Generosidad', 'path' => '/dar'],
        'Contact' => ['label' => 'Contacto', 'path' => '/contacto'],
        'Acceso' => ['label' => 'Acceso al sistema', 'path' => '/acceso'],
        'Estudios/Acceso' => ['label' => 'Acceso de estudiantes', 'path' => '/estudios/acceso'],
        'AccesoAdmin' => ['label' => 'Acceso del panel', 'path' => '/acceso', 'host' => 'admin'],
    ],

    /* Page keys saved before the editor knew every page. */
    'legacy_pages' => [
        'home' => ['Home'],
        'about' => ['About'],
        'ministries' => ['Ministries', 'Ministry'],
        'visit' => ['Visit'],
        'baptisms' => ['Baptisms'],
        'sermons' => ['Sermons'],
        'give' => ['Give'],
        'contact' => ['Contact'],
        'acceso' => ['Acceso'],
    ],

    /* Drawings and animations the editor can recolor, slow down, freeze or hide. An empty color follows the palette accent. */
    'art' => [
        'acceso' => [
            'label' => 'Escena del acceso',
            'text' => 'El escritorio animado con la computadora, la llave y la cinta.',
            'page' => 'Acceso',
            'can_hide' => true,
            'colors' => [
                'sky' => ['label' => 'Fondo', 'value' => '#f0e4d4'],
                'desk' => ['label' => 'Escritorio', 'value' => '#c9ae96'],
                'screen' => ['label' => 'Pantalla', 'value' => '#2b3342'],
                'accent' => ['label' => 'Acento', 'value' => '#c45c26'],
                'gold' => ['label' => 'Dorado', 'value' => '#e0b062'],
            ],
        ],
        'prayer' => [
            'label' => 'Luz de oración',
            'text' => 'Los halos de «Cómo oramos por ti» y el brillo al enviar una petición.',
            'page' => 'Contact',
            'can_hide' => false,
            'colors' => [
                'accent' => ['label' => 'Halos', 'value' => ''],
                'glow' => ['label' => 'Brillo', 'value' => '#f0d090'],
            ],
        ],
        'study' => [
            'label' => 'Vista del aula',
            'text' => 'La ilustración de la plataforma de estudios.',
            'page' => 'ServerRoute',
            'can_hide' => true,
            'colors' => [
                'background' => ['label' => 'Fondo', 'value' => '#ebe4da'],
                'accent' => ['label' => 'Acento', 'value' => ''],
            ],
        ],
        'radio' => [
            'label' => 'Ecualizador de la radio',
            'text' => 'Las barras que se mueven con la música.',
            'page' => 'Radio',
            'can_hide' => false,
            'colors' => [
                'bars' => ['label' => 'Barras', 'value' => '#ffffff'],
            ],
        ],
        'rail' => [
            'label' => 'Carrusel de servicio',
            'text' => 'El zoom suave de la foto activa en «Involúcrate».',
            'page' => 'Home',
            'can_hide' => false,
            'colors' => [],
        ],
        'write' => [
            'label' => 'Frase que se escribe sola',
            'text' => 'La cita que aparece letra por letra.',
            'page' => 'About',
            'can_hide' => false,
            'colors' => [],
        ],
        'cue' => [
            'label' => 'Flecha «desliza»',
            'text' => 'La flecha que invita a bajar en la portada.',
            'page' => 'About',
            'can_hide' => true,
            'colors' => [],
        ],
        'reveal' => [
            'label' => 'Aparición al desplazar',
            'text' => 'Títulos, textos y fotos que aparecen al bajar por cualquier página.',
            'page' => null,
            'can_hide' => false,
            'colors' => [],
        ],
    ],

    'defaults' => [
        'palette' => [
            'paper' => '#fdfcfa',
            'card' => '#ffffff',
            'ink' => '#1a1a1a',
            'muted' => '#5c5853',
            'line' => '#e7e1d8',
            'accent' => '#c14a09',
            'stone' => '#ebe4da',
            'clay' => '#ead8c9',
        ],
        'fonts' => [
            'heading' => 'Fraunces',
            'text' => 'Inter',
            'accent' => 'Fredoka',
        ],
        'sizes' => [
            'title' => 1,
            'subtitle' => 1,
            'text' => 1,
        ],
        'shape' => 'round',
    ],
];
