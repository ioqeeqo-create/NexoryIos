const Icons = (() => {
  const P = {
    'chevron-down': '<path d="m6 9 6 6 6-6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/>',
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    library: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    'skip-back': '<path d="m17 19-7-7 7-7"/><path d="M7 19V5"/>',
    'skip-forward': '<path d="m7 19 7-7-7-7"/><path d="M17 19V5"/>',
    play: '<polygon points="6 4 20 12 6 20 6 4"/>',
    pause: '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>',
    shuffle: '<path d="m18 14 4 4-4 4"/><path d="m18 2 4 4-4 4"/><path d="M2 18h1.4a1 1 0 0 0 .97-.76l3.22-12.84A1 1 0 0 1 8.56 4h7.88"/><path d="M2 6h1.9a1 1 0 0 1 .87.53l5.06 8.6a1 1 0 0 0 .87.47H22"/>',
    repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
    heart: '<path d="M12 21s-7-4.35-9.5-8A5.5 5.5 0 0 1 12 5.1 5.5 5.5 0 0 1 21.5 13c-2.5 3.65-9.5 8-9.5 8Z"/>',
    'music-2': '<circle cx="8" cy="18" r="4"/><path d="M12 18V2l7 4"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    wave: '<path d="M2 12h2"/><path d="M6 8v8"/><path d="M10 5v14"/><path d="M14 9v6"/><path d="M18 7v10"/><path d="M22 11v2"/>',
  }

  function svg(name, cls = 'ui-icon') {
    const body = P[name] || P.play
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`
  }

  function mount(root = document) {
    root.querySelectorAll('[data-icon]').forEach((el) => {
      el.innerHTML = svg(el.dataset.icon, el.dataset.iconClass || 'ui-icon')
    })
  }

  return { svg, mount }
})()
