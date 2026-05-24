# Gateway Nexory на Timeweb Cloud

Панель: [Timeweb Cloud — сервер 7700595](https://timeweb.cloud/my/servers/7700595)

Репозиторий: **https://github.com/ioqeeqo-create/NexoryND.git**  
Корень проекта после clone: `/opt/nexory` (там же `server/`, `packages/`, `package.json`).

---

## На VPS — скопируй блок целиком

Подставь только **IP** в `ssh root@IP` (если логин не root — замени).

```bash
# 1. Клон (если папки ещё нет)
cd /opt
rm -rf nexory
git clone https://github.com/ioqeeqo-create/NexoryND.git nexory
cd /opt/nexory

# 2. Зависимости (express, axios, cors)
npm ci --omit=dev

# 3. Секрет — сохрани вывод, он нужен в приложении
export FLOW_MOBILE_GATEWAY_SECRET="$(openssl rand -hex 32)"
echo "SECRET=$FLOW_MOBILE_GATEWAY_SECRET"

# 4. Запуск (тест)
export FLOW_MOBILE_GATEWAY_PORT=3950
node server/flow-mobile-gateway.js
```

В **другом** SSH-окне проверка:

```bash
curl -s http://127.0.0.1:3950/health
```

Должно быть: `{"ok":true,...}`

Останови тест (`Ctrl+C` в первом окне) и поставь systemd:

```bash
cat > /opt/nexory/server/.env << EOF
FLOW_MOBILE_GATEWAY_PORT=3950
FLOW_MOBILE_GATEWAY_SECRET=ВСТАВЬ_СЮДА_ТОТ_ЖЕ_SECRET
EOF

cat > /etc/systemd/system/nexory-gateway.service << 'EOF'
[Unit]
Description=Nexory Mobile Gateway
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/nexory
EnvironmentFile=/opt/nexory/server/.env
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

Открой порт **3950** в файрволе Timeweb (или nginx + HTTPS на 443).

---

## В iPhone (Nexory)

| Поле | Пример |
|------|--------|
| Режим API | Авто |
| Gateway URL | `http://IP_СЕРВЕРА:3950` |
| Gateway Secret | тот же, что в `.env` |

---

## Частые ошибки

| Ошибка | Причина |
|--------|---------|
| `твой: No such file or directory` | В команду попал текст из инструкции (`твой`, `ВАШ_IP`) — используй реальный IP |
| `nexory/flow_fixed: No such file` | Неверный путь; нужно `cd /opt/nexory` |
| `Cannot find module '/opt/server/...'` | Запуск из `/opt` вместо `/opt/nexory` |
| `FLOW_MOBILE_GATEWAY_SECRET` | Переменная не задана — gateway не стартует |

---

## Обновление

```bash
cd /opt/nexory && git pull && npm ci --omit=dev && systemctl restart nexory-gateway
```

## Волна (HTTP 404)

Если «Моя волна» даёт **HTTP 404** — на VPS старая сборка gateway **без** `/mobile/v1/yandex/wave/*`.  
Обнови репозиторий (`git pull`) и перезапусти `nexory-gateway`.  
В приложении режим **Авто** + токен Яндекса: волна пойдёт **напрямую с телефона**, даже без wave-роутов на VPS.
