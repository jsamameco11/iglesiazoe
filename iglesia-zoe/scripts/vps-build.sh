#!/bin/bash
set -euo pipefail
export PATH="/opt/node-v22/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
cd /opt/iglesia-zoe
node -v
node -e "console.log(require.resolve('@tailwindcss/postcss'))"
rm -rf .next
mkdir -p .next/server
printf '{}\n' > .next/server/pages-manifest.json
node node_modules/next/dist/bin/next build --webpack
systemctl restart iglesia-zoe
sleep 2
systemctl is-active iglesia-zoe
curl -s -o /dev/null -w 'casa:%{http_code}\n' -H 'Host: iglesiacristianazoe.miacademiapreu.com' http://127.0.0.1:8791/
curl -s -o /dev/null -w 'luz:%{http_code}\n' -H 'Host: iglesiacristianazoe2.miacademiapreu.com' http://127.0.0.1:8791/
