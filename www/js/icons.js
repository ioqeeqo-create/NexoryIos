/* Lucide paths from flow desktop (lucide-static v0.469.0, ISC) */
const Icons = (() => {
  const SW = '1.85'
  const ALIAS = { home: 'house' }
  const FILLED = new Set(['play', 'pause'])

  const P = {
  'chevron-down': '<path d="m6 9 6 6 6-6" />',
  'chevron-left': '<path d="m15 18-6-6 6-6" />',
  image: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" />',
  minus: '<path d="M5 12h14" />',
  x: '<path d="M18 6 6 18" /><path d="m6 6 12 12" />',
  play: '<polygon points="6 3 20 12 6 21 6 3" fill="currentColor" stroke="none" />',
  pause:
    '<rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" /><rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" />',
  plus: '<path d="M5 12h14" /><path d="M12 5v14" />',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />',
  'music-2': '<circle cx="8" cy="18" r="4" /><path d="M12 18V2l7 4" />',
  search: '<circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />',
  shuffle:
    '<path d="m18 14 4 4-4 4" /><path d="m18 2 4 4-4 4" /><path d="M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22" /><path d="M2 6h1.972a4 4 0 0 1 3.6 2.2" /><path d="M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45" />',
  'skip-back': '<polygon points="19 20 9 12 19 4 19 20" /><line x1="5" x2="5" y1="19" y2="5" />',
  'skip-forward': '<polygon points="5 4 15 12 5 20 5 4" /><line x1="19" x2="19" y1="5" y2="19" />',
  repeat:
    '<path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" />',
  house: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" /><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />',
  library: '<path d="m16 6 4 14" /><path d="M12 6v14" /><path d="M8 8v12" /><path d="M4 4v16" />',
  settings:
    '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" />',
  'audio-lines':
    '<path d="M2 10v3" /><path d="M6 6v11" /><path d="M10 3v18" /><path d="M14 8v7" /><path d="M18 5v13" /><path d="M22 10v3" />',
  }

  function resolve(name) {
    const key = ALIAS[name] || name
    return P[key] || P.play
  }

  function svg(name, cls = 'ui-icon') {
    const key = ALIAS[name] || name
    const body = resolve(name)
  const filled = FILLED.has(key)
    const strokeAttrs = filled
      ? 'fill="none"'
      : `fill="none" stroke="currentColor" stroke-width="${SW}" stroke-linecap="round" stroke-linejoin="round"`
    return `<svg class="${cls}" viewBox="0 0 24 24" ${strokeAttrs} aria-hidden="true">${body}</svg>`
  }

  function mount(root = document) {
    root.querySelectorAll('[data-icon]').forEach((el) => {
      el.innerHTML = svg(el.dataset.icon, el.dataset.iconClass || 'ui-icon')
    })
  }

  return { svg, mount }
})()
