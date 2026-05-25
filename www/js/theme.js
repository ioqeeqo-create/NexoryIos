const Theme = (() => {

  const BASE_BG = '#050814'

  const PALETTE_VERSION = 11

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



  function rgbToHex(r, g, b) {
    return `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`
  }

  function decorFromAccent(accent, accent2, bg, opts = {}) {
    const shellBase = bg || BASE_BG
    const dark = !!opts.dark
    const mono = !!opts.monochrome
    const coverLum = opts.coverLum ?? 0.28
    const hiStr = opts.highlightStrength || 0
    const lit = hiStr > 0.055 && (mono ? hiStr > 0.08 : true)
    const hiX = opts.highlightX ?? 50
    const hiY = Math.min(42, opts.highlightY ?? 20)
    const topHex = rgbToHex(
      opts.topHighlightR ?? opts.highlightR ?? 255,
      opts.topHighlightG ?? opts.highlightG ?? 255,
      opts.topHighlightB ?? opts.highlightB ?? 255,
    )
    const hiHex = rgbToHex(opts.highlightR ?? 255, opts.highlightG ?? 255, opts.highlightB ?? 255)
    const tintMix = mono ? 0.12 : (dark ? 0.22 + coverLum * 0.18 : 0.18)
    let tintedPlayer = mixHex(BASE_BG, accent, tintMix)
    if (opts.shadowRgb) {
      const [sr, sg, sb] = opts.shadowRgb
      const shadowHex = `#${[sr, sg, sb].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`
      tintedPlayer = mixHex(tintedPlayer, shadowHex, mono ? 0.55 : (dark ? 0.42 : 0.18))
    }
    if (lit) {
      tintedPlayer = mixHex(tintedPlayer, topHex, mono ? 0.14 + hiStr * 0.12 : 0.1 + hiStr * 0.22)
    }
    const glowMul = mono ? 0.85 : (dark ? 1.35 : 1)
    const litBoost = lit ? 0.55 + hiStr * 0.95 : 1
    const shadowGlow = opts.shadowRgb
      ? `#${opts.shadowRgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`
      : accent2
    let playerGlow1 = hexToRgba(accent, 0.42 * glowMul)
    let playerGlow2 = hexToRgba(accent2, 0.32 * glowMul)
    let playerGlow3 = hexToRgba(accent, 0.22 * glowMul)
    let playerOverlay = mono
        ? [
          `radial-gradient(ellipse 92% 58% at 50% 6%, rgba(255,255,255,${coverLum < 0.14 ? '0.28' : '0.18'}) 0%, transparent 62%)`,
          `radial-gradient(ellipse 55% 42% at 88% 78%, rgba(255,255,255,0.12) 0%, transparent 52%)`,
          `linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(72,72,78,0.42) 38%, rgba(0,0,0,0.9) 100%)`,
        ].join(', ')
        : dark
          ? [
            `radial-gradient(ellipse 95% 58% at 50% 6%, ${hexToRgba(accent, 0.48)} 0%, transparent 62%)`,
            `radial-gradient(ellipse 60% 48% at 88% 76%, ${hexToRgba(accent2, 0.34)} 0%, transparent 54%)`,
            `radial-gradient(ellipse 70% 55% at 12% 88%, ${hexToRgba(shadowGlow, 0.38)} 0%, transparent 58%)`,
            `linear-gradient(180deg, ${hexToRgba(accent, 0.22)} 0%, ${hexToRgba(shadowGlow, 0.18)} 32%, rgba(0,0,0,0.88) 100%)`,
          ].join(', ')
          : [
            `radial-gradient(ellipse 90% 55% at 50% 8%, ${hexToRgba(accent, 0.28)} 0%, transparent 58%)`,
            `radial-gradient(ellipse 55% 42% at 92% 78%, ${hexToRgba(accent2, 0.2)} 0%, transparent 52%)`,
            `linear-gradient(180deg, ${hexToRgba(accent, 0.12)} 0%, rgba(0,0,0,0.42) 42%, rgba(0,0,0,0.9) 100%)`,
          ].join(', ')
    if (lit) {
      const topA = mono ? 0.38 : 0.68
      const midA = mono ? 0.22 : 0.52
      playerGlow1 = hexToRgba(topHex, topA * litBoost)
      playerGlow2 = hexToRgba(hiHex, midA * litBoost)
      playerGlow3 = hexToRgba(accent2, 0.34 * litBoost)
      playerOverlay = [
        `radial-gradient(ellipse 115% 78% at ${hiX}% ${hiY}%, ${hexToRgba(topHex, mono ? 0.42 : 0.78)} 0%, transparent 62%)`,
        `radial-gradient(ellipse 82% 58% at ${hiX}% ${Math.min(58, hiY + 16)}%, ${hexToRgba(hiHex, mono ? 0.28 : 0.55)} 0%, transparent 58%)`,
        `radial-gradient(ellipse 58% 44% at 88% 74%, ${hexToRgba(accent2, 0.32)} 0%, transparent 54%)`,
        `linear-gradient(180deg, ${hexToRgba(topHex, mono ? 0.16 : 0.32)} 0%, ${hexToRgba(accent, 0.14)} 30%, rgba(0,0,0,0.86) 100%)`,
      ].join(', ')
    }
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
      playerGlow1,
      playerGlow2,
      playerGlow3,
      playerOverlay,
      playerHighlightX: `${hiX}%`,
      playerHighlightY: `${hiY}%`,
      playerGlowSpot: lit
        ? `radial-gradient(ellipse 100% 72% at ${hiX}% ${hiY}%, ${hexToRgba(topHex, mono ? 0.5 : 0.82)} 0%, transparent 60%)`
        : '',
      playerLit: lit,
      highlightStrength: hiStr,
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



  function buildMonochromeCoverTheme(coverLum, meta = {}) {
    const lum = Math.max(0.05, Math.min(0.92, coverLum != null ? coverLum : 0.22))
    const inkBlack = lum < 0.14
    const accentL = inkBlack ? 0.74 : Math.max(0.52, Math.min(0.82, 0.48 + lum * 0.42))
    const accent = hslToHex(0, 0, accentL)
    const accent2 = hslToHex(0, 0, Math.min(0.92, accentL + 0.08))
    const bg = hslToHex(0, 0, inkBlack ? 0.12 : Math.max(0.04, lum * 0.1 + 0.03))
    const text = '#f8fafc'
    const textDim = '#a1a1aa'
    const textMuted = '#71717a'
    const bgCard = 'rgba(255,255,255,0.06)'
    const bgElevated = 'rgba(255,255,255,0.04)'
    const border = 'rgba(255,255,255,0.1)'
    const glass = 'rgba(12, 12, 14, 0.82)'
    const dockGlass = 'rgba(8, 8, 10, 0.88)'
    const dockBorder = 'rgba(255,255,255,0.08)'
    const wavePlayed = '#ffffff'
    const waveUnplayed = 'rgba(255, 255, 255, 0.22)'
    const appBg = [
      `radial-gradient(ellipse 70% 40% at 50% 12%, rgba(255,255,255,${0.08 + lum * 0.06}), transparent 52%)`,
      `radial-gradient(ellipse 40% 30% at 100% 92%, rgba(255,255,255,0.04), transparent 45%)`,
      bg,
    ].join(', ')
    const shadowRgb = meta.shadowR != null
      ? [meta.shadowR, meta.shadowG, meta.shadowB]
      : [Math.round(24 + lum * 40), Math.round(24 + lum * 40), Math.round(26 + lum * 42)]
    const decor = decorFromAccent(accent, accent2, bg, {
      dark: true,
      coverLum: lum,
      shadowRgb,
      monochrome: true,
      highlightR: meta.highlightR,
      highlightG: meta.highlightG,
      highlightB: meta.highlightB,
      highlightX: meta.highlightX,
      highlightY: meta.highlightY,
      highlightStrength: meta.highlightStrength,
      topHighlightR: meta.topHighlightR,
      topHighlightG: meta.topHighlightG,
      topHighlightB: meta.topHighlightB,
    })
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
      accentGlow: 'rgba(255,255,255,0.2)',
      wavePlayed,
      waveUnplayed,
      appBg,
      ...decor,
      dark: true,
      monochrome: true,
      v: PALETTE_VERSION,
    }
  }

  function buildCoverThemeFromRgb(r, g, b, fallbackTheme, meta = {}) {

    const coverLum = meta.coverLum != null ? meta.coverLum : relLum(r, g, b)

    if (
      meta.monochrome
      || (meta.avgSat != null && meta.avgSat < 0.14 && meta.avgChroma < 22)
      || coverLum < 0.16
    ) {
      return buildMonochromeCoverTheme(coverLum, meta)
    }

    const dark = meta.dark !== false && (meta.dark || coverLum < 0.38)

    if (dark && meta.shadowR != null) {
      const t = Math.min(0.45, 0.18 + (0.42 - coverLum) * 0.75)
      r = Math.round(r * (1 - t) + meta.shadowR * t)
      g = Math.round(g * (1 - t) + meta.shadowG * t)
      b = Math.round(b * (1 - t) + meta.shadowB * t)
    }

    const muted = meta.muted || isDullCover(r, g, b)

    const [h, s] = rgbToHsl(r, g, b)

    const srcSat = meta.sat != null ? meta.sat : s

    const grayish = meta.muted || muted

    const lowChroma = srcSat < 0.14 || grayish

    const accentHue = h

    const accentS = dark

      ? Math.max(0.38, Math.min(0.68, srcSat * 1.2 + (lowChroma ? 0.28 : 0.18)))

      : muted

        ? Math.max(0.32, Math.min(0.54, srcSat * 1.25 + 0.2))

        : Math.max(0.4, Math.min(0.72, srcSat * 1.22 + 0.12))

    const accentL = dark
      ? Math.max(0.4, Math.min(0.56, 0.34 + coverLum * 0.58))
      : (muted ? 0.54 : 0.56)

    const accent = hslToHex(accentHue, accentS, accentL)

    const accent2 = hslToHex((accentHue + 16) % 360, accentS * 0.9, Math.min(0.62, accentL + 0.04))

    const ambientS = Math.min(0.42, Math.max(0.18, accentS * 0.5))

    const tintedBg = hslToHex(accentHue, ambientS, Math.max(0.05, 0.06 + coverLum * 0.1 + (dark ? 0.04 : 0)))

    const bg = mixHex(BASE_BG, tintedBg, dark ? 0.12 + coverLum * 0.2 : (muted ? 0.26 : 0.34))

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



    const shadowRgb = meta.shadowR != null
      ? [meta.shadowR, meta.shadowG, meta.shadowB]
      : null

    const decor = decorFromAccent(accent, accent2, bg, {
      dark: dark || grayish,
      coverLum,
      shadowRgb,
      highlightR: meta.highlightR,
      highlightG: meta.highlightG,
      highlightB: meta.highlightB,
      highlightX: meta.highlightX,
      highlightY: meta.highlightY,
      highlightStrength: meta.highlightStrength,
      topHighlightR: meta.topHighlightR,
      topHighlightG: meta.topHighlightG,
      topHighlightB: meta.topHighlightB,
    })

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
    setVar('--player-hi-x', t.playerHighlightX || '50%')
    setVar('--player-hi-y', t.playerHighlightY || '18%')
    setVar('--player-glow-spot', t.playerGlowSpot || 'none')
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

    document.documentElement.classList.toggle('cover-theme-dark', !!t.dark && !t.monochrome)
    document.documentElement.classList.toggle('cover-theme-mono', !!t.monochrome)
    document.documentElement.classList.toggle('cover-theme-lit', !!t.playerLit)



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

    const dur = (typeof Platform !== 'undefined' && Platform.isAndroid()) ? 200 : 520



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
      document.documentElement.classList.remove('cover-theme-mono')
      document.documentElement.classList.remove('cover-theme-lit')

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

    const lit = document.documentElement.classList.contains('cover-theme-lit')
    const dark = document.documentElement.classList.contains('cover-theme-dark')
    const mono = document.documentElement.classList.contains('cover-theme-mono')

    if (lit) {
      bg.style.filter = mono
        ? 'blur(68px) saturate(0.35) brightness(1.02) contrast(1.03)'
        : 'blur(68px) saturate(1.75) brightness(1.1) contrast(1.04)'
    } else if (mono) {
      bg.style.filter = 'blur(72px) saturate(0) brightness(0.92) contrast(1.02)'
    } else if (dark) {
      bg.style.filter = 'blur(72px) saturate(1.2) brightness(0.72) contrast(1.05)'
    } else {
      bg.style.filter = 'blur(64px) saturate(1.5) brightness(0.88)'
    }
  }



  let fullBgLayer = 'a'

  function setFullBgImage(url) {
    const host = document.getElementById('full-bg')
    const a = document.getElementById('full-bg-a')
    const b = document.getElementById('full-bg-b')
    const lite = typeof Platform !== 'undefined' && Platform.isAndroid()
    if (!host) return
    if (lite && a) {
      if (b) {
        b.classList.remove('is-active')
        b.style.backgroundImage = ''
        b.dataset.bgUrl = ''
      }
      if (!url) {
        a.classList.remove('is-active')
        a.style.backgroundImage = ''
        a.dataset.bgUrl = ''
        return
      }
      a.dataset.bgUrl = url
      a.style.backgroundImage = `url("${url}")`
      a.classList.add('is-active')
      fullBgLayer = 'a'
      return
    }
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
    const buckets = new Map()
    let sumLum = 0
    let allR = 0
    let allG = 0
    let allB = 0
    let allN = 0
    let darkR = 0
    let darkG = 0
    let darkB = 0
    let darkW = 0
    let chromaR = 0
    let chromaG = 0
    let chromaB = 0
    let chromaW = 0
    let hiR = 0
    let hiG = 0
    let hiB = 0
    let hiW = 0
    let hiX = 0
    let hiY = 0
    let topR = 0
    let topG = 0
    let topB = 0
    let topW = 0
    let topX = 0
    let topY = 0
    let sumSat = 0
    let sumChroma = 0
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
        if (a < 80) continue
        const max = Math.max(r, g, b)
        const min = Math.min(r, g, b)
        const chroma = max - min
        const sat = max === 0 ? 0 : chroma / max
        const lum = max / 255

        allR += r
        allG += g
        allB += b
        allN++
        sumLum += lum
        sumSat += sat
        sumChroma += chroma

        if (lum < 0.34) {
          const sw = (0.36 - lum) * 1.75 + 0.1
          darkR += r * sw
          darkG += g * sw
          darkB += b * sw
          darkW += sw
        }

        const dist = Math.hypot(x - cx, y - cy) / maxDist
        const centerBoost = 1.4 - dist * 0.35
        const chromaBoost = chroma > 28 ? 1.7 : (chroma > 10 ? 1.15 : 0.55)
        const weight = centerBoost * chromaBoost * (sat * sat + 0.05) * (0.2 + lum * 0.65)
        if (weight < 0.005) continue
        const key = `${r >> 4},${g >> 4},${b >> 4}`
        const prev = buckets.get(key) || { r: 0, g: 0, b: 0, w: 0, s: 0, c: 0 }
        prev.r += r * weight
        prev.g += g * weight
        prev.b += b * weight
        prev.s += sat * weight
        prev.c += chroma * weight
        prev.w += weight
        buckets.set(key, prev)
        if (chroma > 14 && sat > 0.1) {
          chromaR += r * weight
          chromaG += g * weight
          chromaB += b * weight
          chromaW += weight
        }

        if (lum > 0.44) {
          const hw = Math.pow(lum - 0.4, 1.2) * (0.45 + sat * 1.8) * (1 + chroma / 65)
          hiR += r * hw
          hiG += g * hw
          hiB += b * hw
          hiX += x * hw
          hiY += y * hw
          hiW += hw
          if (y / height < 0.44) {
            topR += r * hw
            topG += g * hw
            topB += b * hw
            topX += x * hw
            topY += y * hw
            topW += hw
          }
        }
      }
    }

    if (!allN) return null
    const avgLum = sumLum / allN
    const avgSat = sumSat / allN
    const avgChroma = sumChroma / allN
    const monochrome = (avgSat < 0.14 && avgChroma < 22) || avgLum < 0.16
    const isDark = avgLum < 0.38
    const ar = allR / allN
    const ag = allG / allN
    const ab = allB / allN
    const shadowR = darkW > 0 ? darkR / darkW : ar
    const shadowG = darkW > 0 ? darkG / darkW : ag
    const shadowB = darkW > 0 ? darkB / darkW : ab

    const highlightStrength = hiW > 0 ? Math.min(1, hiW / Math.max(10, allN * 0.05)) : 0
    let highlightR = 255
    let highlightG = 255
    let highlightB = 255
    let highlightX = 50
    let highlightY = 20
    let topHighlightR = 255
    let topHighlightG = 255
    let topHighlightB = 255
    if (hiW > 0.001) {
      highlightR = Math.round(hiR / hiW)
      highlightG = Math.round(hiG / hiW)
      highlightB = Math.round(hiB / hiW)
      highlightX = Math.round((hiX / hiW / width) * 100)
      highlightY = Math.round((hiY / hiW / height) * 100)
    }
    if (topW > 0.001) {
      topHighlightR = Math.round(topR / topW)
      topHighlightG = Math.round(topG / topW)
      topHighlightB = Math.round(topB / topW)
      highlightX = Math.round((topX / topW / width) * 100)
      highlightY = Math.round((topY / topW / height) * 100)
    }
    const hiFields = {
      highlightR,
      highlightG,
      highlightB,
      highlightX,
      highlightY,
      highlightStrength,
      topHighlightR,
      topHighlightG,
      topHighlightB,
    }

    const ranked = [...buckets.values()]
      .map((b) => ({
        ...b,
        avgSat: b.s / Math.max(0.001, b.w),
        avgChroma: b.c / Math.max(0.001, b.w),
        score: b.w * (1 + (b.s / Math.max(0.001, b.w)) * (isDark ? 2 : 1.15)),
      }))
      .sort((a, b) => b.score - a.score)

    let pick = ranked.find((b) => b.avgSat > 0.12 && b.avgChroma > 10) || ranked[0]
    if (chromaW > 0.002 && (!pick || pick.avgSat < 0.12)) {
      pick = {
        r: chromaR,
        g: chromaG,
        b: chromaB,
        w: chromaW,
        s: chromaW * 0.3,
        avgSat: 0.3,
        avgChroma: 35,
      }
    }

    if (!pick || pick.w < 0.001) {
      const gray = Math.round(40 + avgLum * 180)
      return {
        r: gray,
        g: gray,
        b: gray,
        sat: 0,
        muted: true,
        dark: isDark,
        monochrome,
        avgSat,
        avgChroma,
        coverLum: avgLum,
        shadowR: Math.round(shadowR),
        shadowG: Math.round(shadowG),
        shadowB: Math.round(shadowB),
        ...hiFields,
      }
    }

    if (monochrome) {
      const gray = Math.round(38 + avgLum * 175)
      return {
        r: gray,
        g: gray,
        b: gray,
        sat: 0,
        muted: true,
        dark: true,
        monochrome: true,
        avgSat,
        avgChroma,
        coverLum: avgLum,
        shadowR: Math.round(shadowR),
        shadowG: Math.round(shadowG),
        shadowB: Math.round(shadowB),
        ...hiFields,
      }
    }

    let fr = pick.r / pick.w
    let fg = pick.g / pick.w
    let fb = pick.b / pick.w
    const fsat = pick.s / pick.w

    const avgBlend = isDark ? 0.42 : 0.22
    fr = fr * (1 - avgBlend) + ar * avgBlend
    fg = fg * (1 - avgBlend) + ag * avgBlend
    fb = fb * (1 - avgBlend) + ab * avgBlend

    if (isDark && darkW > 0.01) {
      const shadowBlend = Math.min(0.58, 0.28 + (0.4 - avgLum) * 1.2)
      fr = fr * (1 - shadowBlend) + shadowR * shadowBlend
      fg = fg * (1 - shadowBlend) + shadowG * shadowBlend
      fb = fb * (1 - shadowBlend) + shadowB * shadowBlend
    }

    return {
      r: Math.round(fr),
      g: Math.round(fg),
      b: Math.round(fb),
      sat: Math.max(0.12, fsat),
      muted: fsat < 0.14,
      dark: isDark,
      monochrome,
      avgSat,
      avgChroma,
      coverLum: avgLum,
      shadowR: Math.round(shadowR),
      shadowG: Math.round(shadowG),
      shadowB: Math.round(shadowB),
      ...hiFields,
    }
  }



  function sampleCoverThemeFromImage(img) {

    const size = 96

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


