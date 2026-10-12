// The House List's service worker. It's only here for notifications: no
// offline caching, so the app always loads fresh from the server.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "The House List", {
      body: data.body || "",
      icon: "/apple-icon",
      badge: "/badge",
      // A newer note about the same item replaces the old one, and still buzzes.
      tag: data.tag,
      renotify: !!data.tag,
      data: { url: data.url || "/" },
    }),
  );
});

// A tap opens the app at the item. If the app's already open, it's brought
// forward and told which item to show, rather than reloaded.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        open.postMessage({ type: "open", url });
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
