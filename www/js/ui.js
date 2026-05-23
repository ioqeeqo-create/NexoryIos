const UI = (() => {
  let toastTimer = null
  let searchSource = 'yandex'
  let popularSource = 'yandex'

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
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('screen--active', s.dataset.screen === name))
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('tab--active', t.dataset.tab === name))
    if (name === 'search') setTimeout(() => $('#search-input')?.focus(), 150)
  }

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
  }

  function badge(source) {
    const map = { yandex: ['Я', 'badge-yandex'], vk: ['VK', 'badge-vk'], soundcloud: ['SC', 'badge-sc'] }
    const [t, c] = map[source] || ['?', '']
    return `<span class="badge ${c}">${t}</span>`
  }

  function coverBlock(source, url) {
    if (url) return `<img src="${esc(url)}" alt="" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false" /><span hidden data-icon="music-2" data-icon-class="ui-icon cover-ph"></span>`
    return `<span data-icon="music-2" data-icon-class="ui-icon cover-ph"></span>`
  }

  function trackRowHtml(track, idx) {
    return `<button type="button" class="track-row" data-idx="${idx ?? ''}" data-key="${Store.trackKey(track)}">
      <div class="track-cover">${coverBlock(track.source, track.cover)}</div>
      <div class="track-row__meta">
        <div class="track-row__title">${esc(track.title)}</div>
        <div class="track-row__artist">${esc(track.artist)}</div>
      </div>
      ${badge(track.source)}
    </button>`
  }

  function cardHtml(track) {
    return `<div class="card-tile" data-key="${Store.trackKey(track)}">
      <div class="track-cover" style="width:100%;aspect-ratio:1;border-radius:0">${coverBlock(track.source, track.cover)}</div>
      <div class="card-tile__meta"><div class="card-tile__title">${esc(track.title)}</div><div class="card-tile__sub">${esc(track.artist)}</div></div>
    </div>`
  }

  function bindTrackClicks(container, tracks, playAllFrom) {
    Icons.mount(container)
    container.querySelectorAll('.track-row, .card-tile').forEach((el) => {
      el.addEventListener('click', async () => {
        const key = el.dataset.key
        const idx = tracks.findIndex((t) => Store.trackKey(t) === key)
        try {
          await Player.playQueue(tracks, Math.max(0, idx), playAllFrom)
          openFullPlayer()
        } catch (e) {
          toast(e.message || 'Ошибка воспроизведения')
        }
      })
    })
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

  function updateSetupGate() {
    const gate = $('#setup-gate')
    if (!gate) return
    const ok = Api.isConfigured()
    gate.hidden = ok
    if (!ok) showScreen('settings')
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
    loadPopular()
  }

  async function loadPopular() {
    const el = $('#popular-list')
    if (!el) return
    if (!Api.isConfigured()) {
      el.innerHTML = '<div class="empty-hint">Настрой gateway</div>'
      return
    }
    const queries = Api.POPULAR[popularSource] || Api.POPULAR.yandex
    const q = queries[Math.floor(Math.random() * queries.length)]
    el.innerHTML = '<div class="empty-hint">Загрузка…</div>'
    try {
      const out = await Api.search(q, popularSource)
      const tracks = (out.tracks || []).slice(0, 8)
      el.innerHTML = tracks.length ? tracks.map((t, i) => trackRowHtml(t, i)).join('') : '<div class="empty-hint">Ничего не найдено</div>'
      bindTrackClicks(el, tracks, `Популярное · ${Player.sourceLabel(popularSource)}`)
    } catch (e) {
      el.innerHTML = `<div class="empty-hint">${esc(e.message)}</div>`
    }
  }

  function renderLibrary() {
    const s = Store.get()
    const likesEl = $('#library-likes')
    if (likesEl) {
      likesEl.innerHTML = s.likes.length
        ? s.likes.map((t, i) => trackRowHtml(t, i)).join('')
        : '<p class="empty-hint">Лайкай треки в плеере</p>'
      bindTrackClicks(likesEl, s.likes, 'Любимые')
    }
    const plEl = $('#library-playlists')
    if (plEl) {
      plEl.innerHTML = s.playlists.length
        ? s.playlists.map((p) => `<div class="playlist-row"><div><div class="playlist-row__name">${esc(p.name)}</div><small>${p.tracks.length} треков</small></div><span>›</span></div>`).join('')
        : '<div class="empty-hint">Создай плейлист</div>'
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
    document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => showScreen(t.dataset.tab)))
    document.querySelectorAll('[data-goto]').forEach((b) => b.addEventListener('click', () => showScreen(b.dataset.goto)))
    $('#btn-search-open')?.addEventListener('click', () => showScreen('search'))
    $('#setup-gate-btn')?.addEventListener('click', () => showScreen('settings'))

    $('#btn-wave-play')?.addEventListener('click', async () => {
      try {
        if (!Api.isConfigured()) throw new Error('Настрой gateway в настройках')
        if (!Store.get().yandexToken) throw new Error('Добавь Яндекс OAuth')
        await Player.startWave()
        openFullPlayer()
      } catch (e) {
        toast(e.message || 'Ошибка волны')
      }
    })

    $('#popular-chips')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-popular]')
      if (!btn) return
      popularSource = btn.dataset.popular
      document.querySelectorAll('#popular-chips .chip').forEach((c) => c.classList.toggle('chip--active', c === btn))
      loadPopular()
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

    $('#mini-open-full')?.addEventListener('click', () => openFullPlayer())
    $('#full-close')?.addEventListener('click', () => closeFullPlayer())

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
    $('#seek')?.addEventListener('input', (e) => Player.seek(Number(e.target.value) / 1000))

    Player.on('trackchange', ({ track }) => updatePlayerUI(track))
    Player.on('state', ({ paused }) => setPlayIcon(paused))
    Player.on('time', ({ current, duration }) => {
      $('#time-current').textContent = Player.fmt(current)
      $('#time-total').textContent = Player.fmt(duration)
      if (duration > 0) $('#seek').value = String(Math.floor((current / duration) * 1000))
    })
    Player.on('error', (msg) => toast(msg))
  }

  function init() {
    Icons.mount()
    renderSettingsForm()
    updateSetupGate()
    renderHome()
    renderLibrary()
    wireEvents()
    setPlayIcon(true)
  }

  return { init, toast, showScreen, renderHome, renderLibrary }
})()
