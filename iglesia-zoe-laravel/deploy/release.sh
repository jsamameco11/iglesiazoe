#!/bin/bash
# Applies a code-only release (see release.ps1) on the VPS.
# Data stays in place: .env, the database, storage/ and the home media copies
# (public/media, public/images, public/videos) are never touched.
set -euo pipefail

APP=/opt/iglesia-zoe-app
ARCHIVE=${1:-/root/zoe-release.tgz}
PARTS=(app config routes bootstrap/app.php database/migrations database/seeders resources/views public/build public/geo-data public/sw.js public/.htaccess composer.json composer.lock)

cd "$APP"
STAMP=$(date +%Y%m%d-%H%M%S)
EXISTING=()
for part in "${PARTS[@]}"; do [ -e "$part" ] && EXISTING+=("$part"); done
tar -czf "/root/zoe-code-before-$STAMP.tgz" "${EXISTING[@]}"
[ -f database/database.sqlite ] && cp -p database/database.sqlite "/root/zoe-before-release-$STAMP.sqlite"
echo "respaldo de codigo: $STAMP"

LOCK_BEFORE=$(sha1sum composer.lock | cut -d' ' -f1)
# Each part is swapped whole so files deleted from the repo also disappear from the server.
STAGE=$(mktemp -d)
tar -xzf "$ARCHIVE" --no-same-owner -C "$STAGE"
for part in "${PARTS[@]}"; do
  [ -e "$STAGE/$part" ] || continue
  rm -rf "${APP:?}/$part"
  mkdir -p "$(dirname "$APP/$part")"
  mv "$STAGE/$part" "$APP/$part"
done
rm -rf "$STAGE"
if [ "$LOCK_BEFORE" != "$(sha1sum composer.lock | cut -d' ' -f1)" ]; then
  echo "dependencias de PHP cambiaron: composer install"
  COMPOSER_ALLOW_SUPERUSER=1 composer install --no-dev --optimize-autoloader --no-interaction --no-progress
fi
php artisan config:clear >/dev/null
php artisan migrate --force
php artisan config:cache >/dev/null
php artisan route:cache >/dev/null
php artisan view:cache >/dev/null
php artisan cache:clear >/dev/null || true
chown -R www-data:www-data storage bootstrap/cache database public/build
install -d -o www-data -g www-data public/media public/images public/videos
systemctl restart php8.3-fpm
sudo -u www-data php artisan media:hot || echo "aviso: algunos archivos del inicio siguen sirviéndose desde Wasabi"
php artisan tinker --execute='echo App\Domain\Reports\Support\WeekCalendar::currentLabel();'
echo
echo "RELEASE OK"
