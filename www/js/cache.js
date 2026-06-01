/** Кэш API-ответов на устройстве (без VPS). */
const ApiCache = (() => {
  const LS_KEY = 'nexory_api_cache_v2'
  const MAX_LS = 180
  const TTL = {
    resolve: 3.5 * 60 * 60 * 1000,
    search: 8 * 60 * 1000,
    feed: 45 * 60 * 1000,
  }

  const mem = new Map()

  function now() {
    return Date.now()
  }

  function readLs() {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (!raw) return {}
      const data = JSON.parse(raw)
      return data && typeof data === 'object' ? data : {}
    } catch {
      return {}
    }
  }

  function writeLs(data) {
    try {
      const keys = Object.keys(data)
      if (keys.length > MAX_LS) {
        keys
          .sort((a, b) => (data[a]?.t || 0) - (data[b]?.t || 0))
          .slice(0, keys.length - MAX_LS)
          .forEach((k) => delete data[k])
      }
      localStorage.setItem(LS_KEY, JSON.stringify(data))
    } catch {
      /* quota */
    }
  }

  function getEntry(key) {
    const m = mem.get(key)
    if (m && m.exp > now()) return m.v
    if (m) mem.delete(key)
    const ls = readLs()
    const e = ls[key]
    if (!e || !e.exp || e.exp <= now()) return null
    mem.set(key, { v: e.v, exp: e.exp })
    return e.v
  }

  function setEntry(key, value, ttlMs) {
    const exp = now() + Math.max(1000, ttlMs)
    mem.set(key, { v: value, exp })
    const ls = readLs()
    ls[key] = { v: value, exp, t: now() }
    writeLs(ls)
  }

  function trackKey(track) {
    if (!track) return ''
    const src = String(track.source || '').toLowerCase()
    const id = String(track.id || track.trackId || '').trim()
    if (!src || !id) return ''
    return `${src}:${id}`
  }

  function normQ(q) {
    return String(q || '').trim().toLowerCase().slice(0, 120)
  }

  return {
    getResolve(track) {
      const k = trackKey(track)
      if (!k) return null
      const hit = getEntry(`resolve:${k}`)
      return hit && typeof hit === 'string' ? hit : null
    },

    setResolve(track, url) {
      const k = trackKey(track)
      const u = String(url || '').trim()
      if (!k || !u || !/^https?:\/\//i.test(u)) return
      setEntry(`resolve:${k}`, u, TTL.resolve)
    },

    getSearch(q, source) {
      const sq = normQ(q)
      const src = String(source || '').toLowerCase()
      if (!sq) return null
      return getEntry(`search:${src}:${sq}`)
    },

    setSearch(q, source, payload) {
      const sq = normQ(q)
      const src = String(source || '').toLowerCase()
      if (!sq || !payload) return
      setEntry(`search:${src}:${sq}`, payload, TTL.search)
    },

    getFeed(kind) {
      const k = String(kind || '').trim()
      if (!k) return null
      return getEntry(`feed:${k}`)
    },

    setFeed(kind, tracks) {
      const k = String(kind || '').trim()
      if (!k || !Array.isArray(tracks)) return
      setEntry(`feed:${k}`, tracks, TTL.feed)
    },

    clear() {
      mem.clear()
      try {
        localStorage.removeItem(LS_KEY)
      } catch {}
    },
  }
})()
