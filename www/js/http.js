/**
 * HTTP для iOS: CapacitorHttp обходит CORS/Limitations WKWebView fetch.
 */
const Http = (() => {
  function isNative() {
    try {
      return typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()
    } catch {
      return false
    }
  }

  function capacitorHttp() {
    try {
      if (Capacitor?.Plugins?.CapacitorHttp) return Capacitor.Plugins.CapacitorHttp
      if (typeof CapacitorHttp !== 'undefined') return CapacitorHttp
    } catch (_) {}
    return null
  }

  function normalizeError(e) {
    const msg = String(e?.message || e || '')
    if (/load failed/i.test(msg)) {
      return new Error('Сеть недоступна (Load failed). Попробуй Gateway в настройках')
    }
    if (/aborted|abort/i.test(msg)) return new Error('Таймаут запроса')
    return e instanceof Error ? e : new Error(msg || 'Сеть недоступна')
  }

  async function request(url, opts = {}) {
    const method = String(opts.method || 'GET').toUpperCase()
    const headers = { ...(opts.headers || {}) }
    const timeout = Number(opts.timeout) || 20000
    const ch = capacitorHttp()

    if (isNative() && ch?.request) {
      const req = {
        url: String(url),
        method,
        headers,
        connectTimeout: timeout,
        readTimeout: timeout,
      }
      const body = opts.body
      if (body != null && body !== '') {
        req.data = typeof body === 'string' ? body : body
      }
      try {
        const r = await ch.request(req)
        const status = Number(r.status) || 0
        let data = r.data
        if (typeof data === 'string') {
          try {
            data = data ? JSON.parse(data) : {}
          } catch {
            data = { raw: data }
          }
        }
        return { ok: status >= 200 && status < 300, status, data: data ?? {} }
      } catch (e) {
        throw normalizeError(e)
      }
    }

    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeout)
    try {
      const r = await fetch(url, {
        method,
        headers,
        body: opts.body,
        signal: ctrl.signal,
      })
      const text = await r.text()
      let data = {}
      try {
        data = text ? JSON.parse(text) : {}
      } catch {
        data = { raw: text }
      }
      return { ok: r.ok, status: r.status, data }
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('Таймаут запроса')
      throw normalizeError(e)
    } finally {
      clearTimeout(timer)
    }
  }

  return { request, isNative }
})()
