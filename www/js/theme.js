const Theme = (() => {

  const BASE_BG = '#050814'

  const THEMES = {

    dark: {

      bg: '#020617',

      text: '#f8fafc',

      textDim: '#94a3b8',

      textMuted: '#64748b',

      bgCard: 'rgba(255,255,255,0.06)',

      bgElevated: 'rgba(255,255,255,0.04)',

      border: 'rgba(255,255,255,0.07)',

      glass: 'rgba(15, 17, 26, 0.72)',

      dockGlass: 'rgba(10, 10, 14, 0.68)',

      dockBorder: 'rgba(255, 255, 255, 0.07)',

      accent: '#ec4899',

      accent2: '#f43f5e',

      accentGlow: 'rgba(236, 72, 153, 0.35)',

      wavePlayed: '#ffffff',

      waveUnplayed: 'rgba(255, 255, 255, 0.24)',

      appBg: 'radial-gradient(ellipse 90% 50% at 50% -10%, rgba(236, 72, 153, 0.12), transparent 55%), radial-gradient(ellipse 40% 30% at 100% 80%, rgba(244, 63, 94, 0.08), transparent), #020617',

    },

    light: {

      bg: '#f1f5f9',

      text: '#0f172a',

      textDim: '#475569',

      textMuted: '#64748b',

      bgCard: 'rgba(15, 23, 42, 0.06)',

      bgElevated: 'rgba(15, 23, 42, 0.04)',

      border: 'rgba(15, 23, 42, 0.1)',

      glass: 'rgba(255, 255, 255, 0.82)',

      dockGlass: 'rgba(255, 255, 255, 0.88)',

      dockBorder: 'rgba(15, 23, 42, 0.08)',

      accent: '#db2777',

      accent2: '#e11d48',

      accentGlow: 'rgba(219, 39, 119, 0.25)',

      wavePlayed: '#0f172a',

      waveUnplayed: 'rgba(15, 23, 42, 0.22)',

      appBg: 'radial-gradient(ellipse 90% 50% at 50% -10%, rgba(219, 39, 119, 0.08), transparent 55%), #f1f5f9',

    },

    amoled: {

      bg: '#000000',

      text: '#f8fafc',

      textDim: '#94a3b8',

      textMuted: '#64748b',

      bgCard: 'rgba(255,255,255,0.05)',

      bgElevated: 'rgba(255,255,255,0.03)',

      border: 'rgba(255,255,255,0.06)',

      glass: 'rgba(0, 0, 0, 0.85)',

      dockGlass: 'rgba(0, 0, 0, 0.9)',

      dockBorder: 'rgba(255, 255, 255, 0.06)',

      accent: '#ec4899',

      accent2: '#f43f5e',

      accentGlow: 'rgba(236, 72, 153, 0.3)',

      wavePlayed: '#ffffff',

      waveUnplayed: 'rgba(255, 255, 255, 0.24)',

      appBg: '#000000',

    },

    rose: {

      bg: '#140810',

      text: '#fce7f3',

      textDim: '#f9a8d4',

      textMuted: '#be185d',

      bgCard: 'rgba(251, 113, 133, 0.08)',

      bgElevated: 'rgba(251, 113, 133, 0.05)',

      border: 'rgba(251, 113, 133, 0.15)',

      glass: 'rgba(20, 8, 16, 0.78)',

      dockGlass: 'rgba(12, 4, 10, 0.82)',

      dockBorder: 'rgba(251, 113, 133, 0.12)',

      accent: '#fb7185',

      accent2: '#f472b6',

      accentGlow: 'rgba(251, 113, 133, 0.35)',

      wavePlayed: '#fce7f3',

      waveUnplayed: 'rgba(252, 231, 243, 0.28)',

      appBg: 'radial-gradient(ellipse 80% 45% at 50% 0%, rgba(251, 113, 133, 0.18), transparent 55%), #140810',

    },

  }



  let accentJob = 0

  let currentTheme = null

  let themeAnim = null



  function setVar(name, value) {

    document.documentElement.style.setProperty(name, value)

  }



  function notifyAccentChange(hex) {

    document.documentElement.dispatchEvent(new CustomEvent('nexory-accent', { detail: { hex } }))

  }



  function relLum(r, g, b) {

    const lin = (x) => {

      const v = x / 255

      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4

    }

    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)

  }



  function rgbToHsl(r, g, b) {

    r /= 255

    g /= 255

    b /= 255

    const max = Math.max(r, g, b)

    const min = Math.min(r, g, b)

    let h = 0

    let s = 0

    const l = (max + min) / 2

    if (max !== min) {

      const d = max - min

      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

      switch (max) {

        case r:

          h = ((g - b) / d + (g < b ? 6 : 0)) / 6

          break

        case g:

          h = ((b - r) / d + 2) / 6

          break

        default:

          h = ((r - g) / d + 4) / 6

      }

    }

    return [h * 360, s, l]

  }



  function hslToRgb(h, s, l) {

    h = ((h % 360) + 360) % 360

    s = Math.max(0, Math.min(1, s))

    l = Math.max(0, Math.min(1, l))

    if (s === 0) {

      const v = Math.round(l * 255)

      return [v, v, v]

    }

    const hue2rgb = (p, q, t) => {

      if (t < 0) t += 1

      if (t > 1) t -= 1

      if (t < 1 / 6) return p + (q - p) * 6 * t

      if (t < 1 / 2) return q

      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6

      return p

    }

    const hh = h / 360

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s

    const p = 2 * l - q

    return [

      Math.round(hue2rgb(p, q, hh + 1 / 3) * 255),

      Math.round(hue2rgb(p, q, hh) * 255),

      Math.round(hue2rgb(p, q, hh - 1 / 3) * 255),

    ]

  }



  function hslToHex(h, s, l) {

    const [r, g, b] = hslToRgb(h, s, l)

    return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`

  }



  function hexToRgb(hex) {

    const n = parseInt(String(hex).replace('#', ''), 16)

    if (!Number.isFinite(n)) return [236, 72, 153]

    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]

  }



  function hexToRgba(hex, a) {

    const [r, g, b] = hexToRgb(hex)

    return `rgba(${r}, ${g}, ${b}, ${a})`

  }



  function rgbaFromHsl(h, s, l, a) {

    const [r, g, b] = hslToRgb(h, s, l)

    return `rgba(${r}, ${g}, ${b}, ${a})`

  }



  function mixHex(a, b, t) {

    const [r1, g1, b1] = hexToRgb(a)

    const [r2, g2, b2] = hexToRgb(b)

    const mix = (x, y) => Math.round(x + (y - x) * t)

    return `#${[mix(r1, r2), mix(g1, g2), mix(b1, b2)].map((v) => v.toString(16).padStart(2, '0')).join('')}`

  }



  function easeOutCubic(t) {

    return 1 - (1 - t) ** 3

  }



  function decorFromAccent(accent, accent2, bg) {
    const shellBase = bg || '#050814'
    return {
      homeOrb1: hexToRgba(accent, 0.28),
      homeOrb2: hexToRgba(accent2, 0.18),
      homeOrb3: hexToRgba(accent, 0.1),
      homeCardTint: `linear-gradient(145deg, ${hexToRgba(accent, 0.14)} 0%, ${hexToRgba(accent2, 0.06)} 55%, rgba(255,255,255,0.03) 100%)`,
      homeCardBorder: hexToRgba(accent, 0.22),
      waveLine1: hexToRgba(accent, 0.52),
      waveLine2: hexToRgba(accent2, 0.36),
      waveLine3: hexToRgba(accent, 0.42),
      playerBg: shellBase,
      playerOverlay: `linear-gradient(180deg, ${hexToRgba(accent, 0.32)} 0%, ${hexToRgba(accent2, 0.12)} 38%, rgba(0,0,0,0.78) 72%, rgba(0,0,0,0.9) 100%)`,
      shellBg: `linear-gradient(180deg, ${hexToRgba(accent, 0.22)} 0%, ${hexToRgba(accent, 0.1)} 42%, rgba(8,10,18,0.92) 100%)`,
      shellBorder: hexToRgba(accent, 0.2),
      shellPanel: hexToRgba(accent, 0.1),
    }
  }



  function isDullCover(r, g, b) {

    const max = Math.max(r, g, b)

    const min = Math.min(r, g, b)

    const sat = max === 0 ? 0 : (max - min) / max

    const lum = relLum(r, g, b)

    return lum > 0.9 || (r > 236 && g > 236 && b > 236) || sat < 0.12

  }



  function buildCoverThemeFromRgb(r, g, b, fallbackTheme) {

    if (isDullCover(r, g, b)) {

      const fb = fallbackTheme || THEMES.dark

      return buildCoverThemeFromHex(fb.accent, fb)

    }



    const [h, s] = rgbToHsl(r, g, b)

    const accentS = Math.max(0.48, Math.min(0.8, s < 0.18 ? 0.64 : s * 1.02))

    const accent = hslToHex(h, accentS, 0.56)

    const accent2 = hslToHex((h + 26) % 360, accentS * 0.9, 0.62)



    const ambientS = Math.min(0.38, Math.max(0.2, accentS * 0.48))

    const tintedBg = hslToHex(h, ambientS, 0.072)

    const bg = mixHex(BASE_BG, tintedBg, 0.58)

    const bgAlt = mixHex(BASE_BG, hslToHex((h + 24) % 360, ambientS * 0.85, 0.085), 0.5)



    const text = hslToHex(h, 0.06, 0.97)

    const textDim = hslToHex(h, 0.1, 0.72)

    const textMuted = hslToHex(h, 0.08, 0.46)



    const bgCard = hexToRgba(accent, 0.11)

    const bgElevated = hexToRgba(accent, 0.065)

    const border = hexToRgba(accent, 0.18)

    const glass = rgbaFromHsl(h, ambientS * 0.65, 0.045, 0.78)

    const dockGlass = rgbaFromHsl(h, ambientS * 0.6, 0.032, 0.84)

    const dockBorder = hexToRgba(accent, 0.16)



    const wavePlayed = hslToHex(h, 0.14, 0.96)

    const waveUnplayed = hexToRgba(text, 0.24)



    const appBg = [

      `radial-gradient(ellipse 120% 72% at 50% -16%, ${hexToRgba(accent, 0.2)}, transparent 54%)`,

      `radial-gradient(ellipse 52% 42% at 96% 88%, ${hexToRgba(accent2, 0.12)}, transparent 46%)`,

      `radial-gradient(ellipse 44% 36% at 4% 68%, ${hexToRgba(accent, 0.07)}, transparent 40%)`,

      `linear-gradient(168deg, ${bgAlt} 0%, ${bg} 52%, ${mixHex(BASE_BG, hslToHex((h + 10) % 360, ambientS * 0.75, 0.05), 0.35)} 100%)`,

    ].join(', ')



    const decor = decorFromAccent(accent, accent2, bg)

    return {

      bg,

      text,

      textDim,

      textMuted,

      bgCard,

      bgElevated,

      border,

      glass,

      dockGlass,

      dockBorder,

      accent,

      accent2,

      accentGlow: hexToRgba(accent, 0.32),

      wavePlayed,

      waveUnplayed,

      appBg,

      ...decor,

    }

  }



  function buildCoverThemeFromHex(hex, fallbackTheme) {

    const [r, g, b] = hexToRgb(hex)

    return buildCoverThemeFromRgb(r, g, b, fallbackTheme)

  }



  function withDecor(t) {

    if (t.homeOrb1) return t

    const decor = decorFromAccent(t.accent, t.accent2)

    return { ...t, ...decor }

  }



  function applyAccentVars(theme) {

    setVar('--accent', theme.accent)

    setVar('--accent-2', theme.accent2)

    setVar('--accent-glow', theme.accentGlow)

    setVar('--accent-soft', hexToRgba(theme.accent, 0.14))

    setVar('--accent-border', hexToRgba(theme.accent, 0.28))

    setVar('--accent-fill', hexToRgba(theme.accent, 0.1))

    setVar('--accent-fill-strong', hexToRgba(theme.accent, 0.18))

  }



  function applyDecorVars(theme) {

    const t = withDecor(theme)

    setVar('--home-orb-1', t.homeOrb1)

    setVar('--home-orb-2', t.homeOrb2)

    setVar('--home-orb-3', t.homeOrb3)

    setVar('--home-card-tint', t.homeCardTint)

    setVar('--home-card-border', t.homeCardBorder)

    setVar('--wave-line-1', t.waveLine1)

    setVar('--wave-line-2', t.waveLine2)

    setVar('--wave-line-3', t.waveLine3)
    setVar('--player-bg', t.playerBg || t.bg)
    setVar('--player-overlay', t.playerOverlay || 'rgba(0,0,0,0.86)')
    setVar('--shell-bg', t.shellBg || t.dockGlass)
    setVar('--shell-border', t.shellBorder || t.dockBorder)
    setVar('--shell-panel', t.shellPanel || 'rgba(255,255,255,0.06)')
  }



  function applyCoverThemeInstant(theme, { persist = true, appBgOverride = null } = {}) {

    if (!theme) return null

    const t = withDecor(theme)



    setVar('--bg', t.bg)

    setVar('--text', t.text)

    setVar('--text-dim', t.textDim)

    setVar('--text-muted', t.textMuted)

    setVar('--bg-card', t.bgCard)

    setVar('--bg-elevated', t.bgElevated)

    setVar('--border', t.border)

    setVar('--glass', t.glass)

    setVar('--dock-glass', t.dockGlass)

    setVar('--dock-border', t.dockBorder)

    setVar('--wave-played', t.wavePlayed)

    setVar('--wave-unplayed', t.waveUnplayed)

    applyAccentVars(t)

    applyDecorVars(t)



    const appBg = document.getElementById('app-bg')

    if (appBg) appBg.style.background = appBgOverride || t.appBg



    const meta = document.querySelector('meta[name="theme-color"]')

    if (meta) meta.setAttribute('content', t.bg)



    document.body.classList.add('accent-from-cover')

    document.documentElement.classList.add('cover-theme-on')



    if (persist) {

      Store.patch({ accentCoverHex: t.accent, accentCoverPalette: t })

    }

    notifyAccentChange(t.accent)

    return t

  }



  function lerpTheme(a, b, t) {

    const out = { ...b }

    const hexKeys = ['bg', 'text', 'textDim', 'textMuted', 'accent', 'accent2']

    for (const key of hexKeys) {

      if (a[key] && b[key]) out[key] = mixHex(a[key], b[key], t)

    }

    out.accentGlow = hexToRgba(out.accent, 0.28 + t * 0.06)

    if (t < 0.55) {

      out.appBg = a.appBg

      out.bgCard = a.bgCard

      out.border = a.border

    }

    return withDecor(out)

  }



  function applyCoverTheme(theme, { persist = true, animate = true } = {}) {

    if (!theme) return null

    const target = withDecor(theme)



    if (themeAnim) {

      cancelAnimationFrame(themeAnim)

      themeAnim = null

    }



    if (!animate || !currentTheme || currentTheme.accent === target.accent) {

      applyCoverThemeInstant(target, { persist })

      currentTheme = target

      return target

    }



    const from = currentTheme

    const start = performance.now()

    const dur = 520



    const tick = (now) => {

      const raw = Math.min(1, (now - start) / dur)

      const eased = easeOutCubic(raw)

      const blended = lerpTheme(from, target, eased)

      applyCoverThemeInstant(blended, { persist: false, appBgOverride: raw > 0.72 ? target.appBg : blended.appBg })

      if (raw < 1) {

        themeAnim = requestAnimationFrame(tick)

        return

      }

      themeAnim = null

      applyCoverThemeInstant(target, { persist })

      currentTheme = target

    }



    themeAnim = requestAnimationFrame(tick)

    return target

  }



  function applyBaseTheme(t) {

    const theme = withDecor(t)

    setVar('--bg', theme.bg)

    setVar('--text', theme.text)

    setVar('--text-dim', theme.textDim)

    setVar('--text-muted', theme.textMuted)

    setVar('--bg-card', theme.bgCard)

    setVar('--bg-elevated', theme.bgElevated || 'rgba(255,255,255,0.04)')

    setVar('--border', theme.border)

    setVar('--glass', theme.glass || 'rgba(15, 17, 26, 0.72)')

    setVar('--dock-glass', theme.dockGlass || 'rgba(10, 10, 14, 0.68)')

    setVar('--dock-border', theme.dockBorder || theme.border)

    setVar('--wave-played', theme.wavePlayed || '#ffffff')

    setVar('--wave-unplayed', theme.waveUnplayed || 'rgba(255, 255, 255, 0.24)')

    applyAccentVars(theme)

    applyDecorVars(theme)



    const appBg = document.getElementById('app-bg')

    if (appBg) appBg.style.background = theme.appBg



    const meta = document.querySelector('meta[name="theme-color"]')

    if (meta) meta.setAttribute('content', theme.bg)

    notifyAccentChange(theme.accent)

    currentTheme = theme

  }



  function applyAccent(hex, { persist = true } = {}) {

    if (!hex) return null

    const base = THEMES[Store.get().theme] || THEMES.dark

    const theme = buildCoverThemeFromHex(hex, base)

    return applyCoverTheme(theme, { persist })

  }



  function apply(settings) {

    const s = settings || Store.get()

    const t = THEMES[s.theme] || THEMES.dark



    if (s.accentFromCover) {

      const palette = s.accentCoverPalette

      if (palette && palette.accent && palette.bg) {

        applyCoverTheme(withDecor(palette), { persist: false, animate: false })

      } else if (s.accentCoverHex) {

        applyCoverTheme(buildCoverThemeFromHex(s.accentCoverHex, t), { persist: false, animate: false })

      } else {

        applyBaseTheme(t)

        document.body.classList.add('accent-from-cover')

        document.documentElement.classList.add('cover-theme-on')

      }

    } else {

      document.body.classList.remove('accent-from-cover')

      document.documentElement.classList.remove('cover-theme-on')

      if (s.accentCoverHex || s.accentCoverPalette) {

        Store.patch({ accentCoverHex: '', accentCoverPalette: null })

      }

      applyBaseTheme(t)

    }



    applyPlayerBg(s)

  }



  function applyPlayerBg(settings) {

    const s = settings || Store.get()

    const bg = document.getElementById('full-bg')

    if (!bg) return

    const blur = Number(s.bgBlur ?? 56)

    const bright = Number(s.bgBrightness ?? 45) / 100

    bg.style.filter = `blur(${blur}px) saturate(1.35)`

    bg.style.opacity = String(Math.max(0.35, Math.min(0.72, bright + 0.15)))

  }



  function setFullBgImage(url) {

    const bg = document.getElementById('full-bg')

    if (!bg) return

    if (url) bg.style.backgroundImage = `url(${url})`

    else bg.style.backgroundImage = ''

  }



  function extractAccentRgb(data, width, height) {

    const hues = new Map()

    let sumR = 0

    let sumG = 0

    let sumB = 0

    let sumW = 0



    const cornerIdx = [

      0,

      (width - 1) * 4,

      (height - 1) * width * 4,

      ((height - 1) * width + (width - 1)) * 4,

    ]



    for (const i of cornerIdx) {

      const r = data[i]

      const g = data[i + 1]

      const b = data[i + 2]

      const a = data[i + 3]

      if (a < 128) continue

      const max = Math.max(r, g, b)

      const min = Math.min(r, g, b)

      const sat = max === 0 ? 0 : (max - min) / max

      if (sat < 0.08) continue

      sumR += r * sat

      sumG += g * sat

      sumB += b * sat

      sumW += sat

    }



    for (let i = 0; i < data.length; i += 4) {

      const r = data[i]

      const g = data[i + 1]

      const b = data[i + 2]

      const a = data[i + 3]

      if (a < 100) continue



      const max = Math.max(r, g, b)

      const min = Math.min(r, g, b)

      const sat = max === 0 ? 0 : (max - min) / max

      const lum = max / 255

      if (lum < 0.1 || lum > 0.96) continue



      if (sat > 0.1) {

        sumR += r * sat

        sumG += g * sat

        sumB += b * sat

        sumW += sat

      }

      if (sat < 0.16) continue



      const [hue] = rgbToHsl(r, g, b)

      const bucket = Math.floor(hue / 14) * 14

      const weight = sat * (1 - Math.abs(lum - 0.52) * 0.75)

      const prev = hues.get(bucket) || { r: 0, g: 0, b: 0, w: 0 }

      prev.r += r * weight

      prev.g += g * weight

      prev.b += b * weight

      prev.w += weight

      hues.set(bucket, prev)

    }



    let best = null

    let bestW = 0

    for (const v of hues.values()) {

      if (v.w > bestW) {

        bestW = v.w

        best = [v.r / v.w, v.g / v.w, v.b / v.w]

      }

    }



    if (!best && sumW > 0) {

      best = [sumR / sumW, sumG / sumW, sumB / sumW]

    }

    if (!best) return null

    return best.map((v) => Math.round(v))

  }



  function sampleCoverThemeFromImage(img) {

    const size = 64

    const canvas = document.createElement('canvas')

    canvas.width = size

    canvas.height = size

    const ctx = canvas.getContext('2d')

    ctx.drawImage(img, 0, 0, size, size)

    const { data, width, height } = ctx.getImageData(0, 0, size, size)

    const rgb = extractAccentRgb(data, width, height)

    if (!rgb) return null

    const base = THEMES[Store.get().theme] || THEMES.dark

    return buildCoverThemeFromRgb(rgb[0], rgb[1], rgb[2], base)

  }



  function loadImage(url) {

    return new Promise((resolve, reject) => {

      const img = new Image()

      img.onload = () => resolve(img)

      img.onerror = () => reject(new Error('image load failed'))

      img.src = url

    })

  }



  async function blobUrlForImage(url) {

    if (!url || url.startsWith('data:') || url.startsWith('blob:')) return url

    const res = await fetch(url)

    if (!res.ok) throw new Error('fetch failed')

    const blob = await res.blob()

    return URL.createObjectURL(blob)

  }



  async function extractAccentFromUrl(url) {

    if (!url || !Store.get().accentFromCover) return Promise.resolve(null)

    const job = ++accentJob

    return new Promise((resolve) => {

      let blobUrl = null

      const finish = (theme) => {

        if (blobUrl?.startsWith('blob:')) URL.revokeObjectURL(blobUrl)

        if (!theme || job !== accentJob) return resolve(null)

        applyCoverTheme(theme)

        resolve(theme.accent)

      }



      blobUrlForImage(url)

        .then(async (src) => {

          blobUrl = src.startsWith('blob:') ? src : null

          const img = await loadImage(src)

          if (job !== accentJob) return resolve(null)

          finish(sampleCoverThemeFromImage(img))

        })

        .catch(async () => {

          try {

            const img = await loadImage(url)

            if (job !== accentJob) return resolve(null)

            finish(sampleCoverThemeFromImage(img))

          } catch {

            finish(null)

          }

        })

    })

  }



  function extractAccentFromElement(imgEl) {

    if (!imgEl || !imgEl.complete || !imgEl.naturalWidth || !Store.get().accentFromCover) return null

    try {

      const theme = sampleCoverThemeFromImage(imgEl)

      if (!theme) return null

      applyCoverTheme(theme)

      return theme.accent

    } catch {

      return null

    }

  }



  return {

    apply,

    applyPlayerBg,

    setFullBgImage,

    extractAccentFromUrl,

    extractAccentFromElement,

    applyAccent,

    applyCoverTheme,

    THEMES,

  }

})()


