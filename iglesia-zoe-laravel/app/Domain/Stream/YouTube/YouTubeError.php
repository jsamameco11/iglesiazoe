<?php

namespace App\Domain\Stream\YouTube;

use Illuminate\Http\Client\Response;
use RuntimeException;

/** A YouTube or Google answer the panel can show as is. */
final class YouTubeError extends RuntimeException
{
    private const MESSAGES = [
        'liveStreamingNotEnabled' => 'El canal todavía no tiene activadas las transmisiones en vivo. Actívalas en YouTube Studio → Emitir en directo (la primera vez YouTube tarda hasta 24 horas).',
        'livePermissionBlocked' => 'YouTube bloqueó temporalmente las transmisiones en vivo de este canal. Revisa los avisos en YouTube Studio.',
        'quotaExceeded' => 'Se agotó la cuota diaria de la API de YouTube. Vuelve a intentarlo mañana o pide más cuota en Google Cloud.',
        'dailyLimitExceeded' => 'Se agotó la cuota diaria de la API de YouTube. Vuelve a intentarlo mañana.',
        'uploadLimitExceeded' => 'El canal llegó a su límite diario de subidas en YouTube. Vuelve a intentarlo mañana.',
        'insufficientPermissions' => 'Google no dio permiso para esta acción. Vuelve a conectar la cuenta de YouTube y acepta todos los permisos.',
        'forbidden' => 'YouTube no permitió esta acción con la cuenta conectada.',
        'invalidTitle' => 'YouTube no aceptó el título. Revisa que no esté vacío y tenga hasta 100 caracteres.',
        'invalidDescription' => 'YouTube no aceptó la descripción. Revisa que tenga hasta 5000 caracteres.',
        'invalidTags' => 'YouTube no aceptó las etiquetas. Usa menos etiquetas o más cortas.',
        'invalidCategoryId' => 'YouTube no aceptó la categoría elegida.',
        'invalidPublishAt' => 'YouTube no aceptó la fecha de publicación programada.',
        'invalidScheduledStartTime' => 'YouTube no aceptó la fecha de inicio. Elige una fecha futura.',
        'playlistNotFound' => 'La lista de reproducción ya no existe en el canal.',
        'invalid_grant' => 'Google retiró el permiso de la cuenta de YouTube. Vuelve a conectarla.',
        'notConnected' => 'La cuenta de YouTube de la iglesia no está conectada.',
        'notConfigured' => 'Faltan las credenciales de Google (YOUTUBE_CLIENT_ID y YOUTUBE_CLIENT_SECRET) en el servidor.',
    ];

    public function __construct(string $message, public readonly string $reason = 'error', public readonly int $status = 0)
    {
        parent::__construct($message);
    }

    public static function because(string $reason): self
    {
        return new self(self::MESSAGES[$reason] ?? 'YouTube no respondió como esperábamos.', $reason);
    }

    public static function from(Response $response): self
    {
        $error = $response->json('error');
        $reason = is_string($error) ? $error : (string) ($response->json('error.errors.0.reason') ?? $response->json('error.status') ?? 'error');
        $detail = (string) ($response->json('error.message') ?? $response->json('error_description') ?? '');
        $message = self::MESSAGES[$reason] ?? trim('YouTube respondió con un error ('.$response->status().'). '.$detail);

        return new self($message, $reason, $response->status());
    }

    /** YouTube is down or busy: worth trying the same request again. */
    public function isTemporary(): bool
    {
        return $this->status === 0 || $this->status >= 500 || in_array($this->reason, ['backendError', 'rateLimitExceeded', 'userRateLimitExceeded'], true);
    }
}
