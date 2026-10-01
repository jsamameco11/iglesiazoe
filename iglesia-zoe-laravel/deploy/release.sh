#!/bin/bash
# Applies a code-only release (see release.ps1) on the VPS.
# Data stays in place: .env, the database, storage/ and public/images are never touched.
set -euo pipefail

APP=/opt/iglesia-zoe-app
ARCHIVE=${1:-/root/zoe-release.tgz}
PARTS=(app config routes bootstrap/app.php database/migrations database/seeders resources/views public/build)

cd "$APP"
STAMP=$(date +%Y%m%d-%H%M%S)
tar -czf "/root/zoe-code-before-$STAMP.tgz" "${PARTS[@]}"
cp -p database/database.sqlite "/root/zoe-before-release-$STAMP.sqlite"
echo "respaldo de codigo y base: $STAMP"

tar -xzf "$ARCHIVE" --no-same-owner -C "$APP"
php artisan config:clear >/dev/null
php artisan migrate --force
php artisan config:cache >/dev/null
php artisan route:cache >/dev/null
php artisan view:cache >/dev/null
php artisan cache:clear >/dev/null || true
chown -R www-data:www-data storage bootstrap/cache database public/build
systemctl restart php8.3-fpm
php artisan tinker --execute='echo App\Domain\Reports\Support\WeekCalendar::currentLabel();'
echo
echo "RELEASE OK"
