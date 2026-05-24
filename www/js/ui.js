const UI = (() => {
  let toastTimer = null
  let searchSource = 'yandex'
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
      helpUrl: '',
      helpText: '',
      optional: true,
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
    document.body.dataset.screen = name
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('screen--active', s.dataset.screen === name))
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('tab--active', t.dataset.tab === name))
    if (name === 'library') renderLibrary()
    if (name === 'settings') renderSettingsForm()
    if (name === 'search') setTimeout(() => $('#search-input')?.focus(), 150)
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

  function coverOnly(url) {
    if (url) {
      return `<img src="${esc(url)}" alt="" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false" /><span hidden data-icon="music-2" data-icon-class="ui-icon cover-ph"></span>`
    }
    return `<span data-icon="music-2" data-icon-class="ui-icon cover-ph"></span>`
  }

  function coverBlock(source, url) {
    return `${coverOnly(url)}${sourceBadgeCorner(source)}`
  }

  function trackRowHtml(track, idx) {
    return `<button type="button" class="track-row" data-idx="${idx ?? ''}" data-key="${Store.trackKey(track)}">
      <div class="track-cover">${coverBlock(track.source, track.cover)}</div>
      <div class="track-row__meta">
        <div class="track-row__title">${esc(track.title)}</div>
        <div class="track-row__artist">${esc(track.artist)}</div>
      </div>
    </button>`
  }

  function cardHtml(track) {
    return `<button type="button" class="card-tile" data-key="${Store.trackKey(track)}">
      <div class="card-tile__cover">${coverBlock(track.source, track.cover)}</div>
      <div class="card-tile__meta">
        <div class="card-tile__title">${esc(track.title)}</div>
        <div class="card-tile__sub">${esc(track.artist)}</div>
      </div>
    </button>`
  }

  function highlightPlayingTrack(track) {
    const key = track ? Store.trackKey(track) : ''
    document.querySelectorAll('.card-tile, .track-row').forEach((el) => {
      el.classList.toggle('is-playing', !!key && el.dataset.key === key)
    })
    const from = Player.playingFrom() || ''
    const waveBtn = $('#btn-wave-play')
    if (waveBtn) {
      waveBtn.classList.toggle('is-playing', !!track && (from.includes('волна') || from.includes('Моя волна')))
    }
  }

  function updateWaveformProgress(ratio) {
    const wf = $('#waveform')
    if (!wf) return
    const bars = wf.children
    if (!bars.length) return
    const r = Math.max(0, Math.min(1, ratio))
    for (let i = 0; i < bars.length; i++) {
      bars[i].classList.toggle('played', (i + 0.5) / bars.length <= r)
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
    trackLists.set(container, { tracks: tracks.slice(), playAllFrom })
    Icons.mount(container)
  }

  async function playFromList(container, key, el) {
    if (busy) return
    const list = trackLists.get(container)
    if (!list) return
    const { tracks, playAllFrom } = list
    const idx = tracks.findIndex((t) => Store.trackKey(t) === key)
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

  function setCover(wrap, img, track, { playerOnly = false } = {}) {
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
    const bgUrl = getPlayerBgUrl(track)
    Theme.setFullBgImage(bgUrl)
    Theme.applyPlayerBg()
  }

  function setFullPlayer(open) {
    const fp = $('#full-player')
    const tab = $('#tab-bar')
    if (!fp) return
    fp.hidden = !open
    document.body.classList.toggle('player-open', open)
    if (tab) tab.hidden = open
  }

  function openFullPlayer() {
    setFullPlayer(true)
    Icons.mount($('#full-player'))
  }

  function closeFullPlayer() {
    setFullPlayer(false)
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
    g('#gate-gateway', s.gatewayUrl)
    g('#gate-secret', s.gatewaySecret)
    g('#gate-yandex', s.yandexToken)
  }

  function saveFromGate() {
    Store.patch({
      gatewayUrl: $('#gate-gateway')?.value.trim() || '',
      gatewaySecret: $('#gate-secret')?.value.trim() || '',
      yandexToken: $('#gate-yandex')?.value.trim() || '',
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

  function renderHome() {
    const s = Store.get()
    const recentEl = $('#recent-list')
    const favEl = $('#favorites-preview')
    if (recentEl) {
      const items = s.recent.slice(0, 12)
      recentEl.innerHTML = items.length ? items.map((t) => cardHtml(t)).join('') : '<div class="empty-hint">Включи волну или найди трек</div>'
      bindTrackClicks(recentEl, items, 'Недавние')
    }
    if (favEl) {
      const items = s.likes.slice(0, 12)
      favEl.innerHTML = items.length ? items.map((t) => cardHtml(t)).join('') : '<div class="empty-hint">Нет лайков</div>'
      bindTrackClicks(favEl, items, 'Любимые')
    }
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
    const isLikes = opts.isLikes
    if (hero) {
      hero.classList.toggle('playlist-view__hero--default', !isLikes)
    }
    $('#playlist-view-title').textContent = pl.name
    $('#playlist-view-count').textContent = `${pl.tracks.length} треков`
    const tracksEl = $('#playlist-view-tracks')
    if (tracksEl) {
      tracksEl.innerHTML = pl.tracks.length
        ? pl.tracks.map((t, i) => trackRowHtml(t, i)).join('')
        : '<p class="empty-hint">Плейлист пуст</p>'
      bindTrackClicks(tracksEl, pl.tracks, pl.name)
      highlightPlayingTrack(Player.current())
    }
    if (view) {
      view.hidden = false
      view.classList.remove('is-closing')
    }
    document.body.classList.add('playlist-open')
    Icons.mount(view)
  }

  function closePlaylistView() {
    const view = $('#playlist-view')
    if (!view || view.hidden) {
      openPlaylistId = null
      document.body.classList.remove('playlist-open')
      return
    }
    view.classList.add('is-closing')
    setTimeout(() => {
      openPlaylistId = null
      view.hidden = true
      view.classList.remove('is-closing')
      document.body.classList.remove('playlist-open')
    }, 280)
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

  function openPlaylistCreateSheet(open) {
    const sheet = $('#playlist-create-sheet')
    if (!sheet) return
    sheet.hidden = !open
    if (open) {
      pendingCoverData = ''
      const nameEl = $('#playlist-create-name')
      if (nameEl) nameEl.value = ''
      const prev = $('#playlist-cover-preview')
      if (prev) {
        prev.innerHTML = Icons.svg('image', 'ui-icon lg')
        prev.style.backgroundImage = ''
      }
      setTimeout(() => nameEl?.focus(), 120)
    }
  }

  function saveNewPlaylist() {
    const name = String($('#playlist-create-name')?.value || '').trim() || 'Мой плейлист'
    Store.addPlaylist(name, [], pendingCoverData)
    pendingCoverData = ''
    openPlaylistCreateSheet(false)
    renderLibrary()
    toast('Плейлист создан')
  }

  function openImportSheet(open) {
    const sheet = $('#import-sheet')
    if (!sheet) return
    sheet.hidden = !open
    if (open) $('#import-input')?.focus()
  }

  async function runImport() {
    const raw = String($('#import-input')?.value || '').trim()
    if (!raw) return toast('Вставь ссылку или JSON')
    if (!Api.isConfigured()) {
      toast('Сначала настрой gateway')
      showSetupGate()
      return
    }
    const isJson = /^[\[{]/.test(raw)
    toast('Импортируем…')
    try {
      const out = await Api.importPlaylist(isJson ? { json: raw } : { url: raw })
      if (!out.ok) throw new Error(out.error || 'Импорт не удался')
      if (Array.isArray(out.playlists)) {
        Store.importPlaylists(out.playlists)
        toast(`Импортировано плейлистов: ${out.playlists.length}`)
      } else {
        Store.addPlaylist(out.name || 'Импорт', out.tracks || [])
        toast(`«${out.name || 'Плейлист'}»: ${(out.tracks || []).length} треков`)
      }
      openImportSheet(false)
      $('#import-input').value = ''
      renderLibrary()
    } catch (e) {
      toast(e.message || 'Ошибка импорта')
    }
  }

  function renderSettingsForm() {
    const s = Store.get()
    $('#cfg-gateway').value = s.gatewayUrl || ''
    $('#cfg-secret').value = s.gatewaySecret || ''
    $('#cfg-accent-cover').checked = !!s.accentFromCover
    $('#cfg-bg-blur').value = String(s.bgBlur ?? 56)
    $('#cfg-bg-brightness').value = String(s.bgBrightness ?? 45)
    $('#cfg-blur-val').textContent = String(s.bgBlur ?? 56)
    $('#cfg-bright-val').textContent = String(s.bgBrightness ?? 45)
    document.querySelectorAll('.theme-chip').forEach((btn) => {
      btn.classList.toggle('theme-chip--active', btn.dataset.theme === (s.theme || 'dark'))
    })
    const preview = $('#player-cover-preview')
    if (preview) {
      if (s.playerCoverOverride) {
        preview.hidden = false
        preview.style.backgroundImage = `url(${s.playerCoverOverride})`
      } else {
        preview.hidden = true
        preview.style.backgroundImage = ''
      }
    }
    const bgPreview = $('#player-bg-preview')
    if (bgPreview) {
      if (s.playerBgOverride) {
        bgPreview.hidden = false
        bgPreview.style.backgroundImage = `url(${s.playerBgOverride})`
      } else {
        bgPreview.hidden = true
        bgPreview.style.backgroundImage = ''
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
    if (sc) sc.textContent = s.scClientId ? 'Настроено' : 'Опционально'
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
    const help = $('#service-token-help')
    const helpText = $('#service-token-help-text')
    const status = $('#service-token-status')
    if (logo) logo.src = meta.logo
    if (input) {
      input.type = 'password'
      input.value = Store.get()[meta.storeKey] || ''
    }
    if (help) {
      if (meta.helpUrl) {
        help.href = meta.helpUrl
        help.hidden = false
        if (helpText) helpText.textContent = meta.helpText
      } else {
        help.hidden = true
      }
    }
    if (status) status.textContent = ''
    if (sheet) sheet.hidden = false
    Icons.mount(sheet)
  }

  function closeServiceSheet() {
    openServiceId = null
    tokenVisible = false
    const sheet = $('#service-sheet')
    if (sheet) sheet.hidden = true
  }

  function saveGatewayFromForm() {
    Store.patch({
      gatewayUrl: $('#cfg-gateway').value.trim().replace(/\/+$/, ''),
      gatewaySecret: $('#cfg-secret').value.trim(),
    })
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
    $('#mini-title').textContent = track.title
    $('#mini-artist').textContent = track.artist
    setCover($('#mini-cover-wrap'), $('#mini-cover'), track, { playerOnly: true })
    $('#full-title').textContent = track.title
    $('#full-artist').textContent = track.artist
    $('#full-from').textContent = from || 'Nexory'
    $('#full-like').classList.toggle('is-active', Store.isLiked(track))
    setCover($('#full-cover-wrap'), $('#full-cover'), track, { playerOnly: true })
    applyPlayerVisuals(track)
    if (Store.get().accentFromCover) {
      const accentUrl = getPlayerBgUrl(track) || getPlayerCoverUrl(track)
      if (accentUrl) Theme.extractAccentFromUrl(accentUrl)
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
    const full = $('#full-play')
    if (full) {
      full.dataset.icon = icon
      full.innerHTML = Icons.svg(icon, 'ui-icon lg')
    }
  }

  async function runSearch(q) {
    const status = $('#search-status')
    const results = $('#search-results')
    if (!q.trim()) { status.textContent = ''; results.innerHTML = ''; return }
    if (!Api.isConfigured()) { status.textContent = 'Настрой gateway'; return }
    status.textContent = 'Ищем…'
    try {
      const out = await Api.search(q.trim(), searchSource)
      const tracks = out.tracks || []
      status.textContent = tracks.length ? `${tracks.length} результатов` : out.error || 'Пусто'
      results.innerHTML = tracks.map((t, i) => trackRowHtml(t, i)).join('')
      bindTrackClicks(results, tracks, `Поиск · ${Player.sourceLabel(searchSource)}`)
    } catch (e) {
      status.textContent = e.message
      results.innerHTML = ''
    }
  }

  function wireEvents() {
    $('#screens')?.addEventListener('click', (e) => {
      const el = e.target.closest('.track-row, .card-tile')
      if (!el?.dataset.key) return
      const container = el.closest('[data-track-list]')
      if (!container) return
      e.preventDefault()
      playFromList(container, el.dataset.key, el)
    })

    document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => showScreen(t.dataset.tab)))
    document.querySelectorAll('[data-goto]').forEach((b) => b.addEventListener('click', () => showScreen(b.dataset.goto)))
    $('#btn-search-open')?.addEventListener('click', () => showScreen('search'))

    $('#gate-test')?.addEventListener('click', async () => {
      saveFromGate()
      $('#gate-status').textContent = 'Проверяем…'
      try {
        await Api.health()
        $('#gate-status').textContent = '✓ Gateway OK'
      } catch (e) {
        $('#gate-status').textContent = e.message
      }
    })

    $('#gate-save')?.addEventListener('click', async () => {
      saveFromGate()
      if (!Api.isConfigured()) {
        toast('Укажи Gateway URL и Secret')
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
      toast('Музыка не будет работать без gateway')
    })

    $('#btn-wave-play')?.addEventListener('click', async () => {
      const row = $('#btn-wave-play')
      if (busy) return
      Player.primeAudio()
      try {
        if (!Api.isConfigured()) throw new Error('Настрой gateway в настройках')
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

    $('#btn-open-likes')?.addEventListener('click', () => {
      const s = Store.get()
      openPlaylistView({ id: '__likes', name: 'Любимые', tracks: s.likes }, { isLikes: true })
    })

    $('#library-playlists')?.addEventListener('click', (e) => {
      const card = e.target.closest('[data-pl-id]')
      if (!card) return
      if (plLongPressHandled) return
      const pl = Store.getPlaylist(card.dataset.plId)
      if (pl) openPlaylistView(pl)
    })

    $('#btn-import-open')?.addEventListener('click', () => openImportSheet(true))
    $('#import-sheet-close')?.addEventListener('click', () => openImportSheet(false))
    $('#import-sheet-cancel')?.addEventListener('click', () => openImportSheet(false))
    $('#btn-import-run')?.addEventListener('click', () => runImport())

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
    $('#search-source-chips')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-source]')
      if (!btn) return
      searchSource = btn.dataset.source
      document.querySelectorAll('#search-source-chips .chip').forEach((c) => c.classList.toggle('chip--active', c === btn))
      runSearch($('#search-input').value)
    })

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
      if (track && e.target.checked) applyPlayerVisuals(track)
    })

    $('#cfg-bg-blur')?.addEventListener('input', (e) => {
      $('#cfg-blur-val').textContent = e.target.value
      saveCustomization({ bgBlur: Number(e.target.value) })
    })

    $('#cfg-bg-brightness')?.addEventListener('input', (e) => {
      $('#cfg-bright-val').textContent = e.target.value
      saveCustomization({ bgBrightness: Number(e.target.value) })
    })

    $('#cfg-player-cover-pick')?.addEventListener('click', () => $('#player-cover-input')?.click())
    $('#cfg-player-cover-clear')?.addEventListener('click', () => {
      saveCustomization({ playerCoverOverride: '' })
      renderSettingsForm()
      const track = Player.current()
      if (track) updatePlayerUI(track)
      toast('Обложка сброшена')
    })

    $('#cfg-player-bg-pick')?.addEventListener('click', () => $('#player-bg-input')?.click())
    $('#cfg-player-bg-clear')?.addEventListener('click', () => {
      saveCustomization({ playerBgOverride: '' })
      renderSettingsForm()
      const track = Player.current()
      if (track) updatePlayerUI(track)
      toast('Фон сброшен')
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

    $('#player-bg-input')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        saveCustomization({ playerBgOverride: String(reader.result || '') })
        renderSettingsForm()
        const track = Player.current()
        if (track) updatePlayerUI(track)
        toast('Фон обновлён')
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
      Store.patch({ [meta.storeKey]: '' })
      const input = $('#service-token-input')
      if (input) input.value = ''
      $('#service-token-status').textContent = 'Очищено'
      updateServiceStates()
      renderHome()
      updateGatewayBanner()
    })

    $('#service-token-save')?.addEventListener('click', async () => {
      const meta = SERVICE_META[openServiceId]
      if (!meta) return
      const token = $('#service-token-input').value.trim()
      Store.patch({ [meta.storeKey]: token })
      saveGatewayFromForm()
      const status = $('#service-token-status')
      if (!token && !meta.optional) {
        status.textContent = 'Введи токен'
        return
      }
      if (!token && meta.optional) {
        status.textContent = 'Сохранено'
        updateServiceStates()
        toast('Сохранено')
        return
      }
      status.textContent = 'Проверяем…'
      try {
        if (openServiceId === 'yandex') {
          const r = await Api.validateYandex(token)
          status.textContent = r.ok ? `✓ ${r.login || 'OK'}` : r.error
        } else if (openServiceId === 'vk') {
          const r = await Api.validateVk(token)
          status.textContent = r.ok ? `✓ ${r.name || r.userId}` : r.error
        } else {
          status.textContent = '✓ Сохранено'
        }
        updateServiceStates()
        renderHome()
        updateGatewayBanner()
        toast('Сохранено')
      } catch (e) {
        status.textContent = e.message
      }
    })

    $('#btn-test-gateway')?.addEventListener('click', async () => {
      saveGatewayFromForm()
      $('#gateway-status').textContent = 'Проверяем…'
      try {
        await Api.health()
        $('#gateway-status').textContent = '✓ Gateway OK'
      } catch (e) {
        $('#gateway-status').textContent = e.message
      }
    })

    $('#cfg-gateway')?.addEventListener('change', saveGatewayFromForm)
    $('#cfg-secret')?.addEventListener('change', saveGatewayFromForm)

    $('#btn-create-playlist')?.addEventListener('click', () => openPlaylistCreateSheet(true))
    $('#playlist-create-close')?.addEventListener('click', () => openPlaylistCreateSheet(false))
    $('#playlist-create-cancel')?.addEventListener('click', () => openPlaylistCreateSheet(false))
    $('#playlist-create-save')?.addEventListener('click', () => saveNewPlaylist())
    $('#playlist-cover-pick')?.addEventListener('click', () => $('#playlist-cover-input')?.click())
    $('#playlist-cover-input')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        pendingCoverData = String(reader.result || '')
        const prev = $('#playlist-cover-preview')
        if (prev && pendingCoverData) {
          prev.innerHTML = ''
          prev.style.backgroundImage = `url(${pendingCoverData})`
          prev.style.backgroundSize = 'cover'
          prev.style.backgroundPosition = 'center'
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
    $('#full-shuffle')?.addEventListener('click', () => {
      $('#full-shuffle').classList.toggle('is-active', Player.toggleShuffle())
    })
    wireSeek()

    Player.on('trackchange', ({ track }) => updatePlayerUI(track))
    Player.on('playing', ({ track }) => {
      $('#btn-wave-play')?.classList.add('is-playing')
      highlightPlayingTrack(track)
    })
    Player.on('state', ({ paused }) => {
      setPlayIcon(paused)
      if (paused) $('#btn-wave-play')?.classList.remove('is-playing')
    })
    Player.on('time', ({ current, duration }) => {
      if (!seeking) $('#time-current').textContent = Player.fmt(current)
      $('#time-total').textContent = Player.fmt(duration)
      if (duration > 0) {
        const ratio = current / duration
        if (!seeking) $('#seek').value = String(Math.floor(ratio * 1000))
        updateWaveformProgress(ratio)
      }
    })
    Player.on('error', (msg) => toast(msg))
  }

  function wireSeek() {
    const seek = $('#seek')
    const row = $('#progress-row')
    if (!seek) return

    const applySeek = (commit) => {
      const ratio = Number(seek.value) / 1000
      const dur = Player.audio?.duration || 0
      if (dur > 0) $('#time-current').textContent = Player.fmt(dur * ratio)
      updateWaveformProgress(ratio)
      if (commit) Player.seek(ratio)
    }

    const startSeek = (e) => {
      e.stopPropagation()
      seeking = true
    }
    const endSeek = (e) => {
      e?.stopPropagation?.()
      applySeek(true)
      seeking = false
    }

    row?.addEventListener('click', (e) => e.stopPropagation())
    row?.addEventListener('pointerdown', (e) => e.stopPropagation())
    row?.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true })

    seek.addEventListener('pointerdown', startSeek)
    seek.addEventListener('touchstart', startSeek, { passive: false })
    seek.addEventListener('input', (e) => {
      e.stopPropagation()
      const ratio = Number(seek.value) / 1000
      const dur = Player.audio?.duration || 0
      if (dur > 0) $('#time-current').textContent = Player.fmt(dur * ratio)
      updateWaveformProgress(ratio)
      if (seeking) Player.seek(ratio)
    })
    seek.addEventListener('change', endSeek)
    seek.addEventListener('pointerup', endSeek)
    seek.addEventListener('touchend', endSeek)
    seek.addEventListener('touchcancel', () => { seeking = false })
  }

  function init() {
    document.body.dataset.screen = 'home'
    closeFullPlayer()
    closePlaylistView()
    closePlaylistActionsSheet()
    closeServiceSheet()
    Player.buildWaveform()
    Icons.mount()
    showSettingsPane('custom')
    Theme.apply(Store.get())
    renderSettingsForm()
    renderSetupGateForm()
    updateSetupGate()
    renderHome()
    renderLibrary()
    wireEvents()
    setPlayIcon(true)
    updateGatewayBanner()
  }

  return { init, toast, showScreen, renderHome, renderLibrary }
})()
