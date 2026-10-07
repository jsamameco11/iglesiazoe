<?php

namespace App\Domain\Shared\Support;

use Illuminate\Database\Connectors\PostgresConnector as BaseConnector;
use PDO;

/**
 * Postgres connections that carry the schema in their startup options (server_options), so no
 * «set search_path» round trip to the remote database follows each connection. The search_path
 * config stays set for the schema tools (migrations, hasTable).
 */
class PostgresConnector extends BaseConnector
{
    /**
     * @param  PDO  $connection
     * @param  array<string, mixed>  $config
     */
    protected function configureSearchPath($connection, $config): void
    {
        if (isset($config['server_options']['search_path'])) {
            return;
        }

        parent::configureSearchPath($connection, $config);
    }
}
