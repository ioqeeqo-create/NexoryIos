const Theme = (() => {
  const THEMES = {
    dark: {
      bg: '#020617',
      text: '#f8fafc',
      textDim: '#94a3b8',
      textMuted: '#64748b',
      bgCard: 'rgba(255,255,255,0.06)',
      border: 'rgba(255,255,255,0.07)',
      accent: '#ec4899',
      accent2: '#f43f5e',
      accentGlow: 'rgba(236, 72, 153, 0.35)',
      appBg: 'radial-gradient(ellipse 90% 50% at 50% -10%, rgba(236, 72, 153, 0.12), transparent 55%), radial-gradient(ellipse 40% 30% at 100% 80%, rgba(244, 63, 94, 0.08), transparent), #020617',
    },
    light: {
      bg: '#f1f5f9',
      text: '#0f172a',
      textDim: '#475569',
      textMuted: '#64748b',
      bgCard: 'rgba(15, 23, 42, 0.06)',
      border: 'rgba(15, 23, 42, 0.1)',
      accent: '#db2777',
      accent2: '#e11d48',
      accentGlow: 'rgba(219, 39, 119, 0.25)',
      appBg: 'radial-gradient(ellipse 90% 50% at 50% -10%, rgba(219, 39, 119, 0.08), transparent 55%), #f1f5f9',
    },
    amoled: {
      bg: '#000000',
      text: '#f8fafc',
      textDim: '#94a3b8',
      textMuted: '#64748b',
      bgCard: 'rgba(255,255,255,0.05)',
      border: 'rgba(255,255,255,0.06)',
      accent: '#ec4899',
      accent2: '#f43f5e',
      accentGlow: 'rgba(236, 72, 153, 0.3)',
      appBg: '#000000',
    },
    rose: {
      bg: '#140810',
      text: '#fce7f3',
      textDim: '#f9a8d4',
      textMuted: '#be185d',
      bgCard: 'rgba(251, 113, 133, 0.08)',
      border: 'rgba(251, 113, 133, 0.15)',
      accent: '#fb7185',
      accent2: '#f472b6',
      accentGlow: 'rgba(251, 113, 133, 0.35)',
      appBg: 'radial-gradient(ellipse 80% 45% at 50% 0%, rgba(251, 113, 133, 0.18), transparent 55%), #140810',
    },
  }

  let accentJob = 0

  function setVar(name, value) {
    document.documentElement.style.setProperty(name, value)
  }

  function applyAccent(hex) {
    if (!hex) return
    setVar('--accent', hex)
    setVar('--accent-2', shiftHue(hex, 12))
    setVar('--accent-glow', hexToRgba(hex, 0.35))
  }

  function hexToRgba(hex, a) {
    const n = parseInt(hex.replace('#', ''), 16)
    const r = (n >> 16) & 255
    const g = (n >> 8) & 255
    const b = n & 255
    return `rgba(${r}, ${g}, ${b}, ${a})`
  }

  function shiftHue(hex, deg) {
    const n = parseInt(hex.replace('#', ''), 16)
    let r = (n >> 16) & 255
    let g = (n >> 8) & 255
    let b = n & 255
    r = Math.min(255, r + deg)
    g = Math.max(0, g - Math.floor(deg / 2))
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
  }

  function apply(settings) {
    const s = settings || Store.get()
    const t = THEMES[s.theme] || THEMES.dark

    setVar('--bg', t.bg)
    setVar('--text', t.text)
    setVar('--text-dim', t.textDim)
    setVar('--text-muted', t.textMuted)
    setVar('--bg-card', t.bgCard)
    setVar('--border', t.border)

    if (!s.accentFromCover) {
      setVar('--accent', t.accent)
      setVar('--accent-2', t.accent2)
      setVar('--accent-glow', t.accentGlow)
    }

    const appBg = document.getElementById('app-bg')
    if (appBg) appBg.style.background = t.appBg

    applyPlayerBg(s)
  }

  function applyPlayerBg(settings) {
    const s = settings || Store.get()
    const bg = document.getElementById('full-bg')
    if (!bg) return
    const blur = Number(s.bgBlur ?? 56)
    const bright = Number(s.bgBrightness ?? 45) / 100
    bg.style.filter = `blur(${blur}px) saturate(1.35)`
    bg.style.opacity = String(Math.max(0.15, Math.min(0.85, bright)))
  }

  function setFullBgImage(url) {
    const bg = document.getElementById('full-bg')
    if (!bg) return
    if (url) bg.style.backgroundImage = `url(${url})`
    else bg.style.backgroundImage = ''
  }

  function extractAccentFromUrl(url) {
    if (!url || !Store.get().accentFromCover) return Promise.resolve(null)
    const job = ++accentJob
    return new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        if (job !== accentJob) return resolve(null)
        try {
          const canvas = document.createElement('canvas')
          canvas.width = 32
          canvas.height = 32
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, 32, 32)
          const data = ctx.getImageData(0, 0, 32, 32).data
          let r = 0
          let g = 0
          let b = 0
          let n = 0
          for (let i = 0; i < data.length; i += 4) {
            const pr = data[i]
            const pg = data[i + 1]
            const pb = data[i + 2]
            const pa = data[i + 3]
            if (pa < 128) continue
            const max = Math.max(pr, pg, pb)
            const min = Math.min(pr, pg, pb)
            if (max - min < 18) continue
            if (max < 40) continue
            r += pr
            g += pg
            b += pb
            n += 1
          }
          if (!n) return resolve(null)
          const hex = `#${[r / n, g / n, b / n].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`
          applyAccent(hex)
          resolve(hex)
        } catch {
          resolve(null)
        }
      }
      img.onerror = () => resolve(null)
      img.src = url
    })
  }

  return { apply, applyPlayerBg, setFullBgImage, extractAccentFromUrl, THEMES }
})()
