<?php

use App\Models\Devotional;
use App\Models\ServiceGallery;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Carbon;

/**
 * Starter albums and devotionals so Galería de cultos and Devocionales never open empty.
 * They are ordinary records: the team edits, replaces the photos or deletes them from the panel.
 */
return new class extends Migration
{
    private const GALLERIES = [
        [
            'slug' => 'culto-dominical-familia-zoe',
            'title' => 'Culto dominical · Familia Zoe',
            'kind' => 'dominical',
            'when' => 'sunday',
            'summary' => 'Una mañana de adoración, Palabra y comunión. Gracias a cada familia que llegó a celebrar a Jesús con nosotros.',
            'photos' => ['banner8.jpg', 'familia1.jpg', 'banner4.jpg', 'pastores.jpg', 'man1.jpg', 'man2.jpg'],
        ],
        [
            'slug' => 'noche-de-oracion-y-palabra',
            'title' => 'Noche de oración y Palabra',
            'kind' => 'media-semana',
            'when' => 'wednesday',
            'summary' => 'En medio de la semana nos reunimos para orar unos por otros y seguir creciendo en la Palabra.',
            'photos' => ['banner4.jpg', 'man2.jpg', 'familia1.jpg', 'man1.jpg'],
        ],
        [
            'slug' => 'noche-de-adoracion-zoe',
            'title' => 'Noche de adoración',
            'kind' => 'especial',
            'when' => 12,
            'summary' => 'Una noche especial dedicada a adorar a Dios en unidad, con toda la iglesia y muchos invitados.',
            'photos' => ['banner8.jpg', 'pastores.jpg', 'banner4.jpg', 'familia1.jpg', 'man1.jpg'],
        ],
    ];

    private const DEVOTIONALS = [
        [
            'slug' => 'nadie-camina-solo',
            'title' => 'Nadie camina solo',
            'verse_ref' => 'Eclesiastés 4:9-10',
            'verse_text' => 'Mejores son dos que uno; porque tienen mejor paga de su trabajo. Porque si cayeren, el uno levantará a su compañero.',
            'image' => 'familia1.jpg',
            'days_ago' => 0,
            'body' => "Dios nunca diseñó la fe para vivirse en soledad. Desde el principio dijo: «No es bueno que el hombre esté solo», y a lo largo de toda la Escritura vemos a un pueblo que camina junto, que se sostiene y que se levanta cuando alguno cae.\n\nQuizá esta semana te sientes cansado o sin fuerzas. No tienes que cargarlo todo tú. Jesús te dio una familia: hermanos que oran por ti, que te escuchan y que te recuerdan las promesas de Dios cuando tú las olvidas.\n\nHoy da un paso sencillo: escribe a alguien de tu grupo, cuéntale cómo estás y pídele que ore contigo. Y si ves a alguien que camina solo, sé tú el compañero que lo levanta.\n\nOración: Señor, gracias porque no me dejaste solo. Enséñame a recibir ayuda y a ser ayuda para otros. Amén.",
        ],
        [
            'slug' => 'su-gracia-es-suficiente',
            'title' => 'Su gracia es suficiente',
            'verse_ref' => '2 Corintios 12:9',
            'verse_text' => 'Bástate mi gracia; porque mi poder se perfecciona en la debilidad.',
            'image' => 'banner4.jpg',
            'days_ago' => 3,
            'body' => "Pablo pidió tres veces que Dios le quitara aquello que lo debilitaba. La respuesta no fue un «sí», sino algo mejor: «Bástate mi gracia». Dios no siempre quita la dificultad, pero siempre da la fuerza para atravesarla.\n\nNuestra cultura nos enseña a esconder la debilidad. El evangelio nos invita a presentarla delante de Dios, porque justamente ahí se ve su poder. Donde tú llegas a tu límite, Él apenas comienza.\n\nPiensa en esa área en la que te sientes insuficiente: tu familia, tu trabajo, tu salud o tu carácter. Entrégasela hoy a Dios con honestidad y confía en que su gracia alcanza para este día.\n\nOración: Padre, te entrego mis debilidades. Que tu poder se vea en mí y que tu gracia me sostenga hoy. Amén.",
        ],
        [
            'slug' => 'una-casa-sobre-la-roca',
            'title' => 'Una casa sobre la roca',
            'verse_ref' => 'Mateo 7:24',
            'verse_text' => 'Cualquiera, pues, que me oye estas palabras, y las hace, le compararé a un hombre prudente, que edificó su casa sobre la roca.',
            'image' => 'banner8.jpg',
            'days_ago' => 6,
            'body' => "Jesús terminó el Sermón del Monte con una imagen sencilla: dos casas, dos cimientos y la misma tormenta. La diferencia no estuvo en el clima, sino en lo que cada uno hizo con lo que escuchó.\n\nEscuchar la Palabra es importante, pero obedecerla es lo que nos da firmeza. Cada pequeña decisión de practicar lo que Dios dice es como poner una piedra más en un cimiento que no se mueve.\n\nEsta semana elige una enseñanza concreta que hayas escuchado el domingo y ponla en práctica: perdonar, servir, dar o descansar en Dios. Las tormentas llegarán, pero tu casa permanecerá.\n\nOración: Jesús, quiero ser alguien que no solo oye, sino que hace tu Palabra. Edifica mi vida sobre ti. Amén.",
        ],
        [
            'slug' => 'renovados-cada-manana',
            'title' => 'Renovados cada mañana',
            'verse_ref' => 'Lamentaciones 3:22-23',
            'verse_text' => 'Por la misericordia de Jehová no hemos sido consumidos, porque nunca decayeron sus misericordias. Nuevas son cada mañana; grande es tu fidelidad.',
            'image' => 'pastores.jpg',
            'days_ago' => 9,
            'body' => "Jeremías escribió estas palabras en uno de los momentos más oscuros de su pueblo. Aun así, levantó la mirada y recordó algo que nada podía quitarle: la fidelidad de Dios.\n\nCada amanecer es un recordatorio de que Dios no se cansa de ti. Lo que ayer salió mal no tiene la última palabra. Sus misericordias se renuevan cada mañana y te invitan a empezar de nuevo.\n\nAntes de revisar el teléfono mañana, dedica los primeros minutos del día a agradecer. Nombra tres cosas en las que has visto la fidelidad de Dios y entrégale tu jornada.\n\nOración: Señor, gracias porque tu misericordia es nueva hoy. Ayúdame a empezar cada día contigo. Amén.",
        ],
    ];

    public function up(): void
    {
        $today = now('America/Lima')->startOfDay();

        if (! ServiceGallery::query()->exists()) {
            foreach (self::GALLERIES as $album) {
                ServiceGallery::query()->create([
                    'slug' => $album['slug'],
                    'title' => $album['title'],
                    'kind' => $album['kind'],
                    'service_date' => $this->serviceDate($today, $album['when'])->toDateString(),
                    'summary' => $album['summary'],
                    'photos' => array_map(fn (string $photo) => '/images/'.$photo, $album['photos']),
                    'active' => true,
                ]);
            }
        }

        if (! Devotional::query()->exists()) {
            foreach (self::DEVOTIONALS as $devotional) {
                Devotional::query()->create([
                    'slug' => $devotional['slug'],
                    'title' => $devotional['title'],
                    'verse_ref' => $devotional['verse_ref'],
                    'verse_text' => $devotional['verse_text'],
                    'body' => $devotional['body'],
                    'author' => 'Pastores de Iglesia Cristiana Zoe',
                    'publish_on' => $today->copy()->subDays($devotional['days_ago'])->toDateString(),
                    'image_path' => '/images/'.$devotional['image'],
                    'active' => true,
                ]);
            }
        }
    }

    public function down(): void
    {
        ServiceGallery::query()->whereIn('slug', array_column(self::GALLERIES, 'slug'))->delete();
        Devotional::query()->whereIn('slug', array_column(self::DEVOTIONALS, 'slug'))->delete();
    }

    private function serviceDate(Carbon $today, string|int $when): Carbon
    {
        return match ($when) {
            'sunday' => $today->isSunday() ? $today->copy() : $today->copy()->previous(Carbon::SUNDAY),
            'wednesday' => $today->isWednesday() ? $today->copy() : $today->copy()->previous(Carbon::WEDNESDAY),
            default => $today->copy()->subDays((int) $when),
        };
    }
};
