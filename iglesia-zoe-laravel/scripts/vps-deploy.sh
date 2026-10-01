#!/bin/bash
set -euo pipefail

APP_DIR=/opt/iglesia-zoe-app
ARCHIVE=/tmp/iglesia-zoe-laravel.tgz
NEXT_DIR=/opt/backups/iglesia-zoe-next-20260930
STAGING=/opt/iglesia-zoe-app-new

echo "==> Extracting Laravel"
rm -rf "${STAGING}"
mkdir -p "${STAGING}"
tar -xzf "${ARCHIVE}" -C "${STAGING}"

echo "==> Preserving production data"
if [[ -f "${APP_DIR}/.env" ]]; then
  cp -f "${APP_DIR}/.env" "${STAGING}/.env"
fi
mkdir -p "${STAGING}/database" "${STAGING}/storage/app/public" "${STAGING}/bootstrap/cache"
if [[ -f "${APP_DIR}/database/database.sqlite" ]]; then
  cp -f "${APP_DIR}/database/database.sqlite" "${STAGING}/database/database.sqlite"
fi
if [[ -d "${APP_DIR}/storage/app" ]]; then
  cp -a "${APP_DIR}/storage/app/." "${STAGING}/storage/app/"
fi

echo "==> Restoring public media"
mkdir -p "${STAGING}/public/images" "${STAGING}/public/videos"
if [[ -d "${APP_DIR}/public/images" ]]; then
  cp -a "${APP_DIR}/public/images/." "${STAGING}/public/images/"
elif [[ -d "${NEXT_DIR}/public/images" ]]; then
  cp -a "${NEXT_DIR}/public/images/." "${STAGING}/public/images/"
fi
if [[ -f "${APP_DIR}/public/videos/siguientepaso.mp4" ]]; then
  cp -f "${APP_DIR}/public/videos/siguientepaso.mp4" "${STAGING}/public/videos/siguientepaso.mp4"
elif [[ -f "${NEXT_DIR}/public/videos/siguientepaso.mp4" ]]; then
  cp -f "${NEXT_DIR}/public/videos/siguientepaso.mp4" "${STAGING}/public/videos/siguientepaso.mp4"
elif [[ -f /tmp/siguientepaso.mp4 ]]; then
  cp -f /tmp/siguientepaso.mp4 "${STAGING}/public/videos/siguientepaso.mp4"
fi

if [[ ! -f "${STAGING}/.env" ]]; then
  echo "==> Creating production environment"
  cat > "${STAGING}/.env" <<'ENV'
APP_NAME="Iglesia Cristiana Zoe"
APP_ENV=production
APP_KEY=
APP_DEBUG=false
APP_URL=https://iglesiacristianazoe.miacademiapreu.com
APP_LOCALE=es
APP_FALLBACK_LOCALE=es
APP_FAKER_LOCALE=es_PE
SEED_PASSWORD=ZoeCasa2026!
APP_MAINTENANCE_DRIVER=file
BCRYPT_ROUNDS=12
LOG_CHANNEL=stack
LOG_STACK=single
LOG_DEPRECATIONS_CHANNEL=null
LOG_LEVEL=error
DB_CONNECTION=sqlite
SESSION_DRIVER=database
SESSION_LIFETIME=120
SESSION_ENCRYPT=false
SESSION_PATH=/
SESSION_DOMAIN=null
SESSION_SECURE_COOKIE=true
BROADCAST_CONNECTION=log
FILESYSTEM_DISK=local
QUEUE_CONNECTION=database
CACHE_STORE=database
MAIL_MAILER=log
MAIL_FROM_ADDRESS="contacto@iglesiacristianazoe.miacademiapreu.com"
MAIL_FROM_NAME="${APP_NAME}"
VITE_APP_NAME="${APP_NAME}"
ENV
fi

echo "==> Composer install"
cd "${STAGING}"
export COMPOSER_ALLOW_SUPERUSER=1
composer install --no-dev --optimize-autoloader --no-interaction --prefer-dist

touch "${STAGING}/database/database.sqlite"
mkdir -p "${STAGING}/storage/framework/cache/data" \
         "${STAGING}/storage/framework/sessions" \
         "${STAGING}/storage/framework/views" \
         "${STAGING}/storage/logs" \
         "${STAGING}/storage/app/public" \
         "${STAGING}/bootstrap/cache"

if ! grep -q '^APP_KEY=base64:' "${STAGING}/.env"; then
  php artisan key:generate --force
fi

php artisan migrate --force
# Any error reading the users table must skip the seed: seeding resets content and passwords.
USERS=$(php -r 'try { echo (int) (new PDO("sqlite:".$argv[1]))->query("select count(*) from users")->fetchColumn(); } catch (Throwable $e) { echo -1; }' "${STAGING}/database/database.sqlite")
if [[ "${USERS}" == "0" ]]; then
  php artisan db:seed --force
else
  echo "==> Users already exist (${USERS}); skipping seed so passwords stay"
fi
GEO=$(php -r 'try { echo (int) (new PDO("sqlite:".$argv[1]))->query("select count(*) from geo_countries")->fetchColumn(); } catch (Throwable $e) { echo -1; }' "${STAGING}/database/database.sqlite")
if [[ "${GEO}" == "0" ]]; then
  echo "==> Loading countries and regions"
  php artisan db:seed --class=GeoSeeder --force
else
  echo "==> Geo directory already loaded (${GEO} countries)"
fi
php artisan storage:link --force || true

echo "==> Swap release"
rm -rf "${APP_DIR}.old"
if [[ -d "${APP_DIR}" ]]; then
  mv "${APP_DIR}" "${APP_DIR}.old"
fi
mv "${STAGING}" "${APP_DIR}"
cd "${APP_DIR}"
php artisan config:cache
php artisan route:cache
php artisan view:cache

echo "==> Permissions"
chown -R www-data:www-data "${APP_DIR}/storage" "${APP_DIR}/bootstrap/cache" "${APP_DIR}/database"
find "${APP_DIR}/storage" "${APP_DIR}/bootstrap/cache" -type d -exec chmod 775 {} \;
chmod 664 "${APP_DIR}/database/database.sqlite"
chmod 775 "${APP_DIR}/database"

echo "==> PHP-FPM pool"
cat > /etc/php/8.3/fpm/pool.d/iglesia-zoe.conf <<'POOL'
[iglesia-zoe]
user = www-data
group = www-data
listen = /run/php/php8.3-fpm-iglesia-zoe.sock
listen.owner = www-data
listen.group = www-data
listen.mode = 0660
pm = dynamic
pm.max_children = 16
pm.start_servers = 2
pm.min_spare_servers = 2
pm.max_spare_servers = 6
php_admin_value[upload_max_filesize] = 80M
php_admin_value[post_max_size] = 80M
php_admin_value[memory_limit] = 256M
php_admin_value[max_execution_time] = 120
POOL

a2enmod proxy proxy_fcgi rewrite headers setenvif >/dev/null

echo "==> Apache vhosts"
cat > /etc/apache2/sites-available/iglesia-zoe.conf <<'APACHE'
<VirtualHost *:80>
  ServerName iglesiacristianazoe.miacademiapreu.com
  ServerAlias iglesiacristianazoe2.miacademiapreu.com
  ServerAlias admi-iglesiazoe.miacademiapreu.com

  Alias /.well-known/acme-challenge/ /var/www/letsencrypt/.well-known/acme-challenge/
  <Directory /var/www/letsencrypt/.well-known/acme-challenge/>
    Require all granted
  </Directory>

  RewriteEngine on
  RewriteCond %{REQUEST_URI} !^/\.well-known/acme-challenge/
  RewriteRule ^ https://%{SERVER_NAME}%{REQUEST_URI} [END,NE,R=permanent]
</VirtualHost>
APACHE

cat > /etc/apache2/sites-available/iglesia-zoe-le-ssl.conf <<'APACHE'
<IfModule mod_ssl.c>
<VirtualHost *:443>
  ServerName iglesiacristianazoe.miacademiapreu.com
  ServerAlias iglesiacristianazoe2.miacademiapreu.com
  ServerAlias admi-iglesiazoe.miacademiapreu.com
  DocumentRoot /opt/iglesia-zoe-app/public

  Alias /.well-known/acme-challenge/ /var/www/letsencrypt/.well-known/acme-challenge/
  <Directory /var/www/letsencrypt/.well-known/acme-challenge/>
    Require all granted
  </Directory>

  <Directory /opt/iglesia-zoe-app/public>
    Options FollowSymLinks
    AllowOverride All
    Require all granted
    DirectoryIndex index.php
  </Directory>

  <FilesMatch \.php$>
    SetHandler "proxy:unix:/run/php/php8.3-fpm-iglesia-zoe.sock|fcgi://localhost"
  </FilesMatch>

  ProxyPreserveHost On
  RequestHeader set X-Forwarded-Proto "https"
  RequestHeader set X-Forwarded-Port "443"

  ErrorLog ${APACHE_LOG_DIR}/iglesia-zoe-error.log
  CustomLog ${APACHE_LOG_DIR}/iglesia-zoe-access.log combined

  Include /etc/letsencrypt/options-ssl-apache.conf
  SSLCertificateFile /etc/letsencrypt/live/iglesiacristianazoe.miacademiapreu.com/fullchain.pem
  SSLCertificateKeyFile /etc/letsencrypt/live/iglesiacristianazoe.miacademiapreu.com/privkey.pem
</VirtualHost>
</IfModule>
APACHE

echo "==> Restart PHP-FPM and Apache"
systemctl restart php8.3-fpm
apache2ctl configtest
systemctl reload apache2

echo "==> Remove old Next.js service"
systemctl stop iglesia-zoe.service || true
systemctl disable iglesia-zoe.service || true
rm -f /etc/systemd/system/iglesia-zoe.service
systemctl daemon-reload || true
systemctl reset-failed iglesia-zoe.service || true

echo "==> Health checks"
sleep 1
curl -s -o /dev/null -w 'https-aire:%{http_code}\n' -H 'Host: iglesiacristianazoe.miacademiapreu.com' --resolve iglesiacristianazoe.miacademiapreu.com:443:127.0.0.1 https://iglesiacristianazoe.miacademiapreu.com/ -k
curl -s -o /dev/null -w 'https-marea:%{http_code}\n' -H 'Host: iglesiacristianazoe2.miacademiapreu.com' --resolve iglesiacristianazoe2.miacademiapreu.com:443:127.0.0.1 https://iglesiacristianazoe2.miacademiapreu.com/ -k
curl -s -o /dev/null -w 'https-acceso:%{http_code}\n' -H 'Host: iglesiacristianazoe.miacademiapreu.com' --resolve iglesiacristianazoe.miacademiapreu.com:443:127.0.0.1 https://iglesiacristianazoe.miacademiapreu.com/acceso -k
curl -s -o /dev/null -w 'https-up:%{http_code}\n' -H 'Host: iglesiacristianazoe.miacademiapreu.com' --resolve iglesiacristianazoe.miacademiapreu.com:443:127.0.0.1 https://iglesiacristianazoe.miacademiapreu.com/up -k

echo "DONE"
