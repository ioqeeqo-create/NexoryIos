/**
 * Capacitor: внешний браузер OAuth и deep link nexory://
 */
const Bridge = (() => {
  const SC_REDIRECT = 'nexory://oauth/soundcloud'

  function plugin(name) {
    try {
      return Capacitor?.Plugins?.[name] || null
    } catch {
      return null
    }
  }

  async function openUrl(url) {
    const u = String(url || '').trim()
    if (!u) return
    const Browser = plugin('Browser')
    if (Browser?.open) {
      await Browser.open({ url: u, presentationStyle: 'fullscreen' })
      return
    }
    const a = document.createElement('a')
    a.href = u
    a.rel = 'noopener noreferrer'
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    setTimeout(() => a.remove(), 100)
  }

  function bindAppUrlOpen(handler) {
    const App = plugin('App')
    if (!App?.addListener) return
    App.addListener('appUrlOpen', (ev) => {
      const url = String(ev?.url || '')
      if (url) handler(url)
    })
  }

  function parseSoundCloudRedirect(url) {
    const raw = String(url || '').trim()
    if (!raw.toLowerCase().startsWith('nexory://')) return null
    try {
      const u = new URL(raw.replace('nexory://', 'https://nexory.local/'))
      if (!/\/oauth\/soundcloud/i.test(u.pathname)) return null
      const code = u.searchParams.get('code')
      const err = u.searchParams.get('error')
      return { code, error: err, raw }
    } catch {
      const codeM = raw.match(/[?&]code=([^&#]+)/i)
      if (codeM) return { code: decodeURIComponent(codeM[1]), error: null, raw }
      return null
    }
  }

  return { openUrl, bindAppUrlOpen, parseSoundCloudRedirect, SC_REDIRECT }
})()
