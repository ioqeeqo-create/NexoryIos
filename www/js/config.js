/** Значения по умолчанию для VPS (можно переопределить в настройках). */
const NexoryConfig = {
  /** Redirect URI в приложении SoundCloud → Developers. */
  SC_OAUTH_REDIRECT: 'nexory://oauth/soundcloud',
  /** Пусто = без VPS; пользователь задаёт gateway вручную при необходимости. */
  DEFAULT_SERVER_URL: '',
  DEFAULT_SERVER_SECRET: '',
  SEARCH_SOURCES: [
    { id: 'yandex', label: 'Яндекс', icon: 'assets/source-yandex-music.png' },
    { id: 'vk', label: 'VK', icon: 'assets/source-vk.png' },
    { id: 'soundcloud', label: 'SoundCloud', short: 'SC', icon: 'assets/source-soundcloud.png' },
  ],
  WAVE_MOODS: [
    { id: 'default', label: 'Обычная', icon: 'smile', tint: 'rgba(236, 72, 153, 0.14)', border: 'rgba(236, 72, 153, 0.28)' },
    { id: 'sad', label: 'Грустная', icon: 'frown', tint: 'rgba(96, 165, 250, 0.16)', border: 'rgba(96, 165, 250, 0.32)' },
    { id: 'happy', label: 'Весёлая', icon: 'sparkles', tint: 'rgba(250, 204, 21, 0.16)', border: 'rgba(250, 204, 21, 0.34)' },
    { id: 'energetic', label: 'Энергичная', icon: 'zap', tint: 'rgba(251, 146, 60, 0.16)', border: 'rgba(251, 146, 60, 0.34)' },
    { id: 'calm', label: 'Спокойная', icon: 'leaf', tint: 'rgba(52, 211, 153, 0.14)', border: 'rgba(52, 211, 153, 0.3)' },
    { id: 'romantic', label: 'Романтика', icon: 'heart', tint: 'rgba(244, 114, 182, 0.16)', border: 'rgba(244, 114, 182, 0.32)' },
  ],
  THEME_CARDS: [
    { id: 'dark', label: 'Тёмная', swatch: 'linear-gradient(145deg,#1e293b 0%,#0f172a 55%,#020617 100%)' },
    { id: 'light', label: 'Светлая', swatch: 'linear-gradient(145deg,#f8fafc 0%,#e2e8f0 55%,#cbd5e1 100%)' },
    { id: 'amoled', label: 'AMOLED', swatch: 'linear-gradient(180deg,#1a1a1a 0%,#000 100%)' },
    { id: 'rose', label: 'Розовая', swatch: 'linear-gradient(145deg,#fb7185 0%,#be185d 45%,#4c0519 100%)' },
  ],
  BG_PRESETS: [
    { id: 'night', label: 'Ночь', css: 'linear-gradient(160deg,#0f172a 0%,#312e81 50%,#020617 100%)' },
    { id: 'violet', label: 'Фиолет', css: 'linear-gradient(160deg,#1e1b4b 0%,#6d28d9 45%,#0f172a 100%)' },
    { id: 'ember', label: 'Закат', css: 'linear-gradient(160deg,#431407 0%,#ea580c 40%,#1c1917 100%)' },
    { id: 'ocean', label: 'Океан', css: 'linear-gradient(160deg,#042f2e 0%,#0891b2 42%,#0f172a 100%)' },
  ],
}
