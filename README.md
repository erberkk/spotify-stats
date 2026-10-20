# Spotify card for your GitHub README

Show what you're listening to on Spotify, plus your top tracks and artists, right in your GitHub profile README. Anyone can connect their own account.

[![Spotify](https://spotify-for-readme-pi.vercel.app/api/spotify/zk0e8yk1gnwx793n61k0aflb6)](https://open.spotify.com/user/zk0e8yk1gnwx793n61k0aflb6)

Designed to sit next to [github-streak-stats](https://github.com/erberkk/github-streak-stats): same layout, palette and typography.

## Features

- **Now playing**: the current track with album art, a live progress bar and an equalizer while playing; falls back to the last played track
- **Top tracks and artists**: your five favourites over the last 4 weeks, 6 months or all time
- **Light and dark mode**: follows the viewer's color scheme automatically
- **Fast**: Spotify calls run in parallel and responses are briefly cached on the CDN, so the card doesn't time out on GitHub

## Quick start

1. Open [spotify-for-readme-pi.vercel.app](https://spotify-for-readme-pi.vercel.app/) and click **Connect Spotify**.
2. Authorize on Spotify.
3. Copy the Markdown snippet you get into your GitHub profile README:

```markdown
[![Spotify](https://spotify-for-readme-pi.vercel.app/api/spotify/YOUR_SPOTIFY_ID)](https://open.spotify.com/user/YOUR_SPOTIFY_ID)
```

### Options

| Parameter | Values | Default |
| --- | --- | --- |
| `theme` | `auto`, `dark`, `light` | `auto` |
| `range` | `short_term` (4 weeks), `medium_term` (6 months), `long_term` (all time) | `short_term` |

## 🔧 For Developers

Want to deploy your own instance? Follow these steps:

### 1. 🍴 Fork & Clone

```bash
# Fork this repository on GitHub
# Then clone your fork
git clone https://github.com/YOUR_USERNAME/spotify-for-readme.git
cd spotify-for-readme
```

### 2. 🎵 Spotify Developer Setup

1. **Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)**
2. **Create New App** (or use existing)
3. **Get Client ID & Secret**:
   - Copy `Client ID`
   - Copy `Client Secret`
4. **Configure Redirect URIs**:
   - Add: `https://your-domain.vercel.app/api/auth/callback`
   - Add: `http://localhost:3000/api/auth/callback` (for local testing)
5. **Request Extended Quota** (recommended for production)

### 3. 🗄️ Redis Database

**Option A: Redis Cloud (Free)**
1. [redis.com](https://redis.com/try-free/) - Create free account
2. Create database
3. Copy connection URL

**Option B: Upstash Redis (Vercel Integration)**
1. In Vercel dashboard, go to Storage
2. Create Redis database
3. Auto-connects to your project

### 4. 🚀 Deploy on Vercel

1. **Connect GitHub**:
   - Go to [vercel.com](https://vercel.com)
   - Import your forked repository

2. **Add Environment Variables**:
   ```
   SPOTIFY_CLIENT_ID=your_client_id_here
   SPOTIFY_CLIENT_SECRET=your_client_secret_here
   REDIS_URL=your_redis_connection_string
   ```

3. **Deploy** - Vercel will automatically build and deploy

## 📁 Project Structure

```
spotify-for-readme/
├── api/
│   ├── _lib/
│   │   ├── card.js           # SVG renderer
│   │   └── redis.js          # Shared Redis client
│   ├── auth/
│   │   ├── login.js          # Spotify OAuth initiation
│   │   └── callback.js       # OAuth callback & token storage
│   └── spotify/
│       └── [username].js     # Dynamic Spotify widget endpoint
├── public/
│   ├── index.html            # Landing page
│   └── style.css             # Shared page styles
├── package.json
└── README.md
```

## 🔑 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SPOTIFY_CLIENT_ID` | Your Spotify app client ID | ✅ |
| `SPOTIFY_CLIENT_SECRET` | Your Spotify app client secret | ✅ |
| `REDIS_URL` | Redis connection string | ✅ |

## 🚨 Important Notes

- **Development Mode**: Spotify apps start in development mode (25 user limit)
