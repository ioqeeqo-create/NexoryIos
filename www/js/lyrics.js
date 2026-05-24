const Lyrics = (() => {
  let lines = []
  let activeIdx = -1
  let open = false

  function parseLrc(text) {
    const out = []
    const re = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g
    const raw = String(text || '')
    const chunks = raw.split(/\r?\n/)
    for (const chunk of chunks) {
      let m
      const times = []
      re.lastIndex = 0
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

  async function fetchJson(url, opts = {}) {
    const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(opts.timeout || 12000) })
    const data = await r.json().catch(() => ({}))
    return { ok: r.ok, status: r.status, data }
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
      timeout: 10000,
    })
    const lyricsId = String(meta.data?.result?.id || '').trim()
    if (!lyricsId) return null
    for (const ep of [
      `https://api.music.yandex.net/tracks/${encodeURIComponent(id)}/lyrics/${encodeURIComponent(lyricsId)}?format=LRC`,
      `https://api.music.yandex.net/tracks/${encodeURIComponent(id)}/lyrics/${encodeURIComponent(lyricsId)}`,
    ]) {
      const r = await fetchJson(ep, { headers, timeout: 10000 })
      const res = r.data?.result || {}
      const synced = res?.lyrics || res?.fullLyrics || res?.text || res?.lrc || ''
      const plain = res?.fullLyrics || res?.lyrics || res?.text || ''
      if (synced && /\[\d{1,2}:\d{2}/.test(synced)) return { synced, plain: String(plain || '').trim() }
      if (plain) return { synced: null, plain: String(plain).trim() }
    }
    return null
  }

  async function fromLrclib(track, duration) {
    const title = normalizePart(track?.title)
    const artist = normalizePart(track?.artist)
    if (!title || !artist) return null
    const dur = duration > 0 ? `&duration=${Math.round(duration)}` : ''
    const meta = await fetchJson(
      `https://lrclib.net/api/get?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}${dur}`,
      { headers: { 'User-Agent': 'NexoryIos/1.0' } },
    )
    if (meta.ok && meta.data) {
      return {
        synced: meta.data.syncedLyrics || null,
        plain: meta.data.plainLyrics || null,
      }
    }
    const q = encodeURIComponent(`${artist} ${title}`)
    const search = await fetchJson(`https://lrclib.net/api/search?q=${q}`, {
      headers: { 'User-Agent': 'NexoryIos/1.0' },
    })
    if (search.ok && Array.isArray(search.data) && search.data[0]) {
      const best = search.data[0]
      return { synced: best.syncedLyrics || null, plain: best.plainLyrics || null }
    }
    return null
  }

  async function load(track, duration = 0) {
    const root = document.getElementById('fp-lyrics-content')
    if (!root) return
    lines = []
    activeIdx = -1
    root.innerHTML = '<div class="lyrics-loading">Загрузка текста…</div>'
    let res = null
    try {
      res = await fromYandex(track)
      if (!res) res = await fromLrclib(track, duration)
    } catch {
      res = null
    }
    if (!res) {
      root.innerHTML = '<div class="lyrics-empty">Текст не найден</div>'
      return
    }
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
            Player.play().catch(() => {})
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
    root.innerHTML = '<div class="lyrics-empty">Текст не найден</div>'
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

  return { load, sync, toggle, setOpen, isOpen: () => open }
})()
