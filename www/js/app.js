document.addEventListener('DOMContentLoaded', () => {
  const splash = document.getElementById('splash')
  const finishSplash = () => {
    splash?.classList.add('is-done')
    document.body.classList.add('app-ready')
  }

  try {
    Icons.mount()
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
