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

  function base() {
    const u = String(cfg().gatewayUrl || '').trim().replace(/\/+$/, '')
    if (!u) throw new Error('Укажите Gateway URL в настройках')
    return u
  }

  function headers() {
    const secret = String(cfg().gatewaySecret || '').trim()
    if (!secret) throw new Error('Укажите Gateway Secret в настройках')
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
    const c = cfg()
    return Boolean(String(c.gatewayUrl || '').trim() && String(c.gatewaySecret || '').trim())
  }

  async function fetchWithTimeout(url, opts = {}, ms = TIMEOUT.default) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), ms)
    try {
      return await fetch(url, { ...opts, signal: ctrl.signal })
    } catch (e) {
      if (e.name === 'AbortError') {
        throw new Error('Gateway не отвечает (таймаут). Проверь IP и что сервер запущен на ПК')
      }
      throw new Error('Нет связи с gateway. Телефон и ПК в одной Wi‑Fi?')
    } finally {
      clearTimeout(timer)
    }
  }

  async function health() {
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

  async function search(q, source) {
    return post('/search', { q, source, tokens: tokens() }, TIMEOUT.search)
  }

  async function resolve(track) {
    return post('/resolve', { track, tokens: tokens(), preferMobile: true }, TIMEOUT.resolve)
  }

  async function importPlaylist({ url, json }) {
    return post('/playlist/import', { url, json, tokens: tokens() }, TIMEOUT.import)
  }

  async function validateYandex(token) {
    return post('/validate/yandex', { token }, TIMEOUT.default)
  }

  async function validateVk(token) {
    return post('/validate/vk', { token }, TIMEOUT.default)
  }

  async function waveFetch(opts = {}) {
    const c = cfg()
    const rotor = c.yandexRotor || {}
    return post('/yandex/wave/fetch', {
      token: c.yandexToken,
      mode: opts.mode || 'default',
      resetSession: !!opts.resetSession,
      radioSessionId: opts.radioSessionId || rotor.radioSessionId,
      batchAnchorId: opts.batchAnchorId || rotor.batchAnchorId,
    }, TIMEOUT.wave)
  }

  async function waveFeedback(payload) {
    const c = cfg()
    return post('/yandex/wave/feedback', { token: c.yandexToken, ...payload }, TIMEOUT.wave)
  }

  return { search, resolve, importPlaylist, validateYandex, validateVk, waveFetch, waveFeedback, tokens, health, isConfigured }
})()
