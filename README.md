# NexoryIos

iOS-плеер **Nexory** (UI как Dotify): VK, Яндекс «Моя волна», SoundCloud.

Сборка `.ipa` через **GitHub Actions** на macOS — скачиваешь артеfact и ставишь через **eSign** / свой сертификат.

## Быстрый старт

1. Форк / клон репозитория
2. **Settings → Secrets and variables → Actions** — добавь секреты (см. ниже)
3. **Actions → Build iOS IPA → Run workflow**
4. Скачай артеfact `Nexory-iOS-*` → `Nexory.ipa`

## Секреты GitHub (обязательны для IPA)

| Secret | Описание |
|--------|----------|
| `IOS_CERTIFICATE_P12_BASE64` | `.p12` сертификат в base64 |
| `IOS_CERTIFICATE_PASSWORD` | Пароль от `.p12` |
| `IOS_PROVISIONING_PROFILE_BASE64` | `.mobileprovision` в base64 |

Опционально:

| Secret / Variable | Описание |
|-------------------|----------|
| `IOS_KEYCHAIN_PASSWORD` | Пароль временного keychain в CI (любая строка) |
| `IOS_BUNDLE_ID` (variable) | Bundle ID, по умолчанию `app.nexory.mobile` |
| `IOS_EXPORT_METHOD` (variable) | `development` / `ad-hoc` / `app-store` |

### Как получить base64 (PowerShell)

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("cert.p12")) | Set-Clipboard
[Convert]::ToBase64String([IO.File]::ReadAllBytes("profile.mobileprovision")) | Set-Clipboard
```

## Gateway

Приложению нужен **flow-mobile-gateway** (из репо Nexory desktop):

```bash
FLOW_MOBILE_GATEWAY_SECRET=... node server/flow-mobile-gateway.js
```

В приложении: **Настройки → Gateway URL + Secret + токены**.

## Локальная разработка UI

```bash
npm install
npx serve www -p 8080
```

## Стек

- Capacitor 6
- Шрифт **Minecraft** (`www/fonts/minecraft.ttf`)
- Тема Dotify: `#020617`, акцент `#ec4899`
