# Nexory iOS — краткая справка

Полное описание **Desktop + iOS + Gateway**: см. **[`../HOW-IT-WORKS.md`](../HOW-IT-WORKS.md)** в корне `flow_fixed/`.

Ниже — краткая версия для мобильного репозитория. UI: `www/` в NexoryIos.

---

## 1. Общая архитектура

```
┌─────────────────────────────────────────────────────────────┐
│  iPhone / iPad (Capacitor WebView)                          │
│  index.html + app.css + js (ui, player, theme, api, store)  │
└───────────────┬─────────────────────────────┬───────────────┘
                │                             │
     Прямые запросы (DirectApi)              │  Gateway (VPS/ПК)
     VK / Яндекс / SoundCloud API            │  flow-mobile-gateway
                │                             │
                ▼                             ▼
     api.music.yandex.net              POST /mobile/v1/...
     api.vk.com / api.vk.ru            resolve, import, wave (fallback)
     api-v2.soundcloud.com
```

| Режим | Где | Когда используется |
|--------|-----|-------------------|
| **Прямой** | Только телефон | Токены Яндекс/VK/SC в настройках; запросы с устройства |
| **Gateway** | VPS или ПК в сети | Импорт по ссылке, тяжёлый SC, fallback если прямой API недоступен |
| **Auto** | По умолчанию | Сначала gateway (если настроен), иначе direct |

Данные пользователя (лайки, недавние, плейлисты, настройки) хранятся в **localStorage** (`nexory_mobile_v1`).

---

## 2. iPhone — жизненный цикл

### 2.1 Запуск

1. **Заставка** — овальный «хвост» из трёх цветных точек бежит по эллипсу вокруг логотипа (как волна Яндекса).
2. **Setup gate** — если нет токенов и не нажали «Пропустить», показывается экран первой настройки.
3. **Theme.apply** — тема из настроек или палитра с обложки.
4. **UI.init** — привязка кнопок, вкладок, плеера.

### 2.2 Экраны

| Вкладка | Содержимое |
|---------|------------|
| **Главная** | «Моя волна», настроения, плашки «Недавние» / «Любимые», орбы по краям |
| **Поиск** | Яндекс / VK / SoundCloud |
| **Библиотека** | Лайки, свои плейлисты, импорт |
| **Настройки** | Токены, gateway, тема, «цвет с обложки» |

Переключение вкладок — плавный cross-fade + лёгкий сдвиг.

### 2.3 Плеер

**Мини-плеер** (внизу): обложка, название, prev / play-pause / next.

**Полный плеер**: размытая обложка на фоне, волна прогресса, лирика, shuffle/repeat.

**Lock Screen / Control Center (iOS):**

- Метаданные через `navigator.mediaSession` (название, артист, обложка).
- Кнопки **предыдущий / следующий трек** (не ±10 секунд).
- Позиция трека обновляется для системного UI.

### 2.4 «Моя волна» (Яндекс Rotor)

1. Пользователь выбирает **настроение** (обычная, грустная, весёлая, энергичная, спокойная, романтика).
2. `POST /rotor/session/new` с seeds `user:onyourwave` + `mood:*` и `moodEnergy` / `waveSettings`.
3. Яндекс отдаёт `radioSessionId`, `batchId`, список треков.
4. При смене настроения **сессия сбрасывается** и волна перезапускается.
5. При доигрывании очереди — `POST .../tracks` подгружает следующую пачку.
6. Feedback (`trackFinished`, `skip`, `radioStarted`) уходит в Яндекс для персонализации.

Соответствие настроений API Яндекса:

| UI | mood_energy / seed |
|----|-------------------|
| Обычная | all (без mood) |
| Грустная | sad |
| Весёлая | fun |
| Энергичная | active |
| Спокойная | calm |
| Романтика | fun + diversity favorite |

### 2.5 Тема с обложки

При включённой опции «цвет с обложки»:

1. С обложки текущего трека снимается палитра (canvas 64×64).
2. Для **тёмных** обложек (ч/б, низкая яркость) берутся яркие пиксели и усиливается свечение.
3. Меняются CSS-переменные: `--accent`, фон приложения, орбы, фон полного плеера.
4. iOS **системный** плеер на lock screen фон не красит — это ограничение iOS; внутри Nexory фон подстраивается сильнее.

### 2.6 Импорт плейлистов

Через **gateway**: ссылка VK / Яндекс / SoundCloud / JSON → превью → выбор «новый плейлист / лайки / существующий».

---

## 3. ПК — роли

### 3.1 Браузер (`npx serve www`)

Тот же UI, что на телефоне. Удобно для вёрстки. Плеер и Media Session работают в Chrome/Edge; на iOS Safari lock screen — только на устройстве.

### 3.2 Gateway на VPS (`flow-mobile-gateway.js`)

```bash
FLOW_MOBILE_GATEWAY_SECRET=... node server/flow-mobile-gateway.js
```

| Endpoint | Назначение |
|----------|------------|
| `GET /mobile/v1/health` | Проверка связи |
| `POST /mobile/v1/resolve` | URL потока трека |
| `POST /mobile/v1/yandex/wave/fetch` | Волна (тот же rotor, что в DirectApi) |
| `POST /mobile/v1/playlist/import` | Импорт по ссылке |
| `POST /mobile/v1/validate/yandex` | Проверка OAuth |

В приложении: **Настройки → Gateway URL + Secret**.

### 3.3 Десктоп Flow (`flow_fixed/main.js`)

Отдельное Electron/веб-приложение Flow с тем же ядром rotor (`packages/flow-core`). NexoryIos — мобильный клиент с общей логикой волны, но своим UI (Dotify-стиль).

---

## 4. Потоки данных (кратко)

### Воспроизведение трека

```
Тап по треку → Player.playQueue / playTrackAt
  → Api.resolve(track)  [direct или gateway]
  → audio.src = stream URL
  → MediaSession metadata + Theme.sampleCover (если accent from cover)
  → UI: mini + full player
```

### Волна

```
Тап «Моя волна» или смена mood
  → Store.setRotor(null) при смене mood
  → Api.waveFetch({ resetSession, mode })
  → playQueue(tracks, 0, «Моя волна»)
  → ended → appendWaveTracks (та же сессия, тот же mood)
```

---

## 5. Сборка IPA

GitHub Actions (`build-ipa.yml`) на `macos-latest`:

1. `npm install` + `scripts/build-ios.sh`
2. Артефакт `Nexory.ipa` + релиз `v1.0.{run_number}`

Установка: eSign / Sideloadly / AltStore (переподпись Apple ID ~7 дней).

---

## 6. Файлы проекта

| Файл | Роль |
|------|------|
| `www/index.html` | Разметка экранов, плеер, sheets |
| `www/css/app.css` | Стили, анимации, орбы |
| `www/js/ui.js` | Экраны, библиотека, импорт, жесты |
| `www/js/player.js` | Очередь, audio, Media Session, волна |
| `www/js/api.js` | Direct + gateway hybrid |
| `www/js/direct-api.js` | VK/Яндекс/SC напрямую |
| `www/js/theme.js` | Темы и палитра с обложки |
| `www/js/store.js` | localStorage |
| `packages/flow-core/yandex-rotor-session.js` | Rotor для gateway |

---

## 7. Частые вопросы

**Почему на lock screen фон бледный?**  
iOS рисует свой Material/blur поверх метаданных. Nexory отдаёт обложку в Media Session; насыщенность фона контролирует система.

**Почему волна «не то настроение»?**  
Нужна новая rotor-сессия при смене mood (сделано в v1.0.56+). Без Яндекс-токена волна не работает.

**Нужен ли ПК для прослушивания?**  
Нет, если есть токены Яндекс/VK/SC. ПК/VPS нужен для gateway-импорта и запасного resolve.

---

*Обновлено вместе с UI-итерацией: овальная заставка, орбы на главной, фикс волны и lock screen controls.*
