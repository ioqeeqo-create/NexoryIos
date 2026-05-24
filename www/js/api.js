const Api = (() => {
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

  function base() {
    const u = String(cfg().gatewayUrl || '').trim().replace(/\/+$/, '')
    if (!u) throw new Error('Укажите Gateway URL (VPS или ПК)')
    return u
  }

  function headers() {
    const secret = String(cfg().gatewaySecret || '').trim()
    if (!secret) throw new Error('Укажите Gateway Secret')
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
        throw new Error('Gateway не отвечает (таймаут). Проверь URL и что сервер запущен')
      }
      throw new Error('Нет связи с gateway')
    } finally {
      clearTimeout(timer)
    }
  }

  async function health() {
    if (!hasGateway()) {
      if (DirectApi.hasDirectTokens()) return { ok: true, mode: 'direct' }
      throw new Error('Gateway не настроен')
    }
    const r = await fetchWithTimeout(`${base()}/health`, { method: 'GET' }, TIMEOUT.health)
    const data = await r.json().catch(() => ({}))
    if (!r.ok || !data.ok) throw new Error('Gateway не отвечает')
    return data
  }

  async function post(path, body, ms = TIMEOUT.default) {
    const r = await fetchWithTimeout(`${base()}/mobile/v1${path}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
    }, ms)
    const data = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`)
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
    return withHybrid(
      () => DirectApi.resolve(track),
      '/resolve',
      { track, tokens: tokens(), preferMobile: true },
      TIMEOUT.resolve,
    )
  }

  async function importPlaylist({ url, json }) {
    if (!hasGateway()) {
      throw new Error('Импорт по ссылке нужен gateway на VPS (Настройки → Gateway)')
    }
    return post('/playlist/import', { url, json, tokens: tokens() }, TIMEOUT.import)
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
    return withHybrid(
      () => DirectApi.waveFetch(opts),
      '/yandex/wave/fetch',
      {
        token: cfg().yandexToken,
        mode: opts.mode || 'default',
        resetSession: !!opts.resetSession,
        radioSessionId: opts.radioSessionId || cfg().yandexRotor?.radioSessionId,
        batchAnchorId: opts.batchAnchorId || cfg().yandexRotor?.batchAnchorId,
      },
      TIMEOUT.wave,
    )
  }

  async function waveFeedback(payload) {
    return withHybrid(
      () => DirectApi.waveFeedback(payload),
      '/yandex/wave/feedback',
      { token: cfg().yandexToken, ...payload },
      TIMEOUT.wave,
    )
  }

  return {
    search,
    resolve,
    importPlaylist,
    validateYandex,
    validateVk,
    waveFetch,
    waveFeedback,
    tokens,
    health,
    isConfigured,
    hasGateway,
    usesGatewayOnly,
    apiMode,
  }
})()
