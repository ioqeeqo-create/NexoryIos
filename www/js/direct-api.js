/**
 * Прямые запросы с телефона к VK / Яндекс / SoundCloud (без ПК в локальной сети).
 * Gateway на VPS — запасной канал (импорт по ссылке, тяжёлый SC).
 */
const DirectApi = (() => {
  const YM = 'https://api.music.yandex.net'
  const YM_WAVE = 'user:onyourwave'
  const SC_AUTH_URL = 'https://secure.soundcloud.com/authorize'
  const SC_TOKEN_URL = 'https://secure.soundcloud.com/oauth/token'

  function scRedirectUri() {
    return String(
      typeof NexoryConfig !== 'undefined' ? NexoryConfig.SC_OAUTH_REDIRECT : '',
    ).trim() || 'nexory://oauth/soundcloud'
  }

  function mapWaveModeToMoodEnergy(mode) {
    const m = {
      default: 'all',
      sad: 'sad',
      happy: 'fun',
      energetic: 'active',
      calm: 'calm',
      romantic: 'fun',
    }
    return m[String(mode || 'default').trim()] || 'all'
  }

  function mapWaveModeToSeeds(mode) {
    const mood = mapWaveModeToMoodEnergy(mode)
    if (!mood || mood === 'all') return [YM_WAVE]
    return [YM_WAVE, `mood:${mood}`]
  }

  function buildRotorSessionBody(mode) {
    const moodEnergy = mapWaveModeToMoodEnergy(mode)
    const body = {
      seeds: mapWaveModeToSeeds(mode),
      includeTracksInResponse: true,
      includeWaveModel: true,
      interactive: true,
    }
    if (moodEnergy && moodEnergy !== 'all') {
      body.moodEnergy = moodEnergy
      body.waveSettings = {
        moodEnergy,
        diversity: mode === 'romantic' ? 'favorite' : 'discover',
        language: 'any',
      }
    }
    return body
  }

  async function sendRotorRadioStarted(oauth, parsed) {
    if (!parsed?.radioSessionId || !parsed.batchId) return
    try {
      await fetchJson(
        `${YM}/rotor/session/${encodeURIComponent(parsed.radioSessionId)}/feedback`,
        {
          method: 'POST',
          headers: yandexRotorHeaders(oauth),
          body: JSON.stringify({
            event: { type: 'radioStarted', timestamp: new Date().toISOString() },
            batchId: parsed.batchId,
          }),
          timeout: 12000,
        },
      )
    } catch (_) {}
  }

  const VK_UA = 'KateMobileAndroid/56 lite-460 (Android 9; 9; SDK 28; HIGH)'
  const VK_UA_ALT = 'KateMobileAndroid/52.1 lite-445 (Android 4.4.2; SDK 19; x86; unknown Android SDK built for x86; en)'
  const VK_SEARCH_PLANS = [
    ['get', VK_UA, '5.131'],
    ['post', VK_UA, '5.131'],
    ['post', VK_UA_ALT, '5.131'],
    ['post', VK_UA, '5.131', 'm'],
    ['post', VK_UA, '5.131', 'api.vk.ru'],
    ['post', VK_UA, '5.131', 'm', 'api.vk.ru'],
  ]

  function cfg() {
    return Store.get()
  }

  function tokens() {
    const c = cfg()
    return {
      yandexToken: c.yandexToken,
      vkToken: c.vkToken,
      soundcloudClientId: scAuth().clientId,
      soundcloudAccessToken: scAuth().oauth,
    }
  }

  function parseSoundCloudCredential(raw) {
    const s = String(raw || '').trim().replace(/^["']|["']$/g, '')
    if (!s) return { clientId: '', oauth: '' }
    const tokFromUrl = s.match(/access_token=([^&#]+)/i)
    if (tokFromUrl) {
      return { clientId: scClientIdFromCfg(), oauth: decodeURIComponent(tokFromUrl[1]).trim() }
    }
    const codeFromUrl = s.match(/[?&]code=([^&#]+)/i)
    if (codeFromUrl) {
      return { clientId: scClientIdFromCfg(), oauth: '', code: decodeURIComponent(codeFromUrl[1]).trim() }
    }
    if (s.length >= 50 && /^[A-Za-z0-9._-]+$/.test(s)) {
      return { clientId: scClientIdFromCfg(), oauth: s }
    }
    if (/^[A-Za-z0-9]{16,40}$/.test(s)) return { clientId: s, oauth: '' }
    return { clientId: s, oauth: '' }
  }

  function scClientIdFromCfg() {
    return String(cfg().scClientId || '').trim()
  }

  function scSecretFromCfg() {
    return String(cfg().scClientSecret || '').trim()
  }

  function scAuth() {
    const c = cfg()
    const fromAccess = parseSoundCloudCredential(c.scAccessToken)
    const fromClient = parseSoundCloudCredential(c.scClientId)
    const oauth = String(fromAccess.oauth || fromClient.oauth || c.scAccessToken || '').trim()
    const clientId = String(fromClient.clientId || fromAccess.clientId || c.scClientId || '').trim()
    return { clientId, oauth, secret: scSecretFromCfg() }
  }

  function hasDirectTokens() {
    const t = tokens()
    const sc = scAuth()
    return Boolean(
      String(t.yandexToken || '').trim()
      || String(t.vkToken || '').trim()
      || String(sc.oauth || '').trim()
      || String(sc.clientId || '').trim(),
    )
  }

  async function fetchJson(url, opts = {}) {
    return Http.request(url, opts)
  }

  function yandexOAuth(raw) {
    const t = String(raw || '').trim()
    const m = t.match(/access_token=([^&#]+)/)
    return (m ? decodeURIComponent(m[1]) : t).trim()
  }

  function yandexHeaders(oauth) {
    return {
      Authorization: `OAuth ${oauth}`,
      'X-Yandex-Music-Client': 'WindowsPhone/3.20',
      'User-Agent': 'Windows 10',
      Accept: 'application/json',
    }
  }

  function yandexRotorHeaders(oauth) {
    return {
      Authorization: `OAuth ${oauth}`,
      'X-Yandex-Music-Client': 'YandexMusicDesktop/5.42.2',
      'User-Agent':
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }
  }

  function md5Hex(str) {
    function cmn(q, a, b, x, s, t) {
      a = (a + q + x + t) | 0
      return (((a << s) | (a >>> (32 - s))) + b) | 0
    }
    function ff(a, b, c, d, x, s, t) {
      return cmn((b & c) | (~b & d), a, b, x, s, t)
    }
    function gg(a, b, c, d, x, s, t) {
      return cmn((b & d) | (c & ~d), a, b, x, s, t)
    }
    function hh(a, b, c, d, x, s, t) {
      return cmn(b ^ c ^ d, a, b, x, s, t)
    }
    function ii(a, b, c, d, x, s, t) {
      return cmn(c ^ (b | ~d), a, b, x, s, t)
    }
    function md5blk(s) {
      const blks = []
      for (let i = 0; i < 64; i += 4) {
        blks[i >> 2] =
          s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24)
      }
      return blks
    }
    let n = str.length
    const state = [1732584193, -271733879, -1732584194, 271733878]
    let i
    for (i = 64; i <= n; i += 64) {
      md5cycle(state, md5blk(str.substring(i - 64, i)))
    }
    str = str.substring(i - 64)
    const tail = Array(16).fill(0)
    for (i = 0; i < str.length; i++) tail[i >> 2] |= str.charCodeAt(i) << ((i % 4) << 3)
    tail[i >> 2] |= 0x80 << ((i % 4) << 3)
    if (i > 55) {
      md5cycle(state, tail)
      for (let j = 0; j < 16; j++) tail[j] = 0
    }
    tail[14] = n * 8
    md5cycle(state, tail)
    function md5cycle(x, blk) {
      let [a, b, c, d] = x
      a = ff(a, b, c, d, blk[0], 7, -680876936)
      d = ff(d, a, b, c, blk[1], 12, -389564586)
      c = ff(c, d, a, b, blk[2], 17, 606105819)
      b = ff(b, c, d, a, blk[3], 22, -1044525330)
      a = ff(a, b, c, d, blk[4], 7, -176418897)
      d = ff(d, a, b, c, blk[5], 12, 1200080426)
      c = ff(c, d, a, b, blk[6], 17, -1473231341)
      b = ff(b, c, d, a, blk[7], 22, -45705983)
      a = ff(a, b, c, d, blk[8], 7, 1770035416)
      d = ff(d, a, b, c, blk[9], 12, -1958414417)
      c = ff(c, d, a, b, blk[10], 17, -42063)
      b = ff(b, c, d, a, blk[11], 22, -1990404162)
      a = ff(a, b, c, d, blk[12], 7, 1804603682)
      d = ff(d, a, b, c, blk[13], 12, -40341101)
      c = ff(c, d, a, b, blk[14], 17, -1502002290)
      b = ff(b, c, d, a, blk[15], 22, 1236535329)
      a = gg(a, b, c, d, blk[1], 5, -165796510)
      d = gg(d, a, b, c, blk[6], 9, -1069501632)
      c = gg(c, d, a, b, blk[11], 14, 643717713)
      b = gg(b, c, d, a, blk[0], 20, -373897302)
      a = gg(a, b, c, d, blk[5], 5, -701558691)
      d = gg(d, a, b, c, blk[10], 9, 38016083)
      c = gg(c, d, a, b, blk[15], 14, -660478335)
      b = gg(b, c, d, a, blk[4], 20, -405537848)
      a = gg(a, b, c, d, blk[9], 5, 568446438)
      d = gg(d, a, b, c, blk[14], 9, -1019803690)
      c = gg(c, d, a, b, blk[3], 14, -187363961)
      b = gg(b, c, d, a, blk[8], 20, 1163531501)
      a = gg(a, b, c, d, blk[13], 5, -1444681467)
      d = gg(d, a, b, c, blk[2], 9, -51403784)
      c = gg(c, d, a, b, blk[7], 14, 1735328473)
      b = gg(b, c, d, a, blk[12], 20, -1926607734)
      a = hh(a, b, c, d, blk[5], 4, -378558)
      d = hh(d, a, b, c, blk[8], 11, -2022574463)
      c = hh(c, d, a, b, blk[11], 16, 1839030562)
      b = hh(b, c, d, a, blk[14], 23, -35309556)
      a = hh(a, b, c, d, blk[1], 4, -1530992060)
      d = hh(d, a, b, c, blk[4], 11, 1272893353)
      c = hh(c, d, a, b, blk[7], 16, -155497632)
      b = hh(b, c, d, a, blk[10], 23, -1094730640)
      a = hh(a, b, c, d, blk[13], 4, 681279174)
      d = hh(d, a, b, c, blk[0], 11, -358537222)
      c = hh(c, d, a, b, blk[3], 16, -722521979)
      b = hh(b, c, d, a, blk[6], 23, 76029189)
      a = hh(a, b, c, d, blk[9], 4, -640364487)
      d = hh(d, a, b, c, blk[12], 11, -421815835)
      c = hh(c, d, a, b, blk[15], 16, 530742520)
      b = hh(b, c, d, a, blk[2], 23, -995338651)
      a = ii(a, b, c, d, blk[0], 6, -198630844)
      d = ii(d, a, b, c, blk[7], 10, 1126891415)
      c = ii(c, d, a, b, blk[14], 15, -1416354905)
      b = ii(b, c, d, a, blk[5], 21, -57434055)
      a = ii(a, b, c, d, blk[12], 6, 1700485571)
      d = ii(d, a, b, c, blk[3], 10, -1894986606)
      c = ii(c, d, a, b, blk[10], 15, -1051523)
      b = ii(b, c, d, a, blk[1], 21, -2054922799)
      a = ii(a, b, c, d, blk[8], 6, 1873313359)
      d = ii(d, a, b, c, blk[15], 10, -30611744)
      c = ii(c, d, a, b, blk[6], 15, -1560198380)
      b = ii(b, c, d, a, blk[13], 21, 1309151649)
      a = ii(a, b, c, d, blk[4], 6, -145523070)
      d = ii(d, a, b, c, blk[11], 10, -1120210379)
      c = ii(c, d, a, b, blk[2], 15, 718787259)
      b = ii(b, c, d, a, blk[9], 21, -343485551)
      x[0] = (a + x[0]) | 0
      x[1] = (b + x[1]) | 0
      x[2] = (c + x[2]) | 0
      x[3] = (d + x[3]) | 0
    }
    const HEX = '0123456789abcdef'
    function rhex(n) {
      let s = ''
      for (let j = 0; j < 4; j++) {
        s += HEX[(n >> (j * 8 + 4)) & 0x0f] + HEX[(n >> (j * 8)) & 0x0f]
      }
      return s
    }
    return (rhex(state[0]) + rhex(state[1]) + rhex(state[2]) + rhex(state[3])).toLowerCase()
  }

  function vkHeaders(ua, site = 'www') {
    if (site === 'm') {
      return {
        'User-Agent': ua,
        Referer: 'https://m.vk.com/',
        Origin: 'https://m.vk.com',
        Accept: 'application/json',
      }
    }
    return {
      'User-Agent': ua,
      Referer: 'https://vk.com/',
      Origin: 'https://vk.com',
      Accept: 'application/json',
    }
  }

  async function vkKate(method, params, plans = VK_SEARCH_PLANS) {
    const base = { lang: '0', ...params }
    let last = { status: 0, data: { error: { error_msg: 'empty', error_code: -1 } } }
    for (const entry of plans) {
      const kind = entry[0]
      const ua = entry[1]
      const ver = entry[2]
      let site = 'www'
      let host = 'api.vk.com'
      for (let i = 3; i < entry.length; i++) {
        const x = entry[i]
        if (x === 'm') site = 'm'
        else if (typeof x === 'string' && /^api\.vk\./.test(x)) host = x
      }
      const qs = new URLSearchParams({ ...base, v: ver }).toString()
      const heads = vkHeaders(ua, site)
      const url =
        kind === 'get'
          ? `https://${host}/method/${method}?${qs}`
          : `https://${host}/method/${method}`
      const r = await fetchJson(url, {
        method: kind === 'get' ? 'GET' : 'POST',
        headers:
          kind === 'get'
            ? heads
            : { ...heads, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: kind === 'get' ? undefined : qs,
        timeout: 16000,
      })
      last = { status: r.status, data: r.data }
      if (last.data && !last.data.error) return last
      const ec = last.data?.error?.error_code
      if (ec != null && ec !== 3) return last
    }
    return last
  }

  async function validateYandex(token) {
    const oauth = yandexOAuth(token)
    if (!oauth) return { ok: false, error: 'Пустой токен' }
    const r = await fetchJson(`${YM}/account/status`, { headers: yandexHeaders(oauth), timeout: 12000 })
    if (r.status === 401 || r.status === 403) return { ok: false, error: 'Токен недействителен' }
    const login = r.data?.result?.account?.login || r.data?.result?.login || ''
    return { ok: true, login: String(login) }
  }

  async function validateVk(token) {
    const t = String(token || '').trim()
    if (!t) return { ok: false, error: 'Пустой токен' }
    const r = await vkKate('users.get', { access_token: t, fields: 'photo_100' })
    if (r.data?.error) {
      return { ok: false, error: r.data.error.error_msg || 'VK API' }
    }
    const u = r.data?.response?.[0]
    if (!u) return { ok: false, error: 'Пустой ответ VK' }
    return { ok: true, userId: u.id, name: [u.first_name, u.last_name].filter(Boolean).join(' ') }
  }

  async function searchYandex(q, oauth) {
    const r = await fetchJson(
      `${YM}/search?${new URLSearchParams({ text: q, type: 'track', page: '0' })}`,
      { headers: yandexHeaders(oauth), timeout: 14000 },
    )
    const rows = r.data?.result?.tracks?.results || []
    return rows.map((t) => ({
      title: t.title || 'Без названия',
      artist: (t.artists || []).map((a) => a.name).join(', ') || '—',
      cover: t.coverUri ? `https://${String(t.coverUri).replace('%%', '300x300')}` : null,
      source: 'yandex',
      id: String(t.id),
    }))
  }

  async function searchVk(q, token) {
    const r = await vkKate(
      'audio.search',
      { q, access_token: token, count: '20', auto_complete: '1' },
      VK_SEARCH_PLANS,
    )
    const resp = r.data?.response
    const items = Array.isArray(resp) ? resp : Array.isArray(resp?.items) ? resp.items : []
    return items
      .filter((t) => t?.url)
      .map((t) => ({
        title: t.title || 'Без названия',
        artist: t.artist || '—',
        url: t.url,
        cover: t.album?.thumb?.photo_300 || null,
        source: 'vk',
        id: String(t.id || ''),
      }))
  }

  function soundCloudArtworkUrl(t) {
    const raw = t?.artwork_url || t?.user?.avatar_url || t?.user?.visuals?.metapages?.[0]?.visual_url || null
    if (!raw) return null
    let u = String(raw).trim()
    if (u.startsWith('//')) u = `https:${u}`
    else if (/^http:\/\//i.test(u)) u = u.replace(/^http:/i, 'https:')
    u = u.split('?')[0]
    if (!/sndcdn\.com/i.test(u)) return u
    if (!/-t\d+x\d+\./i.test(u)) {
      u = u.replace(/-(large|original|crop|small|tiny|badge-large|visual-proportioned)(?=\.[a-z]{3,4}$)/i, '-t300x300')
    }
    return u
  }

  function mapSoundCloudTrack(t, auth) {
    const { clientId: cid, oauth } = auth || scAuth()
    const trans = (t.media?.transcodings || []).find((x) => x?.format?.protocol === 'progressive')
      || (t.media?.transcodings || [])[0]
    let streamUrl = null
    if (t.stream_url) {
      streamUrl = String(t.stream_url)
      if (!oauth) streamUrl += `${streamUrl.includes('?') ? '&' : '?'}client_id=${encodeURIComponent(cid)}`
    }
    return {
      title: t.title || 'Без названия',
      artist: t.user?.username || '—',
      url: streamUrl,
      scTranscoding: trans?.url || null,
      scClientId: cid,
      scAccessToken: oauth || '',
      cover: soundCloudArtworkUrl(t),
      source: 'soundcloud',
      id: String(t.id || ''),
      durationMs: Number(t.duration || t.full_duration || 0) || undefined,
    }
  }

  const CIS_SC_COUNTRIES = new Set([
    'RU', 'UA', 'BY', 'KZ', 'UZ', 'AM', 'AZ', 'GE', 'KG', 'MD', 'TJ', 'TM', 'LT', 'LV', 'EE',
  ])
  const CIS_SC_CYRILLIC = /[\u0400-\u04FF\u0500-\u052F]/
  const CIS_SC_TAG_HINTS = /\b(снг|ru\b|russia|russian|украин|беларус|казах|phonk|hardstyle|jumpstyle|микс)\b/i

  function isCisSoundCloudRaw(t) {
    if (!t) return false
    const user = t.user || {}
    const title = String(t.title || '')
    const artist = String(user.username || '')
    const tags = Array.isArray(t.tag_list) ? t.tag_list.join(' ') : String(t.tags || '')
    const blob = `${title} ${artist} ${tags} ${user.city || ''}`
    if (CIS_SC_CYRILLIC.test(blob)) return true
    const cc = String(user.country_code || user.country || '').toUpperCase()
    if (cc && CIS_SC_COUNTRIES.has(cc)) return true
    return CIS_SC_TAG_HINTS.test(blob)
  }

  function dedupeSoundCloudRaw(rows) {
    const seen = new Set()
    return rows.filter((t) => {
      const id = String(t?.id || `${t?.title || ''}:${t?.user?.username || ''}`)
      if (!id || seen.has(id)) return false
      seen.add(id)
      return true
    })
  }

  async function searchSoundCloudTracksRaw(q, limit, auth) {
    const u = new URL(soundCloudRequestUrl('/search/tracks', auth))
    u.searchParams.set('q', q)
    u.searchParams.set('limit', String(limit))
    const r = await fetchJson(u.toString(), { headers: soundCloudHeaders(auth), timeout: 18000 })
    return Array.isArray(r.data) ? r.data : r.data?.collection || []
  }

  async function fetchSoundCloudCisTracks(queries, limit = 20) {
    const auth = scAuth()
    if (!auth.clientId && !auth.oauth) throw new Error('Укажи SoundCloud Client ID')
    let raw = []
    for (const q of queries) {
      if (raw.length >= limit * 3) break
      try {
        const batch = await searchSoundCloudTracksRaw(q, Math.max(12, limit), auth)
        raw = raw.concat(batch)
      } catch (_) {}
    }
    if (raw.length < limit) {
      try {
        const u = new URL(soundCloudRequestUrl('/charts', auth))
        u.searchParams.set('genre', 'soundcloud:genres:hiphoprap')
        u.searchParams.set('kind', 'trending')
        u.searchParams.set('limit', String(limit * 2))
        const charts = await fetchJson(u.toString(), { headers: soundCloudHeaders(auth), timeout: 18000 })
        const coll = charts.data?.collection || charts.data
        const rows = Array.isArray(coll) ? coll.map((item) => item?.track || item).filter(Boolean) : []
        raw = raw.concat(rows)
      } catch (_) {}
    }
    const filtered = dedupeSoundCloudRaw(raw).filter(isCisSoundCloudRaw)
    return filtered
      .slice(0, limit)
      .map((t) => mapSoundCloudTrack(t, auth))
      .filter((t) => t.scTranscoding || t.url)
  }

  async function fetchSoundCloudCisPopular(limit = 20) {
    return fetchSoundCloudCisTracks([
      'снг phonk',
      'снг hardstyle',
      'russian phonk',
      'снг underground',
      'jumpstyle снг',
      'phonk ru',
    ], limit)
  }

  async function fetchSoundCloudCisMixes(limit = 20) {
    return fetchSoundCloudCisTracks([
      'снг mix',
      'russian mix',
      'микс снг',
      'phonk mix ru',
      'hardstyle mix снг',
    ], limit)
  }

  async function fetchSoundCloudChartKind(kind, limit = 20) {
    const auth = scAuth()
    if (!auth.clientId && !auth.oauth) throw new Error('Укажи SoundCloud Client ID')
    const u = new URL(soundCloudRequestUrl('/charts'))
    u.searchParams.set('genre', 'soundcloud:genres:all-music')
    u.searchParams.set('kind', String(kind || 'trending'))
    u.searchParams.set('limit', String(limit))
    const charts = await fetchJson(u.toString(), { headers: soundCloudHeaders(auth), timeout: 18000 })
    const coll = charts.data?.collection || charts.data
    const rows = Array.isArray(coll) ? coll.map((item) => item?.track || item).filter(Boolean) : []
    return rows.map((t) => mapSoundCloudTrack(t, auth)).filter((t) => t.scTranscoding || t.url)
  }

  async function fetchSoundCloudMixes(limit = 20) {
    const auth = scAuth()
    if (!auth.clientId && !auth.oauth) throw new Error('Укажи SoundCloud Client ID')
    const spotU = new URL(soundCloudRequestUrl('/spotlight'))
    spotU.searchParams.set('limit', String(limit))
    const spot = await fetchJson(spotU.toString(), { headers: soundCloudHeaders(auth), timeout: 18000 })
    let rows = []
    const spotColl = spot.data?.collection || spot.data
    if (Array.isArray(spotColl)) rows = spotColl.map((item) => item?.track || item).filter(Boolean)
    if (!rows.length) {
      const u = new URL(soundCloudRequestUrl('/search/tracks'))
      u.searchParams.set('q', 'mix')
      u.searchParams.set('limit', String(limit))
      const r = await fetchJson(u.toString(), { headers: soundCloudHeaders(auth), timeout: 18000 })
      const found = Array.isArray(r.data) ? r.data : r.data?.collection || []
      rows = found
    }
    return rows.map((t) => mapSoundCloudTrack(t, auth)).filter((t) => t.scTranscoding || t.url)
  }

  function soundCloudRequestUrl(path, auth) {
    const { clientId, oauth } = auth || scAuth()
    const u = new URL(path.startsWith('http') ? path : `https://api-v2.soundcloud.com${path}`)
    if (oauth) u.searchParams.set('oauth_token', oauth)
    else if (clientId) u.searchParams.set('client_id', clientId)
    return u.toString()
  }

  function soundCloudHeaders(auth) {
    const { oauth } = auth || scAuth()
    const h = {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15',
    }
    if (oauth) h.Authorization = `OAuth ${oauth}`
    return h
  }

  function randomB64Url(bytes) {
    const a = new Uint8Array(bytes)
    crypto.getRandomValues(a)
    return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }

  async function sha256Base64Url(str) {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
    return btoa(String.fromCharCode(...new Uint8Array(hash))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }

  async function prepareSoundCloudOAuth() {
    const clientId = scClientIdFromCfg()
    if (!clientId) {
      throw new Error('Сначала укажи Client ID приложения SoundCloud (поле выше)')
    }
    const verifier = randomB64Url(32)
    const state = randomB64Url(12)
    const challenge = await sha256Base64Url(verifier)
    const pkce = { verifier, state, challenge, clientId }
    try { sessionStorage.setItem('nexory_sc_pkce', JSON.stringify(pkce)) } catch (_) {}
    const redirect = scRedirectUri()
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirect,
      response_type: 'code',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state,
      scope: '*',
    })
    return `${SC_AUTH_URL}?${params}`
  }

  const SC_PATTERNS = [
    /client_id["']?\s*[:=]\s*["']([a-zA-Z0-9]{32})["']/,
    /client_id\s*:\s*"([a-zA-Z0-9]{32})"/,
    /client_id="([a-zA-Z0-9]{32})"/,
    /"client_id","([a-zA-Z0-9]{32})"/,
    /,client_id:"([a-zA-Z0-9]{32})"/,
    /\?client_id=([a-zA-Z0-9]{32})/,
    /client_id\s*=\s*"([a-zA-Z0-9]{32})"/,
    /["']client_id["']\s*:\s*["']([a-zA-Z0-9]{32})["']/,
    /clientId["']?\s*:\s*["']([a-zA-Z0-9]{32})["']/i,
  ]
  const SC_HTML_PAGES = [
    'https://soundcloud.com/',
    'https://soundcloud.com/discover',
    'https://m.soundcloud.com/',
  ]
  const SC_UA =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1'
  let _scDiscoveredCache = null

  function responseText(data) {
    if (typeof data === 'string') return data
    if (data && typeof data.raw === 'string') return data.raw
    return ''
  }

  function extractSndcdnScriptUrls(html) {
    const raw = String(html || '')
    const out = []
    const reList = [
      /src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js)"/g,
      /"(https:\/\/[a-z0-9.-]*sndcdn\.com\/[^"]+\.js)"/gi,
    ]
    for (const re of reList) {
      let m
      const r = new RegExp(re.source, re.flags)
      while ((m = r.exec(raw)) !== null) {
        if (m[1]) out.push(m[1])
      }
    }
    return [...new Set(out)].slice(0, 10)
  }

  function collectCandidateClientIds(jsText) {
    const text = String(jsText || '')
    const found = new Set()
    for (const pattern of SC_PATTERNS) {
      const g = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`)
      let m
      while ((m = g.exec(text)) !== null) {
        const id = m[1]
        if (id && /^[a-zA-Z0-9]{32}$/.test(id)) found.add(id)
      }
    }
    return [...found]
  }

  async function verifyScClientIdWorks(clientId) {
    const cid = String(clientId || '').trim()
    if (!/^[a-zA-Z0-9]{32}$/.test(cid)) return false
    const test = new URL('https://api-v2.soundcloud.com/search/tracks')
    test.searchParams.set('q', 'a')
    test.searchParams.set('client_id', cid)
    test.searchParams.set('limit', '1')
    try {
      const r = await fetchJson(test.toString(), {
        headers: soundCloudHeaders({ clientId: cid }),
        timeout: 12000,
      })
      if (r.status === 401 || r.status === 403 || !r.ok) return false
      const d = r.data
      return Array.isArray(d) || Array.isArray(d?.collection) || Array.isArray(d?.tracks)
    } catch {
      return false
    }
  }

  async function discoverSoundCloudClientId() {
    if (_scDiscoveredCache) return { ok: true, clientId: _scDiscoveredCache }
    const manual = scClientIdFromCfg()
    if (manual && await verifyScClientIdWorks(manual)) {
      _scDiscoveredCache = manual
      return { ok: true, clientId: manual }
    }
    const candidates = new Set()
    const htmlHeaders = {
      'User-Agent': SC_UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    }
    for (const page of SC_HTML_PAGES) {
      try {
        const htmlR = await fetchJson(page, { headers: htmlHeaders, timeout: 18000 })
        const html = responseText(htmlR.data)
        collectCandidateClientIds(html).forEach((id) => candidates.add(id))
        for (const scriptUrl of extractSndcdnScriptUrls(html)) {
          try {
            const jsR = await fetchJson(scriptUrl, { headers: htmlHeaders, timeout: 15000 })
            collectCandidateClientIds(responseText(jsR.data)).forEach((id) => candidates.add(id))
          } catch (_) {}
        }
      } catch (_) {}
    }
    for (const id of candidates) {
      if (await verifyScClientIdWorks(id)) {
        _scDiscoveredCache = id
        return { ok: true, clientId: id }
      }
    }
    return {
      ok: false,
      error: 'Не удалось найти Client ID. OAuth требует SoundCloud Developer (Artist Pro для новых приложений).',
    }
  }

  async function exchangeSoundCloudCode(code, verifier, clientId, secret) {
    const cid = String(clientId || scClientIdFromCfg()).trim()
    const redirect = scRedirectUri()
    const form = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: cid,
      redirect_uri: redirect,
      code: String(code || '').trim(),
      code_verifier: String(verifier || '').trim(),
    })
    if (secret) form.set('client_secret', String(secret).trim())
    const r = await fetchJson(SC_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: form.toString(),
      timeout: 22000,
    })
    const access = r.data?.access_token
    if (!access) return { ok: false, error: r.data?.error_description || r.data?.error || 'Нет access_token' }
    return { ok: true, accessToken: String(access), clientId: cid }
  }

  async function validateSoundCloud(raw) {
    const parsed = parseSoundCloudCredential(raw)
    if (parsed.code) {
      let pkce = null
      try { pkce = JSON.parse(sessionStorage.getItem('nexory_sc_pkce') || 'null') } catch (_) {}
      if (!pkce?.verifier) {
        return { ok: false, error: 'Сначала «Войти в SoundCloud», затем вставь redirect-ссылку с code' }
      }
      const ex = await exchangeSoundCloudCode(
        parsed.code,
        pkce.verifier,
        pkce.clientId || scClientIdFromCfg(),
        scSecretFromCfg(),
      )
      if (!ex.ok) return ex
      const me = await fetchJson(soundCloudRequestUrl('/me', { clientId: ex.clientId, oauth: ex.accessToken }), {
        headers: soundCloudHeaders({ oauth: ex.accessToken }),
        timeout: 15000,
      })
      if (!me.ok) return { ok: false, error: 'Токен есть, но профиль SC не открылся' }
      return {
        ok: true,
        username: me.data?.username || me.data?.permalink,
        scClientId: ex.clientId,
        scAccessToken: ex.accessToken,
      }
    }
    const oauth = parsed.oauth
    const clientId = parsed.clientId || scClientIdFromCfg()
    if (oauth) {
      const me = await fetchJson(soundCloudRequestUrl('/me', { clientId, oauth }), {
        headers: soundCloudHeaders({ oauth }),
        timeout: 15000,
      })
      if (me.status === 401 || me.status === 403) return { ok: false, error: 'Неверный OAuth-токен' }
      if (!me.ok) return { ok: false, error: 'SoundCloud /me недоступен' }
      return { ok: true, username: me.data?.username, scClientId: clientId, scAccessToken: oauth }
    }
    const test = new URL(soundCloudRequestUrl('/search/tracks', { clientId, oauth: '' }))
    test.searchParams.set('q', 'a')
    test.searchParams.set('limit', '1')
    const r = await fetchJson(test.toString(), { headers: soundCloudHeaders({ clientId }), timeout: 15000 })
    if (r.status === 401 || r.status === 403) return { ok: false, error: 'Неверный Client ID' }
    if (!r.ok) return { ok: false, error: 'SoundCloud API не ответил' }
    return { ok: true, username: 'Client ID OK', scClientId: clientId, scAccessToken: '' }
  }

  async function fetchSoundCloudReleases() {
    return fetchSoundCloudChartKind('trending', 20)
  }

  async function searchSoundCloud(q) {
    const auth = scAuth()
    if (!auth.clientId && !auth.oauth) throw new Error('Укажи SoundCloud Client ID или OAuth-токен')
    const u = new URL(soundCloudRequestUrl('/search/tracks'))
    u.searchParams.set('q', q)
    u.searchParams.set('limit', '20')
    const r = await fetchJson(u.toString(), { headers: soundCloudHeaders(auth), timeout: 18000 })
    if (r.status === 401 || r.status === 403) {
      throw new Error('SoundCloud: неверный токен или Client ID')
    }
    const rows = Array.isArray(r.data) ? r.data : r.data?.collection || []
    return rows.map((t) => mapSoundCloudTrack(t, auth)).filter((t) => t.scTranscoding || t.url)
  }

  async function resolveYandex(trackId, oauth) {
    const info = await fetchJson(`${YM}/tracks/${encodeURIComponent(trackId)}/download-info`, {
      headers: yandexHeaders(oauth),
      timeout: 12000,
    })
    const rows = info.data?.result || []
    if (!rows.length) return { ok: false, error: 'Яндекс: нет потока (нужен Плюс?)' }
    const pick = (codec) =>
      rows
        .filter((s) => String(s.codec || '').toLowerCase().includes(codec))
        .sort((a, b) => Number(b.bitrateInKbps || 0) - Number(a.bitrateInKbps || 0))
    const aac = pick('aac')
    const mp3 = pick('mp3')
    const src = (aac[0] || mp3[0] || rows.sort((a, b) => Number(b.bitrateInKbps || 0) - Number(a.bitrateInKbps || 0))[0])
    if (!src?.downloadInfoUrl) return { ok: false, error: 'Яндекс: нет download URL' }
    const xmlR = await fetchJson(src.downloadInfoUrl, {
      headers: { Authorization: `OAuth ${oauth}`, Accept: 'application/xml' },
      timeout: 12000,
    })
    const raw = typeof xmlR.data === 'string' ? xmlR.data : xmlR.data?.raw || ''
    const host = (raw.match(/<host>([^<]+)<\/host>/) || [])[1]
    const path = (raw.match(/<path>([^<]+)<\/path>/) || [])[1]
    const ts = (raw.match(/<ts>([^<]+)<\/ts>/) || [])[1]
    const s = (raw.match(/<s>([^<]+)<\/s>/) || [])[1]
    if (!host || !path || !ts || !s) return { ok: false, error: 'Яндекс: не распарсили поток' }
    const sign = md5Hex(`XGRlBW9FXlekgbPrRHuSiA${path.slice(1)}${s}`)
    return { ok: true, url: `https://${host}/get-mp3/${sign}/${ts}${path}` }
  }

  async function fetchScTrackTranscoding(trackId, authIn) {
    const auth = authIn || scAuth()
    const id = String(trackId || '').replace(/\D/g, '') || String(trackId || '').trim()
    if (!id || (!auth.clientId && !auth.oauth)) return null
    const r = await fetchJson(soundCloudRequestUrl(`/tracks/${encodeURIComponent(id)}`, auth), {
      headers: soundCloudHeaders(auth),
      timeout: 16000,
    })
    if (r.status === 401 || r.status === 403) throw new Error('SoundCloud: неверный токен')
    const t = r.data
    if (!t || typeof t !== 'object') return null
    const trans = t.media?.transcodings || []
    const prog = trans.find((x) => x?.format?.protocol === 'progressive')
    const hls = trans.find((x) => x?.format?.protocol === 'hls')
    let streamUrl = t.stream_url ? String(t.stream_url) : null
    if (streamUrl && !auth.oauth) {
      streamUrl += `${streamUrl.includes('?') ? '&' : '?'}client_id=${encodeURIComponent(auth.clientId)}`
    }
    return {
      scTranscoding: (prog || hls || trans[0])?.url || null,
      streamUrl,
    }
  }

  async function resolveSoundCloud(track) {
    const auth = scAuth()
    const cid = String(track.scClientId || auth.clientId || '').trim()
    const oauth = String(track.scAccessToken || auth.oauth || '').trim()
    const useAuth = { clientId: cid || scClientIdFromCfg(), oauth, secret: scSecretFromCfg() }
    if (!useAuth.clientId && !useAuth.oauth) {
      return { ok: false, error: 'Укажи SoundCloud Client ID или OAuth-токен' }
    }
    let transcoding = track.scTranscoding
    if (!transcoding && track.id) {
      try {
        const meta = await fetchScTrackTranscoding(track.id, useAuth)
        transcoding = meta?.scTranscoding || null
        if (!track.url && meta?.streamUrl) track.url = meta.streamUrl
      } catch (e) {
        return { ok: false, error: e.message || 'SoundCloud: не удалось загрузить трек' }
      }
    }
    if (!transcoding) {
      if (track.url) return { ok: true, url: track.url }
      return { ok: false, error: 'SoundCloud: нет transcoding — OAuth-токен или Gateway' }
    }
    const u = new URL(transcoding)
    if (useAuth.oauth) u.searchParams.set('oauth_token', useAuth.oauth)
    else u.searchParams.set('client_id', useAuth.clientId)
    const r = await fetchJson(`https://${u.host}${u.pathname}${u.search}`, {
      headers: soundCloudHeaders(useAuth),
      timeout: 16000,
    })
    if (r.data?.url) return { ok: true, url: r.data.url }
    return { ok: false, error: 'SoundCloud: пустой ответ стрима' }
  }

  function mapRotorTrack(t, batchId, radioSessionId) {
    if (!t?.title) return null
    const id = String(t.id || '').split(':')[0]
    return {
      title: String(t.title).trim(),
      artist: (t.artists || []).map((a) => a.name).filter(Boolean).join(', ') || '—',
      cover: t.coverUri ? `https://${String(t.coverUri).replace('%%', '300x300')}` : null,
      source: 'yandex',
      id,
      durationMs: Number(t.durationMs || 0) || undefined,
      yandexRotor: {
        batchId,
        sessionBatchId: batchId,
        radioSessionId,
        station: YM_WAVE,
      },
    }
  }

  function parseRotorBody(data, mode = 'default') {
    const res = data?.result != null ? data.result : data
    const radioSessionId = String(res?.radioSessionId || res?.radio_session_id || '').trim()
    const batchId = String(res?.batchId || res?.batch_id || '').trim()
    const tracks = []
    for (const item of res?.sequence || []) {
      if (String(item?.type).toLowerCase() !== 'track' || !item?.track) continue
      const itemBatch = String(item.batchId || item.batch_id || batchId || '').trim()
      const row = mapRotorTrack(item.track, itemBatch, radioSessionId)
      if (row) tracks.push(row)
    }
    const lastTrack = tracks.length ? tracks[tracks.length - 1] : null
    const batchAnchorId = lastTrack?.id ? String(lastTrack.id) : ''
    let radioStartedFrom = 'radio-mobile-user-onyourwave-default'
    const desc = res?.descriptionSeed || res?.description_seed
    if (desc && typeof desc === 'object') {
      const typ = String(desc.type || 'user').trim() || 'user'
      const tag = String(desc.tag || 'onyourwave').trim() || 'onyourwave'
      radioStartedFrom = `radio-mobile-${typ}-${tag}-default`
    }
    return {
      radioSessionId,
      batchId,
      tracks,
      batchAnchorId,
      nextQueueTrackId: batchAnchorId,
      radioStartedFrom,
      moodEnergy: mapWaveModeToMoodEnergy(mode),
      mode: mode || 'default',
    }
  }

  function parseRotorStationTracksBody(data) {
    const res = data?.result != null ? data.result : data
    if (!res || typeof res !== 'object') return { tracks: [], batchId: '', batchAnchorId: '', nextQueueTrackId: '' }
    let batchId = String(res.batchId || res.batch_id || '').trim()
    const sequence = Array.isArray(res.sequence) ? res.sequence : []
    if (!batchId && sequence.length) {
      batchId = String(sequence[0]?.batchId || sequence[0]?.batch_id || '').trim()
    }
    const tracks = []
    for (const item of sequence) {
      if (String(item?.type).toLowerCase() !== 'track' || !item?.track) continue
      const row = mapRotorTrack(item.track, batchId, '')
      if (row) tracks.push(row)
    }
    const lastTrack = tracks.length ? tracks[tracks.length - 1] : null
    const batchAnchorId = lastTrack?.id ? String(lastTrack.id) : ''
    return { tracks, batchId, batchAnchorId, nextQueueTrackId: batchAnchorId }
  }

  async function applyRotorStationMoodSettings(oauth, mode) {
    const moodEnergy = mapWaveModeToMoodEnergy(mode)
    const form = new URLSearchParams()
    form.set('moodEnergy', moodEnergy)
    form.set('diversity', mode === 'romantic' ? 'favorite' : 'discover')
    form.set('language', 'any')
    form.set('type', 'rotor')
    await fetchJson(`${YM}/rotor/station/${encodeURIComponent(YM_WAVE)}/settings3`, {
      method: 'POST',
      headers: { ...yandexHeaders(oauth), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      timeout: 15000,
    })
  }

  async function rotorStationFeedback(oauth, type, fields = {}, batchId = '') {
    const form = new URLSearchParams()
    form.set('type', String(type || ''))
    form.set('timestamp', String(Math.floor(Date.now() / 1000)))
    if (fields.from) form.set('from', String(fields.from))
    if (fields.trackId != null) form.set('trackId', String(fields.trackId))
    if (fields.totalPlayedSeconds != null) form.set('totalPlayedSeconds', String(fields.totalPlayedSeconds))
    const path =
      `/rotor/station/${encodeURIComponent(YM_WAVE)}/feedback` +
      (batchId ? `?batch-id=${encodeURIComponent(batchId)}` : '')
    const r = await fetchJson(`${YM}${path}`, {
      method: 'POST',
      headers: { ...yandexHeaders(oauth), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      timeout: 15000,
    })
    const okBody =
      r.data?.result === 'ok' ||
      r.data === 'ok' ||
      String(r.data?.result || '').toLowerCase() === 'ok'
    return okBody || (r.status >= 200 && r.status < 300 && !r.data?.error)
  }

  async function waveFetchLegacy(oauth, opts = {}) {
    const mode = opts.mode || 'default'
    const moodEnergy = mapWaveModeToMoodEnergy(mode)
    const resetSession = !!opts.resetSession
    const queueId = resetSession ? '' : String(opts.batchAnchorId || '').trim()

    if (resetSession) {
      try {
        await applyRotorStationMoodSettings(oauth, mode)
      } catch (e) {
        return { ok: false, error: `Не удалось применить настроение: ${e.message || e}` }
      }
      await new Promise((r) => setTimeout(r, 220))
      try {
        await rotorStationFeedback(oauth, 'radioStarted', {
          from: String(opts.radioFrom || `nexory-wave-${moodEnergy}-${Date.now()}`).slice(0, 120),
        })
      } catch (_) {}
    }

    let path = `/rotor/station/${encodeURIComponent(YM_WAVE)}/tracks?settings2=true`
    if (queueId) path += `&queue=${encodeURIComponent(queueId)}`
    const r = await fetchJson(`${YM}${path}`, {
      method: 'GET',
      headers: yandexHeaders(oauth),
      timeout: 28000,
    })
    if (r.data?.error) {
      return { ok: false, error: String(r.data.error?.message || r.data.error?.name || 'rotor/tracks') }
    }
    const parsed = parseRotorStationTracksBody(r.data)
    if (!parsed.tracks.length) return { ok: false, error: 'Яндекс волна: пустой ответ' }
    return {
      ok: true,
      apiMode: 'legacy',
      mode,
      moodEnergy,
      radioSessionId: '',
      batchId: parsed.batchId,
      tracks: parsed.tracks,
      batchAnchorId: parsed.batchAnchorId,
      nextQueueTrackId: parsed.nextQueueTrackId,
      radioStartedFrom: `radio-mobile-user-onyourwave-${moodEnergy}`,
    }
  }

  async function waveFetch(opts = {}) {
    const oauth = yandexOAuth(cfg().yandexToken)
    if (!oauth) return { ok: false, error: 'Нужен токен Яндекса' }
    const mode = opts.mode || 'default'
    const resetSession = !!opts.resetSession
    const radioSessionId = String(opts.radioSessionId || '').trim()
    const batchAnchorId = String(opts.batchAnchorId || '').trim()

    const packSession = async (parsed) => {
      if (!parsed?.tracks?.length) return null
      await sendRotorRadioStarted(oauth, parsed)
      return { ok: true, apiMode: 'session', ...parsed }
    }

    if (!resetSession && radioSessionId) {
      const queue = batchAnchorId ? [batchAnchorId] : []
      try {
        const r = await fetchJson(`${YM}/rotor/session/${encodeURIComponent(radioSessionId)}/tracks`, {
          method: 'POST',
          headers: yandexRotorHeaders(oauth),
          body: JSON.stringify({ queue }),
          timeout: 28000,
        })
        if (r.data?.error) {
          return { ok: false, error: String(r.data.error?.message || r.data.error?.name || 'session/tracks') }
        }
        const cont = await packSession(parseRotorBody(r.data, mode))
        if (cont) return cont
      } catch (e) {
        if (!batchAnchorId) return { ok: false, error: String(e.message || e) }
      }
    }

    if (!resetSession && !radioSessionId && batchAnchorId) {
      return waveFetchLegacy(oauth, { ...opts, mode, resetSession: false, batchAnchorId })
    }

    if (resetSession) {
      try {
        await applyRotorStationMoodSettings(oauth, mode)
      } catch (_) {}
    }

    try {
      const r = await fetchJson(`${YM}/rotor/session/new`, {
        method: 'POST',
        headers: yandexRotorHeaders(oauth),
        body: JSON.stringify(buildRotorSessionBody(mode)),
        timeout: 28000,
      })
      if (r.data?.error) {
        return waveFetchLegacy(oauth, { ...opts, mode, resetSession, batchAnchorId })
      }
      const fresh = await packSession(parseRotorBody(r.data, mode))
      if (fresh) return fresh
    } catch (_) {}

    return waveFetchLegacy(oauth, { ...opts, mode, resetSession, batchAnchorId })
  }

  async function waveFeedback(payload) {
    const oauth = yandexOAuth(cfg().yandexToken)
    if (!oauth) return { ok: false }
    const radioSessionId = String(payload?.radioSessionId || '').trim()
    if (radioSessionId) {
      const event = {
        type: String(payload.type || ''),
        timestamp: new Date().toISOString(),
      }
      if (payload.trackId != null) event.trackId = String(payload.trackId)
      if (payload.from) event.from = String(payload.from)
      if (payload.totalPlayedSeconds != null) event.totalPlayedSeconds = Number(payload.totalPlayedSeconds)
      await fetchJson(
        `${YM}/rotor/session/${encodeURIComponent(radioSessionId)}/feedback`,
        {
          method: 'POST',
          headers: yandexRotorHeaders(oauth),
          body: JSON.stringify({ event, batchId: String(payload.batchId || '') }),
          timeout: 12000,
        },
      )
      return { ok: true }
    }
    if (payload?.trackId != null) {
      const ok = await rotorStationFeedback(
        oauth,
        String(payload.type || ''),
        {
          from: payload.from,
          trackId: payload.trackId,
          totalPlayedSeconds: payload.totalPlayedSeconds,
        },
        String(payload.batchId || ''),
      )
      return { ok: !!ok }
    }
    return { ok: false }
  }

  async function search(q, source) {
    const src = String(source || 'yandex').toLowerCase()
    const t = tokens()
    if (src === 'yandex') {
      const oauth = yandexOAuth(t.yandexToken)
      if (!oauth) return { ok: false, error: 'Нужен токен Яндекса', tracks: [] }
      const tracks = await searchYandex(q, oauth)
      return { ok: tracks.length > 0, mode: 'yandex', tracks }
    }
    if (src === 'vk') {
      const vk = String(t.vkToken || '').trim()
      if (!vk) return { ok: false, error: 'Нужен VK токен', tracks: [] }
      const tracks = await searchVk(q, vk)
      return { ok: tracks.length > 0, mode: 'vk', tracks }
    }
    if (src === 'soundcloud') {
      const tracks = await searchSoundCloud(q)
      return { ok: tracks.length > 0, mode: 'soundcloud', tracks, error: tracks.length ? undefined : 'Пусто' }
    }
    return { ok: false, error: 'Источник не поддержан напрямую', tracks: [] }
  }

  async function resolve(track) {
    const source = String(track?.source || '').toLowerCase()
    const t = tokens()
    if (source === 'vk' && track.url) return { ok: true, url: track.url }
    if (source === 'yandex') {
      const oauth = yandexOAuth(t.yandexToken)
      if (!oauth) return { ok: false, error: 'Нет токена Яндекса' }
      return resolveYandex(String(track.id).split(':')[0], oauth)
    }
    if (source === 'soundcloud') {
      return resolveSoundCloud(track)
    }
    return { ok: false, error: `Напрямую: источник ${source || '?'} не поддержан` }
  }

  function parseYandexPlaylistRef(input) {
    const raw = String(input || '').trim().replace(/^["']|["']$/g, '')
    if (!raw) return null
    const decodeSafe = (v) => {
      try { return decodeURIComponent(String(v || '').trim()) } catch { return String(v || '').trim() }
    }
    const fromPath = (path = '') => {
      const src = String(path || '')
      const m1 = src.match(/(?:^|\/)users\/([^/?#]+)\/playlists\/([^/?#]+)/i)
      if (m1) return { user: decodeSafe(m1[1]), kind: decodeSafe(m1[2]) }
      const m2 = src.match(/(?:^|\/)playlist\/([^/?#]+)\/([^/?#]+)/i)
      if (m2) return { user: decodeSafe(m2[1]), kind: decodeSafe(m2[2]) }
      const m4 = src.match(/(?:^|\/)playlists\/([^/?#]+)/i)
      if (m4) return { user: 'me', kind: decodeSafe(m4[1]) }
      return null
    }
    try {
      const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
      const host = String(u.hostname || '').toLowerCase()
      if (!/(^|\.)music\.yandex\./i.test(host) && !/(^|\.)yandex\./i.test(host)) return null
      const direct = fromPath(u.pathname)
      if (direct) return direct
    } catch {}
    return null
  }

  function parseYandexAlbumId(input) {
    const raw = String(input || '').trim()
    const m = raw.match(/\/album\/([0-9]{1,22})/i)
    return m ? String(m[1]).trim() : null
  }

  function parseYandexLink(input) {
    const albumId = parseYandexAlbumId(input)
    if (albumId) return { albumId }
    const playlist = parseYandexPlaylistRef(input)
    if (playlist) return { playlist }
    return null
  }

  function mapYandexImportTrack(t, row = {}) {
    if (!t?.title) return null
    const id = String(t.id ?? row.trackId ?? row.id ?? '').split(':')[0].trim()
    if (!id) return null
    const msRaw = Number(t.durationMs ?? t.duration_ms ?? row?.durationMs ?? row?.duration_ms ?? 0)
    const durField = Number(t.duration ?? row?.duration ?? 0)
    let durationMs
    if (msRaw > 0) durationMs = msRaw
    else if (durField > 0) durationMs = durField > 36000 ? durField : durField * 1000
    return {
      title: String(t.title).trim(),
      artist: (t.artists || []).map((a) => a?.name).filter(Boolean).join(', ') || '—',
      cover: t.coverUri ? `https://${String(t.coverUri).replace('%%', '300x300')}` : null,
      source: 'yandex',
      id,
      durationMs: durationMs > 0 ? durationMs : undefined,
    }
  }

  async function enrichYandexTrackMeta(headers, tracks = []) {
    const list = (Array.isArray(tracks) ? tracks : []).map((t) => ({ ...t }))
    const need = list.some((t) => t.id && (!t.durationMs || !t.cover))
    if (!need || !list.length) return list
    const ids = [...new Set(list.map((t) => String(t.id).split(':')[0]).filter(Boolean))]
    if (!ids.length) return list
    const full = await fetchYandexTracksByIds(headers, ids)
    const byId = new Map(full.map((t) => [String(t.id), t]))
    return list.map((t) => {
      const f = byId.get(String(t.id))
      if (!f) return t
      return {
        ...t,
        durationMs: t.durationMs || f.durationMs,
        cover: t.cover || f.cover,
        artist: (!t.artist || t.artist === '—') && f.artist ? f.artist : t.artist,
      }
    })
  }

  async function finalizeYandexImport(headers, name, tracks) {
    const enriched = await enrichYandexTrackMeta(headers, tracks)
    return { name, tracks: enriched }
  }

  function mapYandexImportRows(tracks = []) {
    const out = []
    for (const row of tracks) {
      if (row?.error) continue
      const t = row?.track || row
      const mapped = mapYandexImportTrack(t, row)
      if (mapped) out.push(mapped)
    }
    return out
  }

  async function getYandexAccountUid(headers) {
    const r = await fetchJson(`${YM}/account/settings`, { headers, timeout: 12000 })
    const res = r.data?.result
    if (!res || typeof res !== 'object') return null
    if (res.uid != null) return String(res.uid).trim()
    if (typeof res.login === 'string' && res.login.trim()) return res.login.trim()
    return null
  }

  async function fetchYandexTracksByIds(headers, trackIds) {
    const ids = (Array.isArray(trackIds) ? trackIds : []).filter(Boolean)
    if (!ids.length) return []
    const merged = []
    for (let i = 0; i < ids.length; i += 120) {
      const chunk = ids.slice(i, i + 120)
      const form = new URLSearchParams()
      form.append('with-positions', 'true')
      chunk.forEach((id) => form.append('track-ids', String(id)))
      const r = await fetchJson(`${YM}/tracks`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
        timeout: 35000,
      })
      const list = Array.isArray(r.data?.result) ? r.data.result : []
      list.forEach((t) => {
        const mapped = mapYandexImportTrack(t)
        if (mapped) merged.push(mapped)
      })
    }
    return merged
  }

  function collectYandexBatchIds(tracks = []) {
    const out = []
    const seen = new Set()
    for (const row of tracks) {
      if (!row || typeof row !== 'object' || row.error) continue
      if (row.track?.title) continue
      let spec = null
      if (typeof row.id === 'string' && row.id.includes(':')) spec = row.id
      else if (row.trackId != null && row.albumId != null) spec = `${row.trackId}:${row.albumId}`
      else if (row.trackId != null) spec = String(row.trackId)
      if (spec && !seen.has(spec)) {
        seen.add(spec)
        out.push(spec)
      }
    }
    return out
  }

  function isYandexLikesPlaylistKind(kind) {
    return /^lk\./i.test(String(kind || '').trim())
  }

  async function fetchYandexUserLikesTracksForImport(headers, uid) {
    const user = encodeURIComponent(String(uid || '').trim())
    if (!user) return { name: 'Мне нравится', tracks: [] }
    const paths = [
      `/users/${user}/likes/tracks?if-modified-since-revision=0`,
      `/users/${user}/likes/tracks`,
    ]
    let rows = []
    for (const p of paths) {
      const r = await fetchJson(`${YM}${p}`, { headers, timeout: 40000 })
      const res = r.data?.result
      let lib = null
      if (res && typeof res === 'object') {
        if (res.library && typeof res.library === 'object') lib = res.library
        else if (Array.isArray(res.tracks)) lib = res
      }
      rows = Array.isArray(lib?.tracks) ? lib.tracks : []
      if (rows.length) break
    }
    if (!rows.length) return finalizeYandexImport(headers, 'Мне нравится', [])
    const seen = new Set()
    const batchIds = []
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue
      const id = row.id != null ? String(row.id).trim() : ''
      const aid = row.albumId != null ? String(row.albumId).trim() : ''
      const spec = id && aid ? `${id}:${aid}` : id
      if (!spec || seen.has(spec)) continue
      seen.add(spec)
      batchIds.push(spec)
    }
    const tracks = await fetchYandexTracksByIds(headers, batchIds)
    return finalizeYandexImport(headers, 'Мне нравится', tracks)
  }

  async function fetchYandexPlaylistImport(headers, owner, kind) {
    const uid = String(owner || '').trim()
    const k = String(kind || '').trim()
    if (!uid || !k) return finalizeYandexImport(headers, 'Плейлист', [])
    if (isYandexLikesPlaylistKind(k)) {
      return fetchYandexUserLikesTracksForImport(headers, uid)
    }
    const pathKind = encodeURIComponent(k)
    const load = (pl) => ({
      name: String(pl?.title || 'Плейлист'),
      tracks: mapYandexImportRows(Array.isArray(pl?.tracks) ? pl.tracks : []),
      pl,
    })
    let lastPlWithTrackRows = null
    const rememberRowsPl = (p) => {
      if (p && typeof p === 'object' && Array.isArray(p.tracks) && p.tracks.length) lastPlWithTrackRows = p
    }
    const rRich = await fetchJson(`${YM}/users/${encodeURIComponent(uid)}/playlists/${pathKind}?rich-tracks=true`, { headers, timeout: 28000 })
    let { name, tracks, pl } = load(rRich.data?.result)
    rememberRowsPl(pl)
    if (tracks.length) return finalizeYandexImport(headers, name, tracks)
    try {
      const form = new URLSearchParams()
      form.set('kinds', k)
      form.set('mixed', 'false')
      form.set('rich-tracks', 'true')
      const postR = await fetchJson(`${YM}/users/${encodeURIComponent(uid)}/playlists`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
        timeout: 40000,
      })
      const raw = postR.data?.result
      const first = Array.isArray(raw) ? raw[0] : raw
      ;({ name, tracks, pl } = load(first))
      rememberRowsPl(pl)
      if (tracks.length) return finalizeYandexImport(headers, name, tracks)
    } catch {}
    const rPlain = await fetchJson(`${YM}/users/${encodeURIComponent(uid)}/playlists/${pathKind}`, { headers, timeout: 20000 })
    ;({ name, tracks, pl } = load(rPlain.data?.result))
    rememberRowsPl(pl)
    if (tracks.length) return finalizeYandexImport(headers, name, tracks)
    const sourcePl = lastPlWithTrackRows || pl
    const batchIds = collectYandexBatchIds(sourcePl?.tracks || [])
    if (batchIds.length) {
      const fromBatch = await fetchYandexTracksByIds(headers, batchIds)
      if (fromBatch.length) return finalizeYandexImport(headers, name, fromBatch)
    }
    return finalizeYandexImport(headers, name, [])
  }

  function flattenYandexAlbum(result = {}) {
    const out = []
    const push = (item) => {
      const mapped = mapYandexImportTrack(item?.track || item, item)
      if (mapped) out.push(mapped)
    }
    const volumes = Array.isArray(result.volumes) ? result.volumes : []
    for (const vol of volumes) {
      if (Array.isArray(vol)) vol.forEach(push)
      else if (vol && Array.isArray(vol.tracks)) vol.tracks.forEach(push)
    }
    if (!out.length && Array.isArray(result.tracks)) result.tracks.forEach(push)
    return out
  }

  async function importYandexLink(link) {
    const oauth = yandexOAuth(cfg().yandexToken)
    if (!oauth) return { ok: false, error: 'Нужен токен Яндекса в настройках' }
    const headers = yandexRotorHeaders(oauth)
    const albumId = parseYandexAlbumId(link)
    if (albumId) {
      const r = await fetchJson(`${YM}/albums/${encodeURIComponent(albumId)}/with-tracks`, { headers, timeout: 28000 })
      const result = r.data?.result || {}
      let tracks = flattenYandexAlbum(result)
      if (!tracks.length) return { ok: false, error: 'В альбоме нет треков' }
      tracks = await enrichYandexTrackMeta(headers, tracks)
      return { ok: true, service: 'yandex', name: String(result.title || `Альбом ${albumId}`), tracks }
    }
    const ref = parseYandexPlaylistRef(link)
    if (!ref) return { ok: false, error: 'Не удалось распознать ссылку Яндекс Музыки' }
    let owner = String(ref.user || '').trim()
    if (!owner || /^me$/i.test(owner)) {
      owner = await getYandexAccountUid(headers)
      if (!owner) return { ok: false, error: 'Не удалось получить id аккаунта — проверь токен' }
    }
    const { name, tracks } = await fetchYandexPlaylistImport(headers, owner, ref.kind)
    if (!tracks.length) return { ok: false, error: 'Плейлист пуст или API не вернул треки' }
    return { ok: true, service: 'yandex', name, tracks }
  }

  function parseVkPlaylistRef(input) {
    const raw = String(input || '').trim()
    if (!raw) return null
    const widgetArgs = raw.match(/VK\.Widgets\.Playlist\(\s*["'][^"']+["']\s*,\s*(-?\d+)\s*,\s*(\d+)\s*,\s*["']([a-zA-Z0-9_-]+)["']/i)
    if (widgetArgs) {
      return { ownerId: widgetArgs[1], albumId: widgetArgs[2], accessKey: widgetArgs[3] || null }
    }
    const patterns = [
      /audio_playlist(-?\d+)_([0-9]+)(?:_([a-zA-Z0-9]+))?/i,
      /music\.vk\.com\/playlist\/(-?\d+)_([0-9]+)(?:_([a-zA-Z0-9]+))?/i,
      /vk\.com\/music\/playlist\/(-?\d+)_([0-9]+)(?:_([a-zA-Z0-9]+))?/i,
      /vk\.com\/audios(-?\d+)\?.*section=playlist_(-?\d+)_([0-9]+)/i,
    ]
    for (const rx of patterns) {
      const m = raw.match(rx)
      if (!m) continue
      if (m.length >= 4 && /section=playlist/i.test(rx.source)) {
        return { ownerId: m[1], albumId: m[3], accessKey: m[4] || null }
      }
      return { ownerId: m[1], albumId: m[2], accessKey: m[3] || null }
    }
    return null
  }

  function vkImportItems(body) {
    const r = body?.response
    if (Array.isArray(r)) return r
    if (Array.isArray(r?.items)) return r.items
    if (Array.isArray(r?.audios)) return r.audios
    if (Array.isArray(r?.list)) return r.list
    return []
  }

  function mapVkImportTrack(t) {
    if (!t?.title) return null
    const id = t?.owner_id != null && t?.id != null ? `${t.owner_id}_${t.id}` : String(t?.id || '')
    if (!id) return null
    return {
      title: String(t.title || '').trim(),
      artist: String(t?.artist || '—').trim(),
      cover: t?.album?.thumb?.photo_300 || t?.album?.thumb?.photo_270 || null,
      source: 'vk',
      id,
      url: t?.url || null,
    }
  }

  async function importVkLink(link) {
    const ref = parseVkPlaylistRef(link)
    if (!ref) return { ok: false, error: 'Не удалось распознать ссылку VK' }
    const tok = String(cfg().vkToken || '').trim()
    if (!tok) return { ok: false, error: 'Нужен VK токен в настройках' }

    const base = {
      owner_id: String(ref.ownerId),
      playlist_id: String(ref.albumId),
      access_token: tok,
    }
    if (ref.accessKey) base.access_key = String(ref.accessKey)

    const byId = await vkKate('audio.getPlaylistById', base)
    if (!byId.data?.error) {
      const r0 = Array.isArray(byId.data?.response) ? byId.data.response[0] : byId.data?.response || {}
      const rawRows = Array.isArray(r0?.audios) ? r0.audios : Array.isArray(r0?.list) ? r0.list : []
      const tracks = rawRows.map(mapVkImportTrack).filter(Boolean)
      if (tracks.length) {
        return { ok: true, service: 'vk', name: String(r0?.title || 'VK плейлист'), tracks }
      }
    }

    const params = {
      owner_id: String(ref.ownerId),
      album_id: String(ref.albumId),
      access_token: tok,
      count: '600',
    }
    if (ref.accessKey) params.access_key = String(ref.accessKey)
    const r = await vkKate('audio.get', params)
    if (r.data?.error) {
      return { ok: false, error: r.data.error.error_msg || 'VK API error' }
    }
    const tracks = vkImportItems(r.data).map(mapVkImportTrack).filter(Boolean)
    if (!tracks.length) return { ok: false, error: 'VK плейлист пуст или недоступен' }
    return { ok: true, service: 'vk', name: 'VK плейлист', tracks }
  }

  async function importPlaylistLink({ url, json } = {}) {
    if (json != null && json !== '') {
      return { ok: false, error: 'JSON импортируется локально в приложении' }
    }
    const link = String(url || '').trim()
    if (!link) return { ok: false, error: 'Укажите ссылку' }
    if (/^[\[{]/.test(link)) {
      return { ok: false, error: 'JSON импортируется локально в приложении' }
    }
    const isYandex = /(^|\/\/)(music\.)?yandex\./i.test(link) || /(^|\/\/)yandex\.[^/]+/i.test(link)
    if (isYandex) return importYandexLink(link)
    if (parseVkPlaylistRef(link)) return importVkLink(link)
    return { ok: false, error: 'Поддерживаются ссылки Яндекс Музыки и VK' }
  }

  return {
    hasDirectTokens,
    validateYandex,
    validateVk,
    search,
    resolve,
    waveFetch,
    waveFeedback,
    parseYandexLink,
    parseVkPlaylistRef,
    importPlaylistLink,
    fetchSoundCloudReleases,
    fetchSoundCloudChartKind,
    fetchSoundCloudMixes,
    fetchSoundCloudCisPopular,
    fetchSoundCloudCisMixes,
    validateSoundCloud,
    discoverSoundCloudClientId,
    prepareSoundCloudOAuth,
    parseSoundCloudCredential,
    scAuth,
  }
})()
