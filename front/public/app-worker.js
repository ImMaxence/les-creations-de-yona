/*
 * The service worker of the site (2.23): Angular's (offline reading of the installed app, notifications), and the
 * number on the icon of the app, which Angular's does not set. Plain JavaScript, copied as is from public/.
 *
 * iOS shows the number only once the site sets it (Badging API), and keeps it until the site changes it; a computer
 * shows it on the icon of the installed app too. Android has no such API: its launcher puts a dot on the icon while a
 * notification is there, without the site.
 *
 * Each push says what the number counts (PushService on the backend):
 * - {"badge": {"backOffice": 3}}: what awaits the admin of the device in the back-office (messages not read, orders
 *   to handle), in place of the last one;
 * - {"badge": {"newRecipe": true}}: one more new recipe, until the site is opened.
 * Both kept in the storage of the site ("yona-badge"), which its pages read and write too (core/pwa/app-badge.ts).
 */
importScripts('./ngsw-worker.js');

const BADGE_CACHE = 'yona-badge';
const BADGE_FILE = '/app-badge.json';

// Beside Angular's own listener, which shows the notification
self.addEventListener('push', (event) => {
  const badge = readBadge(event);
  if (badge && typeof self.navigator.setAppBadge === 'function') {
    event.waitUntil(updateBadge(badge).catch(() => undefined));
  }
});

function readBadge(event) {
  try {
    const badge = event.data ? event.data.json().badge : null;
    return badge && typeof badge === 'object' ? badge : null;
  } catch {
    return null;
  }
}

async function updateBadge(badge) {
  const cache = await caches.open(BADGE_CACHE);
  const counts = await readCounts(cache);
  if (Number.isInteger(badge.backOffice) && badge.backOffice >= 0) {
    counts.backOffice = badge.backOffice;
  }
  if (badge.newRecipe === true) {
    counts.newRecipes++;
  }
  await cache.put(BADGE_FILE, new Response(JSON.stringify(counts), { headers: { 'Content-Type': 'application/json' } }));
  const total = counts.backOffice + counts.newRecipes;
  await (total > 0 ? self.navigator.setAppBadge(total) : self.navigator.clearAppBadge());
}

/** Nothing kept yet, or unreadable: nothing counted. */
async function readCounts(cache) {
  const counts = { backOffice: 0, newRecipes: 0 };
  try {
    const kept = await (await cache.match(BADGE_FILE))?.json();
    for (const name of Object.keys(counts)) {
      if (Number.isInteger(kept?.[name]) && kept[name] >= 0) {
        counts[name] = kept[name];
      }
    }
  } catch {
    // Counted again from nothing
  }
  return counts;
}
