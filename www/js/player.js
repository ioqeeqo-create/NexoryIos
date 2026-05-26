const Player = (() => {
  const audio = document.getElementById('audio')
  let queue = []
  let index = 0
  let playingFrom = ''
  let shuffle = false
  let waveMode = false
  let waveLoading = false
  let listeners = new Set()
  let audioPrimed = false
  let playGen = 0
  const STALE_PLAY = Symbol('stale-play')

  function primeAudio() {
    if (audioPrimed || !audio) return
    try {
      audio.muted = true
      const p = audio.play()
      if (p && typeof p.then === 'function') {
        p.then(() => {
          audio.pause()
          audio.muted = false
          audioPrimed = true
        }).catch(() => { audio.muted = false })
      } else {
        audio.muted = false
      }
    } catch {
      audio.muted = false
    }
  }

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

  let waveformHeights = []
  let waveformRatio = 0

  function buildWaveform() {
    const el = document.getElementById('waveform')
    if (!el) return
    if (!waveformHeights.length) {
      waveformHeights = Array.from({ length: 72 }, (_, i) => {
        const t = i * 0.19
        const wave = Math.abs(Math.sin(t)) * 0.62 + Math.abs(Math.sin(t * 2.4 + 0.6)) * 0.22
        return 0.12 + wave * 0.76
      })
    }
    if (el.querySelector('canvas')) {
      drawWaveform(waveformRatio)
      return
    }
    el.innerHTML = '<canvas class="waveform-canvas" id="waveform-canvas" aria-hidden="true"></canvas>'
    drawWaveform(waveformRatio)
  }

  function drawWaveform(ratio = 0) {
    waveformRatio = Math.max(0, Math.min(1, ratio))
    const canvas = document.getElementById('waveform-canvas')
    const wrap = document.getElementById('waveform')
    if (!canvas || !wrap) return
    const dpr = window.devicePixelRatio || 1
    const w = wrap.clientWidth
    const h = wrap.clientHeight
    if (w <= 0 || h <= 0) return
    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    const bars = waveformHeights.length
    const pad = 0
    const bw = w / bars
    const barW = Math.max(1.5, bw * 0.42)
    const centerY = h / 2
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--wave-played').trim() || '#ffffff'
    const unplayed = getComputedStyle(document.documentElement).getPropertyValue('--wave-unplayed').trim() || 'rgba(255,255,255,0.24)'
    for (let i = 0; i < bars; i++) {
      const norm = waveformHeights[i]
      const totalH = Math.max(3, norm * (h - 8))
      const x = i * bw + (bw - barW) * 0.5
      const y = centerY - totalH / 2
      const played = (i + 0.5) / bars <= waveformRatio
      ctx.fillStyle = played ? accent : unplayed
      ctx.beginPath()
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x, y, barW, totalH, barW / 2)
      } else {
        ctx.rect(x, y, barW, totalH)
      }
      ctx.fill()
    }
  }

  function getWaveformHeights() {
    return waveformHeights
  }

  function fmt(sec) {
    if (!Number.isFinite(sec) || sec < 0) return '0:00'
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${String(s).padStart(2, '0')}`
  }

  function friendlyStreamError(track, rawMsg = '') {
    const msg = String(rawMsg || '').trim()
    const code = audio?.error?.code
    if (/load failed/i.test(msg) || code === 2 || code === 4) {
      if (track?.source === 'yandex') {
        return 'Яндекс: поток не открылся. Проверь токен и gateway на VPS'
      }
      if (track?.source === 'soundcloud') {
        return 'SoundCloud: поток не открылся. Обнови VPS (git pull) и Client ID'
      }
      return 'Поток не загрузился — попробуй другой трек'
    }
    if (/not supported/i.test(msg) || code === 4) return 'Поток не поддерживается на iOS'
    return msg || 'Поток недоступен'
  }

  function updateMediaSession(track) {
    if (!track || !('mediaSession' in navigator)) return
    const artwork = []
    if (track.cover) {
      artwork.push(
        { src: track.cover, sizes: '96x96', type: 'image/jpeg' },
        { src: track.cover, sizes: '256x256', type: 'image/jpeg' },
        { src: track.cover, sizes: '512x512', type: 'image/jpeg' },
      )
    }
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: String(track.title || 'Nexory'),
        artist: String(track.artist || ''),
        album: playingFrom || 'Nexory',
        artwork,
      })
    } catch {}
    navigator.mediaSession.playbackState = audio.paused ? 'paused' : 'playing'
    updateMediaSessionPosition()
  }

  function updateMediaSessionPosition() {
    if (!('mediaSession' in navigator) || typeof navigator.mediaSession.setPositionState !== 'function') return
    const duration = audio.duration
    if (!duration || !Number.isFinite(duration) || duration <= 0) return
    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: audio.playbackRate || 1,
        position: Math.min(audio.currentTime, duration),
      })
    } catch {}
  }

  function wireMediaSessionActions() {
    if (!('mediaSession' in navigator)) return
    try {
      navigator.mediaSession.setActionHandler('seekbackward', null)
      navigator.mediaSession.setActionHandler('seekforward', null)
      navigator.mediaSession.setActionHandler('seekto', null)
      navigator.mediaSession.setActionHandler('play', () => { audio.play().catch(() => {}) })
      navigator.mediaSession.setActionHandler('pause', () => { audio.pause() })
      navigator.mediaSession.setActionHandler('previoustrack', () => { prev().catch(() => {}) })
      navigator.mediaSession.setActionHandler('nexttrack', () => { next().catch(() => {}) })
    } catch {}
  }

  function waitForAudioReady(timeoutMs = 22000, isStale) {
    return new Promise((resolve, reject) => {
      if (isStale?.()) {
        reject(STALE_PLAY)
        return
      }
      if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
        resolve()
        return
      }
      let done = false
      const finish = (fn, val) => {
        if (done) return
        done = true
        clearTimeout(timer)
        audio.removeEventListener('canplay', onReady)
        audio.removeEventListener('loadedmetadata', onReady)
        audio.removeEventListener('error', onErr)
        if (isStale?.()) {
          reject(STALE_PLAY)
          return
        }
        fn(val)
      }
      const onReady = () => finish(resolve)
      const onErr = () => {
        if (isStale?.()) {
          finish(reject, STALE_PLAY)
          return
        }
        const code = audio.error?.code
        const hint =
          code === 2 ? 'сеть' : code === 3 ? 'декодер' : code === 4 ? 'формат' : 'источник'
        finish(reject, new Error(`Поток недоступен (${hint})`))
      }
      const timer = setTimeout(() => {
        if (isStale?.()) finish(reject, STALE_PLAY)
        else finish(reject, new Error('Таймаут загрузки трека'))
      }, timeoutMs)
      audio.addEventListener('canplay', onReady, { once: true })
      audio.addEventListener('loadedmetadata', onReady, { once: true })
      audio.addEventListener('error', onErr, { once: true })
    })
  }

  function prefetchQueueAhead(count = 2) {
    for (let j = 1; j <= count; j++) {
      const t = queue[index + j]
      if (!t || t.url) continue
      resolveUrl(t).catch(() => {})
    }
  }

  async function resolveUrl(track) {
    if (track.url && track.source !== 'soundcloud') return track.url
    let lastErr = new Error('Не удалось получить поток')
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const out = await Api.resolve(track)
        if (out.ok && out.url) {
          track.url = out.url
          return out.url
        }
        lastErr = new Error(out.error || 'Не удалось получить поток')
      } catch (e) {
        lastErr = e
      }
      if (attempt === 0) await new Promise((r) => setTimeout(r, 600))
    }
    throw lastErr
  }

  async function playTrackAt(i, fromLabel) {
    if (i < 0 || i >= queue.length) return
    const gen = ++playGen
    const stale = () => gen !== playGen
    index = i
    const track = queue[index]
    playingFrom = fromLabel || playingFrom
    emit('trackchange', { track, index, queue })
    updateMediaSession(track)
    try {
      const url = await resolveUrl(track)
      if (stale()) return
      audio.pause()
      audio.removeAttribute('src')
      audio.src = url
      audio.load()
      await waitForAudioReady(22000, stale)
      if (stale()) return
      await audio.play().catch((e) => {
        const msg = String(e?.message || e)
        if (/not supported/i.test(msg)) throw new Error('Поток не поддерживается на iOS — попробуй другой трек')
        if (/interact|gesture|denied|permission/i.test(msg)) throw new Error('Нажми play ещё раз — iOS заблокировал автозапуск')
        throw e
      })
      if (stale()) return
      Store.pushRecent(track)
      if (waveMode && track?.id) {
        const rotor = Store.get().yandexRotor || {}
        Store.setRotor({ ...rotor, batchAnchorId: String(track.id) })
      }
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
      prefetchQueueAhead(2)
      if (track) Lyrics.prefetch?.(track, audio.duration || 0)
    } catch (e) {
      if (e === STALE_PLAY) return
      const needRetry =
        (track?.source === 'soundcloud' || track?.source === 'yandex') &&
        !track.__streamRetried
      if (needRetry) {
        track.__streamRetried = true
        delete track.url
        if (track.source === 'soundcloud') delete track.scTranscoding
        try {
          return await playTrackAt(i, fromLabel)
        } catch (_) {}
      }
      const msg = friendlyStreamError(track, e?.message || e)
      emit('error', msg)
      throw new Error(msg)
    }
  }

  async function playQueue(tracks, startIdx = 0, fromLabel = '', opts = {}) {
    if (!Api.isConfigured()) throw new Error('Настрой gateway URL и Secret')
    const list = Store.normalizeTracks(tracks)
    if (!list.length) throw new Error('Нет треков для воспроизведения')
    let start = Math.max(0, Math.min(startIdx, list.length - 1))
    const wantKey = Store.trackKey(tracks[startIdx])
    if (wantKey) {
      const mapped = list.findIndex((t) => Store.trackKey(t) === wantKey)
      if (mapped >= 0) start = mapped
    }
    shuffle = !!opts.shuffle
    queue = shuffle ? list.sort(() => Math.random() - 0.5) : list
    waveMode = fromLabel.includes('волна') || fromLabel.includes('Моя волна')
    playingFrom = fromLabel
    await playTrackAt(start, fromLabel)
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
      Api.waveFeedback({
        type: 'skip',
        trackId: track.id,
        radioSessionId: track.yandexRotor.radioSessionId || rotor.radioSessionId,
        batchId: track.yandexRotor.sessionBatchId || track.yandexRotor.batchId,
      }).catch(() => {})
    }
    if (shuffle && queue.length > 1) {
      let nextIdx = index
      while (nextIdx === index) nextIdx = Math.floor(Math.random() * queue.length)
      await playTrackAt(nextIdx)
      return
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
    if (shuffle && queue.length > 1) {
      let prevIdx = index
      while (prevIdx === index) prevIdx = Math.floor(Math.random() * queue.length)
      await playTrackAt(prevIdx)
      return
    }
    if (index > 0) await playTrackAt(index - 1)
  }

  async function appendWaveTracks() {
    if (waveLoading) return
    waveLoading = true
    try {
      const rotor = Store.get().yandexRotor || {}
      const mood = Store.get().waveMood || 'default'
      const moodChanged = rotor.mode && rotor.mode !== mood
      const anchor = rotor.batchAnchorId || queue[index]?.id || ''
      const out = await Api.waveFetch({
        mode: mood,
        resetSession: moodChanged,
        radioSessionId: moodChanged ? '' : rotor.radioSessionId,
        batchAnchorId: moodChanged ? '' : anchor,
      })
      if (!out.ok) throw new Error(out.error || 'Волна недоступна')
      const last = (out.tracks || [])[out.tracks.length - 1]
      Store.setRotor({
        radioSessionId: out.radioSessionId,
        batchId: out.batchId,
        batchAnchorId: out.nextQueueTrackId || out.batchAnchorId || last?.id || anchor,
        radioStartedFrom: out.radioStartedFrom,
        mode: mood,
        apiMode: out.apiMode,
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
    const mood = Store.get().waveMood || 'default'
    const out = await Api.waveFetch({ resetSession: true, mode: mood })
    if (!out.ok || !out.tracks?.length) throw new Error(out.error || 'Не удалось запустить волну')
    const last = (out.tracks || [])[out.tracks.length - 1]
    Store.setRotor({
      radioSessionId: out.radioSessionId,
      batchId: out.batchId,
      batchAnchorId: out.nextQueueTrackId || out.batchAnchorId || last?.id,
      radioStartedFrom: out.radioStartedFrom,
      mode: mood,
      apiMode: out.apiMode,
    })
    await playQueue(out.tracks, 0, 'Моя волна')
  }

  let lastListenTick = 0
  audio.addEventListener('timeupdate', () => {
    emit('time', { current: audio.currentTime, duration: audio.duration || 0 })
    updateMediaSessionPosition()
    if (!audio.paused && !audio.ended) {
      const now = Date.now()
      if (!lastListenTick) lastListenTick = now
      else {
        const dt = (now - lastListenTick) / 1000
        if (dt >= 0.9) {
          Store.addListenSeconds(Math.min(dt, 4))
          lastListenTick = now
        }
      }
    } else {
      lastListenTick = 0
    }
  })
  audio.addEventListener('play', () => {
    document.getElementById('waveform')?.classList.remove('paused')
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing'
    updateMediaSession(current())
    emit('state', { paused: false })
  })
  audio.addEventListener('pause', () => {
    document.getElementById('waveform')?.classList.add('paused')
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused'
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

  wireMediaSessionActions()
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
    primeAudio,
    buildWaveform,
    drawWaveform,
    getWaveformHeights,
  }
})()
