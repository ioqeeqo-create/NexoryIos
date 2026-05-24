const UI = (() => {
  let toastTimer = null
  let searchSource = 'yandex'
  let busy = false
  let openPlaylistId = null
  let seeking = false
  const trackLists = new WeakMap()

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

  function sourceBadge(source) {
    const map = {
      yandex: 'assets/source-yandex-music.png',
      vk: 'assets/source-vk.png',
      soundcloud: 'assets/source-soundcloud.png',
    }
    const src = map[source]
    if (!src) return ''
    return `<img class="source-badge" src="${src}" alt="" loading="lazy" />`
  }

  function coverBlock(source, url) {
    const inner = url
      ? `<img src="${esc(url)}" alt="" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false" /><span hidden data-icon="music-2" data-icon-class="ui-icon cover-ph"></span>`
      : `<span data-icon="music-2" data-icon-class="ui-icon cover-ph"></span>`
    return `${inner}${sourceBadge(source)}`
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
      <div class="track-cover" style="width:100%;aspect-ratio:1;border-radius:0">${coverBlock(track.source, track.cover)}</div>
      <div class="card-tile__meta"><div class="card-tile__title">${esc(track.title)}</div><div class="card-tile__sub">${esc(track.artist)}</div></div>
    </button>`
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

  function setCover(wrap, img, track) {
    if (!wrap) return
    const ph = wrap.querySelector('[data-icon]')
    if (track?.cover) {
      if (img) {
        img.hidden = false
        img.src = track.cover
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
  }

  function playlistCoverHtml(pl) {
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
    }
    if (view) view.hidden = false
    document.body.classList.add('playlist-open')
    Icons.mount(view)
  }

  function closePlaylistView() {
    openPlaylistId = null
    const view = $('#playlist-view')
    if (view) view.hidden = true
    document.body.classList.remove('playlist-open')
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
    $('#cfg-yandex').value = s.yandexToken || ''
    $('#cfg-vk').value = s.vkToken || ''
    $('#cfg-sc').value = s.scClientId || ''
  }

  function updatePlayerUI(track) {
    if (!track) return
    const from = Player.playingFrom()
    $('#mini-player').hidden = false
    $('#mini-title').textContent = track.title
    $('#mini-artist').textContent = track.artist
    setCover($('#mini-cover-wrap'), $('#mini-cover'), track)
    $('#full-title').textContent = track.title
    $('#full-artist').textContent = track.artist
    $('#full-from').textContent = from ? `Играет из ${from}` : ''
    $('#full-like').classList.toggle('is-active', Store.isLiked(track))
    setCover($('#full-cover-wrap'), $('#full-cover'), track)
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
      const orb = $('#btn-wave-play')
      if (busy) return
      try {
        if (!Api.isConfigured()) throw new Error('Настрой gateway в настройках')
        if (!Store.get().yandexToken) throw new Error('Добавь Яндекс OAuth')
        busy = true
        orb?.classList.add('is-busy')
        toast('Запускаем волну…')
        await Player.startWave()
      } catch (e) {
        toast(e.message || 'Ошибка волны')
      } finally {
        busy = false
        orb?.classList.remove('is-busy')
      }
    })

    $('#btn-open-likes')?.addEventListener('click', () => {
      const s = Store.get()
      openPlaylistView({ id: '__likes', name: 'Любимые', tracks: s.likes }, { isLikes: true })
    })

    $('#library-playlists')?.addEventListener('click', (e) => {
      const card = e.target.closest('[data-pl-id]')
      if (!card) return
      const pl = Store.getPlaylist(card.dataset.plId)
      if (pl) openPlaylistView(pl)
    })

    $('#btn-import-open')?.addEventListener('click', () => openImportSheet(true))
    $('#import-sheet-close')?.addEventListener('click', () => openImportSheet(false))
    $('#import-sheet-cancel')?.addEventListener('click', () => openImportSheet(false))
    $('#btn-import-run')?.addEventListener('click', () => runImport())

    $('#playlist-view-back')?.addEventListener('click', () => closePlaylistView())
    $('#playlist-view-play')?.addEventListener('click', async () => {
      const pl = openPlaylistId === '__likes'
        ? { name: 'Любимые', tracks: Store.get().likes }
        : Store.getPlaylist(openPlaylistId)
      if (!pl?.tracks?.length) return toast('Плейлист пуст')
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
        await Player.playQueue(shuffled, 0, pl.name)
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

    $('#btn-test-gateway')?.addEventListener('click', async () => {
      Store.patch({ gatewayUrl: $('#cfg-gateway').value.trim(), gatewaySecret: $('#cfg-secret').value.trim() })
      $('#gateway-status').textContent = 'Проверяем…'
      try {
        await Api.health()
        $('#gateway-status').textContent = '✓ Gateway OK'
      } catch (e) {
        $('#gateway-status').textContent = e.message
      }
    })

    $('#btn-save-settings')?.addEventListener('click', async () => {
      Store.patch({
        gatewayUrl: $('#cfg-gateway').value.trim(),
        gatewaySecret: $('#cfg-secret').value.trim(),
        yandexToken: $('#cfg-yandex').value.trim(),
        vkToken: $('#cfg-vk').value.trim(),
        scClientId: $('#cfg-sc').value.trim(),
      })
      updateSetupGate()
      toast('Сохранено')
      renderHome()
      updateGatewayBanner()
      const yt = $('#cfg-yandex').value.trim()
      const vk = $('#cfg-vk').value.trim()
      if (yt && Api.isConfigured()) Api.validateYandex(yt).then((r) => { $('#yandex-status').textContent = r.ok ? `✓ ${r.login || 'OK'}` : r.error })
      if (vk && Api.isConfigured()) Api.validateVk(vk).then((r) => { $('#vk-status').textContent = r.ok ? `✓ ${r.name || r.userId}` : r.error })
    })

    $('#btn-create-playlist')?.addEventListener('click', () => {
      const name = prompt('Название плейлиста')
      if (!name) return
      Store.addPlaylist(name)
      renderLibrary()
    })

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
    Player.on('playing', () => openFullPlayer())
    Player.on('state', ({ paused }) => setPlayIcon(paused))
    Player.on('time', ({ current, duration }) => {
      if (!seeking) $('#time-current').textContent = Player.fmt(current)
      $('#time-total').textContent = Player.fmt(duration)
      if (!seeking && duration > 0) {
        $('#seek').value = String(Math.floor((current / duration) * 1000))
      }
    })
    Player.on('error', (msg) => toast(msg))
  }

  function wireSeek() {
    const seek = $('#seek')
    if (!seek) return

    const applySeek = (commit) => {
      const ratio = Number(seek.value) / 1000
      const dur = Player.audio?.duration || 0
      if (dur > 0) $('#time-current').textContent = Player.fmt(dur * ratio)
      if (commit) Player.seek(ratio)
    }

    const startSeek = () => { seeking = true }
    const endSeek = () => {
      applySeek(true)
      seeking = false
    }

    seek.addEventListener('pointerdown', startSeek)
    seek.addEventListener('touchstart', startSeek, { passive: true })
    seek.addEventListener('input', () => {
      const ratio = Number(seek.value) / 1000
      const dur = Player.audio?.duration || 0
      if (dur > 0) $('#time-current').textContent = Player.fmt(dur * ratio)
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
    Icons.mount()
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
