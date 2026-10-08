# Caffeine

## AI workspace

Use the **three-sparkle icon** to open AI in a Caffeine tab, or go directly to
`/ai`. Select a Groq or Pollinations chat model and manage conversations on this
device. Chat content is sent to the selected provider; local history is not cloud
synced. Delete conversations with the trash button in the conversation list.

On Railway, keep your Groq API key in **`groq`** and your Pollinations API key
in **`pollinations`**. `GROQ_API_KEY` and `POLLINATIONS_API_KEY` are also accepted.
Redeploy after changing variables. Available models are fetched from each
configured provider and grouped into General use, Coding, and Unfiltered.
Only models explicitly labelled unfiltered by the provider appear in that
category; ordinary models are not relabelled as uncensored. Provider moderation
still applies. Catalog availability and billing depend on your provider account.

Choose General, Coder, Professional, Friend, or Femboy personality presets.
Attach up to four images or text/code files by upload, drop, or clipboard paste.
Images are resized locally and accepted only by image-compatible models. Text
files are limited to 64 KB; PDFs and other binary documents are not supported.
Files sent in a message are shared with the selected AI provider. Attachments
and chat history remain in local browser storage, subject to browser capacity.
Never put the key in a `VITE_` variable: those are exposed in browser bundles.
The existing Node server handles `/api/ai/models` and `/api/ai/chat` and forwards
requests to Groq over HTTPS. Scramjet continues to proxy browser tabs; routing
Groq credentials through Scramjet would expose the key to the browser, so AI
uses the secure same-origin server relay instead.

For local AI development, export `groq` in the terminal before `pnpm dev`.
The Vite development middleware uses the same AI relay as the production server.
Without a key, the UI displays an unavailable state rather than fake responses.

**Protect a public deployment:** set a strong `PROXY_PASSWORD` (at least 12
characters). AI respects the production server's existing access cookie and
includes request size limits, model validation, a 90-second timeout, and basic
per-connection-IP rate limiting. Without a password, anyone reaching your site
can spend your Groq quota. Railway may share a reverse-proxy IP across users;
use authenticated per-user quotas for larger deployments.

### Railway build fix

The supplied log fails during `mise install`, not Vite. It selects pnpm 9.15.9
from the v9 lockfile but also tries to install `npm:pnpm@10.34.3` from
`.mise.toml`, which fails provenance checks. This project now pins the native
mise `pnpm` tool to **9.15.9**, matching the lockfile. No trust-policy bypass is
needed. Use `pnpm install --frozen-lockfile`, `pnpm run build`, and
`pnpm run start` on Railway. Keep the existing Node 22 toolchain.

A self-hosted browser workspace with local encrypted profiles, a customizable
home canvas, and Scramjet-powered browsing. Built with React, TypeScript, Vite,
and Tailwind CSS.

## Make it yours

- Browser-reserved Ctrl/Cmd+T and Ctrl/Cmd+W cannot reliably be intercepted by
  an ordinary website. Use **Alt+T**, **Alt+W**, **Alt+L**, **Alt+Shift+N**, and
  **Alt+1–9** for Caffeine tabs; Ctrl/Cmd variants are handled when delivered
  by the browser. The shortcuts also attach to same-origin proxy frames.
- The cursor follows the active accent and supports dust, sparkles, hearts,
  or bubbles in the customization panel. Trails honor reduced-motion settings.
- The AI main pane uses the selected wallpaper or video, blurred; its sidebar
  remains separate. Pink theme retains the same editable widget coordinates.

- The home screen greets you by time of day, with a compact quick-travel row.
- **Customize caffeine** is docked in the bottom-right. In edit mode, drag
  elements or use arrow keys (Shift for larger steps), then adjust their type,
  color, size, and position in the editor.
- Choose **Add widget** in the top-left to add notes, tasks, a focus timer,
  breathing guide, calendar, world clocks, countdown, calculator, hydration
  tracker, mood check-in, dice, quick link, text card, daily thought, gentle
  reminder, or day-progress meter. None are added by default.
- Notes, tasks, and widget values stay on this device, scoped to your profile.
  Remove a widget from the editor when you no longer want it on your canvas.
- The **femboy-ify!** slider switches to an alternate pink, heart-accented layout.
  Turn it off to restore the normal layout. Your choice is saved with your profile.
- Typeface choices preview their actual fonts. Google Fonts need a network
  connection; system fonts depend on what is installed on your device.

## Local profiles and privacy

First-run onboarding walks through your profile, wallpaper, and preferences
with a live preview. Profile PINs/passwords protect the locally encrypted login
vault, not proxy access. Profiles are not isolated browser accounts: proxied
site cookies share this origin. Do not use the proxy origin for unrelated apps.
No profile recovery or cloud sync is provided. Clearing site data removes local
profiles, widget contents, and saved customization.

## Run the browser

```sh
pnpm install
pnpm build:host
pnpm start
```

The production server defaults to port 8080 and honors `PORT`. Use a dedicated
HTTPS origin (or localhost) so the proxy service worker can control browser tabs.
`pnpm dev` serves the interface only; it does not run the Wisp WebSocket backend.

On Railway or another public host, set `HOST=0.0.0.0` and `NODE_ENV=production`.
No proxy password is required. Leave `PROXY_PASSWORD` unset to allow browsing
without signing in. Anyone who can reach the host can then use its proxy and
consume its bandwidth. For optional password protection, set `PROXY_PASSWORD`
and unlock server access in Settings → Connection. Your reverse proxy must
forward WebSocket upgrades for `/wisp/`.

## Proxy routing

Scramjet v2 and its separate controller intercept frame-specific `/p/` requests
and rewrite website HTML, scripts, and assets. Epoxy v3 sends network requests
through the bundled `/wisp/` server, avoiding browser CORS restrictions.
Scramjet v2 is currently an alpha release, pinned to `2.0.67-alpha.2` with matching
controller `0.0.14`. Reopen old tabs after upgrading; v1 proxy URLs are not compatible.
Install and build scripts synchronize the browser assets from the installed packages.
If the service worker is absent, the server returns an explicit 503
instead of serving the Caffeine application inside its own tab.

After updating, reload the top-level Caffeine page to activate the new worker.
Proxy engine assets and the service worker revalidate on every deployment;
engine URLs are versioned to prevent mixed cached releases. Initialization waits
for both worker activation and transport readiness, and transport changes are
applied without losing existing frames. Use Retry connection if activation fails.
If an older worker persists, unregister it in your browser's Application →
Service Workers tools and reload. Static hosting can show the interface but
cannot provide the bundled Wisp backend.
