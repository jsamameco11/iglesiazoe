/* Iglesia Zoe · notifications: new web forms for the panel; radio programs, live services and new sermons for visitors. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Iglesia Zoe", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Iglesia Zoe";
  const url = data.url || "/";

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, {
        body: data.body || "",
        tag: data.tag || url,
        renotify: true,
        requireInteraction: false,
        vibrate: [180, 80, 180],
        lang: "es-PE",
        data: { url },
      });
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      windows.forEach((client) => client.postMessage({ type: "zoe:inbox", kind: data.kind || null }));
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const panel = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (panel) {
        await panel.focus();
        return panel.navigate ? panel.navigate(target) : undefined;
      }
      return self.clients.openWindow(target);
    })(),
  );
});
