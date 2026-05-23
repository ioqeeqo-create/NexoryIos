const UI = (() => {
  let toastTimer = null
  let searchSource = 'yandex'
  let popularSource = 'yandex'

  const $ = (sel) => document.querySelector(sel)
  const $$ = (sel) => [...document.querySelectorAll(sel)]

  function toast(msg) {
    const el = $('#toast')
    if (!el) return
    el.textContent = msg
    el.hidden = false
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
      el.hidden = true
    }, 2800)
  }

  function showScreen(name) {
    $$('.screen').forEach((s) => s.classList.toggle('screen--active', s.dataset.screen === name))
    $$('.tab').forEach((t) => t.classList.toggle('tab--active', t.dataset.tab === name))
    if (name === 'search') setTimeout(() => $('#search-input')?.focus(), 200)
  }

  function coverFallback(source) {
    const colors = { yandex: '#fc3f1d', vk: '#0077ff', soundcloud: '#ff5500' }
    return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="${colors[source] || '#333'}" width="100" height="100"/></svg>`)}`
  }

  function badge(source) {
    const map = { yandex: ['Я', 'badge-yandex'], vk: ['VK', 'badge-vk'], soundcloud: ['SC', 'badge-sc'] }
    const [t, c] = map[source] || ['?', '']
    return `<span class="track-row__badge ${c}">${t}</span>`
  }

  function trackRowHtml(track, idx) {
    const cover = track.cover || coverFallback(track.source)
    return `<button type="button" class="track-row" data-idx="${idx ?? ''}" data-key="${Store.trackKey(track)}">
      <img src="${cover}" alt="" loading="lazy" />
      <div class="track-row__meta">
        <div class="track-row__title">${esc(track.title)}</div>
        <div class="track-row__artist">${esc(track.artist)}</div>
      </div>
      ${badge(track.source)}
    </button>`
  }

  function cardHtml(track) {
    const cover = track.cover || coverFallback(track.source)
    return `<div class="card-tile" data-key="${Store.trackKey(track)}">
      <img src="${cover}" alt="" loading="lazy" />
      <div class="card-tile__meta">
        <div class="card-tile__title">${esc(track.title)}</div>
        <div class="card-tile__sub">${esc(track.artist)}</div>
      </div>
    </div>`
  }

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;')
  }

  function bindTrackClicks(container, tracks, playAllFrom) {
    container.querySelectorAll('.track-row, .card-tile').forEach((el) => {
      el.addEventListener('click', async () => {
        const key = el.dataset.key
        const idx = tracks.findIndex((t) => Store.trackKey(t) === key)
        try {
          await Player.playQueue(tracks, Math.max(0, idx), playAllFrom)
        } catch (e) {
          toast(e.message || 'Ошибка воспроизведения')
        }
      })
    })
  }

  function renderHome() {
    const s = Store.get()
    const recentEl = $('#recent-list')
    const favEl = $('#favorites-preview')
    if (recentEl) {
      const items = s.recent.slice(0, 12)
      recentEl.innerHTML = items.length
        ? items.map((t) => cardHtml(t)).join('')
        : '<div class="empty-hint">Пока пусто — включи волну или найди трек</div>'
      bindTrackClicks(recentEl, items, 'Недавнее')
    }
    if (favEl) {
      const items = s.likes.slice(0, 12)
      favEl.innerHTML = items.length
        ? items.map((t) => cardHtml(t)).join('')
        : '<div class="empty-hint">Нет лайков</div>'
      bindTrackClicks(favEl, items, 'Любимое')
    }
    loadPopular()
  }

  async function loadPopular() {
    const el = $('#popular-list')
    if (!el) return
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
        : '<div class="empty-hint">Лайкай треки в плеере ♥</div>'
      bindTrackClicks(likesEl, s.likes, 'Любимое')
    }
    const plEl = $('#library-playlists')
    if (plEl) {
      plEl.innerHTML = s.playlists.length
        ? s.playlists
            .map(
              (p) => `<div class="playlist-row" data-pl="${p.id}">
            <div><div class="playlist-row__name">${esc(p.name)}</div><div class="playlist-row__count">${p.tracks.length} треков</div></div>
            <span>›</span></div>`,
            )
            .join('')
        : '<div class="empty-hint">Создай свой плейлист</div>'
    }
  }

  function renderSettingsForm() {
    const s = Store.get()
    $('#cfg-gateway').value = s.gatewayUrl || ''
    $('#cfg-secret').value = s.gatewaySecret || ''
    $('#cfg-yandex').value = s.yandexToken || ''
    $('#cfg-vk').value = s.vkToken || ''
    $('#cfg-sc').value = s.scClientId || ''
    $('#cfg-wave-source').value = s.waveSource || 'yandex'
  }

  function updatePlayerUI(track) {
    if (!track) return
    const cover = track.cover || coverFallback(track.source)
    const from = Player.playingFrom()
    $('#mini-player').hidden = false
    $('#mini-cover').src = cover
    $('#mini-title').textContent = track.title
    $('#mini-artist').textContent = track.artist
    $('#mini-from').textContent = from ? `Играет из ${from}` : ''
    $('#full-cover').src = cover
    $('#full-title').textContent = track.title
    $('#full-artist').textContent = track.artist
    $('#full-from').textContent = from ? `Играет из ${from}` : ''
    $('#full-backdrop').style.background = track.cover
      ? `linear-gradient(180deg, rgba(0,0,0,0.2), #050505), url(${track.cover}) center/cover`
      : ''
    $('#full-like').classList.toggle('is-active', Store.isLiked(track))

    const q = Player.queue()
    const idx = Player.index()
    const ql = $('#queue-list')
    if (ql) {
      ql.innerHTML = q
        .map(
          (t, i) => `<div class="queue-item ${i === idx ? 'queue-item--active' : ''}" data-q="${i}">
          <img src="${t.cover || coverFallback(t.source)}" alt="" />
          <div><div>${esc(t.title)}</div><small>${esc(t.artist)}</small></div>
        </div>`,
        )
        .join('')
      ql.querySelectorAll('.queue-item').forEach((el) => {
        el.addEventListener('click', async () => {
          try {
            await Player.playTrackAt(Number(el.dataset.q))
          } catch (e) {
            toast(e.message)
          }
        })
      })
    }
  }

  function setPlayIcon(paused) {
    const path = paused ? 'M8 5v14l11-7z' : 'M6 5h4v14H6zm8 0h4v14h-4z'
    ;['#mini-play svg path', '#full-play svg path'].forEach((sel) => {
      const p = document.querySelector(sel)
      if (p) p.setAttribute('d', path.includes('M6 5') ? 'M6 5h4v14H6zm8 0h4v14h-4z' : 'M8 5v14l11-7z')
    })
  }

  async function runSearch(q) {
    const status = $('#search-status')
    const results = $('#search-results')
    if (!q.trim()) {
      status.textContent = ''
      results.innerHTML = ''
      return
    }
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
    $$('.tab').forEach((t) => t.addEventListener('click', () => showScreen(t.dataset.tab)))
    $$('[data-goto]').forEach((b) => b.addEventListener('click', () => showScreen(b.dataset.goto)))
    $('#btn-search-open')?.addEventListener('click', () => showScreen('search'))

    $('#btn-wave-play')?.addEventListener('click', async () => {
      try {
        if (!Store.get().yandexToken) throw new Error('Добавь Яндекс-токен в настройках')
        await Player.startWave()
      } catch (e) {
        toast(e.message || 'Ошибка волны')
      }
    })

    $('#popular-chips')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-popular]')
      if (!btn) return
      popularSource = btn.dataset.popular
      $$('#popular-chips .chip').forEach((c) => c.classList.toggle('chip--active', c === btn))
      loadPopular()
    })

    let searchDebounce
    $('#search-input')?.addEventListener('input', (e) => {
      const v = e.target.value
      $('#search-clear').hidden = !v
      clearTimeout(searchDebounce)
      searchDebounce = setTimeout(() => runSearch(v), 400)
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
      $$('#search-source-chips .chip').forEach((c) => c.classList.toggle('chip--active', c === btn))
      runSearch($('#search-input').value)
    })

    $('#btn-save-settings')?.addEventListener('click', async () => {
      Store.patch({
        gatewayUrl: $('#cfg-gateway').value.trim(),
        gatewaySecret: $('#cfg-secret').value.trim(),
        yandexToken: $('#cfg-yandex').value.trim(),
        vkToken: $('#cfg-vk').value.trim(),
        scClientId: $('#cfg-sc').value.trim(),
        waveSource: $('#cfg-wave-source').value,
      })
      toast('Сохранено')
      const yt = $('#cfg-yandex').value.trim()
      const vk = $('#cfg-vk').value.trim()
      if (yt) {
        Api.validateYandex(yt).then((r) => {
          $('#yandex-status').textContent = r.ok ? `✓ ${r.login || 'OK'}` : r.error || 'Ошибка'
        })
      }
      if (vk) {
        Api.validateVk(vk).then((r) => {
          $('#vk-status').textContent = r.ok ? `✓ ${r.name || r.userId}` : r.error || 'Ошибка'
        })
      }
    })

    $('#btn-create-playlist')?.addEventListener('click', () => {
      const name = prompt('Название плейлиста')
      if (!name) return
      Store.addPlaylist(name)
      renderLibrary()
      toast('Плейлист создан')
    })

    $('#mini-open-full')?.addEventListener('click', () => {
      $('#full-player').hidden = false
    })
    $('#full-close')?.addEventListener('click', () => {
      $('#full-player').hidden = true
    })
    $('#full-backdrop')?.addEventListener('click', () => {
      $('#full-player').hidden = true
    })

    ;['#mini-play', '#full-play'].forEach((sel) => $(sel)?.addEventListener('click', () => Player.toggle()))
    ;['#mini-next', '#full-next'].forEach((sel) =>
      $(sel)?.addEventListener('click', async () => {
        try {
          await Player.next()
        } catch (e) {
          toast(e.message)
        }
      }),
    )
    ;['#mini-prev', '#full-prev'].forEach((sel) => $(sel)?.addEventListener('click', () => Player.prev()))
    $('#full-like')?.addEventListener('click', () => {
      const t = Player.current()
      if (!t) return
      Store.toggleLike(t)
      $('#full-like').classList.toggle('is-active', Store.isLiked(t))
      renderHome()
      renderLibrary()
    })
    $('#full-shuffle')?.addEventListener('click', () => {
      const on = Player.toggleShuffle()
      $('#full-shuffle').classList.toggle('is-active', on)
    })

    $('#seek')?.addEventListener('input', (e) => {
      Player.seek(Number(e.target.value) / 1000)
    })

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
    renderSettingsForm()
    renderHome()
    renderLibrary()
    wireEvents()
  }

  return { init, toast, showScreen, renderHome, renderLibrary, renderSettingsForm }
})()
