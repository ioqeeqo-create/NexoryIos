document.addEventListener('DOMContentLoaded', () => {
  const splash = document.getElementById('splash')
  const finishSplash = () => {
    splash?.classList.add('is-done')
    document.body.classList.add('app-ready')
  }

  try {
    Icons.mount()
    Viewport.bind()
    Viewport.onResize(() => {
      if (typeof Player?.drawWaveform === 'function') {
        const d = Player.audio?.duration || 0
        const ratio = d > 0 ? (Player.audio?.currentTime || 0) / d : 0
        Player.drawWaveform(ratio)
      }
    })
    document.documentElement.addEventListener('nexory-accent', () => {
      if (typeof Player?.drawWaveform === 'function') {
        const d = Player.audio?.duration || 0
        const ratio = d > 0 ? (Player.audio?.currentTime || 0) / d : 0
        Player.drawWaveform(ratio)
      }
    })
    UI.init()
    setTimeout(finishSplash, 1100)
  } catch (e) {
    console.error(e)
    finishSplash()
    const toast = document.getElementById('toast')
    if (toast) {
      toast.hidden = false
      toast.textContent = `Ошибка запуска: ${e.message || e}`
    }
  }
})

window.addEventListener('error', (e) => {
  UI?.toast?.(e.message || 'Ошибка приложения')
})

window.addEventListener('unhandledrejection', (e) => {
  UI?.toast?.(e.reason?.message || String(e.reason || 'Ошибка сети'))
})
