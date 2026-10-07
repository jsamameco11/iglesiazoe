#!/bin/bash
# One-time install of live streaming on the VPS (safe to run again: it only updates what it manages).
#   - ffmpeg and MediaMTX (receives OBS by RTMP/SRT, records the original, serves HLS to the site)
#   - systemd services: zoe-stream (MediaMTX) and zoe-queue (recordings to Wasabi, uploads to YouTube)
#   - Laravel scheduler cron, firewall ports, Apache proxy for the site player, PHP upload size
# Usage (as root, after a normal release):  bash /root/zoe-stream-setup.sh
set -euo pipefail

APP=/opt/iglesia-zoe-app
SITE_VHOST=/etc/apache2/sites-available/iglesia-zoe-le-ssl.conf
CONF_DIR=/etc/zoe-stream
RECORDINGS=/var/lib/zoe-stream/grabaciones
STREAM_PATH=envivo
RUN_AS=www-data

cd "$APP"
SITE_URL=$(php -r 'foreach (file(".env") as $l) { if (str_starts_with($l, "ZOE_SITE_URL=")) { echo trim(substr($l, 13), " \"\r\n"); } }')
SITE_URL=${SITE_URL:-https://iglesiacristianazoe.miacademiapreu.com}
# The site domains go through Cloudflare, which only carries web traffic: encoders connect straight to the server.
STREAM_HOST=$(grep -E '^STREAM_HOST=' .env | cut -d= -f2- | tr -d '"' || true)
if [ -z "$STREAM_HOST" ]; then
  STREAM_HOST=$(curl -4 -fsS --max-time 10 https://api.ipify.org || hostname -I | awk '{print $1}')
fi
echo "==> Sitio: $SITE_URL (OBS se conectará a $STREAM_HOST)"

echo "==> ffmpeg"
command -v ffmpeg >/dev/null || { apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ffmpeg; }
ffmpeg -version | head -n 1

echo "==> MediaMTX"
case "$(uname -m)" in
  x86_64) ARCH=linux_amd64 ;;
  aarch64) ARCH=linux_arm64 ;;
  *) echo "Arquitectura no soportada: $(uname -m)"; exit 1 ;;
esac
URL=$(curl -fsSL https://api.github.com/repos/bluenviron/mediamtx/releases/latest | grep -o "https://[^\"]*_${ARCH}\.tar\.gz" | head -n 1)
[ -n "$URL" ] || { echo "No se encontró la descarga de MediaMTX"; exit 1; }
TMP=$(mktemp -d)
curl -fsSL "$URL" -o "$TMP/mediamtx.tgz"
tar -xzf "$TMP/mediamtx.tgz" -C "$TMP"
install -m 0755 "$TMP/mediamtx" /usr/local/bin/mediamtx
rm -rf "$TMP"
/usr/local/bin/mediamtx --version || true

echo "==> Carpetas"
mkdir -p "$CONF_DIR" "$RECORDINGS"
chown -R "$RUN_AS:$RUN_AS" /var/lib/zoe-stream

echo "==> Ganchos del servidor de video"
# MediaMTX runs these as www-data; they hand each event to Laravel.
cat > /usr/local/bin/zoe-stream-relay <<SH
#!/bin/bash
# Signal is ready: Laravel puts the broadcast on air and prints where to relay it on YouTube (or nothing).
TARGET=\$(cd $APP && php artisan stream:started 2>/dev/null | tail -n 1)
if [ -n "\$TARGET" ]; then
  exec ffmpeg -hide_banner -loglevel error -rw_timeout 15000000 -i "rtmp://127.0.0.1:1935/$STREAM_PATH" -c copy -f flv "\$TARGET"
fi
exec sleep infinity
SH
cat > /usr/local/bin/zoe-stream-hook <<SH
#!/bin/bash
cd $APP || exit 0
case "\$1" in
  stopped) exec php artisan stream:stopped ;;
  segment) exec php artisan stream:segment "\$MTX_SEGMENT_PATH" ;;
esac
SH
chmod 0755 /usr/local/bin/zoe-stream-relay /usr/local/bin/zoe-stream-hook

echo "==> Configuración de MediaMTX"
cat > "$CONF_DIR/mediamtx.yml" <<YML
logLevel: warn
logDestinations: [stdout]

api: yes
apiAddress: 127.0.0.1:9997
metrics: no
pprof: no
playback: no
rtsp: no
webrtc: no
moq: no

rtmp: yes
rtmpAddress: :1935

srt: yes
srtAddress: :8890

hls: yes
hlsAddress: 127.0.0.1:8888
hlsAlwaysRemux: yes
hlsVariant: lowLatency
hlsSegmentCount: 7
hlsSegmentDuration: 1s
hlsPartDuration: 200ms

# Only OBS publishing is checked (by Laravel); watching and the local API are open.
authMethod: http
authHTTPAddress: $SITE_URL/transmision/servidor/autorizar
authHTTPExclude:
  - action: read
  - action: playback
  - action: api
  - action: metrics
  - action: pprof

pathDefaults:
  record: no

paths:
  $STREAM_PATH:
    record: yes
    recordPath: $RECORDINGS/%path/%Y-%m-%d_%H-%M-%S-%f
    recordFormat: fmp4
    recordPartDuration: 1s
    recordSegmentDuration: 1h
    # Laravel deletes each part once it is safe on Wasabi; this only protects the disk if that fails.
    recordDeleteAfter: 168h
    runOnAvailable: /usr/local/bin/zoe-stream-relay
    runOnAvailableRestart: yes
    runOnUnavailable: /usr/local/bin/zoe-stream-hook stopped
    runOnRecordSegmentComplete: /usr/local/bin/zoe-stream-hook segment
YML
chown root:"$RUN_AS" "$CONF_DIR/mediamtx.yml"
chmod 0640 "$CONF_DIR/mediamtx.yml"

echo "==> Servicios"
cat > /etc/systemd/system/zoe-stream.service <<UNIT
[Unit]
Description=Iglesia Zoe · servidor de transmisión (MediaMTX)
After=network-online.target
Wants=network-online.target

[Service]
User=$RUN_AS
Group=$RUN_AS
ExecStart=/usr/local/bin/mediamtx $CONF_DIR/mediamtx.yml
Restart=always
RestartSec=3
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
UNIT

cat > /etc/systemd/system/zoe-queue.service <<UNIT
[Unit]
Description=Iglesia Zoe · grabaciones a Wasabi y videos a YouTube
After=network-online.target

[Service]
User=$RUN_AS
Group=$RUN_AS
WorkingDirectory=$APP
ExecStart=/usr/bin/php $APP/artisan queue:work stream --queue=stream --timeout=18000 --tries=1 --sleep=3 --max-time=86400
Restart=always
RestartSec=5
Nice=10

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now zoe-stream zoe-queue
systemctl restart zoe-stream zoe-queue

echo "==> Programador de Laravel (cron)"
cat > /etc/cron.d/iglesia-zoe <<CRON
* * * * * $RUN_AS cd $APP && php artisan schedule:run >> /dev/null 2>&1
CRON
chmod 0644 /etc/cron.d/iglesia-zoe

echo "==> Tamaño de subida de PHP (partes de 16 MB del video editado)"
cat > /etc/php/8.3/fpm/conf.d/99-iglesia-zoe-stream.ini <<INI
upload_max_filesize = 128M
post_max_size = 136M
INI
systemctl reload php8.3-fpm

echo "==> Apache: reproductor de la señal en $SITE_URL/transmision/senal/"
a2enmod -q proxy proxy_http headers >/dev/null
# MediaMTX redirects to root-relative paths (its HLS cookie check), which must keep the /transmision/senal/ prefix.
cat > /etc/apache2/iglesia-zoe-stream-proxy.conf <<'APACHE'
ProxyPass /transmision/senal/ http://127.0.0.1:8888/ flushpackets=on
ProxyPassReverse /transmision/senal/ http://127.0.0.1:8888/
<Location /transmision/senal/>
    Header edit Location "^/(?!transmision/senal/)" "/transmision/senal/"
    Header set Cache-Control "no-store" "expr=%{REQUEST_URI} =~ /\.m3u8$/"
</Location>
APACHE
if [ -f "$SITE_VHOST" ] && ! grep -q "iglesia-zoe-stream-proxy.conf" "$SITE_VHOST"; then
  cp -p "$SITE_VHOST" "/root/iglesia-zoe-le-ssl.conf.before-stream"
  sed -i 's#</VirtualHost>#    Include /etc/apache2/iglesia-zoe-stream-proxy.conf\n</VirtualHost>#' "$SITE_VHOST"
fi
apache2ctl configtest
systemctl reload apache2

echo "==> Firewall"
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow 1935/tcp comment "OBS RTMP"
  ufw allow 8890/udp comment "OBS SRT"
else
  echo "ufw no está activo; si el proveedor tiene firewall, abre 1935/tcp y 8890/udp."
fi

echo "==> Laravel"
grep -q '^STREAM_HOST=' .env || printf '\nSTREAM_HOST=%s\nSTREAM_RECORDINGS=%s\n' "$STREAM_HOST" "$RECORDINGS" >> .env
grep -q '^YOUTUBE_CLIENT_ID=' .env || printf 'YOUTUBE_CLIENT_ID=\nYOUTUBE_CLIENT_SECRET=\n' >> .env
php artisan config:cache >/dev/null
sleep 2
curl -fsS http://127.0.0.1:9997/v3/paths/list >/dev/null && echo "MediaMTX responde"
AUTH_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 -H 'Content-Type: application/json' \
  -d "{\"action\":\"publish\",\"path\":\"$STREAM_PATH\",\"user\":\"prueba\",\"password\":\"prueba\"}" \
  "$SITE_URL/transmision/servidor/autorizar")
if [ "$AUTH_CODE" = "401" ]; then
  echo "Permiso de publicación: Laravel responde (rechaza claves falsas)"
else
  echo "AVISO: el permiso de publicación respondió $AUTH_CODE en lugar de 401; OBS no podrá conectarse"
fi
df -h "$RECORDINGS" | tail -n 1
echo
echo "STREAM OK · OBS → rtmp://$STREAM_HOST  (la clave está en el panel, Transmisión)"
echo "Falta: YOUTUBE_CLIENT_ID y YOUTUBE_CLIENT_SECRET en $APP/.env y luego: php artisan config:cache"
