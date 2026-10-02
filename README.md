https://ashy-rock-03c3ecf1e.3.azurestaticapps.net/

# Reel

A Spotify-style player for music videos. Instead of playing the audio, Reel plays the music video from YouTube, with playlists, a queue, and search.

<!-- Add a screenshot: ![Reel screenshot](docs/screenshot.png) -->

**Live site:** _add your Azure Static Web Apps URL here_

## Features

- **Full-screen video:** the video fills the page, with the correct aspect ratio and a fullscreen button.
- **Search:** find songs and artists through YouTube, with results showing thumbnail, length, channel, year, views, and description.
- **Playlists:** create playlists, rename them, add and remove videos, and paste a YouTube link to add a video directly.
- **Queue:** playing a search result or a playlist track queues up the rest, with previous, next, and a seek bar.
- **Skips broken videos:** if a video can't be embedded, Reel moves on to the next one.
- **Lime and purple theme,** inspired by Spotify.

## Built with

- **Angular** (standalone components, signals, zoneless change detection), plain CSS with no UI library
- **YouTube IFrame Player API** for playback
- **YouTube Data API v3** for search, called through an **Azure Function** so the API key never reaches the browser
- **Azure Static Web Apps** for hosting, deployed with GitHub Actions
- **localStorage** for playlists (no accounts or database)

## Built with Claude

This is the first app I've ever built with [Claude](https://claude.ai), Anthropic's AI assistant. I started with just an idea ("Spotify, but for music videos").

Claude helped me plan the architecture and wrote the code, and I steered the design and features and deployed it to Azure myself. When something broke, I pasted the error back into the conversation and we fixed it together. The layout, colors, and features all came from going back and forth ("make the video fill the screen," "make the results more verbose," "make it lime green and purple").

A few things I learned along the way:

- Keep API keys out of the repo. They belong in environment settings, not in code.
- A small backend function is the right way to use an API key from a web app.
- Describing what you want, then iterating, works better than trying to get everything right in one prompt.

## Running it locally

**You'll need:** Node.js 20.19 or newer, the [Angular CLI](https://angular.dev/tools/cli), [Azure Functions Core Tools](https://learn.microsoft.com/azure/azure-functions/functions-run-local) v4, and a [YouTube Data API v3 key](https://console.cloud.google.com/).

1. Clone the repo and install dependencies:

   ```bash
   npm install
   cd api
   npm install
   ```

2. Add your key to `api/local.settings.json` (this file is gitignored, so don't commit it):

   ```json
   {
     "IsEncrypted": false,
     "Values": {
       "AzureWebJobsStorage": "",
       "FUNCTIONS_WORKER_RUNTIME": "node",
       "YOUTUBE_API_KEY": "your-key-here"
     }
   }
   ```

3. Start the API in one terminal:

   ```bash
   cd api
   func start
   ```

4. Start the app in another terminal, from the project root:

   ```bash
   ng serve --proxy-config proxy.conf.json
   ```

5. Open `http://localhost:4200`.

The proxy forwards `/api/...` requests from Angular to the Function on port 7071.

## Project structure

```
reel/
├── src/app/
│   ├── app.ts                  # UI: top search bar, results, library panel, player bar
│   ├── player.service.ts       # YouTube player wrapper, queue, playback state
│   └── library.service.ts      # Playlists in localStorage, search and link lookup
├── src/styles.css              # Theme and layout
├── api/
│   └── src/functions/search.js # Azure Function that calls the YouTube Data API
├── proxy.conf.json             # Local dev proxy to the Function
└── staticwebapp.config.json    # Azure Static Web Apps settings (API runtime)
```

## Deploying

Reel deploys to Azure Static Web Apps (Free plan), using GitHub Actions.

- **App location:** `/`
- **Api location:** `api`
- **Output location:** `dist/reel/browser`
- Add `YOUTUBE_API_KEY` under the app's environment variables in the Azure portal.

## Good to know

- Videos play through YouTube's embedded player, as YouTube's terms require. Reel doesn't extract audio or play videos in the background.
- The YouTube Data API has a default quota of 10,000 units per day. Each search uses about 101 units, so that's roughly 100 searches a day. The Function caches repeat searches for 10 minutes.
- Playlists are stored in your browser, so they don't sync between devices.
- Some uploaders disable embedding. Reel skips those videos automatically.

## Ideas for later

- Delete playlists, shuffle, repeat, and drag-to-reorder
- Keyboard shortcuts and media-key controls
- Accounts and cross-device sync

## Disclaimer

Reel is a personal project and isn't affiliated with or endorsed by YouTube, Google, or Spotify.
