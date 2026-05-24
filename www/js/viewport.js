const Viewport = (() => {
  const listeners = new Set()
  let resyncTimer = null

  function sync() {
    const vv = window.visualViewport
    const layoutH = window.innerHeight
    const vvHeight = vv ? vv.height : layoutH
    const offsetTop = vv ? vv.offsetTop : 0
    const kbOffset = Math.max(0, layoutH - vvHeight - offsetTop)
    const keyboardOpen = kbOffset > 72

    document.body.classList.toggle('keyboard-open', keyboardOpen)
    listeners.forEach((fn) => fn({ kbOffset, keyboardOpen }))
  }

  function scheduleResync() {
    clearTimeout(resyncTimer)
    ;[0, 80, 180, 360, 720].forEach((delay) => {
      setTimeout(sync, delay)
    })
    resyncTimer = setTimeout(sync, 900)
  }

  function bind() {
    sync()
    window.visualViewport?.addEventListener('resize', sync)
    window.visualViewport?.addEventListener('scroll', sync)
    window.addEventListener('resize', sync)
    window.addEventListener('orientationchange', scheduleResync)
    window.addEventListener('focusin', () => setTimeout(sync, 60))
    window.addEventListener('focusout', scheduleResync)
  }

  function onResize(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }

  return { bind, sync, scheduleResync, onResize }
})()
