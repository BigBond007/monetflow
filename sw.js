// MonetFlow Service Worker
// 策略：
// - 导航请求（页面）：网络优先，失败时回退到缓存的 app shell（离线可用）
// - 静态资源（同源、hash 文件名不可变）：缓存优先，未命中再走网络并缓存
// 更新：改动此文件或 CACHE_VERSION 后，旧缓存会在 activate 阶段被清理。

const CACHE_VERSION = 'monetflow-v1'
const CACHE = CACHE_VERSION
const APP_SHELL = 'index.html'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // 只处理同源 GET 请求
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  // 页面导航：网络优先，离线回退缓存
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => {
            c.put(request, copy)
            c.put(APP_SHELL, res.clone())
          })
          return res
        })
        .catch(() => caches.match(request).then((m) => m || caches.match(APP_SHELL))),
    )
    return
  }

  // 静态资源：缓存优先
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((res) => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(request, copy))
        }
        return res
      })
    }),
  )
})
