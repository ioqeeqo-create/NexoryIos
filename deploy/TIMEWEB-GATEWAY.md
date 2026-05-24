# Gateway Nexory на Timeweb Cloud

Панель сервера: [Timeweb Cloud — сервер 7700595](https://timeweb.cloud/my/servers/7700595)

Приложение работает **гибридно**:
- **С телефона** (режим «Авто»): Яндекс, VK, волна — без ПК в Wi‑Fi.
- **Через gateway на VPS**: импорт плейлистов по ссылке, запасной поиск/SC, если прямой запрос не прошёл.

## 1. Подключение по SSH

В панели Timeweb возьми **IP**, **логин** (обычно `root`) и пароль или SSH-ключ.

```bash
ssh root@ВАШ_IP
```

## 2. Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node -v
```

## 3. Код gateway на сервер

С локального ПК (из папки `flow_fixed`):

```bash
scp -r server packages root@ВАШ_IP:/opt/nexory-gateway/
```

На сервере структура:

```
/opt/nexory-gateway/
  server/flow-mobile-gateway.js
  packages/flow-core/...
```

Установи зависимости в `server` (если есть `package.json` в корне flow_fixed — скопируй и `npm ci --omit=dev` там, где лежит `node_modules` для gateway). Минимально gateway тянет `express`, `cors`, `axios` из корня проекта NexoryND.

Проще: склонировать весь репозиторий NexoryND на VPS и запускать из `flow_fixed`:

```bash
cd /opt
git clone https://github.com/ВАШ_ЮЗЕР/NexoryND.git nexory
cd nexory/flow_fixed
npm ci --omit=dev
```

## 4. Секрет и переменные

```bash
nano /opt/nexory/flow_fixed/server/.env
```

```env
FLOW_MOBILE_GATEWAY_PORT=3950
FLOW_MOBILE_GATEWAY_SECRET=сгенерируй_длинную_случайную_строку_32+
# опционально SoundCloud на сервере:
# SC_CLIENT_ID=...
# SC_CLIENT_ID_FALLBACKS=id1,id2
```

Сгенерировать секрет:

```bash
openssl rand -hex 32
```

## 5. systemd

```bash
cat > /etc/systemd/system/nexory-gateway.service << 'EOF'
[Unit]
Description=Nexory Mobile Gateway
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/nexory/flow_fixed
EnvironmentFile=/opt/nexory/flow_fixed/server/.env
ExecStart=/usr/bin/node server/flow-mobile-gateway.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable nexory-gateway
systemctl start nexory-gateway
systemctl status nexory-gateway
```

Проверка:

```bash
curl -s http://127.0.0.1:3950/health
```

Должно быть `{"ok":true,...}`.

## 6. HTTPS (рекомендуется)

В Timeweb можно повесить домен на IP и выпустить Let's Encrypt, либо nginx:

```nginx
server {
    listen 443 ssl;
    server_name music.твой-домен.ru;

    ssl_certificate     /etc/letsencrypt/live/music.твой-домен.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/music.твой-домен.ru/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3950;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

В приложении Nexory iOS:
- **Gateway URL**: `https://music.твой-домен.ru` (без `/mobile` — путь добавляет само приложение)
- **Gateway Secret**: тот же, что в `.env`
- **Режим API**: «Авто»

Открой порт **3950** только если не используешь nginx (в файрволе Timeweb).

## 7. Настройка в iPhone

1. Настройки → Подключение → **Авто**.
2. Gateway URL + Secret с VPS.
3. Яндекс OAuth (и при желании VK, SC Client ID).
4. «Проверить gateway» → ✓.

ПК в локальной сети **не нужен**, если VPS доступен из интернета.

## Обновление

```bash
cd /opt/nexory && git pull
cd flow_fixed && npm ci --omit=dev
systemctl restart nexory-gateway
```
