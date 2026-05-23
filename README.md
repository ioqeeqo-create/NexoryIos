# NexoryIos

iOS-плеер **Nexory** (UI как Dotify): VK, Яндекс «Моя волна», SoundCloud.

## Сборка IPA (без Mac, без Apple Developer)

GitHub Actions собирает **неподписанный IPA** на `macos-latest`:

1. **Actions → Build unsigned iOS IPA → Run workflow**
2. Скачай artifact `Nexory-unsigned-*` → `Nexory.ipa`
3. Подпиши и установи через **eSign / Sideloadly / AltStore / GBox** своим Apple ID

Секреты GitHub **не нужны**.

> Сертификат free Apple ID живёт ~7 дней — потом пересигн.

## Gateway

Нужен **flow-mobile-gateway** на VPS/ПК:

```bash
FLOW_MOBILE_GATEWAY_SECRET=... node server/flow-mobile-gateway.js
```

В приложении: **Настройки → Gateway URL + Secret + токены**.

## Локально (только UI)

```bash
npm install
npx serve www -p 8080
```

## Опционально: подписанный IPA

Если есть `.p12` + `.mobileprovision`, можно добавить secrets и отдельный workflow — см. историю коммитов.
