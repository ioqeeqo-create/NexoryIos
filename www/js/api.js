const Api = (() => {
  let activeServerBase = null

  const TIMEOUT = {
    health: 8000,
    search: 22000,
    resolve: 45000,
    wave: 35000,
    import: 60000,
    default: 20000,
  }

  function cfg() {
    return Store.get()
  }

  function apiMode() {
    const m = String(cfg().apiMode || 'auto').toLowerCase()
    if (m === 'direct' || m === 'gateway') return m
    return 'auto'
  }

  function hasGateway() {
    const c = cfg()
    return Boolean(String(c.gatewayUrl || '').trim() && String(c.gatewaySecret || '').trim())
  }

  function serverBases() {
    const raw = String(cfg().gatewayUrl || '').trim().replace(/\/+$/, '')
    const fallback =
      typeof NexoryConfig !== 'undefined' ? String(NexoryConfig.DEFAULT_SERVER_URL || '').replace(/\/+$/, '') : ''
    const url = raw || fallback
    if (!url) return []
    const out = []
    const add = (u) => {
      if (u && !out.includes(u)) out.push(u)
    }
    add(url)
    if (!/:\d+$/.test(url)) add(`${url}:3950`)
    if (/:3950$/.test(url)) add(url.replace(/:3950$/, ''))
    return out
  }

  function base() {
    const bases = serverBases()
    if (activeServerBase && bases.includes(activeServerBase)) return activeServerBase
    if (bases[0]) return bases[0]
    throw new Error('Укажите URL сервера')
  }

  function headers() {
    const secret = String(cfg().gatewaySecret || '').trim()
    if (!secret) throw new Error('Укажите секрет сервера')
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
    }
  }

  function tokens() {
    const c = cfg()
    return {
      yandexToken: c.yandexToken,
      vkToken: c.vkToken,
      soundcloudClientId: c.scClientId,
      soundcloudAccessToken: c.scAccessToken,
    }
  }

  function isConfigured() {
    const mode = apiMode()
    if (mode === 'direct') return DirectApi.hasDirectTokens()
    if (mode === 'gateway') return hasGateway()
    return hasGateway() || DirectApi.hasDirectTokens()
  }

  function usesGatewayOnly() {
    return apiMode() === 'gateway' || (apiMode() === 'auto' && !DirectApi.hasDirectTokens())
  }

  async function fetchWithTimeout(url, opts = {}, ms = TIMEOUT.default) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), ms)
    try {
      return await fetch(url, { ...opts, signal: ctrl.signal })
    } catch (e) {
      if (e.name === 'AbortError') {
        throw new Error(
          'Gateway не отвечает (таймаут). На VPS: systemctl status nexory-gateway и открой порт 3950 в файрволе Timeweb',
        )
      }
      const hint = String(e?.message || e)
      if (/failed to fetch|network|load/i.test(hint)) {
        throw new Error('Нет связи с gateway — порт 3950 закрыт снаружи или nexory-gateway не запущен')
      }
      throw new Error('Нет связи с сервером')
    } finally {
      clearTimeout(timer)
    }
  }

  async function health() {
    if (!hasGateway()) {
      if (DirectApi.hasDirectTokens()) return { ok: true, mode: 'direct' }
      throw new Error('Сервер не настроен')
    }
    let lastErr = new Error('Сервер не отвечает')
    for (const b of serverBases()) {
      try {
        const r = await fetchWithTimeout(`${b}/health`, { method: 'GET' }, TIMEOUT.health)
        const data = await r.json().catch(() => ({}))
        if (!r.ok || !data.ok) {
          lastErr = new Error('Сервер не отвечает')
          continue
        }
        activeServerBase = b
        return { ...data, baseUrl: b }
      } catch (e) {
        lastErr = e
      }
    }
    throw lastErr
  }

  async function post(path, body, ms = TIMEOUT.default) {
    const r = await fetchWithTimeout(`${base()}/mobile/v1${path}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
    }, ms)
    const data = await r.json().catch(() => ({}))
    if (!r.ok) {
      if (r.status === 401 && String(data.error || '').toLowerCase() === 'unauthorized') {
        throw new Error('Неверный Gateway Secret — сверь с /opt/nexory/server/.env на VPS')
      }
      throw new Error(data.error || `HTTP ${r.status}`)
    }
    if (data.ok === false && data.error) throw new Error(data.error)
    return data
  }

  async function withHybrid(directFn, gatewayPath, gatewayBody, ms, { allowEmptyDirect = false } = {}) {
    const mode = apiMode()
    if (mode === 'gateway') return post(gatewayPath, gatewayBody, ms)
    if (mode === 'direct') return directFn()
    try {
      const out = await directFn()
      if (out?.ok !== false || allowEmptyDirect) return out
    } catch (e) {
      if (!hasGateway()) throw e
    }
    if (!hasGateway()) {
      throw new Error('Нет gateway и прямой запрос не удался')
    }
    return post(gatewayPath, gatewayBody, ms)
  }

  async function search(q, source) {
    return withHybrid(
      () => DirectApi.search(q, source),
      '/search',
      { q, source, tokens: tokens() },
      TIMEOUT.search,
      { allowEmptyDirect: true },
    )
  }

  async function resolve(track) {
    const src = String(track?.source || '').toLowerCase()
    const mode = apiMode()
    const preferGateway = hasGateway() && mode !== 'direct' && (src === 'soundcloud' || src === 'yandex')
    if (preferGateway) {
      try {
        const gw = await post(
          '/resolve',
          { track, tokens: tokens(), preferMobile: true },
          TIMEOUT.resolve,
        )
        if (gw.ok && gw.url) return gw
      } catch (e) {
        if (mode === 'gateway') throw e
      }
    }
    return withHybrid(
      () => DirectApi.resolve(track),
      '/resolve',
      { track, tokens: tokens(), preferMobile: true },
      TIMEOUT.resolve,
    )
  }

  async function importPlaylist({ url, json }) {
    if (json != null && json !== '') {
      if (hasGateway()) {
        return post('/playlist/import', { url, json, tokens: tokens() }, TIMEOUT.import)
      }
      throw new Error('JSON импортируется в приложении без сервера')
    }
    const link = String(url || '').trim()
    const isYandex = /(^|\/\/)(music\.)?yandex\./i.test(link) || /(^|\/\/)yandex\.[^/]+/i.test(link)
    const hasYm = Boolean(String(cfg().yandexToken || '').trim())
    const mode = apiMode()
    if (isYandex && hasYm && mode !== 'gateway') {
      try {
        const out = await DirectApi.importPlaylistLink({ url: link })
        if (out?.ok) return out
        if (mode === 'direct') return out
      } catch (e) {
        if (mode === 'direct') throw e
      }
    }
    if (hasGateway() && mode !== 'direct') {
      try {
        const out = await post('/playlist/import', { url, json, tokens: tokens() }, TIMEOUT.import)
        if (out?.ok) return out
        if (mode === 'gateway') throw new Error(out?.error || 'Импорт не удался')
      } catch (e) {
        if (mode === 'gateway') throw e
      }
    }
    if (isYandex && hasYm) {
      return DirectApi.importPlaylistLink({ url: link })
    }
    if (hasGateway()) {
      return post('/playlist/import', { url, json, tokens: tokens() }, TIMEOUT.import)
    }
    throw new Error('Импорт: настрой Gateway или добавь токен Яндекса')
  }

  async function validateYandex(token) {
    return withHybrid(
      () => DirectApi.validateYandex(token),
      '/validate/yandex',
      { token },
      TIMEOUT.default,
    )
  }

  async function validateVk(token) {
    return withHybrid(
      () => DirectApi.validateVk(token),
      '/validate/vk',
      { token },
      TIMEOUT.default,
    )
  }

  async function waveFetch(opts = {}) {
    const apiModeVal = apiMode()
    const waveOpts = { ...opts, mode: opts.mode || cfg().waveMood || 'default' }
    const hasYm = Boolean(String(cfg().yandexToken || '').trim())
    if (hasGateway() && apiModeVal !== 'direct') {
      try {
        const out = await post(
          '/yandex/wave/fetch',
          {
            token: cfg().yandexToken,
            mode: waveOpts.mode,
            resetSession: !!waveOpts.resetSession,
            radioSessionId: waveOpts.radioSessionId || cfg().yandexRotor?.radioSessionId,
            batchAnchorId: waveOpts.batchAnchorId || cfg().yandexRotor?.batchAnchorId,
          },
          TIMEOUT.wave,
        )
        if (out?.ok) return out
        if (apiModeVal === 'gateway') throw new Error(out?.error || 'Волна недоступна')
      } catch (e) {
        if (apiModeVal === 'gateway' || !hasYm) throw e
      }
    }
    if (!hasYm) {
      throw new Error('Нужен токен Яндекса в настройках')
    }
    try {
      return await DirectApi.waveFetch(waveOpts)
    } catch (e) {
      if (hasGateway() && /404|not found|unauthorized/i.test(String(e.message || e))) {
        return post(
          '/yandex/wave/fetch',
          {
            token: cfg().yandexToken,
            mode: waveOpts.mode,
            resetSession: !!waveOpts.resetSession,
            radioSessionId: waveOpts.radioSessionId || cfg().yandexRotor?.radioSessionId,
            batchAnchorId: waveOpts.batchAnchorId || cfg().yandexRotor?.batchAnchorId,
          },
          TIMEOUT.wave,
        )
      }
      throw e
    }
  }

  async function fetchLyrics(track, duration = 0) {
    if (hasGateway()) {
      try {
        const out = await post('/lyrics', { track, duration, tokens: tokens() }, TIMEOUT.default)
        if (out.ok && (out.synced || out.plain)) return out
        if (apiMode() === 'gateway') return out
      } catch (e) {
        if (apiMode() === 'gateway') throw e
      }
    }
    return { ok: false }
  }

  async function waveFeedback(payload) {
    return withHybrid(
      () => DirectApi.waveFeedback(payload),
      '/yandex/wave/feedback',
      { token: cfg().yandexToken, ...payload },
      TIMEOUT.wave,
    )
  }

  async function soundCloudReleases() {
    return DirectApi.fetchSoundCloudReleases()
  }

  async function soundCloudChartKind(kind, limit) {
    return DirectApi.fetchSoundCloudChartKind(kind, limit)
  }

  async function soundCloudMixes(limit) {
    return DirectApi.fetchSoundCloudMixes(limit)
  }

  async function validateSoundCloud(token) {
    try {
      return await DirectApi.validateSoundCloud(token)
    } catch (e) {
      if (!hasGateway()) throw e
      const t = tokens()
      const out = await post('/search', {
        source: 'soundcloud',
        q: 'test',
        tokens: t,
      }, TIMEOUT.default)
      if (out?.ok && (out.tracks?.length || out.mode === 'soundcloud')) {
        return {
          ok: true,
          username: 'через Gateway',
          scClientId: t.soundcloudClientId || '',
          scAccessToken: t.soundcloudAccessToken || '',
        }
      }
      throw e
    }
  }

  async function prepareSoundCloudOAuth() {
    return DirectApi.prepareSoundCloudOAuth()
  }

  async function discoverSoundCloudClientId() {
    return DirectApi.discoverSoundCloudClientId()
  }

  return {
    search,
    resolve,
    importPlaylist,
    validateYandex,
    validateVk,
    waveFetch,
    waveFeedback,
    fetchLyrics,
    soundCloudReleases,
    soundCloudChartKind,
    soundCloudMixes,
    validateSoundCloud,
    discoverSoundCloudClientId,
    prepareSoundCloudOAuth,
    tokens,
    health,
    isConfigured,
    hasGateway,
    usesGatewayOnly,
    apiMode,
  }
})()
