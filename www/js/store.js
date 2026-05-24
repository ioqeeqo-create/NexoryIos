const Store = (() => {
  const KEY = 'nexory_mobile_v1'

  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '{}') || {}
    } catch {
      return {}
    }
  }

  function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data))
  }

  function defaults() {
    return {
      apiMode: 'auto',
      gatewayUrl: '',
      gatewaySecret: '',
      yandexToken: '',
      vkToken: '',
      scClientId: '',
      waveSource: 'yandex',
      likes: [],
      recent: [],
      playlists: [],
      yandexRotor: null,
      theme: 'dark',
      accentFromCover: false,
      accentCoverHex: '',
      playerCoverOverride: '',
      playerBgOverride: '',
      bgBlur: 56,
      bgBrightness: 45,
    }
  }

  function get() {
    return { ...defaults(), ...load() }
  }

  function patch(partial) {
    const next = { ...get(), ...partial }
    try {
      save(next)
    } catch (e) {
      if (e && (e.name === 'QuotaExceededError' || /quota/i.test(String(e.message || e)))) {
        throw new Error('Память приложения переполнена. Удали старые обложки плейлистов или импортируй меньше JSON.')
      }
      throw e
    }
    return next
  }

  function normalizeSource(source) {
    const s = String(source || '').trim().toLowerCase()
    if (s === 'ya' || s === 'ym' || s === 'yandex_music') return 'yandex'
    if (s === 'vk' || s === 'vkontakte') return 'vk'
    if (s === 'sc' || s === 'soundcloud') return 'soundcloud'
    return s
  }

  function normalizeTrack(track) {
    if (!track || typeof track !== 'object') return null
    const t = { ...track }
    t.source = normalizeSource(t.source)
    if (!t.id) {
      t.id = t.trackId || t.track_id || t.yandexId || t.vkAudioId || t.audioId || t.oid || ''
    }
    t.id = String(t.id || '').trim()
    if (!t.id && t.url) t.id = String(t.url)
    if (!t.source || !t.id) return null
    t.title = String(t.title || t.name || 'Без названия').trim() || 'Без названия'
    let artist = t.artist ?? t.artists ?? t.author ?? '—'
    if (Array.isArray(artist)) artist = artist.map((a) => (typeof a === 'string' ? a : a?.name)).filter(Boolean).join(', ')
    t.artist = String(artist || '—').trim() || '—'
    const ms = Number(t.durationMs ?? t.duration_ms)
    if (Number.isFinite(ms) && ms > 0) t.durationMs = ms
    else {
      const d = Number(t.duration)
      if (Number.isFinite(d) && d > 0) t.durationMs = d > 36000 ? d : d * 1000
    }
    if (!t.cover) t.cover = t.coverUrl || t.cover_uri || t.albumCover || t.thumbnail || ''
    if (t.source === 'yandex' && t.url) delete t.url
    if (t.source === 'soundcloud') {
      if (!t.scClientId && get().scClientId) t.scClientId = get().scClientId
      if (t.sc_transcoding && !t.scTranscoding) t.scTranscoding = t.sc_transcoding
      if (!t.scTranscoding) delete t.url
    }
    return t
  }

  function normalizeTracks(tracks) {
    return (Array.isArray(tracks) ? tracks : [])
      .map((tr) => normalizeTrack(tr))
      .filter(Boolean)
  }

  function trackKey(t) {
    if (!t) return ''
    const n = normalizeTrack(t)
    const src = n?.source || normalizeSource(t.source)
    const id = n?.id || String(t.id || '').trim()
    return `${src}:${id}`
  }

  function isLiked(track) {
    const k = trackKey(track)
    return get().likes.some((x) => trackKey(x) === k)
  }

  function toggleLike(track) {
    const s = get()
    const k = trackKey(track)
    const has = s.likes.some((x) => trackKey(x) === k)
    const likes = has ? s.likes.filter((x) => trackKey(x) !== k) : [{ ...track, likedAt: Date.now() }, ...s.likes]
    return patch({ likes })
  }

  function pushRecent(track) {
    const s = get()
    const k = trackKey(track)
    const recent = [{ ...track, playedAt: Date.now() }, ...s.recent.filter((x) => trackKey(x) !== k)].slice(0, 40)
    return patch({ recent })
  }

  function setRotor(meta) {
    return patch({ yandexRotor: meta })
  }

  function addPlaylist(name, tracks = [], coverData = '') {
    const s = get()
    const pl = {
      id: `pl_${Date.now()}`,
      name: String(name || 'Плейлист').trim(),
      tracks: normalizeTracks(tracks),
      coverData: String(coverData || ''),
    }
    return patch({ playlists: [pl, ...s.playlists] })
  }

  function importPlaylists(items) {
    const s = get()
    const incoming = (Array.isArray(items) ? items : [])
      .map((pl) => ({
        id: pl.id || `pl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: String(pl.name || 'Плейлист').trim(),
        tracks: normalizeTracks(pl.tracks),
        coverData: String(pl.coverData || pl.cover || ''),
        description: pl.description || '',
      }))
      .filter((p) => p.name)
    if (!incoming.length) return s
    return patch({ playlists: [...incoming, ...s.playlists] })
  }

  function getPlaylist(id) {
    return get().playlists.find((p) => p.id === id) || null
  }

  function updatePlaylist(id, changes) {
    const s = get()
    const playlists = s.playlists.map((p) => {
      if (p.id !== id) return p
      const next = {
        ...p,
        ...changes,
        name: changes.name != null ? String(changes.name).trim() || p.name : p.name,
      }
      if (changes.coverData != null) next.coverData = String(changes.coverData)
      return next
    })
    return patch({ playlists })
  }

  function deletePlaylist(id) {
    const s = get()
    return patch({ playlists: s.playlists.filter((p) => p.id !== id) })
  }

  function addTrackToPlaylist(playlistId, track) {
    if (!track) return get()
    const s = get()
    const k = trackKey(track)
    const playlists = s.playlists.map((p) => {
      if (p.id !== playlistId) return p
      if (p.tracks.some((t) => trackKey(t) === k)) return p
      return { ...p, tracks: [...p.tracks, { ...track }] }
    })
    return patch({ playlists })
  }

  return {
    get, patch, trackKey, normalizeTrack, normalizeTracks, isLiked, toggleLike, pushRecent, setRotor,
    addPlaylist, importPlaylists, getPlaylist, updatePlaylist, deletePlaylist, addTrackToPlaylist,
  }
})()
