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
      playerCoverOverride: '',
      bgBlur: 56,
      bgBrightness: 45,
    }
  }

  function get() {
    return { ...defaults(), ...load() }
  }

  function patch(partial) {
    const next = { ...get(), ...partial }
    save(next)
    return next
  }

  function trackKey(t) {
    return `${t.source}:${t.id}`
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
      tracks: Array.isArray(tracks) ? tracks.map((t) => ({ ...t })) : [],
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
        tracks: Array.isArray(pl.tracks) ? pl.tracks.map((t) => ({ ...t })) : [],
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
      return {
        ...p,
        ...changes,
        name: changes.name != null ? String(changes.name).trim() || p.name : p.name,
      }
    })
    return patch({ playlists })
  }

  return { get, patch, trackKey, isLiked, toggleLike, pushRecent, setRotor, addPlaylist, importPlaylists, getPlaylist, updatePlaylist }
})()
