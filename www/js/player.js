const Player = (() => {
  const audio = document.getElementById('audio')
  let queue = []
  let index = 0
  let playingFrom = ''
  let shuffle = false
  let waveMode = false
  let waveLoading = false
  let listeners = new Set()

  function on(ev, fn) {
    listeners.add({ ev, fn })
    return () => listeners.delete({ ev, fn })
  }

  function emit(ev, data) {
    listeners.forEach((l) => {
      if (l.ev === ev) l.fn(data)
    })
  }

  function current() {
    return queue[index] || null
  }

  function sourceLabel(src) {
    return { yandex: 'Яндекс Музыка', vk: 'VK Музыка', soundcloud: 'SoundCloud' }[src] || src
  }

  function buildWaveform() {
    const el = document.getElementById('waveform')
    if (!el || el.childElementCount) return
    for (let i = 0; i < 32; i++) {
      const bar = document.createElement('span')
      bar.style.height = `${20 + Math.random() * 80}%`
      bar.style.animationDelay = `${(i * 0.04).toFixed(2)}s`
      el.appendChild(bar)
    }
  }

  function fmt(sec) {
    if (!Number.isFinite(sec) || sec < 0) return '0:00'
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${String(s).padStart(2, '0')}`
  }

  async function resolveUrl(track) {
    if (track.url) return track.url
    const out = await Api.resolve(track)
    if (!out.ok || !out.url) throw new Error(out.error || 'Не удалось получить поток')
    track.url = out.url
    return out.url
  }

  async function playTrackAt(i, fromLabel) {
    if (i < 0 || i >= queue.length) return
    index = i
    const track = queue[index]
    playingFrom = fromLabel || playingFrom
    emit('trackchange', { track, index, queue })
    const bg = document.getElementById('full-bg')
    if (bg) {
      bg.style.backgroundImage = track.cover ? `url(${track.cover})` : 'none'
    }
    try {
      const url = await resolveUrl(track)
      audio.src = url
      await audio.play().catch((e) => {
        const msg = String(e?.message || e)
        if (/not supported/i.test(msg)) throw new Error('Поток не поддерживается на iOS — попробуй другой трек')
        throw e
      })
      Store.pushRecent(track)
      if (track.source === 'yandex' && track.yandexRotor) {
        const rotor = Store.get().yandexRotor || {}
        Api.waveFeedback({
          type: 'trackStarted',
          trackId: track.id,
          radioSessionId: track.yandexRotor.radioSessionId || rotor.radioSessionId,
          batchId: track.yandexRotor.sessionBatchId || track.yandexRotor.batchId || rotor.batchId,
          from: rotor.radioStartedFrom,
        }).catch(() => {})
      }
      emit('playing', { track })
    } catch (e) {
      emit('error', e.message || String(e))
      throw e
    }
  }

  async function playQueue(tracks, startIdx = 0, fromLabel = '') {
    if (!Api.isConfigured()) throw new Error('Настрой gateway URL и Secret')
    queue = tracks.slice()
    waveMode = fromLabel.includes('волна') || fromLabel.includes('Моя волна')
    shuffle = false
    playingFrom = fromLabel
    await playTrackAt(startIdx, fromLabel)
  }

  async function toggle() {
    if (!audio.src) {
      emit('error', 'Трек ещё не загружен')
      return
    }
    if (audio.paused) {
      await audio.play().catch((e) => {
        emit('error', String(e?.message || e))
      })
    } else audio.pause()
    emit('state', { paused: audio.paused })
  }

  async function next(manual = true) {
    const track = current()
    if (track?.source === 'yandex' && track.yandexRotor && manual) {
      const rotor = Store.get().yandexRotor || {}
      await Api.waveFeedback({
        type: 'skip',
        trackId: track.id,
        radioSessionId: track.yandexRotor.radioSessionId || rotor.radioSessionId,
        batchId: track.yandexRotor.sessionBatchId || track.yandexRotor.batchId,
      }).catch(() => {})
    }
    if (index < queue.length - 1) {
      await playTrackAt(index + 1)
      return
    }
    if (waveMode) await appendWaveTracks()
    else emit('ended', {})
  }

  async function prev() {
    if (audio.currentTime > 3) {
      audio.currentTime = 0
      return
    }
    if (index > 0) await playTrackAt(index - 1)
  }

  async function appendWaveTracks() {
    if (waveLoading) return
    waveLoading = true
    try {
      const rotor = Store.get().yandexRotor || {}
      const out = await Api.waveFetch({
        resetSession: !rotor.radioSessionId,
        radioSessionId: rotor.radioSessionId,
        batchAnchorId: rotor.batchAnchorId,
      })
      if (!out.ok) throw new Error(out.error || 'Волна недоступна')
      Store.setRotor({
        radioSessionId: out.radioSessionId,
        batchId: out.batchId,
        batchAnchorId: out.batchAnchorId || out.nextQueueTrackId,
        radioStartedFrom: out.radioStartedFrom,
      })
      const existing = new Set(queue.map((t) => Store.trackKey(t)))
      const fresh = (out.tracks || []).filter((t) => !existing.has(Store.trackKey(t)))
      if (!fresh.length) throw new Error('Нет новых треков')
      queue = queue.concat(fresh)
      if (index >= queue.length - fresh.length) await playTrackAt(index + 1)
    } finally {
      waveLoading = false
    }
  }

  async function startWave() {
    Store.setRotor(null)
    const out = await Api.waveFetch({ resetSession: true })
    if (!out.ok || !out.tracks?.length) throw new Error(out.error || 'Не удалось запустить волну')
    Store.setRotor({
      radioSessionId: out.radioSessionId,
      batchId: out.batchId,
      batchAnchorId: out.batchAnchorId,
      radioStartedFrom: out.radioStartedFrom,
    })
    await playQueue(out.tracks, 0, 'Моя волна')
  }

  audio.addEventListener('timeupdate', () => {
    emit('time', { current: audio.currentTime, duration: audio.duration || 0 })
  })
  audio.addEventListener('play', () => {
    document.getElementById('waveform')?.classList.remove('paused')
    document.querySelector('.wave-orb')?.classList.add('is-playing')
    emit('state', { paused: false })
  })
  audio.addEventListener('pause', () => {
    document.getElementById('waveform')?.classList.add('paused')
    document.querySelector('.wave-orb')?.classList.remove('is-playing')
    emit('state', { paused: true })
  })
  audio.addEventListener('ended', async () => {
    const track = current()
    if (track?.source === 'yandex' && track.yandexRotor) {
      const rotor = Store.get().yandexRotor || {}
      await Api.waveFeedback({
        type: 'trackFinished',
        trackId: track.id,
        totalPlayedSeconds: Math.floor(audio.duration || 0),
        radioSessionId: track.yandexRotor.radioSessionId || rotor.radioSessionId,
        batchId: track.yandexRotor.sessionBatchId || track.yandexRotor.batchId,
      }).catch(() => {})
    }
    try {
      await next(false)
    } catch (e) {
      emit('error', e.message)
    }
  })

  buildWaveform()

  return {
    audio,
    on,
    current,
    queue: () => queue,
    index: () => index,
    playingFrom: () => playingFrom,
    sourceLabel,
    fmt,
    playQueue,
    startWave,
    toggle,
    next,
    prev,
    seek(ratio) {
      if (!Number.isFinite(audio.duration) || audio.duration <= 0) return
      const t = Math.max(0, Math.min(1, ratio)) * audio.duration
      try {
        audio.currentTime = t
      } catch (e) {
        emit('error', 'Перемотка недоступна для этого трека')
      }
    },
    toggleShuffle() {
      shuffle = !shuffle
      return shuffle
    },
    playTrackAt,
    isShuffle: () => shuffle,
  }
})()
