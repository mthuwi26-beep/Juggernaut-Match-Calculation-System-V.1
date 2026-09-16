// ── Lo de siempre: notificaciones push (SIN TOCAR) ──────────────────────
self.addEventListener("push", (event) => {
  let datos = {};
  try {
    datos = event.data ? event.data.json() : {};
  } catch {
    datos = {};
  }
  const titulo = datos.titulo || "JMCS";
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: datos.cuerpo || "",
      icon: "/logo.png",
      badge: "/logo.png",
      data: { url: datos.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(clients.openWindow(url));
});

// ── Nuevo: caché para que funcione (parcialmente) sin conexión ──────────
// Estrategia: red primero, caché como respaldo. Así el usuario siempre ve
// lo más actualizado posible cuando hay internet, y si se corta, ve lo
// último que se guardó en vez de una pantalla en blanco o el error feo
// típico del navegador.
const CACHE_NOMBRE = "jmcs-cache-v1";
const RUTAS_INICIALES = ["/", "/offline.html", "/manifest.json", "/icon-192.png"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NOMBRE).then((cache) =>
      Promise.all(
        RUTAS_INICIALES.map((ruta) => cache.add(ruta).catch(() => {}))
        // .catch silencioso a propósito: si una ruta puntual falla al
        // guardarse (ej. todavía no existe en este deploy), no queremos
        // que se caiga TODO el cacheo inicial por eso
      )
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((nombres) =>
      Promise.all(nombres.filter((n) => n !== CACHE_NOMBRE).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Solo nos metemos con pedidos GET de nuestro propio dominio — nunca
  // tocamos POST/PUT/DELETE (pagos, guardar datos, etc.) ni pedidos a
  // otros dominios (Supabase, Wompi, la API de fútbol externa)
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  // /api/ping es la comprobación real de "¿hay internet de verdad?" que usa
  // la app — si nosotros mismos le contestáramos desde el caché, la app
  // creería que hay conexión aunque no la haya. Por eso a este pedido en
  // particular ni lo tocamos: que la red conteste, o que falle de verdad.
  if (new URL(request.url).pathname === "/api/ping") {
    return;
  }

  const esNavegacion = request.mode === "navigate";

  event.respondWith(
    fetch(request)
      .then((respuesta) => {
        const copia = respuesta.clone();
        caches.open(CACHE_NOMBRE).then((cache) => cache.put(request, copia));
        return respuesta;
      })
      .catch(async () => {
        const cacheado = await caches.match(request);
        if (cacheado) return cacheado;
        if (esNavegacion) {
          const paginaOffline = await caches.match("/offline.html");
          if (paginaOffline) return paginaOffline;
        }
        return new Response("Sin conexión y sin datos guardados para esto todavía.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      })
  );
});
