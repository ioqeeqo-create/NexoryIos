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

  function addPlaylist(name) {
    const s = get()
    const pl = { id: `pl_${Date.now()}`, name: String(name || 'Плейлист').trim(), tracks: [] }
    return patch({ playlists: [pl, ...s.playlists] })
  }

  return { get, patch, trackKey, isLiked, toggleLike, pushRecent, setRotor, addPlaylist }
})()
