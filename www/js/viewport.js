const Viewport = (() => {
  const listeners = new Set()

  function sync() {
    const vv = window.visualViewport
    const layoutH = window.innerHeight
    const vvHeight = vv ? vv.height : layoutH
    const offsetTop = vv ? vv.offsetTop : 0
    const kbOffset = Math.max(0, layoutH - vvHeight - offsetTop)
    const keyboardOpen = kbOffset > 72

    if (keyboardOpen) {
      document.documentElement.style.setProperty('--app-height', `${Math.round(vvHeight)}px`)
    } else {
      document.documentElement.style.setProperty('--app-height', '100dvh')
    }

    document.documentElement.style.setProperty('--vv-offset-top', `${Math.round(offsetTop)}px`)
    document.documentElement.style.setProperty('--kb-offset', `${Math.round(kbOffset)}px`)
    document.body.classList.toggle('keyboard-open', keyboardOpen)
    listeners.forEach((fn) => fn({ appHeight: keyboardOpen ? vvHeight : layoutH, kbOffset, keyboardOpen }))
  }

  function bind() {
    sync()
    window.visualViewport?.addEventListener('resize', sync)
    window.visualViewport?.addEventListener('scroll', sync)
    window.addEventListener('resize', sync)
    window.addEventListener('orientationchange', () => setTimeout(sync, 120))
    window.addEventListener('focusin', () => setTimeout(sync, 80))
    window.addEventListener('focusout', () => setTimeout(sync, 120))
  }

  function onResize(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }

  return { bind, sync, onResize }
})()
