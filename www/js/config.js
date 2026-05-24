/** Значения по умолчанию для VPS (можно переопределить в настройках). */
const NexoryConfig = {
  DEFAULT_SERVER_URL: 'http://85.239.34.229',
  DEFAULT_SERVER_SECRET:
    'd7e68022ac41dd20db61c45f6ed54222c0bd56e5313f15b50263ef3358c70dca',
  WAVE_MOODS: [
    { id: 'default', label: 'Обычная', icon: 'smile' },
    { id: 'sad', label: 'Грустная', icon: 'frown' },
    { id: 'happy', label: 'Весёлая', icon: 'sparkles' },
    { id: 'energetic', label: 'Энергичная', icon: 'zap' },
    { id: 'calm', label: 'Спокойная', icon: 'leaf' },
    { id: 'romantic', label: 'Романтика', icon: 'heart' },
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
