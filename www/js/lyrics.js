const Lyrics = (() => {
  const CACHE_KEY = 'nexory_lyrics_cache_v1'
  const CACHE_MAX = 180
  const CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000

  let lines = []
  let activeIdx = -1
  let open = false
  let loadGen = 0

  function parseLrc(text) {
    const out = []
    const re = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g
    const raw = String(text || '')
    for (const chunk of raw.split(/\r?\n/)) {
      const times = []
      re.lastIndex = 0
      let m
      while ((m = re.exec(chunk)) != null) {
        const min = Number(m[1])
        const sec = Number(m[2])
        const ms = m[3] ? Number(m[3].padEnd(3, '0').slice(0, 3)) : 0
        times.push(min * 60 + sec + ms / 1000)
      }
      const textLine = chunk.replace(/\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]/g, '').trim()
      if (!textLine) continue
      times.forEach((t) => out.push({ time: t, text: textLine }))
    }
    return out.sort((a, b) => a.time - b.time)
  }

  function normalizePart(v) {
    return String(v || '')
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/\([^)]*\)/g, ' ')
      .replace(/\b(official|lyrics?|audio|video)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  function titleVariants(track) {
    const raw = String(track?.title || '').trim()
    const norm = normalizePart(raw)
    return [...new Set([norm, raw].filter(Boolean))]
  }

  function artistVariants(track) {
    const raw = String(track?.artist || '').trim()
    const norm = normalizePart(raw)
    const first = raw.split(',')[0]?.trim()
    return [...new Set([norm, first, raw].filter(Boolean))]
  }

  function readCacheMap() {
    try {
      return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') || {}
    } catch {
      return {}
    }
  }

  function writeCacheMap(map) {
    const keys = Object.keys(map)
    if (keys.length > CACHE_MAX) {
      keys
        .sort((a, b) => (map[a]?.ts || 0) - (map[b]?.ts || 0))
        .slice(0, keys.length - CACHE_MAX)
        .forEach((k) => delete map[k])
    }
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(map))
    } catch {}
  }

  function getCached(track) {
    const key = Store.trackKey(track)
    if (!key) return null
    const row = readCacheMap()[key]
    if (!row) return null
    if (Date.now() - (row.ts || 0) > CACHE_TTL_MS) return null
    return row
  }

  function setCached(track, payload) {
    const key = Store.trackKey(track)
    if (!key || !payload) return
    const map = readCacheMap()
    map[key] = { ...payload, ts: Date.now() }
    writeCacheMap(map)
  }

  async function fetchJson(url, opts = {}) {
    const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(opts.timeout || 10000) })
    const data = await r.json().catch(() => ({}))
    return { ok: r.ok, status: r.status, data }
  }

  async function fetchText(url, opts = {}) {
    const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(opts.timeout || 10000) })
    return { ok: r.ok, text: await r.text().catch(() => '') }
  }

  function packLyrics(synced, plain) {
    const s = String(synced || '').trim()
    const p = String(plain || '').trim()
    if (s && /\[\d{1,2}:\d{2}/.test(s)) return { synced: s, plain: p || null }
    if (p) return { synced: null, plain: p }
    return null
  }

  async function fromYandex(track) {
    const token = String(Store.get().yandexToken || '').trim()
    const id = String(track?.id || '').split(':')[0]
    if (track?.source !== 'yandex' || !token || !id) return null
    const oauth = token.match(/access_token=([^&#]+)/)
      ? decodeURIComponent(token.match(/access_token=([^&#]+)/)[1])
      : token
    const headers = {
      Authorization: `OAuth ${oauth}`,
      'X-Yandex-Music-Client': 'WindowsPhone/3.20',
      'User-Agent': 'Windows 10',
    }
    const meta = await fetchJson(`https://api.music.yandex.net/tracks/${encodeURIComponent(id)}/lyrics`, {
      headers,
      timeout: 8000,
    })
    const res = meta.data?.result || {}
    const lyricsId = String(res?.lyrics?.id || res?.id || '').trim()
    const downloadUrl = res?.downloadUrl || res?.lyrics?.downloadUrl
    if (downloadUrl) {
      const dl = await fetchText(downloadUrl, { headers, timeout: 8000 })
      const packed = packLyrics(dl.text, dl.text)
      if (packed) return packed
    }
    if (!lyricsId) return null
    for (const ep of [
      `https://api.music.yandex.net/tracks/${encodeURIComponent(id)}/lyrics/${encodeURIComponent(lyricsId)}?format=LRC`,
      `https://api.music.yandex.net/tracks/${encodeURIComponent(id)}/lyrics/${encodeURIComponent(lyricsId)}`,
    ]) {
      const r = await fetchJson(ep, { headers, timeout: 8000 })
      const body = r.data?.result || {}
      const packed = packLyrics(
        body?.lyrics || body?.fullLyrics || body?.text || body?.lrc,
        body?.fullLyrics || body?.lyrics || body?.text,
      )
      if (packed) return packed
    }
    return null
  }

  async function fromLrclib(track, duration) {
    const titles = titleVariants(track)
    const artists = artistVariants(track)
    const dur = duration > 0 ? `&duration=${Math.round(duration)}` : ''
    for (const artist of artists) {
      for (const title of titles) {
        const meta = await fetchJson(
          `https://lrclib.net/api/get?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}${dur}`,
          { headers: { 'User-Agent': 'NexoryIos/1.0' }, timeout: 8000 },
        )
        if (meta.ok && meta.data) {
          const packed = packLyrics(meta.data.syncedLyrics, meta.data.plainLyrics)
          if (packed) return packed
        }
      }
    }
    for (const artist of artists) {
      for (const title of titles) {
        const q = encodeURIComponent(`${artist} ${title}`.trim())
        const search = await fetchJson(`https://lrclib.net/api/search?q=${q}`, {
          headers: { 'User-Agent': 'NexoryIos/1.0' },
          timeout: 8000,
        })
        if (search.ok && Array.isArray(search.data) && search.data[0]) {
          const best = search.data[0]
          const packed = packLyrics(best.syncedLyrics, best.plainLyrics)
          if (packed) return packed
        }
      }
    }
    return null
  }

  async function fromOvh(track) {
    for (const artist of artistVariants(track)) {
      for (const title of titleVariants(track)) {
        try {
          const r = await fetchJson(
            `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`,
            { timeout: 7000 },
          )
          if (r.ok && r.data?.lyrics) return { synced: null, plain: String(r.data.lyrics).trim() }
        } catch {}
      }
    }
    return null
  }

  async function fetchRemote(track, duration = 0) {
    const tasks = []
    if (Api.hasGateway()) {
      tasks.push(
        Api.fetchLyrics(track, duration)
          .then((gw) => (gw?.ok && (gw.synced || gw.plain) ? packLyrics(gw.synced, gw.plain) : null))
          .catch(() => null),
      )
    }
    if (track?.source === 'yandex') {
      tasks.push(fromYandex(track).catch(() => null))
    }
    tasks.push(fromLrclib(track, duration).catch(() => null))
    tasks.push(fromOvh(track).catch(() => null))

    const settled = await Promise.allSettled(tasks)
    for (const s of settled) {
      if (s.status === 'fulfilled' && s.value) return s.value
    }
    return null
  }

  function renderResult(res) {
    const root = document.getElementById('fp-lyrics-content')
    if (!root || !res) return
    if (res.synced) {
      lines = parseLrc(res.synced)
      root.innerHTML = ''
      const top = document.createElement('div')
      top.className = 'lyrics-spacer'
      root.appendChild(top)
      lines.forEach((line, i) => {
        const div = document.createElement('div')
        div.className = 'lyrics-line future'
        div.dataset.idx = String(i)
        div.textContent = line.text
        div.addEventListener('click', () => {
          const audio = Player.audio
          if (audio) {
            audio.currentTime = line.time
            Player.audio?.play().catch(() => {})
          }
        })
        root.appendChild(div)
      })
      const bottom = document.createElement('div')
      bottom.className = 'lyrics-spacer'
      root.appendChild(bottom)
      requestAnimationFrame(() => {
        root.querySelectorAll('.lyrics-line').forEach((el) => el.classList.add('is-visible'))
      })
      sync(Player.audio?.currentTime || 0)
      return
    }
    if (res.plain) {
      lines = []
      root.innerHTML = `<div class="lyrics-plain">${res.plain.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`
      return
    }
    lines = []
    root.innerHTML = '<div class="lyrics-empty">Текст не найден</div>'
  }

  async function load(track, duration = 0) {
    const root = document.getElementById('fp-lyrics-content')
    if (!root || !track) return
    const gen = ++loadGen
    lines = []
    activeIdx = -1

    const cached = getCached(track)
    if (cached?.synced || cached?.plain) {
      renderResult({ synced: cached.synced, plain: cached.plain })
      if (cached.synced) return
    } else {
      root.innerHTML = '<div class="lyrics-loading">Загрузка текста…</div>'
    }

    const res = await fetchRemote(track, duration)
    if (gen !== loadGen) return
    if (!res) {
      if (!cached) root.innerHTML = '<div class="lyrics-empty">Текст не найден</div>'
      return
    }
    setCached(track, res)
    renderResult(res)
  }

  function findIdx(t) {
    if (!lines.length) return -1
    if (t < lines[0].time) return -1
    let lo = 0
    let hi = lines.length - 1
    let ans = 0
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (lines[mid].time <= t) {
        ans = mid
        lo = mid + 1
      } else hi = mid - 1
    }
    return ans
  }

  function sync(currentTime) {
    if (!open || !lines.length) return
    const root = document.getElementById('fp-lyrics-content')
    if (!root) return
    const idx = findIdx(Number(currentTime) || 0)
    if (idx === activeIdx) return
    activeIdx = idx
    root.querySelectorAll('.lyrics-line').forEach((el) => {
      const i = Number(el.dataset.idx)
      el.classList.toggle('active', i === idx)
      el.classList.toggle('past', i >= 0 && i < idx)
      el.classList.toggle('future', i > idx)
    })
    const activeEl = root.querySelector('.lyrics-line.active')
    if (activeEl) {
      try {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } catch {
        activeEl.scrollIntoView(false)
      }
    }
  }

  function prefetch(track, duration = 0) {
    if (!track || getCached(track)) return
    fetchRemote(track, duration)
      .then((res) => {
        if (res) setCached(track, res)
      })
      .catch(() => {})
  }

  function setOpen(on) {
    open = !!on
    const fp = document.getElementById('full-player')
    const btn = document.getElementById('full-lyrics-btn')
    const view = document.getElementById('fp-lyrics-view')
    if (fp) fp.classList.toggle('full-player--lyrics', open)
    if (btn) btn.classList.toggle('is-active', open)
    if (view) view.hidden = !open
    document.body.classList.toggle('fp-lyrics-open', open)
    if (!open) return
    const track = Player.current()
    if (track) load(track, Player.audio?.duration || 0)
  }

  function toggle() {
    setOpen(!open)
  }

  return { load, sync, toggle, setOpen, isOpen: () => open, prefetch }
})()
