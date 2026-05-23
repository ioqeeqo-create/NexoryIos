# Nexory Mobile — сборка IPA (eSign / свой сертификат)

## Что это

Capacitor-приложение с UI как **Dotify**: шрифт **Minecraft** (`www/fonts/minecraft.ttf`), тёмная тема `#020617`, акцент `#ec4899`.

**Источники:** VK, Яндекс (rotor session «Моя волна»), SoundCloud.

**Важно:** для стриминга нужен **flow-mobile-gateway** на VPS или домашнем ПК.

---

## 1. Gateway

```bash
cd flow_fixed
set FLOW_MOBILE_GATEWAY_SECRET=ваш-длинный-секрет
set FLOW_MOBILE_GATEWAY_PORT=3950
node server/flow-mobile-gateway.js
```

---

## 2. Сборка IPA (Mac + Xcode)

```bash
cd flow_fixed/nexory-mobile
npm install
npx cap add ios
npx cap sync ios
npx cap open ios
```

Xcode: Signing → ваш Team → Archive → Export `.ipa`

eSign: залей `.ipa` + `.p12` + mobileprovision на iPhone.

---

## 3. Настройки в приложении

- Gateway URL + Secret
- Яндекс OAuth (волна)
- VK token

---

## Wave API

- `POST /mobile/v1/yandex/wave/fetch`
- `POST /mobile/v1/yandex/wave/feedback`
