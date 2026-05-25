const UI = (() => {
  let toastTimer = null
  let searchSource = 'yandex'

  const IMPORT_SOURCES = {
    yandex: { label: 'Яндекс Музыка', logo: 'assets/source-yandex-music.png' },
    vk: { label: 'VK Музыка', logo: 'assets/source-vk.svg' },
    soundcloud: { label: 'SoundCloud', logo: 'assets/source-soundcloud.png' },
    json: { label: 'Файл Nexory', logo: 'assets/nexory-icon.png' },
  }

  let importState = {
    step: 'hub',
    source: 'yandex',
    preview: null,
    destination: 'new',
    failed: [],
  }
  let busy = false
  let openPlaylistId = null
  let pendingCoverData = ''
  let seeking = false
  let openServiceId = null
  let tokenVisible = false
  let actionsPlaylistId = null
  let plPressTimer = null
  let plPressMoved = false
  let plLongPressHandled = false
  let pickPlaylistTrack = null
  let editingPlaylistId = null
  const homeScCache = { popular: null, mixes: null }
  const homeScLoading = { popular: false, mixes: false }

  function resetHomeScCache() {
    homeScCache.popular = null
    homeScCache.mixes = null
  }
  let trackActionPlaylistId = null
  let trackActionKey = null
  const trackLists = new WeakMap()

  const SERVICE_META = {
    yandex: {
      logo: 'assets/source-yandex-music.png',
      storeKey: 'yandexToken',
      helpUrl: 'https://telegra.ph/Kak-podklyuchit-YAndeks-Muzyku-vo-Flow-05-03',
      helpText: 'Как получить токен Яндекс',
    },
    vk: {
      logo: 'assets/source-vk.png',
      storeKey: 'vkToken',
      helpUrl: 'https://telegra.ph/Kak-podklyuchit-VKontakte-vo-Flow-05-04',
      helpText: 'Получить токен VK',
    },
    soundcloud: {
      logo: 'assets/source-soundcloud.png',
      storeKey: 'scClientId',
      accessStoreKey: 'scAccessToken',
      helpUrl: 'https://soundcloud.com/you/apps',
      helpText: 'Создать приложение SoundCloud',
      optional: true,
      oauth: true,
    },
  }

  const $ = (sel) => document.querySelector(sel)

  function toast(msg) {
    const el = $('#toast')
    if (!el) return
    el.textContent = msg
    el.hidden = false
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => { el.hidden = true }, 3200)
  }

  function showScreen(name) {
    const prev = document.body.dataset.screen || 'home'
    if (prev === name) return
    if (prev === 'search' && name !== 'search') {
      $('#search-input')?.blur()
      Viewport.scheduleResync?.()
    }

    const leaving = document.querySelector(`.screen[data-screen="${prev}"]`)
    const entering = document.querySelector(`.screen[data-screen="${name}"]`)

    document.querySelectorAll('.screen').forEach((s) => {
      s.classList.remove('screen--entering', 'screen--leaving')
      if (leaving && s === leaving && leaving !== entering) {
        s.classList.add('screen--leaving', 'screen--active')
        return
      }
      s.classList.toggle('screen--active', s.dataset.screen === name)
    })

    entering?.classList.add('screen--entering')
    document.body.dataset.screen = name
    requestAnimationFrame(() => entering?.classList.remove('screen--entering'))
    if (leaving && leaving !== entering) {
      setTimeout(() => leaving.classList.remove('screen--active', 'screen--leaving'), 300)
    }
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('tab--active', t.dataset.tab === name))
    if (name === 'library') renderLibrary()
    if (name === 'settings') renderSettingsForm()
    if (name === 'search') {
      renderSearchSourceButton()
      setTimeout(() => $('#search-input')?.focus(), 150)
    }
  }

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
  }

  function sourceIcon(source) {
    const map = {
      yandex: 'assets/source-yandex-music.png',
      vk: 'assets/source-vk.png',
      soundcloud: 'assets/source-soundcloud.png',
    }
    const src = map[source]
    if (!src) return '<span class="source-icon source-icon--ph">?</span>'
    return `<img class="source-icon" src="${src}" alt="" loading="lazy" />`
  }

  function sourceBadgeCorner(source) {
    const map = {
      yandex: 'assets/source-yandex-music.png',
      vk: 'assets/source-vk.png',
      soundcloud: 'assets/source-soundcloud.png',
    }
    const src = map[source]
    if (!src) return ''
    return `<span class="source-badge-corner"><img src="${src}" alt="" loading="lazy" /></span>`
  }

  function coverImgFallbackSrc(url) {
    if (!url || !/sndcdn\.com/i.test(url)) return ''
    if (/-t\d+x\d+\./i.test(url)) return String(url).replace(/-t\d+x\d+(?=\.[a-z]{3,4}$)/i, '-large')
    return ''
  }

  function coverOnly(url) {
    if (url) {
      const fb = coverImgFallbackSrc(url)
      const fbAttr = fb ? ` data-cover-fb="${esc(fb)}"` : ''
      return `<img src="${esc(url)}" alt="" loading="lazy" referrerpolicy="no-referrer"${fbAttr} onerror="if(this.dataset.coverFb&&!this.dataset.coverTried){this.dataset.coverTried='1';this.src=this.dataset.coverFb;return}this.hidden=true;this.nextElementSibling.hidden=false" /><span hidden data-icon="music-2" data-icon-class="ui-icon cover-ph"></span>`
    }
    return `<span data-icon="music-2" data-icon-class="ui-icon cover-ph"></span>`
  }

  function coverBlock(source, url) {
    return `${coverOnly(url)}${sourceBadgeCorner(source)}`
  }

  function trackDurationSec(track) {
    if (!track) return 0
    const ms = Number(track.durationMs ?? track.duration_ms)
    if (Number.isFinite(ms) && ms > 0) return ms / 1000
    const d = Number(track.duration)
    if (Number.isFinite(d) && d > 0) return d > 36000 ? d / 1000 : d
    const len = Number(track.length)
    if (Number.isFinite(len) && len > 0) return len
    const cur = Player.current()
    if (cur && Store.trackKey(cur) === Store.trackKey(track)) {
      const ad = Number(Player.audio?.duration)
      if (ad > 0) return ad
    }
    return 0
  }

  function trackDurationLabel(track) {
    const sec = trackDurationSec(track)
    return sec > 0 ? Player.fmt(sec) : '—:——'
  }

  function setupScrollTitles(root) {
    const scope = root && root.querySelectorAll ? root : document
    const wraps = root?.classList?.contains('scroll-title-wrap')
      ? [root]
      : [...scope.querySelectorAll('.scroll-title-wrap')]
    wraps.forEach((wrap) => {
      const inner = wrap.querySelector('.scroll-title')
      if (!inner) return
      requestAnimationFrame(() => {
        const overflow = inner.scrollWidth > wrap.clientWidth + 2
        wrap.classList.toggle('is-scrolling', overflow)
        if (overflow) {
          inner.style.setProperty('--scroll-shift', `${wrap.clientWidth - inner.scrollWidth}px`)
        } else {
          inner.style.removeProperty('--scroll-shift')
        }
      })
    })
  }

  function trackRowHtml(track, idx) {
    const dur = trackDurationLabel(track)
    return `<button type="button" class="track-row" data-idx="${idx ?? ''}" data-key="${Store.trackKey(track)}">
      <div class="track-cover">${coverBlock(track.source, track.cover)}</div>
      <div class="track-row__meta">
        <div class="scroll-title-wrap track-row__title-wrap">
          <div class="track-row__title scroll-title">${esc(track.title)}</div>
        </div>
        <div class="track-row__artist">${esc(track.artist)}</div>
      </div>
      <span class="track-row__dur">${dur}</span>
    </button>`
  }

  function cardHtml(track) {
    return `<button type="button" class="card-tile" data-key="${Store.trackKey(track)}">
      <div class="card-tile__cover">${coverBlock(track.source, track.cover)}</div>
      <div class="card-tile__meta">
        <div class="scroll-title-wrap card-tile__title-wrap">
          <div class="card-tile__title scroll-title">${esc(track.title)}</div>
        </div>
        <div class="card-tile__sub">${esc(track.artist)}</div>
      </div>
    </button>`
  }

  function plaqueCoversHtml(tracks, emptyIcon = 'music-2') {
    const slice = tracks.slice(0, 2)
    if (!slice.length) {
      return `<span class="home-plaque__ph"><span data-icon="${emptyIcon}" data-icon-class="ui-icon"></span></span>`
    }
    return slice.map((t, i) => (
      `<span class="home-plaque__cover home-plaque__cover--${i + 1}">${coverOnly(t.cover)}</span>`
    )).join('')
  }

  let recentSheetTimer = null
  let recentDrag = null
  let playlistViewTimer = null
  const trackTap = { active: false, moved: false, x: 0, y: 0, el: null, container: null, key: null }

  function bindRecentSheetSwipe() {
    const sheet = $('#recent-sheet')
    const panel = sheet?.querySelector('.sheet__panel--recent')
    if (!sheet || !panel || sheet.dataset.swipeBound) return
    sheet.dataset.swipeBound = '1'
    const startDrag = (e) => {
      if (sheet.hidden) return
      if (e.target.closest('.track-row, button, input')) return
      recentDrag = {
        pid: e.pointerId,
        startY: e.clientY,
        dy: 0,
      }
      panel.setPointerCapture?.(e.pointerId)
      panel.classList.add('is-dragging')
    }
    const moveDrag = (e) => {
      if (!recentDrag || recentDrag.pid !== e.pointerId) return
      recentDrag.dy = Math.max(0, e.clientY - recentDrag.startY)
      const shift = Math.min(recentDrag.dy, 280)
      panel.style.transform = `translateY(${shift}px)`
      panel.style.opacity = String(Math.max(0.55, 1 - shift / 420))
      const backdrop = sheet.querySelector('.sheet__backdrop')
      if (backdrop) backdrop.style.opacity = String(Math.max(0, 0.55 - shift / 500))
    }
    const endDrag = (e) => {
      if (!recentDrag || recentDrag.pid !== e.pointerId) return
      panel.releasePointerCapture?.(e.pointerId)
      const commit = recentDrag.dy > 100
      panel.style.transform = ''
      panel.style.opacity = ''
      const backdrop = sheet.querySelector('.sheet__backdrop')
      if (backdrop) backdrop.style.opacity = ''
      panel.classList.remove('is-dragging')
      recentDrag = null
      if (commit) openRecentSheet(false)
    }
    panel.addEventListener('pointerdown', startDrag)
    panel.addEventListener('pointermove', moveDrag)
    panel.addEventListener('pointerup', endDrag)
    panel.addEventListener('pointercancel', endDrag)
    sheet.querySelector('.sheet__grabber')?.addEventListener('pointerdown', startDrag)
  }

  function openRecentSheet(open) {
    const sheet = $('#recent-sheet')
    const list = $('#recent-sheet-list')
    if (!sheet) return
    clearTimeout(recentSheetTimer)
    if (!open) {
      if (sheet.hidden) return
      sheet.classList.remove('is-opening')
      sheet.classList.add('is-closing')
      document.body.classList.remove('recent-sheet-open')
      recentSheetTimer = setTimeout(() => {
        sheet.hidden = true
        sheet.classList.remove('is-closing')
      }, 360)
      return
    }
    const items = Store.get().recent.slice(0, 40)
    if (list) {
      list.innerHTML = items.length
        ? items.map((t, i) => trackRowHtml(t, i)).join('')
        : '<p class="empty-hint sheet-list__empty">Пока пусто — включи волну или найди трек</p>'
      bindTrackClicks(list, items, 'Недавние')
      setupScrollTitles(list)
      Icons.mount(list)
    }
    sheet.hidden = false
    sheet.classList.remove('is-closing')
    document.body.classList.add('recent-sheet-open')
    void sheet.offsetWidth
    sheet.classList.add('is-opening')
    Icons.mount(sheet)
    recentSheetTimer = setTimeout(() => sheet.classList.remove('is-opening'), 480)
    bindRecentSheetSwipe()
  }

  function highlightPlayingTrack(track) {
    const key = track ? Store.trackKey(track) : ''
    document.querySelectorAll('.card-tile, .strip-tile, .track-row, .pl-track-row').forEach((el) => {
      el.classList.toggle('is-playing', !!key && el.dataset.key === key)
    })
    const from = Player.playingFrom() || ''
    const waveBtn = $('#btn-wave-play')
    const isWave = !!track && (from.includes('волна') || from.includes('Моя волна'))
    const audio = Player.audio
    const playing = isWave && audio && !audio.paused
    if (waveBtn) {
      waveBtn.classList.toggle('is-wave-session', isWave)
      waveBtn.classList.toggle('is-playing', playing)
    }
  }

  function updateWaveformProgress(ratio) {
    Player.drawWaveform(ratio)
  }

  function syncShellLayout() {
    const hasMini = $('#mini-player') && !$('#mini-player').hidden
    document.body.classList.toggle('has-mini', !!hasMini)
  }

  function playlistTrackRowHtml(track, idx) {
    const dur = trackDurationLabel(track)
    return `<button type="button" class="pl-track-row track-row" data-idx="${idx ?? ''}" data-key="${Store.trackKey(track)}">
      <div class="pl-track-row__cover">${coverBlock(track.source, track.cover)}</div>
      <div class="pl-track-row__meta">
        <div class="scroll-title-wrap pl-track-row__title-wrap">
          <div class="pl-track-row__title scroll-title">${esc(track.title)}</div>
        </div>
        <div class="pl-track-row__artist">${esc(track.artist)}</div>
      </div>
      <span class="pl-track-row__dur">${dur}</span>
    </button>`
  }

  function getSearchSources() {
    if (typeof NexoryConfig !== 'undefined' && NexoryConfig.SEARCH_SOURCES?.length) {
      return NexoryConfig.SEARCH_SOURCES
    }
    return [
      { id: 'yandex', label: 'Яндекс', icon: 'assets/source-yandex-music.png' },
      { id: 'vk', label: 'VK', icon: 'assets/source-vk.png' },
      { id: 'soundcloud', label: 'SoundCloud', icon: 'assets/source-soundcloud.png' },
    ]
  }

  function getSearchSourceMeta(id) {
    return getSearchSources().find((s) => s.id === id) || getSearchSources()[0]
  }

  function renderSearchSourceButton() {
    const btn = $('#search-source-btn')
    if (!btn) return
    const meta = getSearchSourceMeta(searchSource)
    btn.innerHTML = `<img class="search-source-btn__icon" src="${esc(meta.icon)}" alt="" />`
    btn.dataset.source = meta.id
    btn.setAttribute('aria-label', `Источник: ${meta.label}`)
    const sub = document.querySelector('.search-hero__sub')
    if (sub) sub.textContent = meta.label
  }

  function renderSearchSourcePicker() {
    const el = $('#search-source-picker')
    if (!el) return
    el.innerHTML = getSearchSources()
      .map((s) => {
        const active = s.id === searchSource ? ' source-picker__item--active' : ''
        return `<button type="button" class="source-picker__item${active}" data-source="${esc(s.id)}" role="option">
        <img src="${esc(s.icon)}" alt="" />
        <span>${esc(s.label)}</span>
      </button>`
      })
      .join('')
  }

  function openSearchSourceSheet() {
    renderSearchSourcePicker()
    const sheet = $('#search-source-sheet')
    if (sheet) sheet.hidden = false
  }

  function closeSearchSourceSheet() {
    const sheet = $('#search-source-sheet')
    if (sheet) sheet.hidden = true
  }

  function setSearchSource(id) {
    if (!getSearchSources().some((s) => s.id === id)) return
    searchSource = id
    renderSearchSourceButton()
    closeSearchSourceSheet()
    runSearch($('#search-input')?.value || '')
  }

  function renderWaveMoods() {
    const el = $('#wave-moods')
    if (!el || typeof NexoryConfig === 'undefined') return
    const mood = Store.get().waveMood || 'default'
    el.innerHTML = NexoryConfig.WAVE_MOODS.map((m) => {
      const active = m.id === mood ? ' wave-mood--active' : ''
      const icon = m.icon || 'audio-lines'
      const tint = m.tint ? `--mood-tint:${m.tint};` : ''
      const border = m.border ? `--mood-border:${m.border};` : ''
      return `<button type="button" class="wave-mood${active}" data-wave-mood="${esc(m.id)}" data-mood="${esc(m.id)}" style="${tint}${border}">
        <span class="wave-mood__icon" data-icon="${esc(icon)}" data-icon-class="ui-icon"></span>
        <span class="wave-mood__label">${esc(m.label)}</span>
      </button>`
    }).join('')
    Icons.mount(el)
  }

  function renderThemeCards() {
    const el = $('#theme-grid')
    if (!el || typeof NexoryConfig === 'undefined') return
    const theme = Store.get().theme || 'dark'
    el.innerHTML = NexoryConfig.THEME_CARDS.map((t) => {
      const active = t.id === theme ? ' theme-card--active' : ''
      return `<button type="button" class="theme-card${active}" data-theme="${esc(t.id)}">
        <span class="theme-card__swatch" style="background:${t.swatch}"></span>
        <span class="theme-card__label">${esc(t.label)}</span>
        <span class="theme-card__check" data-icon="check" data-icon-class="ui-icon"></span>
      </button>`
    }).join('')
    Icons.mount(el)
  }

  function renderBgPresets() {
    const el = $('#bg-presets')
    if (!el || typeof NexoryConfig === 'undefined') return
    const preset = Store.get().playerBgPreset || ''
    el.innerHTML = NexoryConfig.BG_PRESETS.map((p) => {
      const active = p.id === preset ? ' bg-preset--active' : ''
      return `<button type="button" class="bg-preset${active}" data-bg-preset="${esc(p.id)}" style="background:${p.css}" title="${esc(p.label)}"></button>`
    }).join('')
  }

  function setServerStatus(state, detail = '') {
    const okCard = $('#gateway-status-card')
    const errCard = $('#gateway-status-error')
    const okText = $('#gateway-status-text')
    const errText = $('#gateway-status-error-text')
    if (state === 'ok') {
      if (okCard) okCard.hidden = false
      if (errCard) errCard.hidden = true
      if (okText) okText.textContent = detail || 'Ответ получен'
    } else if (state === 'error') {
      if (okCard) okCard.hidden = true
      if (errCard) errCard.hidden = false
      if (errText) errText.textContent = detail || 'Сервер не отвечает'
    } else {
      if (okCard) okCard.hidden = true
      if (errCard) errCard.hidden = true
    }
  }

  async function testServerConnection(statusEl) {
    saveGatewayFromForm()
    setServerStatus('idle')
    const t0 = performance.now()
    try {
      await Api.health()
      const ms = Math.round(performance.now() - t0)
      setServerStatus('ok', `Ответ получен · ${ms} ms`)
      if (statusEl) statusEl.textContent = ''
      updateGatewayBanner()
      return true
    } catch (e) {
      const msg = String(e?.message || e)
      setServerStatus('error', msg)
      if (statusEl) statusEl.textContent = msg
      return false
    }
  }

  async function setWaveMood(id) {
    const prev = Store.get().waveMood || 'default'
    if (prev === id) return
    Store.patch({ waveMood: id })
    Store.setRotor(null)
    renderWaveMoods()
    const from = Player.playingFrom() || ''
    if (from.includes('волна') || from.includes('Моя волна')) {
      if (busy) return
      try {
        busy = true
        toast('Меняем настроение волны…')
        await Player.startWave()
      } catch (e) {
        toast(e.message || 'Не удалось переключить волну')
      } finally {
        busy = false
      }
    }
  }

  function openTrackActionsSheet(playlistId, track) {
    if (!playlistId || playlistId === '__likes' || !track) return
    trackActionPlaylistId = playlistId
    trackActionKey = Store.trackKey(track)
    const sheet = $('#track-actions-sheet')
    if (!sheet) return
    $('#track-actions-title').textContent = track.title || 'Трек'
    $('#track-actions-sub').textContent = track.artist || ''
    sheet.hidden = false
    Icons.mount(sheet)
  }

  function closeTrackActionsSheet() {
    trackActionPlaylistId = null
    trackActionKey = null
    const sheet = $('#track-actions-sheet')
    if (sheet) sheet.hidden = true
  }

  function bindPlaylistTrackLongPress(container, playlistId) {
    if (!container || playlistId === '__likes' || container.dataset.trackPressBound) return
    container.dataset.trackPressBound = '1'
    let timer = null
    let moved = false
    container.addEventListener('pointerdown', (e) => {
      const row = e.target.closest('.pl-track-row')
      if (!row) return
      moved = false
      clearTimeout(timer)
      const idx = Number(row.dataset.idx)
      timer = setTimeout(() => {
        if (moved) return
        const pl = playlistId === '__likes' ? null : Store.getPlaylist(playlistId)
        const tracks = playlistId === '__likes' ? Store.get().likes : pl?.tracks
        const track = tracks?.[idx]
        if (track && playlistId !== '__likes') {
          if (navigator.vibrate) navigator.vibrate(10)
          openTrackActionsSheet(playlistId, track)
        }
      }, 520)
    })
    container.addEventListener('pointermove', () => {
      moved = true
      clearTimeout(timer)
    })
    container.addEventListener('pointerup', () => clearTimeout(timer))
    container.addEventListener('pointercancel', () => clearTimeout(timer))
  }

  async function validatePlaylistTracks(tracks, onProgress) {
    const list = Store.normalizeTracks(tracks)
    const ok = []
    const failed = []
    for (let i = 0; i < list.length; i++) {
      const t = list[i]
      onProgress?.(i + 1, list.length, t)
      if (t.source === 'vk' && t.url) {
        ok.push(t)
        continue
      }
      if (t.source === 'yandex' && (t.id || t.url)) {
        ok.push(t)
        continue
      }
      try {
        const out = await Api.resolve(t)
        if (out.ok && out.url) {
          const next = { ...t, url: out.url }
          if (out.scTranscoding) next.scTranscoding = out.scTranscoding
          ok.push(next)
        } else {
          failed.push({ track: t, error: out.error || 'Не удалось получить поток' })
        }
      } catch (e) {
        failed.push({ track: t, error: String(e?.message || e) })
      }
    }
    return { ok, failed }
  }

  function showImportProgress(done, total, text) {
    const box = $('#import-progress')
    const label = $('#import-progress-text')
    const fill = $('#import-progress-fill')
    if (!box) return
    box.hidden = false
    if (label) label.textContent = text || `Проверка ${done}/${total}`
    if (fill && total > 0) fill.style.width = `${Math.round((done / total) * 100)}%`
  }

  function hideImportProgress() {
    const box = $('#import-progress')
    if (box) box.hidden = true
    const list = $('#import-failures')
    if (list) list.innerHTML = ''
    const fill = $('#import-progress-fill')
    if (fill) fill.style.width = '0%'
  }

  function renderImportFailures(failed) {
    const list = $('#import-failures')
    if (!list) return
    if (!failed.length) {
      list.innerHTML = ''
      return
    }
    list.innerHTML = failed
      .slice(0, 24)
      .map(
        (f) =>
          `<li><strong>${esc(f.track?.title || 'Трек')}</strong> — ${esc(f.error || 'ошибка')}</li>`,
      )
      .join('')
    if (failed.length > 24) {
      list.innerHTML += `<li>…и ещё ${failed.length - 24}</li>`
    }
  }

  function getActionsPlaylist() {
    if (!actionsPlaylistId) return null
    return Store.getPlaylist(actionsPlaylistId)
  }

  function openPlaylistActionsSheet(pl) {
    if (!pl || pl.id === '__likes') return
    actionsPlaylistId = pl.id
    const sheet = $('#playlist-actions-sheet')
    if (!sheet) return
    $('#pl-actions-name').textContent = pl.name
    $('#pl-actions-count').textContent = `${pl.tracks.length} треков`
    const icon = $('#pl-actions-icon')
    if (icon) {
      if (pl.coverData) {
        icon.innerHTML = `<img src="${esc(pl.coverData)}" alt="" />`
      } else {
        icon.dataset.icon = 'library'
        icon.innerHTML = Icons.svg('library', 'ui-icon')
      }
    }
    sheet.hidden = false
    Icons.mount(sheet)
  }

  function closePlaylistActionsSheet() {
    actionsPlaylistId = null
    const sheet = $('#playlist-actions-sheet')
    if (sheet) sheet.hidden = true
  }

  async function playActionsPlaylist(shuffleMode = false) {
    const pl = getActionsPlaylist()
    if (!pl?.tracks?.length) return toast('Плейлист пуст')
    closePlaylistActionsSheet()
    Player.primeAudio()
    try {
      const tracks = shuffleMode ? pl.tracks.slice().sort(() => Math.random() - 0.5) : pl.tracks
      const label = shuffleMode ? `${pl.name} · shuffle` : pl.name
      await Player.playQueue(tracks, 0, label, { shuffle: shuffleMode })
    } catch (e) {
      toast(e.message)
    }
  }

  function bindPlaylistLongPress(container) {
    if (!container || container.dataset.plPressBound) return
    container.dataset.plPressBound = '1'
    container.addEventListener('pointerdown', (e) => {
      const card = e.target.closest('[data-pl-id]')
      if (!card) return
      plPressMoved = false
      clearTimeout(plPressTimer)
      const id = card.dataset.plId
      plPressTimer = setTimeout(() => {
        if (plPressMoved) return
        const pl = Store.getPlaylist(id)
        if (pl) {
          plLongPressHandled = true
          if (navigator.vibrate) navigator.vibrate(12)
          openPlaylistActionsSheet(pl)
        }
      }, 480)
    })
    container.addEventListener('pointermove', () => { plPressMoved = true; clearTimeout(plPressTimer) })
    container.addEventListener('pointerup', () => {
      clearTimeout(plPressTimer)
      setTimeout(() => { plLongPressHandled = false }, 320)
    })
    container.addEventListener('pointercancel', () => clearTimeout(plPressTimer))
    container.addEventListener('pointerleave', () => clearTimeout(plPressTimer))
  }

  function registerTrackList(container, tracks, playAllFrom) {
    if (!container) return
    container.setAttribute('data-track-list', '')
    trackLists.set(container, { tracks: Store.normalizeTracks(tracks), playAllFrom })
    Icons.mount(container)
  }

  async function playFromList(container, key, el) {
    if (busy) return
    const list = trackLists.get(container)
    if (!list) return
    let { tracks, playAllFrom } = list
    tracks = Store.normalizeTracks(tracks)
    let idx = tracks.findIndex((t) => Store.trackKey(t) === key)
    if (idx < 0 && el?.dataset.idx != null && el.dataset.idx !== '') {
      const i = Number(el.dataset.idx)
      if (Number.isFinite(i) && i >= 0 && i < tracks.length) idx = i
    }
    if (idx < 0) return

    if (!Api.isConfigured()) {
      toast('Сначала настрой gateway')
      showSetupGate()
      return
    }

    Player.primeAudio()
    busy = true
    if (el) el.classList.add('is-busy')
    toast('Загружаем…')
    try {
      await Player.playQueue(tracks, idx, playAllFrom)
      if (container?.id === 'recent-sheet-list') openRecentSheet(false)
    } catch (e) {
      toast(e.message || 'Ошибка воспроизведения')
    } finally {
      busy = false
      if (el) el.classList.remove('is-busy')
    }
  }

  function bindTrackClicks(container, tracks, playAllFrom) {
    registerTrackList(container, tracks, playAllFrom)
  }

  function getPlayerCoverUrl(track) {
    const override = Store.get().playerCoverOverride
    if (override) return override
    return track?.cover || ''
  }

  function getPlayerBgUrl(track) {
    const override = Store.get().playerBgOverride
    if (override) return override
    const coverOverride = Store.get().playerCoverOverride
    if (coverOverride) return coverOverride
    return track?.cover || ''
  }

  let fullCoverLayer = 'a'

  function activeFullCoverEl() {
    const a = $('#full-cover-a')
    const b = $('#full-cover-b')
    if (b?.classList.contains('is-active')) return b
    return a || b
  }

  function setFullCoverInstant(url) {
    const wrap = $('#full-cover-wrap')
    const ph = wrap?.querySelector('[data-icon]')
    const a = $('#full-cover-a')
    const b = $('#full-cover-b')
    if (!a && !b) return
    if (!url) {
      if (a) { a.hidden = true; a.classList.remove('is-active'); a.removeAttribute('src') }
      if (b) { b.hidden = true; b.classList.remove('is-active'); b.removeAttribute('src') }
      if (ph) ph.hidden = false
      Icons.mount(wrap)
      return
    }
    if (ph) ph.hidden = true
    const img = a || b
    if (b) { b.hidden = true; b.classList.remove('is-active') }
    img.src = url
    img.hidden = false
    img.classList.add('is-active')
    fullCoverLayer = img.id === 'full-cover-a' ? 'a' : 'b'
  }

  function crossfadeFullCover(track) {
    const wrap = $('#full-cover-wrap')
    if (!wrap) return
    const url = getPlayerCoverUrl(track)
    if (typeof Platform !== 'undefined' && Platform.isAndroid()) {
      setFullCoverInstant(url)
      return
    }
    const ph = wrap.querySelector('[data-icon]')
    const a = $('#full-cover-a')
    const b = $('#full-cover-b')
    if (!a && !b) return
    if (!url) {
      if (a) { a.hidden = true; a.classList.remove('is-active'); a.removeAttribute('src') }
      if (b) { b.hidden = true; b.classList.remove('is-active'); b.removeAttribute('src') }
      if (ph) ph.hidden = false
      Icons.mount(wrap)
      return
    }
    const nextKey = fullCoverLayer === 'a' ? 'b' : 'a'
    const cur = fullCoverLayer === 'a' ? a : b
    const next = fullCoverLayer === 'a' ? b : a
    if (!next) return
    if (ph) ph.hidden = true
    if (cur && !cur.src) {
      cur.src = url
      cur.hidden = false
      cur.classList.add('is-active')
      if (next) {
        next.classList.remove('is-active')
        next.hidden = true
      }
      return
    }
    const show = () => {
      next.hidden = false
      next.classList.add('is-active')
      if (cur) {
        cur.classList.remove('is-active')
        window.setTimeout(() => {
          if (!cur.classList.contains('is-active')) cur.hidden = true
        }, 520)
      }
      fullCoverLayer = nextKey
    }
    if (next.src === url && next.classList.contains('is-active')) return
    next.onload = show
    next.onerror = () => {
      next.hidden = true
      next.classList.remove('is-active')
      if (ph) ph.hidden = false
      Icons.mount(wrap)
    }
    next.src = url
    if (next.complete) show()
  }

  function setCover(wrap, img, track, { playerOnly = false, crossfade = false } = {}) {
    if (crossfade && wrap?.id === 'full-cover-wrap') {
      crossfadeFullCover(track)
      return
    }
    if (!wrap) return
    const ph = wrap.querySelector('[data-icon]')
    const url = playerOnly ? getPlayerCoverUrl(track) : track?.cover
    if (url) {
      if (img) {
        img.hidden = false
        img.src = url
        img.onerror = () => {
          img.hidden = true
          if (ph) ph.hidden = false
        }
      }
      if (ph) ph.hidden = true
    } else {
      if (img) { img.hidden = true; img.removeAttribute('src') }
      if (ph) ph.hidden = false
      Icons.mount(wrap)
    }
  }

  function applyPlayerVisuals(track) {
    if (!track) return
    const s = Store.get()
    const bgUrl = s.playerBgOverride || getPlayerBgUrl(track)
    Theme.setFullBgImage(bgUrl || '')
    Theme.applyPlayerBg()
  }

  let fpCloseTimer = null
  let fpOpenTimer = null

  function setFullPlayer(open) {
    const fp = $('#full-player')
    if (!fp) return
    clearTimeout(fpCloseTimer)
    clearTimeout(fpOpenTimer)
    if (open) {
      fp.hidden = false
      fp.classList.remove('is-closing')
      void fp.offsetWidth
      fp.classList.add('is-opening')
      document.body.classList.add('player-open')
      fpOpenTimer = setTimeout(() => fp.classList.remove('is-opening'), 560)
    } else if (!fp.hidden) {
      fp.classList.remove('is-opening')
      fp.classList.add('is-closing')
      document.body.classList.remove('player-open')
      fpCloseTimer = setTimeout(() => {
        fp.hidden = true
        fp.classList.remove('is-closing')
        syncShellLayout()
      }, 500)
      syncShellLayout()
      return
    }
    syncShellLayout()
  }

  function setupMarqueeTitle(title) {
    const el = $('#full-title')
    if (el) el.textContent = String(title || '—')
    setupScrollTitles($('#fp-title-wrap'))
  }

  function openPickPlaylistSheet(track) {
    if (!track) return
    pickPlaylistTrack = track
    const sheet = $('#pick-playlist-sheet')
    const list = $('#pick-playlist-list')
    const playlists = Store.get().playlists
    $('#pick-playlist-track').textContent = `${track.title} — ${track.artist}`
    if (!list) return
    if (!playlists.length) {
      list.innerHTML = '<p class="empty-hint">Создай плейлист в библиотеке</p>'
    } else {
      list.innerHTML = playlists.map((p) => `
        <button type="button" class="pick-playlist-item" data-pick-pl="${esc(p.id)}">
          <span class="pick-playlist-item__cover">${playlistCoverHtml(p)}</span>
          <span>
            <div class="pick-playlist-item__name">${esc(p.name)}</div>
            <div class="pick-playlist-item__count">${p.tracks.length} треков</div>
          </span>
        </button>
      `).join('')
      Icons.mount(list)
    }
    sheet.dataset.trackKey = Store.trackKey(track)
    sheet.hidden = false
  }

  function closePickPlaylistSheet() {
    const sheet = $('#pick-playlist-sheet')
    if (sheet) {
      sheet.hidden = true
      delete sheet.dataset.trackKey
    }
    pickPlaylistTrack = null
  }

  function openFullPlayer() {
    setFullPlayer(true)
    Icons.mount($('#full-player'))
    const t = Player.current()
    if (t) setupMarqueeTitle(t.title)
    requestAnimationFrame(() => {
      Player.buildWaveform()
      const d = Player.audio?.duration || 0
      if (d > 0) Player.drawWaveform((Player.audio?.currentTime || 0) / d)
    })
  }

  function closeFullPlayer() {
    Lyrics.setOpen(false)
    setFullPlayer(false)
  }

  function bindSwipeClosers() {
    const plView = $('#playlist-view')
    if (plView && !plView.dataset.swipeBound) {
      plView.dataset.swipeBound = '1'
      let active = false
      let startX = 0
      let startY = 0
      let dx = 0
      let dy = 0
      plView.addEventListener('pointerdown', (e) => {
        if (plView.hidden) return
        if (e.clientX > 48) return
        active = true
        startX = e.clientX
        startY = e.clientY
        dx = 0
        dy = 0
        plView.setPointerCapture?.(e.pointerId)
      })
      plView.addEventListener('pointermove', (e) => {
        if (!active) return
        dx = e.clientX - startX
        dy = e.clientY - startY
        if (dx <= 0 || Math.abs(dx) < Math.abs(dy)) return
        const shift = Math.min(dx, 160)
        plView.style.transform = `translateX(${shift}px)`
        plView.style.opacity = String(Math.max(0.65, 1 - shift / 360))
      })
      const finishPlaylistSwipe = (e) => {
        if (!active) return
        active = false
        plView.releasePointerCapture?.(e.pointerId)
        const commit = dx > 96 && dx > Math.abs(dy)
        plView.style.transform = ''
        plView.style.opacity = ''
        if (commit) closePlaylistView()
      }
      plView.addEventListener('pointerup', finishPlaylistSwipe)
      plView.addEventListener('pointercancel', finishPlaylistSwipe)
    }

    const full = $('#full-player')
    const fullSheet = full?.querySelector('.full-player__sheet')
    if (full && fullSheet && !full.dataset.swipeBound) {
      full.dataset.swipeBound = '1'
      let active = false
      let startX = 0
      let startY = 0
      let dx = 0
      let dy = 0
      fullSheet.addEventListener('pointerdown', (e) => {
        if (full.hidden) return
        if (e.target.closest('button, input, .pick-playlist-list, #progress-row')) return
        active = true
        startX = e.clientX
        startY = e.clientY
        dx = 0
        dy = 0
        fullSheet.setPointerCapture?.(e.pointerId)
        full.classList.add('is-dragging')
      })
      fullSheet.addEventListener('pointermove', (e) => {
        if (!active) return
        dx = e.clientX - startX
        dy = e.clientY - startY
        if (dy <= 0 || Math.abs(dx) > 12) return
        if (Math.abs(dx) > dy * 0.45) return
        const shift = Math.min(dy, 280)
        fullSheet.style.transform = `translateY(${shift}px)`
        fullSheet.style.opacity = String(Math.max(0.55, 1 - shift / 480))
      })
      const finishFullSwipe = (e) => {
        if (!active) return
        active = false
        fullSheet.releasePointerCapture?.(e.pointerId)
        const commit = dy > 100 && dy > Math.abs(dx) * 1.2
        fullSheet.style.transform = ''
        fullSheet.style.opacity = ''
        full.classList.remove('is-dragging')
        if (commit) closeFullPlayer()
      }
      fullSheet.addEventListener('pointerup', finishFullSwipe)
      fullSheet.addEventListener('pointercancel', finishFullSwipe)
    }
  }

  function hideSetupGate() {
    const gate = $('#setup-gate')
    if (gate) gate.hidden = true
  }

  function showSetupGate() {
    const gate = $('#setup-gate')
    if (!gate) return
    gate.hidden = false
    renderSetupGateForm()
  }

  function renderSetupGateForm() {
    const s = Store.get()
    const g = (id, val) => { const el = $(id); if (el) el.value = val || '' }
    g('#gate-api-mode', s.apiMode || 'auto')
    g('#gate-gateway', s.gatewayUrl)
    g('#gate-secret', s.gatewaySecret)
    g('#gate-yandex', s.yandexToken)
    g('#gate-vk', s.vkToken)
  }

  function saveFromGate() {
    Store.patch({
      apiMode: $('#gate-api-mode')?.value || 'auto',
      gatewayUrl: $('#gate-gateway')?.value.trim().replace(/\/+$/, '') || '',
      gatewaySecret: $('#gate-secret')?.value.trim() || '',
      yandexToken: $('#gate-yandex')?.value.trim() || '',
      vkToken: $('#gate-vk')?.value.trim() || '',
    })
    renderSettingsForm()
  }

  function updateSetupGate() {
    const gate = $('#setup-gate')
    if (!gate) return
    const ok = Api.isConfigured()
    const skipped = sessionStorage.getItem('nexory_setup_skip') === '1'
    if (ok || skipped) {
      hideSetupGate()
    } else {
      showSetupGate()
    }
    updateGatewayBanner()
  }

  async function updateGatewayBanner() {
    const banner = $('#gateway-banner')
    if (!banner) return
    if (!Api.isConfigured()) {
      banner.hidden = false
      banner.innerHTML = 'Подключи Яндекс/VK или gateway на VPS.<br><button type="button" id="banner-settings">Настройки</button>'
      $('#banner-settings')?.addEventListener('click', () => showScreen('settings'), { once: true })
      return
    }
    if (!Api.hasGateway()) {
      banner.hidden = true
      return
    }
    try {
      await Api.health()
      banner.hidden = true
    } catch (e) {
      banner.hidden = false
      banner.innerHTML = `${esc(e.message)}<br><button type="button" id="banner-settings">Открыть настройки</button>`
      $('#banner-settings')?.addEventListener('click', () => showScreen('settings'), { once: true })
    }
  }


  function formatTrackCount(n) {
    if (!n) return '0 треков'
    const mod10 = n % 10
    const mod100 = n % 100
    if (mod10 === 1 && mod100 !== 11) return `${n} трек`
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} трека`
    return `${n} треков`
  }

  function formatListenDuration(sec) {
    const total = Math.max(0, Math.floor(Number(sec) || 0))
    const h = Math.floor(total / 3600)
    const m = Math.floor((total % 3600) / 60)
    if (h > 0) return `${h} ч ${m} м`
    if (m > 0) return `${m} м`
    return '0 м'
  }

  function renderHomeListenStats() {
    const s = Store.get()
    const tracksEl = $('#home-stats-tracks')
    const timeEl = $('#home-stats-time')
    const count = Math.max(0, Number(s.listenTrackCount) || 0)
    if (tracksEl) tracksEl.textContent = String(count)
    if (timeEl) timeEl.textContent = formatListenDuration(s.listenSeconds || 0)
  }

  function scHomeHintHtml() {
    return '<p class="empty-hint empty-hint--inline">Настройки → SoundCloud → «Найти Client ID»</p>'
  }

  async function loadHomeScRow({ key, elId, title, fetcher }) {
    const el = $(elId)
    if (!el || homeScLoading[key]) return
    if (!String(Store.get().scClientId || '').trim()) {
      el.innerHTML = scHomeHintHtml()
      return
    }
    if (homeScCache[key]?.length) {
      el.innerHTML = homeScCache[key].map(cardHtml).join('')
      bindTrackClicks(el, homeScCache[key], title)
      Icons.mount(el)
      setupScrollTitles(el)
      highlightPlayingTrack(Player.current())
      return
    }
    homeScLoading[key] = true
    el.innerHTML = '<p class="empty-hint empty-hint--inline">Загрузка…</p>'
    try {
      const tracks = (await fetcher()).slice(0, 20)
      homeScCache[key] = tracks
      if (!tracks.length) {
        el.innerHTML = '<p class="empty-hint empty-hint--inline">Нет треков</p>'
        return
      }
      el.innerHTML = tracks.map(cardHtml).join('')
      bindTrackClicks(el, tracks, title)
      Icons.mount(el)
      setupScrollTitles(el)
      highlightPlayingTrack(Player.current())
    } catch (e) {
      el.innerHTML = `<p class="empty-hint empty-hint--inline">${esc(String(e.message || e))}</p>`
    } finally {
      homeScLoading[key] = false
    }
  }

  function loadHomeSoundCloudSections() {
    return Promise.all([
      loadHomeScRow({
        key: 'popular-v2',
        elId: '#home-popular-scroll',
        title: 'Популярные треки',
        fetcher: () => Api.soundCloudCisPopular(20),
      }),
      loadHomeScRow({
        key: 'mixes-v2',
        elId: '#home-mixes-scroll',
        title: 'Миксы',
        fetcher: () => Api.soundCloudCisMixes(20),
      }),
    ])
  }

  function renderHome() {
    const s = Store.get()
    const recentCovers = $('#home-recent-covers')
    const recentCount = $('#home-recent-count')
    if (recentCount) recentCount.textContent = formatTrackCount(s.recent.length)
    if (recentCovers) {
      recentCovers.innerHTML = plaqueCoversHtml(s.recent, 'music-2')
      Icons.mount(recentCovers)
    }
    const likesCovers = $('#home-likes-covers')
    const likesCount = $('#home-likes-count')
    if (likesCount) likesCount.textContent = formatTrackCount(s.likes.length)
    if (likesCovers) {
      likesCovers.innerHTML = plaqueCoversHtml(s.likes, 'heart')
      Icons.mount(likesCovers)
    }
    renderWaveMoods()
    renderHomeListenStats()
    highlightPlayingTrack(Player.current())
  }

  function playlistCoverHtml(pl) {
    if (pl.coverData) {
      return `<img src="${esc(pl.coverData)}" alt="" loading="lazy" />`
    }
    const first = pl.tracks?.find((t) => t.cover)
    if (first?.cover) {
      return `<img src="${esc(first.cover)}" alt="" loading="lazy" />`
    }
    return '<span data-icon="library" data-icon-class="ui-icon"></span>'
  }

  function openPlaylistView(pl, opts = {}) {
    if (!pl) return
    openPlaylistId = pl.id
    const view = $('#playlist-view')
    const hero = $('#playlist-view-hero')
    const heroBg = $('#pl-view-hero-bg')
    const isLikes = opts.isLikes
    if (hero) {
      hero.classList.toggle('pl-view-hero--likes', !!isLikes)
      hero.classList.toggle('pl-view-hero--default', !isLikes && !pl.coverData && !pl.tracks?.find((t) => t.cover))
    }
    if (heroBg) {
      const cover = pl.coverData || pl.tracks?.find((t) => t.cover)?.cover || ''
      if (cover && !isLikes) {
        heroBg.style.backgroundImage = `url(${cover})`
        heroBg.style.backgroundPosition = 'center 22%'
        heroBg.style.backgroundSize = 'cover'
        heroBg.style.filter = 'none'
        heroBg.style.transform = 'scale(1.08)'
      } else {
        heroBg.style.backgroundImage = ''
        heroBg.style.backgroundPosition = ''
        heroBg.style.backgroundSize = ''
        heroBg.style.filter = ''
        heroBg.style.transform = ''
      }
    }
    $('#playlist-view-title').textContent = pl.name
    $('#playlist-view-count').textContent = formatTrackCount(pl.tracks.length)
    const editBtn = $('#playlist-view-edit')
    if (editBtn) editBtn.hidden = !!isLikes
    const tracksEl = $('#playlist-view-tracks')
    if (tracksEl) {
      tracksEl.innerHTML = pl.tracks.length
        ? pl.tracks.map((t, i) => playlistTrackRowHtml(t, i)).join('')
        : '<p class="empty-hint">Плейлист пуст</p>'
      bindTrackClicks(tracksEl, pl.tracks, pl.name)
      if (!isLikes && pl.id) bindPlaylistTrackLongPress(tracksEl, pl.id)
      highlightPlayingTrack(Player.current())
      setupScrollTitles(tracksEl)
    }
    if (view) {
      clearTimeout(playlistViewTimer)
      view.hidden = false
      view.classList.remove('is-closing')
      void view.offsetWidth
      view.classList.add('is-opening')
      playlistViewTimer = setTimeout(() => view.classList.remove('is-opening'), 520)
    }
    document.body.classList.add('playlist-open')
    syncShellLayout()
    Icons.mount(view)
  }

  function closePlaylistView() {
    const view = $('#playlist-view')
    if (!view || view.hidden) {
      openPlaylistId = null
      document.body.classList.remove('playlist-open')
      return
    }
    clearTimeout(playlistViewTimer)
    document.body.classList.remove('playlist-open')
    view.classList.remove('is-opening')
    view.classList.add('is-closing')
    playlistViewTimer = setTimeout(() => {
      openPlaylistId = null
      view.hidden = true
      view.classList.remove('is-closing')
      syncShellLayout()
    }, 380)
  }

  function renderLibrary() {
    const s = Store.get()
    const countEl = $('#likes-count')
    if (countEl) {
      const n = s.likes.length
      countEl.textContent = n ? `${n} ${n === 1 ? 'трек' : n < 5 ? 'трека' : 'треков'}` : 'Нет лайков'
    }
    const plEl = $('#library-playlists')
    if (!plEl) return
    if (!s.playlists.length) {
      plEl.innerHTML = '<div class="empty-hint">Создай плейлист или импортируй по ссылке</div>'
      return
    }
    plEl.innerHTML = s.playlists.map((p) => `
      <button type="button" class="playlist-card" data-pl-id="${esc(p.id)}">
        <div class="playlist-card__cover">${playlistCoverHtml(p)}</div>
        <div class="playlist-card__name">${esc(p.name)}</div>
        <div class="playlist-card__count">${p.tracks.length} треков</div>
      </button>
    `).join('')
    Icons.mount(plEl)
    bindPlaylistLongPress(plEl)
  }

  function compressCoverDataUrl(dataUrl, maxSide = 480, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxSide / img.width, maxSide / img.height)
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas недоступен'))
          return
        }
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = () => reject(new Error('Не удалось прочитать фото'))
      img.src = dataUrl
    })
  }

  function setPlaylistCoverPreview(coverData) {
    const prev = $('#playlist-cover-preview')
    if (!prev) return
    if (coverData) {
      prev.innerHTML = ''
      prev.style.backgroundImage = `url(${coverData})`
      prev.style.backgroundSize = 'cover'
      prev.style.backgroundPosition = 'center'
    } else {
      prev.innerHTML = Icons.svg('image', 'ui-icon lg')
      prev.style.backgroundImage = ''
      prev.style.backgroundSize = ''
      prev.style.backgroundPosition = ''
    }
  }

  function openPlaylistCreateSheet(open, editPl = null) {
    const sheet = $('#playlist-create-sheet')
    if (!sheet) return
    sheet.hidden = !open
    if (open) {
      editingPlaylistId = editPl?.id || null
      const titleEl = $('#playlist-sheet-title')
      const saveBtn = $('#playlist-create-save')
      if (titleEl) titleEl.textContent = editingPlaylistId ? 'Редактировать плейлист' : 'Новый плейлист'
      if (saveBtn) saveBtn.textContent = editingPlaylistId ? 'Сохранить' : 'Создать'
      pendingCoverData = editPl?.coverData || ''
      const nameEl = $('#playlist-create-name')
      if (nameEl) nameEl.value = editPl?.name || ''
      setPlaylistCoverPreview(pendingCoverData)
      setTimeout(() => nameEl?.focus(), 120)
    } else {
      editingPlaylistId = null
      pendingCoverData = ''
    }
  }

  function saveNewPlaylist() {
    const name = String($('#playlist-create-name')?.value || '').trim() || 'Мой плейлист'
    try {
      if (editingPlaylistId) {
        const patch = { name }
        if (pendingCoverData) patch.coverData = pendingCoverData
        Store.updatePlaylist(editingPlaylistId, patch)
        const updated = Store.getPlaylist(editingPlaylistId)
        if (openPlaylistId === editingPlaylistId && updated) openPlaylistView(updated)
        toast('Плейлист обновлён')
      } else {
        Store.addPlaylist(name, [], pendingCoverData)
        toast('Плейлист создан')
      }
      pendingCoverData = ''
      editingPlaylistId = null
      openPlaylistCreateSheet(false)
      renderLibrary()
    } catch (e) {
      toast(e.message || 'Не удалось сохранить')
    }
  }

  function parseFlowJsonLocal(raw) {
    try {
      const data = JSON.parse(raw)
      if (data?.format === 'flow-playlists-v1' && Array.isArray(data.playlists)) {
        return { playlists: data.playlists }
      }
      if (Array.isArray(data)) return { playlists: data }
      if (Array.isArray(data?.playlists)) return { playlists: data.playlists }
      if (Array.isArray(data?.tracks)) {
        return { playlists: [{ name: data.name || 'Импорт', tracks: data.tracks, coverData: data.coverData }] }
      }
    } catch (_) { /* not local json */ }
    return null
  }

  function migrateStoredTracks() {
    const s = Store.get()
    Store.patch({
      likes: Store.normalizeTracks(s.likes),
      recent: Store.normalizeTracks(s.recent),
      playlists: s.playlists.map((p) => ({
        ...p,
        tracks: Store.normalizeTracks(p.tracks),
      })),
    })
  }

  function detectImportSource(raw) {
    const t = String(raw || '').trim()
    if (!t) return null
    if (/^[\[{]/.test(t)) return 'json'
    const u = t.toLowerCase()
    if (u.includes('music.yandex') || u.includes('yandex.ru/playlists') || u.includes('yandex.ru/album') || u.includes('yandex.ru/playlist')) return 'yandex'
    if (u.includes('vk.com') || u.includes('vk.ru') || u.includes('m.vk.com')) return 'vk'
    if (u.includes('soundcloud.com')) return 'soundcloud'
    return null
  }

  function importSourceMeta(id) {
    return IMPORT_SOURCES[id] || IMPORT_SOURCES.yandex
  }

  function setImportHubLogo(sourceId) {
    const meta = importSourceMeta(sourceId || 'yandex')
    const img = $('#import-logo-from')
    if (img) img.src = meta.logo
    importState.source = sourceId || 'yandex'
  }

  function setImportStep(step) {
    importState.step = step
    const flow = $('#import-flow')
    if (!flow) return
    flow.querySelectorAll('.import-step').forEach((el) => {
      const on = el.dataset.importStep === step
      el.hidden = !on
      el.classList.toggle('import-step--active', on)
      el.classList.toggle('import-step--enter', on)
      if (on) {
        void el.offsetWidth
        el.classList.add('import-step--enter')
        setTimeout(() => el.classList.remove('import-step--enter'), 450)
      }
    })
  }

  function updateImportLinkUI() {
    const raw = String($('#import-link-input')?.value || '').trim()
    const src = detectImportSource(raw)
    const step = $('#import-step-link')
    const heroIdle = step?.querySelector('.import-link-hero__icon--idle')
    const heroLogo = $('#import-link-hero-logo')
    const heroImg = $('#import-link-hero-img')
    const badge = $('#import-link-badge')
    const badgeImg = $('#import-link-badge-img')
    const loadBtn = $('#import-btn-load')
    const meta = src ? importSourceMeta(src) : null

    if (src && meta) {
      importState.source = src
      step?.classList.add('import-step-link--detected')
      if (heroIdle) heroIdle.hidden = true
      if (heroLogo) heroLogo.hidden = false
      if (heroImg) heroImg.src = meta.logo
      if (badge) badge.hidden = false
      if (badgeImg) badgeImg.src = meta.logo
      setImportHubLogo(src)
      const fromBox = document.querySelector('.import-transfer__logo--from')
      if (fromBox) {
        fromBox.classList.remove('import-transfer__logo--pulse')
        void fromBox.offsetWidth
        fromBox.classList.add('import-transfer__logo--pulse')
      }
    } else {
      step?.classList.remove('import-step-link--detected')
      if (heroIdle) heroIdle.hidden = false
      if (heroLogo) heroLogo.hidden = true
      if (badge) badge.hidden = true
    }
    if (loadBtn) loadBtn.disabled = !raw || (!src && !/^https?:\/\//i.test(raw))
  }

  function renderImportDestinations() {
    const list = $('#import-dest-list')
    if (!list) return
    const s = Store.get()
    const sel = importState.destination
    const plOpts = s.playlists.map((p) => `
      <button type="button" class="import-dest-opt" data-dest="pl:${esc(p.id)}" role="radio" aria-checked="${sel === `pl:${p.id}`}">
        <span class="import-dest-opt__icon" data-icon="list-music" data-icon-class="ui-icon"></span>
        <span class="import-dest-opt__text">
          <span class="import-dest-opt__title pixel-text">${esc(p.name)}</span>
          <span class="import-dest-opt__hint">${p.tracks.length} треков</span>
        </span>
        <span class="import-dest-opt__mark">${sel === `pl:${p.id}` ? '<span data-icon="check" data-icon-class="ui-icon"></span>' : '<span data-icon="circle" data-icon-class="ui-icon"></span>'}</span>
      </button>
    `).join('')

    list.innerHTML = `
      <button type="button" class="import-dest-opt${sel === 'new' ? ' import-dest-opt--active' : ''}" data-dest="new" role="radio" aria-checked="${sel === 'new'}">
        <span class="import-dest-opt__icon" data-icon="plus" data-icon-class="ui-icon"></span>
        <span class="import-dest-opt__text">
          <span class="import-dest-opt__title pixel-text">Создать новый плейлист</span>
        </span>
        <span class="import-dest-opt__mark">${sel === 'new' ? '<span data-icon="check" data-icon-class="ui-icon"></span>' : '<span data-icon="circle" data-icon-class="ui-icon"></span>'}</span>
      </button>
      <button type="button" class="import-dest-opt${sel === 'likes' ? ' import-dest-opt--active' : ''}" data-dest="likes" role="radio" aria-checked="${sel === 'likes'}">
        <span class="import-dest-opt__icon import-dest-opt__icon--heart" data-icon="heart" data-icon-class="ui-icon"></span>
        <span class="import-dest-opt__text">
          <span class="import-dest-opt__title pixel-text">Любимые</span>
        </span>
        <span class="import-dest-opt__mark">${sel === 'likes' ? '<span data-icon="check" data-icon-class="ui-icon"></span>' : '<span data-icon="circle" data-icon-class="ui-icon"></span>'}</span>
      </button>
      ${s.playlists.length ? '<p class="import-dest-section pixel-text">Добавить в существующий</p>' : ''}
      ${plOpts}
    `
    Icons.mount(list)
  }

  function showImportDestStep(preview) {
    importState.preview = preview
    importState.destination = 'new'
    const cover = $('#import-dest-cover-img')
    const ph = $('#import-dest-cover')?.querySelector('.import-dest-cover__ph')
    const title = $('#import-dest-title')
    const count = $('#import-dest-count')
    if (title) title.textContent = preview.name || 'Плейлист'
    if (count) count.textContent = formatTrackCount(preview.tracks?.length || 0)
    if (preview.coverData && cover) {
      cover.src = preview.coverData
      cover.hidden = false
      if (ph) ph.hidden = true
    } else {
      if (cover) { cover.hidden = true; cover.removeAttribute('src') }
      if (ph) ph.hidden = false
      Icons.mount($('#import-dest-cover'))
    }
    renderImportDestinations()
    setImportStep('dest')
  }

  function assertImportLink(raw) {
    const t = String(raw || '').trim()
    const src = detectImportSource(t)
    if (!src || src === 'json') return
    if (/^https?:\/\/((music\.)?yandex\.|yandex\.ru)\/?$/i.test(t)) {
      throw new Error('Вставь полную ссылку на плейлист (не главную страницу)')
    }
    if (src === 'yandex' && DirectApi.parseYandexLink) {
      const ref = DirectApi.parseYandexLink(t)
      if (!ref?.playlist && !ref?.albumId) {
        throw new Error('Не распознан плейлист Яндекса — открой плейлист → Поделиться → скопируй ссылку')
      }
    }
  }

  async function fetchImportPreview(raw) {
    const isJson = /^[\[{]/.test(raw)
    if (isJson) {
      const local = parseFlowJsonLocal(raw)
      if (!local?.playlists?.length) throw new Error('Не распознан JSON плейлистов')
      const pl = local.playlists[0]
      let allFailed = []
      showImportProgress(0, pl.tracks.length, `Проверка «${pl.name}»…`)
      const { ok, failed } = await validatePlaylistTracks(pl.tracks, (d, t) => {
        showImportProgress(d, t, `Проверка ${d}/${t}`)
      })
      allFailed = failed
      importState.failed = allFailed
      renderImportFailures(allFailed)
      return {
        name: pl.name,
        tracks: ok,
        coverData: pl.coverData || '',
        multi: local.playlists.length > 1 ? local.playlists : null,
      }
    }
    let out
    try {
      out = await Api.importPlaylist(isJson ? { json: raw } : { url: raw })
    } catch (e) {
      const msg = String(e?.message || e)
      if (/load failed|сеть/i.test(msg) && Api.hasGateway?.()) {
        throw new Error(`${msg}. Проверь Gateway URL/Secret в настройках`)
      }
      throw e
    }
    if (!out.ok) throw new Error(out.error || 'Импорт не удался')
    if (Array.isArray(out.playlists)) {
      const pl = out.playlists[0]
      showImportProgress(0, pl.tracks?.length || 0, `Проверка «${pl.name}»…`)
      const { ok, failed } = await validatePlaylistTracks(pl.tracks || [], (d, t) => {
        showImportProgress(d, t, `Проверка ${d}/${t}`)
      })
      importState.failed = failed
      renderImportFailures(failed)
      return {
        name: pl.name,
        tracks: ok,
        coverData: pl.coverData || pl.cover || '',
        multi: out.playlists.length > 1 ? out.playlists : null,
      }
    }
    const tracks = out.tracks || []
    if (out.service === 'yandex' && tracks.length) {
      const norm = Store.normalizeTracks(tracks)
      importState.failed = []
      return {
        name: out.name || 'Импорт',
        tracks: norm,
        coverData: out.coverData || out.cover || '',
        multi: null,
      }
    }
    showImportProgress(0, tracks.length, 'Проверка треков…')
    const { ok, failed } = await validatePlaylistTracks(tracks, (d, t) => {
      showImportProgress(d, t, `Проверка ${d}/${t}`)
    })
    importState.failed = failed
    renderImportFailures(failed)
    return {
      name: out.name || 'Импорт',
      tracks: ok,
      coverData: out.coverData || out.cover || '',
      multi: null,
    }
  }

  async function confirmImportDestination() {
    const preview = importState.preview
    if (!preview?.tracks?.length) return toast('Нет треков для импорта')
    const dest = importState.destination
    const failed = importState.failed || []
    if (preview.multi && dest === 'new') {
      let allFailed = []
      for (const pl of preview.multi) {
        showImportProgress(0, pl.tracks.length, `Проверка «${pl.name}»…`)
        const { ok, failed: f } = await validatePlaylistTracks(pl.tracks, (d, t) => {
          showImportProgress(d, t, `Проверка ${d}/${t}`)
        })
        pl.tracks = ok
        allFailed = allFailed.concat(f)
      }
      Store.importPlaylists(preview.multi.map((pl) => ({
        name: pl.name,
        tracks: pl.tracks,
        coverData: pl.coverData || '',
      })))
      toast(allFailed.length ? `Импорт: ${preview.multi.length} пл., ${allFailed.length} без потока` : `Импортировано: ${preview.multi.length} плейлистов`)
    } else if (dest === 'likes') {
      Store.mergeLikes(preview.tracks)
      toast(failed.length ? `В любимые: ${preview.tracks.length}, ${failed.length} без потока` : `Добавлено в любимые: ${preview.tracks.length}`)
    } else if (dest.startsWith('pl:')) {
      const id = dest.slice(3)
      const pl = Store.getPlaylist(id)
      if (!pl) return toast('Плейлист не найден')
      const merged = [...pl.tracks]
      for (const t of preview.tracks) {
        const k = Store.trackKey(t)
        if (!merged.some((x) => Store.trackKey(x) === k)) merged.push(t)
      }
      Store.setPlaylistTracks(id, merged)
      toast(`Добавлено в «${pl.name}»: ${preview.tracks.length}`)
    } else {
      Store.addPlaylist(preview.name, preview.tracks, preview.coverData || '')
      toast(failed.length ? `«${preview.name}»: ${preview.tracks.length}, ${failed.length} без потока` : `Создан «${preview.name}»`)
    }
    closeImportFlow()
    renderLibrary()
    renderHome()
  }

  function openImportFlow() {
    const flow = $('#import-flow')
    if (!flow) return
    importState = { step: 'hub', source: 'yandex', preview: null, destination: 'new', failed: [] }
    hideImportProgress()
    const input = $('#import-link-input')
    if (input) input.value = ''
    setImportHubLogo('yandex')
    updateImportLinkUI()
    flow.hidden = false
    document.body.classList.add('import-flow-open')
    setImportStep('hub')
    Icons.mount(flow)
  }

  function closeImportFlow() {
    const flow = $('#import-flow')
    if (flow) flow.hidden = true
    document.body.classList.remove('import-flow-open')
    hideImportProgress()
    importState.preview = null
  }

  function openImportSheet(open) {
    if (open) openImportFlow()
    else closeImportFlow()
  }

  async function runImportLoad() {
    const raw = String($('#import-link-input')?.value || '').trim()
    if (!raw) return toast('Вставь ссылку')
    const hasYm = Boolean(String(Store.get().yandexToken || '').trim())
    if (!Api.isConfigured() && !hasYm) {
      toast('Добавь токен Яндекса или Gateway в настройках')
      showSetupGate()
      return
    }
    hideImportProgress()
    const btn = $('#import-btn-load')
    if (btn) btn.disabled = true
    try {
      assertImportLink(raw)
      const preview = await fetchImportPreview(raw)
      showImportDestStep(preview)
    } catch (e) {
      toast(e.message || 'Не удалось загрузить')
    } finally {
      if (btn) btn.disabled = false
    }
  }

  function handleImportFile(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      const raw = String(reader.result || '')
      $('#import-link-input').value = raw.slice(0, 120)
      importState.source = 'json'
      updateImportLinkUI()
      setImportStep('link')
      if (!Api.isConfigured()) {
        toast('Сначала настрой сервер')
        return
      }
      hideImportProgress()
      try {
        const preview = await fetchImportPreview(raw)
        showImportDestStep(preview)
      } catch (e) {
        toast(e.message || 'Не удалось прочитать файл')
      }
    }
    reader.readAsText(file)
  }

  function renderSettingsForm() {
    const s = Store.get()
    const modeEl = $('#cfg-api-mode')
    if (modeEl) modeEl.value = s.apiMode || 'auto'
    $('#cfg-gateway').value = s.gatewayUrl || ''
    $('#cfg-secret').value = s.gatewaySecret || ''
    $('#cfg-accent-cover').checked = !!s.accentFromCover
    renderThemeCards()
    const preview = $('#player-cover-preview')
    const ph = preview?.querySelector('.player-cover-preview__ph')
    if (preview) {
      if (s.playerCoverOverride) {
        preview.style.backgroundImage = `url(${s.playerCoverOverride})`
        preview.classList.add('has-image')
        if (ph) ph.hidden = true
      } else {
        preview.style.backgroundImage = ''
        preview.classList.remove('has-image')
        if (ph) {
          ph.hidden = false
          Icons.mount(ph)
        }
      }
    }
    updateServiceStates()
    Theme.apply(s)
  }

  function updateServiceStates() {
    const s = Store.get()
    const y = $('#svc-yandex-state')
    const v = $('#svc-vk-state')
    const sc = $('#svc-sc-state')
    if (y) y.textContent = s.yandexToken ? 'Подключено' : 'Не настроено'
    if (v) v.textContent = s.vkToken ? 'Подключено' : 'Не настроено'
    if (sc) sc.textContent = (s.scAccessToken || s.scClientId) ? 'Настроено' : 'Опционально'
  }

  function showSettingsPane(name) {
    document.querySelectorAll('.settings-switch__btn').forEach((b) => {
      b.classList.toggle('settings-switch__btn--active', b.dataset.settingsPane === name)
    })
    $('#settings-custom').hidden = name !== 'custom'
    $('#settings-services').hidden = name !== 'services'
  }

  function openServiceSheet(id) {
    const meta = SERVICE_META[id]
    if (!meta) return
    openServiceId = id
    tokenVisible = false
    const sheet = $('#service-sheet')
    const logo = $('#service-sheet-logo')
    const input = $('#service-token-input')
    const label = $('#service-token-label')
    const help = $('#service-token-help')
    const helpText = $('#service-token-help-text')
    const status = $('#service-token-status')
    const scFields = $('#service-sc-fields')
    const scCid = $('#service-sc-client-id')
    const scSec = $('#service-sc-client-secret')
    const tokenField = $('#service-token-field')
    const tokenEye = $('#service-token-eye')
    const isSc = id === 'soundcloud'
    if (logo) logo.src = meta.logo
    if (scFields) scFields.hidden = !isSc
    if (tokenField) tokenField.hidden = isSc
    if (tokenEye) tokenEye.hidden = isSc
    if (input) {
      input.type = 'password'
      const s = Store.get()
      if (isSc) {
        if (scCid) scCid.value = s.scClientId || ''
        if (scSec) scSec.value = s.scClientSecret || ''
        input.value = ''
      } else {
        input.value = s[meta.storeKey] || ''
        if (label) label.textContent = 'Access Token'
      }
    }
    const scAutoBtn = $('#service-sc-autoid')
    const scOAuthBtn = $('#service-sc-oauth')
    if (scAutoBtn) scAutoBtn.hidden = !isSc
    if (scOAuthBtn) scOAuthBtn.hidden = true
    if (help) help.hidden = isSc || !meta.helpUrl
    if (!isSc && help && meta.helpUrl) {
      help.href = meta.helpUrl
      if (helpText) helpText.textContent = meta.helpText
    }
    if (status) status.textContent = ''
    if (sheet) sheet.hidden = false
    Icons.mount(sheet)
  }

  async function handleOAuthRedirect(url) {
    const parsed = Bridge.parseSoundCloudRedirect(url)
    if (!parsed) return
    openServiceId = 'soundcloud'
    const status = $('#service-token-status')
    const input = $('#service-token-input')
    if (parsed.error) {
      if (status) status.textContent = `OAuth: ${parsed.error}`
      return
    }
    if (!parsed.code) return
    if (input) input.value = `nexory://oauth/soundcloud?code=${parsed.code}`
    if (status) status.textContent = 'Код получен, обмениваем…'
    try {
      const r = await Api.validateSoundCloud(input?.value || parsed.code)
      if (r.ok) {
        Store.patch({
          scClientId: r.scClientId || $('#service-sc-client-id')?.value?.trim() || '',
          scClientSecret: $('#service-sc-client-secret')?.value?.trim() || Store.get().scClientSecret || '',
          scAccessToken: r.scAccessToken || '',
        })
        if (status) status.textContent = r.username ? `✓ ${r.username}` : '✓ SoundCloud'
        toast('SoundCloud подключён')
        updateServiceStates()
        renderHome()
        resetHomeScCache()
        loadHomeSoundCloudSections()
      } else if (status) {
        status.textContent = r.error || 'Ошибка OAuth'
      }
    } catch (e) {
      if (status) status.textContent = e.message
    }
  }

  function closeServiceSheet() {
    openServiceId = null
    tokenVisible = false
    const sheet = $('#service-sheet')
    if (sheet) sheet.hidden = true
  }

  function saveGatewayFromForm() {
    const s = Store.get()
    const urlRaw = String($('#cfg-gateway')?.value || s.gatewayUrl || '').trim().replace(/\/+$/, '')
    const secretRaw = String($('#cfg-secret')?.value ?? s.gatewaySecret ?? '').trim()
    Store.patch({
      apiMode: $('#cfg-api-mode')?.value || 'auto',
      gatewayUrl: urlRaw,
      gatewaySecret: secretRaw,
    })
    const gUrl = $('#cfg-gateway')
    const gSec = $('#cfg-secret')
    if (gUrl) gUrl.value = urlRaw
    if (gSec) gSec.value = secretRaw
    updateSetupGate()
  }

  function saveCustomization(patch) {
    const next = Store.patch(patch)
    Theme.apply(next)
    const track = Player.current()
    if (track) applyPlayerVisuals(track)
  }

  function updatePlayerUI(track) {
    if (!track) return
    const from = Player.playingFrom()
    $('#mini-player').hidden = false
    syncShellLayout()
    $('#mini-title').textContent = track.title
    $('#mini-artist').textContent = track.artist
    setCover($('#mini-cover-wrap'), $('#mini-cover'), track, { playerOnly: true })
    setupMarqueeTitle(track.title)
    setupScrollTitles($('.mini-title-wrap'))
    $('#full-artist').textContent = track.artist
    $('#full-from').textContent = from || 'Nexory'
    $('#full-like').classList.toggle('is-active', Store.isLiked(track))
    setCover($('#full-cover-wrap'), null, track, { playerOnly: true, crossfade: true })
    applyPlayerVisuals(track)
    const fpMeta = $('#fp-cover-block .fp-meta')
    if (fpMeta) {
      fpMeta.classList.remove('is-fading')
      void fpMeta.offsetWidth
      fpMeta.classList.add('is-fading')
      window.setTimeout(() => fpMeta.classList.remove('is-fading'), 480)
    }
    if (Store.get().accentFromCover) {
      const accentUrl = getPlayerBgUrl(track) || getPlayerCoverUrl(track)
      const coverImg = activeFullCoverEl()
      const tryRedraw = () => {
        const d = Player.audio?.duration || 0
        if (d > 0) Player.drawWaveform((Player.audio?.currentTime || 0) / d)
      }
      if (accentUrl) {
        Theme.extractAccentFromUrl(accentUrl).then(tryRedraw)
      } else if (coverImg && !coverImg.hidden) {
        Theme.extractAccentFromElement(coverImg)
        tryRedraw()
      }
    }
    highlightPlayingTrack(track)
  }

  function setPlayIcon(paused) {
    const icon = paused ? 'play' : 'pause'
    const mini = $('#mini-play')
    if (mini) {
      mini.dataset.icon = icon
      mini.innerHTML = Icons.svg(icon, 'ui-icon')
    }
    const from = Player.playingFrom() || ''
    const isWave = from.includes('волна') || from.includes('Моя волна')
    const wavePlay = $('#wave-play-btn')
    if (wavePlay) {
      const waveIcon = isWave ? icon : 'play'
      wavePlay.dataset.icon = waveIcon
      wavePlay.innerHTML = Icons.svg(waveIcon, 'ui-icon')
    }
    const full = $('#full-play')
    if (full) {
      full.dataset.icon = icon
      full.innerHTML = Icons.svg(icon, 'ui-icon lg')
    }
    highlightPlayingTrack(Player.current())
  }

  async function runSearch(q) {
    const status = $('#search-status')
    const results = $('#search-results')
    if (!q.trim()) { status.textContent = ''; results.innerHTML = ''; return }
    if (!Api.isConfigured()) { status.textContent = 'Подключи сервисы в настройках'; return }
    status.textContent = 'Ищем…'
    try {
      const out = await Api.search(q.trim(), searchSource)
      const tracks = out.tracks || []
      status.textContent = tracks.length ? `${tracks.length} результатов` : out.error || 'Пусто'
      results.innerHTML = tracks.map((t, i) => trackRowHtml(t, i)).join('')
      bindTrackClicks(results, tracks, `Поиск · ${Player.sourceLabel(searchSource)}`)
      setupScrollTitles(results)
    } catch (e) {
      status.textContent = e.message
      results.innerHTML = ''
    }
  }

  function wireTrackTapPlay() {
    const TAP_MOVE_PX = 14
    const resetTap = () => {
      trackTap.active = false
      trackTap.moved = false
      trackTap.el = null
      trackTap.container = null
      trackTap.key = null
    }
    document.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return
      const el = e.target.closest('.track-row, .card-tile, .strip-tile, .pl-track-row')
      if (!el?.dataset.key) return
      const container = el.closest('[data-track-list]')
      if (!container) return
      trackTap.active = true
      trackTap.moved = false
      trackTap.x = e.clientX
      trackTap.y = e.clientY
      trackTap.el = el
      trackTap.container = container
      trackTap.key = el.dataset.key
    }, { capture: true })
    document.addEventListener('pointermove', (e) => {
      if (!trackTap.active || trackTap.moved) return
      if (Math.hypot(e.clientX - trackTap.x, e.clientY - trackTap.y) > TAP_MOVE_PX) {
        trackTap.moved = true
      }
    }, { capture: true })
    document.addEventListener('pointerup', (e) => {
      if (!trackTap.active) return
      const { moved, el, container, key } = trackTap
      resetTap()
      if (moved || !el || !container || !key) return
      e.preventDefault()
      playFromList(container, key, el)
    }, { capture: true })
    document.addEventListener('pointercancel', resetTap, { capture: true })
  }

  function wireEvents() {
    wireTrackTapPlay()

    document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => showScreen(t.dataset.tab)))
    document.querySelectorAll('[data-goto]').forEach((b) => b.addEventListener('click', () => showScreen(b.dataset.goto)))
    $('#btn-search-open')?.addEventListener('click', () => showScreen('search'))

    $('#gate-test')?.addEventListener('click', async () => {
      const el = $('#gate-status')
      if (el) el.textContent = 'Проверяем…'
      const ok = await testServerConnection(el)
      if (ok && el) el.textContent = '✓ Сервер доступен'
    })

    $('#gate-save')?.addEventListener('click', async () => {
      saveFromGate()
      if (!Api.isConfigured()) {
        toast('Укажи токены Яндекс/VK или gateway на VPS')
        return
      }
      hideSetupGate()
      updateSetupGate()
      toast('Сохранено')
      showScreen('home')
      renderHome()
      updateGatewayBanner()
    })

    $('#gate-skip')?.addEventListener('click', () => {
      sessionStorage.setItem('nexory_setup_skip', '1')
      hideSetupGate()
      showScreen('home')
      toast('Без токенов музыка не заработает')
    })

    $('#wave-moods')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-wave-mood]')
      if (!btn) return
      setWaveMood(btn.dataset.waveMood)
    })

    $('#btn-wave-play')?.addEventListener('click', async () => {
      const row = $('#btn-wave-play')
      if (busy) return
      Player.primeAudio()
      try {
        if (!Api.isConfigured()) throw new Error('Настрой сервер и токены')
        if (!Store.get().yandexToken) throw new Error('Добавь Яндекс OAuth')
        busy = true
        row?.classList.add('is-busy')
        toast('Запускаем волну…')
        await Player.startWave()
      } catch (e) {
        toast(e.message || 'Ошибка волны')
      } finally {
        busy = false
        row?.classList.remove('is-busy')
      }
    })

    $('#playlist-view-edit')?.addEventListener('click', () => {
      const pl = Store.getPlaylist(openPlaylistId)
      if (pl) openPlaylistCreateSheet(true, pl)
    })

    $('#track-action-remove')?.addEventListener('click', () => {
      const plId = trackActionPlaylistId
      const key = trackActionKey
      if (!plId || !key) return
      Store.removeTrackFromPlaylist(plId, key)
      closeTrackActionsSheet()
      const pl = Store.getPlaylist(plId)
      if (pl && openPlaylistId === plId) openPlaylistView(pl)
      renderLibrary()
      toast('Трек удалён')
    })
    $('#track-actions-close')?.addEventListener('click', () => closeTrackActionsSheet())
    $('#track-actions-cancel')?.addEventListener('click', () => closeTrackActionsSheet())

    $('#btn-open-likes')?.addEventListener('click', () => {
      const s = Store.get()
      openPlaylistView({ id: '__likes', name: 'Любимые', tracks: s.likes }, { isLikes: true })
    })

    $('#btn-home-recent')?.addEventListener('click', () => {
      openRecentSheet(true)
    })
    $('#recent-sheet-close')?.addEventListener('click', () => openRecentSheet(false))

    $('#btn-home-likes-play')?.addEventListener('click', async () => {
      const likes = Store.get().likes
      if (!likes.length) {
        toast('Добавь треки в любимые')
        return
      }
      if (busy) return
      Player.primeAudio()
      if (!Api.isConfigured()) {
        toast('Сначала настрой gateway')
        showSetupGate()
        return
      }
      busy = true
      toast('Включаем любимые…')
      try {
        await Player.playQueue(likes, 0, 'Любимые')
      } catch (e) {
        toast(e.message || 'Ошибка воспроизведения')
      } finally {
        busy = false
      }
    })

    $('#library-playlists')?.addEventListener('click', (e) => {
      const card = e.target.closest('[data-pl-id]')
      if (!card) return
      if (plLongPressHandled) return
      const pl = Store.getPlaylist(card.dataset.plId)
      if (pl) openPlaylistView(pl)
    })

    $('#btn-import-open')?.addEventListener('click', () => openImportFlow())
    $('#import-flow-close')?.addEventListener('click', () => closeImportFlow())
    $('#import-link-back')?.addEventListener('click', () => setImportStep('hub'))
    $('#import-dest-back')?.addEventListener('click', () => setImportStep('link'))
    $('#import-btn-link-step')?.addEventListener('click', () => setImportStep('link'))
    $('#import-btn-profile')?.addEventListener('click', () => toast('Импорт профиля — скоро'))
    $('#import-link-input')?.addEventListener('input', updateImportLinkUI)
    $('#import-link-input')?.addEventListener('paste', () => {
      requestAnimationFrame(updateImportLinkUI)
    })
    $('#import-btn-load')?.addEventListener('click', () => runImportLoad())
    $('#import-btn-file')?.addEventListener('click', () => $('#import-file-input')?.click())
    $('#import-file-input')?.addEventListener('change', (e) => {
      handleImportFile(e.target.files?.[0])
      e.target.value = ''
    })
    $('#import-btn-confirm')?.addEventListener('click', () => confirmImportDestination())
    $('#import-dest-list')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-dest]')
      if (!btn) return
      importState.destination = btn.dataset.dest
      renderImportDestinations()
    })

    $('#playlist-view-back')?.addEventListener('click', () => closePlaylistView())

    $('#playlist-actions-close')?.addEventListener('click', () => closePlaylistActionsSheet())
    $('#pl-action-play')?.addEventListener('click', () => playActionsPlaylist(false))
    $('#pl-action-shuffle')?.addEventListener('click', () => playActionsPlaylist(true))
    $('#pl-action-wave')?.addEventListener('click', async () => {
      const pl = getActionsPlaylist()
      if (!pl?.tracks?.length) return toast('Плейлист пуст')
      closePlaylistActionsSheet()
      toast('Волна по плейлисту скоро')
    })
    $('#pl-action-edit')?.addEventListener('click', () => {
      const pl = getActionsPlaylist()
      if (!pl) return
      closePlaylistActionsSheet()
      openPlaylistCreateSheet(true, pl)
    })
    $('#pl-action-delete')?.addEventListener('click', () => {
      const pl = getActionsPlaylist()
      if (!pl) return
      Store.deletePlaylist(pl.id)
      closePlaylistActionsSheet()
      if (openPlaylistId === pl.id) closePlaylistView()
      renderLibrary()
      toast('Плейлист удалён')
    })

    $('#playlist-view-play')?.addEventListener('click', async () => {
      const pl = openPlaylistId === '__likes'
        ? { name: 'Любимые', tracks: Store.get().likes }
        : Store.getPlaylist(openPlaylistId)
      if (!pl?.tracks?.length) return toast('Плейлист пуст')
      Player.primeAudio()
      try {
        await Player.playQueue(pl.tracks, 0, pl.name)
      } catch (e) {
        toast(e.message)
      }
    })
    $('#playlist-view-shuffle')?.addEventListener('click', async () => {
      const pl = openPlaylistId === '__likes'
        ? { name: 'Любимые', tracks: Store.get().likes }
        : Store.getPlaylist(openPlaylistId)
      if (!pl?.tracks?.length) return toast('Плейлист пуст')
      const shuffled = pl.tracks.slice().sort(() => Math.random() - 0.5)
      try {
        await Player.playQueue(shuffled, 0, `${pl.name} · shuffle`, { shuffle: true })
      } catch (e) {
        toast(e.message)
      }
    })

    let searchDebounce
    $('#search-input')?.addEventListener('input', (e) => {
      $('#search-clear').hidden = !e.target.value
      clearTimeout(searchDebounce)
      searchDebounce = setTimeout(() => runSearch(e.target.value), 400)
    })
    $('#search-clear')?.addEventListener('click', () => {
      $('#search-input').value = ''
      $('#search-clear').hidden = true
      runSearch('')
    })
    $('#search-source-btn')?.addEventListener('click', openSearchSourceSheet)
    $('#search-source-picker')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-source]')
      if (!btn) return
      setSearchSource(btn.dataset.source)
    })
    $('#search-source-backdrop')?.addEventListener('click', closeSearchSourceSheet)
    $('#search-source-cancel')?.addEventListener('click', closeSearchSourceSheet)

    document.querySelectorAll('[data-settings-pane]').forEach((btn) => {
      btn.addEventListener('click', () => showSettingsPane(btn.dataset.settingsPane))
    })

    $('#theme-grid')?.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-theme]')
      if (!chip) return
      saveCustomization({ theme: chip.dataset.theme })
      renderSettingsForm()
    })

    $('#cfg-accent-cover')?.addEventListener('change', (e) => {
      saveCustomization({ accentFromCover: e.target.checked })
      const track = Player.current()
      if (e.target.checked && track) {
        const accentUrl = getPlayerBgUrl(track) || getPlayerCoverUrl(track)
        if (accentUrl) Theme.extractAccentFromUrl(accentUrl)
      } else {
        Theme.apply(Store.get())
      }
    })

    $('#cfg-player-cover-pick')?.addEventListener('click', () => $('#player-cover-input')?.click())
    $('#cfg-player-cover-clear')?.addEventListener('click', () => {
      saveCustomization({ playerCoverOverride: '' })
      renderSettingsForm()
      const track = Player.current()
      if (track) updatePlayerUI(track)
      toast('Обложка сброшена')
    })

    $('#player-cover-input')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        saveCustomization({ playerCoverOverride: String(reader.result || '') })
        renderSettingsForm()
        const track = Player.current()
        if (track) updatePlayerUI(track)
        toast('Обложка обновлена')
      }
      reader.readAsDataURL(file)
      e.target.value = ''
    })

    document.querySelectorAll('[data-service-open]').forEach((btn) => {
      btn.addEventListener('click', () => openServiceSheet(btn.dataset.serviceOpen))
    })

    $('#service-sheet-hide')?.addEventListener('click', closeServiceSheet)
    $('#service-sheet-back')?.addEventListener('click', closeServiceSheet)

    $('#service-token-eye')?.addEventListener('click', () => {
      const input = $('#service-token-input')
      if (!input) return
      tokenVisible = !tokenVisible
      input.type = tokenVisible ? 'text' : 'password'
      const eye = $('#service-token-eye')
      if (eye) {
        eye.dataset.icon = tokenVisible ? 'eye-off' : 'eye'
        eye.innerHTML = Icons.svg(eye.dataset.icon, 'ui-icon')
      }
    })

    $('#service-token-clear')?.addEventListener('click', () => {
      const meta = SERVICE_META[openServiceId]
      if (!meta) return
      if (openServiceId === 'soundcloud') {
        Store.patch({ scClientId: '', scClientSecret: '', scAccessToken: '' })
        const scCid = $('#service-sc-client-id')
        const scSec = $('#service-sc-client-secret')
        if (scCid) scCid.value = ''
        if (scSec) scSec.value = ''
      } else {
        Store.patch({ [meta.storeKey]: '' })
      }
      const input = $('#service-token-input')
      if (input) input.value = ''
      $('#service-token-status').textContent = 'Очищено'
      updateServiceStates()
      renderHome()
      if (openServiceId === 'soundcloud') {
        resetHomeScCache()
        loadHomeSoundCloudSections()
      }
      updateGatewayBanner()
    })

    $('#service-sc-autoid')?.addEventListener('click', async () => {
      const status = $('#service-token-status')
      const scCid = $('#service-sc-client-id')
      if (status) status.textContent = 'Ищем Client ID…'
      try {
        const r = await Api.discoverSoundCloudClientId()
        if (r.ok && r.clientId) {
          Store.patch({ scClientId: r.clientId })
          if (scCid) scCid.value = r.clientId
          if (status) status.textContent = '✓ Client ID найден'
          toast('SoundCloud Client ID подставлен')
          updateServiceStates()
          renderHome()
          resetHomeScCache()
          loadHomeSoundCloudSections()
        } else if (status) {
          status.textContent = r.error || 'Не найден'
        }
      } catch (e) {
        if (status) status.textContent = e.message
      }
    })

    $('#service-sc-oauth')?.addEventListener('click', async () => {
      const status = $('#service-token-status')
      const scCid = $('#service-sc-client-id')
      const scSec = $('#service-sc-client-secret')
      const cid = scCid?.value?.trim() || ''
      const sec = scSec?.value?.trim() || ''
      if (!cid) {
        toast('Сначала укажи Client ID')
        scCid?.focus()
        return
      }
      Store.patch({ scClientId: cid, scClientSecret: sec })
      try {
        if (status) status.textContent = 'Открываем авторизацию…'
        const url = await Api.prepareSoundCloudOAuth()
        await Bridge.openUrl(url)
        if (status) status.textContent = 'После входа вернись в Nexory — токен подставится сам'
      } catch (e) {
        if (status) status.textContent = e.message
      }
    })

    $('#service-token-save')?.addEventListener('click', async () => {
      const meta = SERVICE_META[openServiceId]
      if (!meta) return
      const token = $('#service-token-input').value.trim()
      saveGatewayFromForm()
      const status = $('#service-token-status')
      if (openServiceId === 'soundcloud') {
        const scCid = $('#service-sc-client-id')?.value?.trim() || Store.get().scClientId || ''
        if (!scCid) {
          status.textContent = 'Сначала «Найти Client ID»'
          return
        }
        status.textContent = 'Проверяем…'
        try {
          const r = await Api.validateSoundCloud(scCid)
          if (r.ok) {
            Store.patch({ scClientId: r.scClientId || scCid, scAccessToken: r.scAccessToken || '' })
            status.textContent = r.username ? `✓ ${r.username}` : '✓ SoundCloud'
          } else {
            status.textContent = r.error || 'Ошибка'
          }
          updateServiceStates()
          renderHome()
          resetHomeScCache()
          loadHomeSoundCloudSections()
          updateGatewayBanner()
          toast('Сохранено')
        } catch (e) {
          status.textContent = e.message
        }
        return
      }
      if (!token && !meta.optional) {
        status.textContent = 'Введи токен'
        return
      }
      if (!token && meta.optional) {
        Store.patch({ [meta.storeKey]: '' })
        status.textContent = 'Сохранено'
        updateServiceStates()
        toast('Сохранено')
        return
      }
      status.textContent = 'Проверяем…'
      try {
        if (openServiceId === 'yandex') {
          Store.patch({ [meta.storeKey]: token })
          const r = await Api.validateYandex(token)
          status.textContent = r.ok ? `✓ ${r.login || 'OK'}` : r.error
        } else if (openServiceId === 'vk') {
          Store.patch({ [meta.storeKey]: token })
          const r = await Api.validateVk(token)
          status.textContent = r.ok ? `✓ ${r.name || r.userId}` : r.error
        } else {
          Store.patch({ [meta.storeKey]: token })
          status.textContent = '✓ Сохранено'
        }
        updateServiceStates()
        renderHome()
        if (openServiceId === 'soundcloud') {
          resetHomeScCache()
          loadHomeSoundCloudSections()
        }
        updateGatewayBanner()
        toast('Сохранено')
      } catch (e) {
        status.textContent = e.message
      }
    })

    $('#btn-test-gateway')?.addEventListener('click', () => testServerConnection())

    $('#cfg-api-mode')?.addEventListener('change', saveGatewayFromForm)

    $('#btn-create-playlist')?.addEventListener('click', () => openPlaylistCreateSheet(true))
    $('#playlist-create-close')?.addEventListener('click', () => openPlaylistCreateSheet(false))
    $('#playlist-create-cancel')?.addEventListener('click', () => openPlaylistCreateSheet(false))
    $('#playlist-create-save')?.addEventListener('click', () => saveNewPlaylist())
    $('#playlist-cover-pick')?.addEventListener('click', () => $('#playlist-cover-input')?.click())
    $('#playlist-cover-input')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = async () => {
        try {
          pendingCoverData = await compressCoverDataUrl(String(reader.result || ''))
          setPlaylistCoverPreview(pendingCoverData)
        } catch (err) {
          toast(err.message || 'Не удалось обработать фото')
        }
      }
      reader.readAsDataURL(file)
      e.target.value = ''
    })

    $('#mini-prev')?.addEventListener('click', (e) => { e.stopPropagation(); Player.prev().catch((err) => toast(err.message)) })
    $('#mini-next')?.addEventListener('click', (e) => { e.stopPropagation(); Player.next().catch((err) => toast(err.message)) })

    $('#mini-open-full')?.addEventListener('click', () => {
      if (!Player.current()) {
        toast('Сначала включи трек')
        return
      }
      openFullPlayer()
    })
    $('#full-close')?.addEventListener('click', () => closeFullPlayer())
    $('#full-lyrics-btn')?.addEventListener('click', () => Lyrics.toggle())
    $('#full-player')?.addEventListener('click', (e) => {
      if (e.target.id === 'full-player' || e.target.id === 'full-bg') closeFullPlayer()
    })

    $('#mini-play')?.addEventListener('click', (e) => { e.stopPropagation(); Player.toggle() })
    $('#full-play')?.addEventListener('click', () => Player.toggle())
    $('#full-next')?.addEventListener('click', async () => { try { await Player.next() } catch (err) { toast(err.message) } })
    $('#full-prev')?.addEventListener('click', () => Player.prev())
    $('#full-like')?.addEventListener('click', () => {
      const t = Player.current()
      if (!t) return
      Store.toggleLike(t)
      $('#full-like').classList.toggle('is-active', Store.isLiked(t))
      renderHome()
      renderLibrary()
    })
    $('#full-add')?.addEventListener('click', (e) => {
      e.stopPropagation()
      const t = Player.current()
      if (!t) {
        toast('Сначала включи трек')
        return
      }
      openPickPlaylistSheet(t)
    })
    $('#pick-playlist-close')?.addEventListener('click', () => closePickPlaylistSheet())
    $('#pick-playlist-cancel')?.addEventListener('click', () => closePickPlaylistSheet())
    $('#pick-playlist-list')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-pick-pl]')
      if (!btn || !pickPlaylistTrack) return
      Store.addTrackToPlaylist(btn.dataset.pickPl, pickPlaylistTrack)
      closePickPlaylistSheet()
      renderLibrary()
      toast('Добавлено в плейлист')
    })
    $('#full-shuffle')?.addEventListener('click', () => {
      $('#full-shuffle').classList.toggle('is-active', Player.toggleShuffle())
    })
    wireSeek()

    Player.on('trackchange', ({ track }) => {
      updatePlayerUI(track)
      if (Lyrics.isOpen() && track) Lyrics.load(track, Player.audio?.duration || 0)
    })
    Player.on('playing', ({ track }) => {
      highlightPlayingTrack(track)
      setPlayIcon(false)
      renderHomeListenStats()
    })
    Player.on('state', ({ paused }) => {
      setPlayIcon(paused)
      document.body.classList.toggle('audio-playing', !paused)
      highlightPlayingTrack(Player.current())
    })
    Player.on('time', ({ current, duration }) => {
      if (!seeking) $('#time-current').textContent = Player.fmt(current)
      $('#time-total').textContent = Player.fmt(duration)
      if (duration > 0) {
        const ratio = current / duration
        if (!seeking) $('#seek').value = String(Math.floor(ratio * 1000))
        updateWaveformProgress(ratio)
        Lyrics.sync(current)
      }
    })
    Player.on('error', (msg) => toast(msg))
  }

  function wireSeek() {
    const seek = $('#seek')
    const scrubEl = $('#progress-row')
    if (!seek || !scrubEl) return

    let scrubbing = false

    const setRatio = (ratio, commit) => {
      const r = Math.max(0, Math.min(1, ratio))
      seek.value = String(Math.floor(r * 1000))
      const dur = Player.audio?.duration || 0
      if (dur > 0) $('#time-current').textContent = Player.fmt(dur * r)
      updateWaveformProgress(r)
      if (commit) Player.seek(r)
    }

    const ratioFromEvent = (e) => {
      const rect = scrubEl.getBoundingClientRect()
      const clientX = e.touches?.[0]?.clientX ?? e.clientX
      return (clientX - rect.left) / rect.width
    }

    const onDown = (e) => {
      if (e.target.closest('button')) return
      scrubbing = true
      seeking = true
      setRatio(ratioFromEvent(e), false)
      scrubEl.setPointerCapture?.(e.pointerId)
      e.preventDefault()
    }

    const onMove = (e) => {
      if (!scrubbing) return
      setRatio(ratioFromEvent(e), false)
      e.preventDefault()
    }

    const onUp = (e) => {
      if (!scrubbing) return
      scrubbing = false
      setRatio(ratioFromEvent(e), true)
      seeking = false
      scrubEl.releasePointerCapture?.(e.pointerId)
    }

    scrubEl.addEventListener('pointerdown', onDown)
    scrubEl.addEventListener('pointermove', onMove)
    scrubEl.addEventListener('pointerup', onUp)
    scrubEl.addEventListener('pointercancel', onUp)

    seek.addEventListener('input', () => {
      if (!scrubbing) setRatio(Number(seek.value) / 1000, false)
    })
    seek.addEventListener('change', () => {
      setRatio(Number(seek.value) / 1000, true)
      seeking = false
    })
  }

  function init() {
    document.body.dataset.screen = 'home'
    closeFullPlayer()
    closePlaylistView()
    closePlaylistActionsSheet()
    closePickPlaylistSheet()
    closeServiceSheet()
    Player.buildWaveform()
    syncShellLayout()
    Icons.mount()
    showSettingsPane('custom')
    Theme.apply(Store.get())
    migrateStoredTracks()
    renderSettingsForm()
    renderSetupGateForm()
    updateSetupGate()
    renderHome()
    loadHomeSoundCloudSections()
    renderLibrary()
    renderSearchSourceButton()
    wireEvents()
    bindSwipeClosers()
    setPlayIcon(true)
    updateGatewayBanner()
  }

  return { init, toast, showScreen, renderHome, renderLibrary, handleOAuthRedirect }
})()
