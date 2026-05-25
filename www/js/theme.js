const Theme = (() => {

  const BASE_BG = '#050814'

  const PALETTE_VERSION = 7

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



  function decorFromAccent(accent, accent2, bg, opts = {}) {
    const shellBase = bg || BASE_BG
    const dark = !!opts.dark
    const tintMix = dark ? 0.28 : 0.18
    const tintedPlayer = mixHex(BASE_BG, accent, tintMix)
    const glowMul = dark ? 1.35 : 1
    return {
      homeOrb1: hexToRgba(accent, 0.18),
      homeOrb2: hexToRgba(accent2, 0.12),
      homeOrb3: hexToRgba(accent, 0.1),
      homeCardTint: `linear-gradient(160deg, ${hexToRgba(accent, 0.1)} 0%, rgba(255,255,255,0.04) 100%)`,
      homeCardBorder: hexToRgba(accent, 0.18),
      waveLine1: hexToRgba(accent, 0.42),
      waveLine2: hexToRgba(accent2, 0.28),
      waveLine3: hexToRgba(accent, 0.34),
      playerBg: tintedPlayer,
      playerGlow1: hexToRgba(accent, 0.42 * glowMul),
      playerGlow2: hexToRgba(accent2, 0.32 * glowMul),
      playerGlow3: hexToRgba(accent, 0.22 * glowMul),
      playerOverlay: dark
        ? [
          `radial-gradient(ellipse 95% 58% at 50% 6%, ${hexToRgba(accent, 0.38)} 0%, transparent 62%)`,
          `radial-gradient(ellipse 60% 48% at 88% 76%, ${hexToRgba(accent2, 0.28)} 0%, transparent 54%)`,
          `linear-gradient(180deg, ${hexToRgba(accent, 0.16)} 0%, rgba(0,0,0,0.35) 38%, rgba(0,0,0,0.88) 100%)`,
        ].join(', ')
        : [
          `radial-gradient(ellipse 90% 55% at 50% 8%, ${hexToRgba(accent, 0.28)} 0%, transparent 58%)`,
          `radial-gradient(ellipse 55% 42% at 92% 78%, ${hexToRgba(accent2, 0.2)} 0%, transparent 52%)`,
          `linear-gradient(180deg, ${hexToRgba(accent, 0.12)} 0%, rgba(0,0,0,0.42) 42%, rgba(0,0,0,0.9) 100%)`,
        ].join(', '),
      shellBg: `linear-gradient(180deg, ${hexToRgba(accent, 0.1)} 0%, rgba(10,10,14,0.9) 100%)`,
      shellBorder: hexToRgba(accent, 0.14),
      shellPanel: 'rgba(255,255,255,0.06)',
    }
  }



  function isDullCover(r, g, b) {

    const max = Math.max(r, g, b)

    const min = Math.min(r, g, b)

    const sat = max === 0 ? 0 : (max - min) / max

    const lum = relLum(r, g, b)

    return lum > 0.9 || (r > 236 && g > 236 && b > 236) || sat < 0.12

  }



  function buildCoverThemeFromRgb(r, g, b, fallbackTheme, meta = {}) {

    const coverLum = relLum(r, g, b)

    const dark = meta.dark || coverLum < 0.28

    const muted = meta.muted || isDullCover(r, g, b)

    const [h, s] = rgbToHsl(r, g, b)

    const srcSat = meta.sat != null ? meta.sat : s

    const grayish = meta.muted || muted

    const accentS = dark && grayish

      ? Math.max(0.2, Math.min(0.38, srcSat * 0.9 + 0.14))

      : dark

        ? Math.max(0.36, Math.min(0.62, srcSat * 1.1 + 0.18))

        : muted

          ? Math.max(0.28, Math.min(0.5, srcSat * 1.25 + 0.18))

          : Math.max(0.38, Math.min(0.72, srcSat * 1.22 + 0.1))

    const accentL = dark && grayish ? 0.62 : (dark ? 0.64 : (muted ? 0.54 : 0.56))

    const accent = hslToHex(h, accentS, accentL)

    const accent2 = hslToHex((h + 16) % 360, accentS * 0.9, accentL + 0.04)

    const ambientS = Math.min(0.36, Math.max(0.18, accentS * 0.48))

    const tintedBg = hslToHex(h, ambientS, dark && grayish ? 0.08 : 0.07)

    const bg = mixHex(BASE_BG, tintedBg, dark && grayish ? 0.34 : (dark ? 0.28 : (muted ? 0.26 : 0.34)))

    const text = '#f8fafc'

    const textDim = '#94a3b8'

    const textMuted = '#64748b'

    const bgCard = 'rgba(255,255,255,0.06)'

    const bgElevated = 'rgba(255,255,255,0.04)'

    const border = hexToRgba(accent, 0.12)

    const glass = 'rgba(15, 17, 26, 0.78)'

    const dockGlass = 'rgba(10, 10, 14, 0.82)'

    const dockBorder = hexToRgba(accent, 0.1)

    const wavePlayed = '#ffffff'

    const waveUnplayed = 'rgba(255, 255, 255, 0.24)'

    const appBg = [

      `radial-gradient(ellipse 70% 40% at 50% 12%, ${hexToRgba(accent, dark ? 0.22 : 0.14)}, transparent 52%)`,

      `radial-gradient(ellipse 40% 30% at 100% 92%, ${hexToRgba(accent2, dark ? 0.16 : 0.1)}, transparent 45%)`,

      `radial-gradient(ellipse 35% 28% at 4% 68%, ${hexToRgba(accent, dark ? 0.12 : 0.08)}, transparent 48%)`,

      bg,

    ].join(', ')



    const decor = decorFromAccent(accent, accent2, bg, { dark: dark || grayish })

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

      dark,

      v: PALETTE_VERSION,

    }

  }



  function buildCoverThemeFromHex(hex, fallbackTheme) {

    const [r, g, b] = hexToRgb(hex)

    return buildCoverThemeFromRgb(r, g, b, fallbackTheme)

  }



  function withDecor(t) {

    if (t.homeOrb1) return t

    const decor = decorFromAccent(t.accent, t.accent2, t.bg, { dark: t.dark })

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
    setVar('--player-glow-1', t.playerGlow1 || hexToRgba(t.accent, 0.35))
    setVar('--player-glow-2', t.playerGlow2 || hexToRgba(t.accent2, 0.25))
    setVar('--player-glow-3', t.playerGlow3 || hexToRgba(t.accent, 0.18))
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

    document.documentElement.classList.toggle('cover-theme-dark', !!t.dark)



    if (persist) {

      Store.patch({ accentCoverHex: t.accent, accentCoverPalette: t })

    }

    notifyAccentChange(t.accent)

    applyPlayerBg()

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



    if (!animate || !currentTheme) {

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

      const paletteOk = palette && palette.accent && palette.bg && palette.v === PALETTE_VERSION

      if (paletteOk) {

        applyCoverTheme(withDecor(palette), { persist: false, animate: false })

      } else if (s.accentCoverHex) {

        applyCoverTheme(buildCoverThemeFromHex(s.accentCoverHex, t), { persist: true, animate: false })

      } else {

        applyBaseTheme(t)

        document.body.classList.add('accent-from-cover')

        document.documentElement.classList.add('cover-theme-on')

      }

    } else {

      document.body.classList.remove('accent-from-cover')

      document.documentElement.classList.remove('cover-theme-on')

      document.documentElement.classList.remove('cover-theme-dark')

      if (s.accentCoverHex || s.accentCoverPalette) {

        Store.patch({ accentCoverHex: '', accentCoverPalette: null })

      }

      applyBaseTheme(t)

    }



    applyPlayerBg(s)

  }



  function applyPlayerBg(settings) {

    const bg = document.getElementById('full-bg')

    if (!bg) return

    const dark = document.documentElement.classList.contains('cover-theme-dark')

    bg.style.filter = dark

      ? 'blur(72px) saturate(1.2) brightness(0.72) contrast(1.05)'

      : 'blur(64px) saturate(1.5) brightness(0.88)'

  }



  let fullBgLayer = 'a'

  function setFullBgImage(url) {
    const host = document.getElementById('full-bg')
    const a = document.getElementById('full-bg-a')
    const b = document.getElementById('full-bg-b')
    if (!host) return
    if (!a || !b) {
      if (url) host.style.backgroundImage = `url("${url}")`
      else host.style.backgroundImage = ''
      return
    }
    host.style.backgroundImage = ''
    const nextKey = fullBgLayer === 'a' ? 'b' : 'a'
    const cur = fullBgLayer === 'a' ? a : b
    const next = fullBgLayer === 'a' ? b : a
    if (!url) {
      cur.classList.remove('is-active')
      next.classList.remove('is-active')
      cur.style.backgroundImage = ''
      next.style.backgroundImage = ''
      cur.dataset.bgUrl = ''
      next.dataset.bgUrl = ''
      return
    }
    if (next.dataset.bgUrl === url && next.classList.contains('is-active')) return
    const swap = () => {
      next.dataset.bgUrl = url
      next.style.backgroundImage = `url("${url}")`
      requestAnimationFrame(() => {
        next.classList.add('is-active')
        cur.classList.remove('is-active')
        fullBgLayer = nextKey
      })
    }
    const probe = new Image()
    probe.onload = swap
    probe.onerror = swap
    probe.src = url
  }



  function extractAccentRgb(data, width, height) {

    const hues = new Map()

    let grayPixels = 0

    let colorPixels = 0

    let avgR = 0

    let avgG = 0

    let avgB = 0

    let avgN = 0

    let sumLum = 0

    let brightR = 0

    let brightG = 0

    let brightB = 0

    let brightW = 0

    const cx = (width - 1) / 2

    const cy = (height - 1) / 2

    const maxDist = Math.hypot(cx, cy) || 1



    for (let y = 0; y < height; y++) {

      for (let x = 0; x < width; x++) {

        const i = (y * width + x) * 4

        const r = data[i]

        const g = data[i + 1]

        const b = data[i + 2]

        const a = data[i + 3]

        if (a < 96) continue



        const max = Math.max(r, g, b)

        const min = Math.min(r, g, b)

        const sat = max === 0 ? 0 : (max - min) / max

        const lum = max / 255



        avgR += r

        avgG += g

        avgB += b

        avgN++

        sumLum += lum



        if (sat < 0.12) {

          grayPixels++

          continue

        }

        colorPixels++



        const dist = Math.hypot(x - cx, y - cy) / maxDist

        const centerBoost = 1.58 - dist * 0.42

        if (lum > 0.68 && sat > 0.1) {

          const bw = sat * centerBoost

          brightR += r * bw

          brightG += g * bw

          brightB += b * bw

          brightW += bw

        }

        if (lum < 0.1 || lum > 0.94) continue

        if (sat < 0.18) continue



        const [hue, sl] = rgbToHsl(r, g, b)

        const bucket = Math.floor(hue / 12) * 12

        const satW = sat * sat

        const weight = satW * centerBoost * (1 - Math.abs(sl - 0.44) * 0.5)

        const prev = hues.get(bucket) || { r: 0, g: 0, b: 0, w: 0, s: 0 }

        prev.r += r * weight

        prev.g += g * weight

        prev.b += b * weight

        prev.s += sat * weight

        prev.w += weight

        hues.set(bucket, prev)

      }

    }



    if (!avgN) return null



    const grayRatio = grayPixels / Math.max(1, grayPixels + colorPixels)

    const avgLum = sumLum / Math.max(1, avgN)

    const isDark = avgLum < 0.38

    const fallbackRgb = {

      r: Math.round(avgR / avgN),

      g: Math.round(avgG / avgN),

      b: Math.round(avgB / avgN),

    }



    if (!hues.size || colorPixels < 6 || grayRatio > 0.68) {

      const [, fs] = rgbToHsl(fallbackRgb.r, fallbackRgb.g, fallbackRgb.b)

      return { ...fallbackRgb, sat: Math.max(0.16, fs), muted: true }

    }



    const entries = [...hues.entries()].sort((a, b) => b[1].w - a[1].w)

    const top = entries[0]

    let cluster = { ...top[1] }

    let clusterW = top[1].w

    const totalW = entries.reduce((n, [, v]) => n + v.w, 0)



    if (entries.length > 1 && top[1].w < totalW * 0.38) {

      const h0 = top[0]

      for (let k = 1; k < Math.min(3, entries.length); k++) {

        const hk = entries[k][0]

        const diff = Math.min(Math.abs(hk - h0), 360 - Math.abs(hk - h0))

        if (diff <= 24) {

          const v = entries[k][1]

          cluster.r += v.r

          cluster.g += v.g

          cluster.b += v.b

          cluster.s += v.s

          cluster.w += v.w

          clusterW += v.w

        }

      }

    }



    if (cluster.w < 0.001) {

      const [, fs] = rgbToHsl(fallbackRgb.r, fallbackRgb.g, fallbackRgb.b)

      return { ...fallbackRgb, sat: Math.max(0.16, fs), muted: true }

    }



    let fr = cluster.r / cluster.w

    let fg = cluster.g / cluster.w

    let fb = cluster.b / cluster.w

    let fsat = cluster.s / cluster.w



    if (entries.length > 1 && entries[1][1].w > totalW * 0.2) {

      const second = entries[1][1]

      const mix = Math.min(0.36, second.w / totalW)

      fr = fr * (1 - mix) + (second.r / second.w) * mix

      fg = fg * (1 - mix) + (second.g / second.w) * mix

      fb = fb * (1 - mix) + (second.b / second.w) * mix

      fsat = fsat * (1 - mix) + (second.s / second.w) * mix

    }



    if (isDark && brightW > 0.001) {

      fr = brightR / brightW

      fg = brightG / brightW

      fb = brightB / brightW

      fsat = Math.max(fsat, 0.35)

    }



    return {

      r: Math.round(fr),

      g: Math.round(fg),

      b: Math.round(fb),

      sat: fsat,

      muted: grayRatio > 0.48 || clusterW < totalW * 0.42,

      dark: isDark,

    }

  }



  function sampleCoverThemeFromImage(img) {

    const size = 64

    const canvas = document.createElement('canvas')

    canvas.width = size

    canvas.height = size

    const ctx = canvas.getContext('2d')

    ctx.drawImage(img, 0, 0, size, size)

    const { data, width, height } = ctx.getImageData(0, 0, size, size)

    const sample = extractAccentRgb(data, width, height)

    if (!sample) return null

    const base = THEMES[Store.get().theme] || THEMES.dark

    return buildCoverThemeFromRgb(sample.r, sample.g, sample.b, base, sample)

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


