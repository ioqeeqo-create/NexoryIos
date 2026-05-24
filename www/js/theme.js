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

  function notifyAccentChange(hex) {
    document.documentElement.dispatchEvent(new CustomEvent('nexory-accent', { detail: { hex } }))
  }

  function applyAccent(hex, { persist = true } = {}) {
    if (!hex) return null
    const accent2 = shiftHue(hex, 12)
    setVar('--accent', hex)
    setVar('--accent-2', accent2)
    setVar('--accent-glow', hexToRgba(hex, 0.35))
    setVar('--accent-soft', hexToRgba(hex, 0.14))
    setVar('--accent-border', hexToRgba(hex, 0.28))
    setVar('--accent-fill', hexToRgba(hex, 0.1))
    setVar('--accent-fill-strong', hexToRgba(hex, 0.18))

    const appBg = document.getElementById('app-bg')
    if (appBg) {
      appBg.style.background = [
        `radial-gradient(ellipse 90% 50% at 50% -10%, ${hexToRgba(hex, 0.18)}, transparent 55%)`,
        `radial-gradient(ellipse 40% 30% at 100% 80%, ${hexToRgba(accent2, 0.1)}, transparent)`,
        'var(--bg)',
      ].join(', ')
    }

    document.body.classList.add('accent-from-cover')
    if (persist) Store.patch({ accentCoverHex: hex })
    notifyAccentChange(hex)
    return hex
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

  function applyThemeAccent(t) {
    setVar('--accent', t.accent)
    setVar('--accent-2', t.accent2)
    setVar('--accent-glow', t.accentGlow)
    setVar('--accent-soft', hexToRgba(t.accent, 0.14))
    setVar('--accent-border', hexToRgba(t.accent, 0.28))
    setVar('--accent-fill', hexToRgba(t.accent, 0.1))
    setVar('--accent-fill-strong', hexToRgba(t.accent, 0.18))
    const appBg = document.getElementById('app-bg')
    if (appBg) appBg.style.background = t.appBg
    notifyAccentChange(t.accent)
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

    if (s.accentFromCover) {
      if (s.accentCoverHex) applyAccent(s.accentCoverHex, { persist: false })
    } else {
      document.body.classList.remove('accent-from-cover')
      if (s.accentCoverHex) Store.patch({ accentCoverHex: '' })
      applyThemeAccent(t)
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

  function pickAccentFromImageData(data) {
    let best = null
    let bestScore = 0
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const a = data[i + 3]
      if (a < 128) continue
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const sat = max === 0 ? 0 : (max - min) / max
      const lum = max / 255
      if (sat < 0.18 || lum < 0.12 || lum > 0.94) continue
      const score = sat * (1 - Math.abs(lum - 0.58) * 0.85)
      if (score > bestScore) {
        bestScore = score
        best = [r, g, b]
      }
    }
    if (!best) return null
    return `#${best.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`
  }

  function sampleAccentFromImage(img) {
    const canvas = document.createElement('canvas')
    canvas.width = 40
    canvas.height = 40
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, 40, 40)
    const data = ctx.getImageData(0, 0, 40, 40).data
    return pickAccentFromImageData(data)
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
      const finish = (hex) => {
        if (blobUrl?.startsWith('blob:')) URL.revokeObjectURL(blobUrl)
        if (!hex || job !== accentJob) return resolve(null)
        applyAccent(hex)
        resolve(hex)
      }

      blobUrlForImage(url)
        .then(async (src) => {
          blobUrl = src.startsWith('blob:') ? src : null
          const img = await loadImage(src)
          if (job !== accentJob) return resolve(null)
          finish(sampleAccentFromImage(img))
        })
        .catch(async () => {
          try {
            const img = await loadImage(url)
            if (job !== accentJob) return resolve(null)
            finish(sampleAccentFromImage(img))
          } catch {
            finish(null)
          }
        })
    })
  }

  function extractAccentFromElement(imgEl) {
    if (!imgEl || !imgEl.complete || !imgEl.naturalWidth || !Store.get().accentFromCover) return null
    try {
      const hex = sampleAccentFromImage(imgEl)
      if (!hex) return null
      applyAccent(hex)
      return hex
    } catch {
      return null
    }
  }

  return { apply, applyPlayerBg, setFullBgImage, extractAccentFromUrl, extractAccentFromElement, applyAccent, THEMES }
})()
