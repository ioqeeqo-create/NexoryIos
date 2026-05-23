document.addEventListener('DOMContentLoaded', () => {
  try {
    Icons.mount()
    UI.init()
  } catch (e) {
    console.error(e)
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
