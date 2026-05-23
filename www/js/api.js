const Api = (() => {
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

  async function health() {
    const r = await fetch(`${base()}/health`, { method: 'GET' })
    const data = await r.json().catch(() => ({}))
    if (!r.ok || !data.ok) throw new Error('Gateway не отвечает')
    return data
  }

  async function post(path, body) {
    const r = await fetch(`${base()}/mobile/v1${path}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok && !data.error) throw new Error(data.error || `HTTP ${r.status}`)
    if (data.error && data.ok === false) throw new Error(data.error)
    return data
  }

  async function search(q, source) {
    return post('/search', { q, source, tokens: tokens() })
  }

  async function resolve(track) {
    return post('/resolve', { track, tokens: tokens() })
  }

  async function validateYandex(token) {
    return post('/validate/yandex', { token })
  }

  async function validateVk(token) {
    return post('/validate/vk', { token })
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
    })
  }

  async function waveFeedback(payload) {
    const c = cfg()
    return post('/yandex/wave/feedback', { token: c.yandexToken, ...payload })
  }

  const POPULAR = {
    yandex: ['популярное', 'новинки', 'русский рэп', 'phonk'],
    vk: ['популярное', 'phonk', 'hyperpop', 'инди'],
    soundcloud: ['phonk', 'drill', 'hyperpop', 'lofi'],
  }

  return { search, resolve, validateYandex, validateVk, waveFetch, waveFeedback, POPULAR, tokens, health, isConfigured }
})()
