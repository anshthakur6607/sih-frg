// SkillUp Service Worker
// Provides offline-first capability for field officials

const CACHE_NAME = 'skillup-v1';
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/survey',
  '/recommendations',
  '/courses',
  '/my-courses',
  '/ai-tutor',
  '/gamification',
  '/roadmap',
  '/manifest.json',
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first, fall back to cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, Supabase, and external requests
  if (request.method !== 'GET' || 
      url.hostname.includes('supabase') || 
      url.hostname.includes('igot') ||
      url.hostname.includes('localhost:3001') ||
      url.hostname.includes('localhost:8001') ||
      url.hostname.includes('localhost:8000')) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses
        if (response && response.status === 200 && response.type === 'basic') {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, cloned);
          });
        }
        return response;
      })
      .catch(() => {
        // Fall back to cache
        return caches.match(request).then((cached) => {
          return cached || new Response('Offline', { status: 503 });
        });
      })
  );
});

// Background sync for offline quiz attempts
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-quiz-attempts') {
    event.waitUntil(syncQuizAttempts());
  }
});

async function syncQuizAttempts() {
  // Get queued attempts from IndexedDB
  // Send them to the server when online
  console.log('Syncing queued quiz attempts...');
}