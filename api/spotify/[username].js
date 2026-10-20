// api/spotify/[username].js — Multi-User Spotify Widget
import { getRedis, userKey } from '../_lib/redis.js';
import { parseTheme, renderCard, renderMessageCard, RANGES } from '../_lib/card.js';

const TIMEOUT_MS = 4000;

class AuthError extends Error {}

// ------- Auth -------
async function getAccessToken(username) {
  const redis = await getRedis();
  const key = userKey(username);
  const user = await redis.hGetAll(key);

  if (!user.refresh_token) throw new AuthError('not_found');

  // Reuse the stored token until shortly before it expires; no test call needed.
  if (user.access_token && Number(user.expires_at) > Date.now() + 60_000) {
    return { token: user.access_token, user };
  }

  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env;
  const auth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: user.refresh_token }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    console.error(`Token refresh failed for ${username}: ${res.status} ${await res.text()}`);
    throw new AuthError('expired');
  }

  const data = await res.json();
  const update = {
    access_token: data.access_token,
    expires_at: String(Date.now() + (data.expires_in || 3600) * 1000),
  };
  // Spotify may rotate the refresh token; keep the new one or the next refresh fails.
  if (data.refresh_token) update.refresh_token = data.refresh_token;
  await redis.hSet(key, update);

  return { token: data.access_token, user };
}

// ------- Spotify API -------
async function spotify(token, path) {
  try {
    const res = await fetch(`https://api.spotify.com/v1${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status === 204 || !res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error(`Spotify ${path} failed:`, error.message);
    return null;
  }
}

// Picks the smallest image that is at least `min` px wide.
function pickImage(images, min) {
  if (!images?.length) return null;
  const sorted = [...images].sort((a, b) => (a.width || 0) - (b.width || 0));
  return (sorted.find((i) => (i.width || 0) >= min) || sorted[sorted.length - 1]).url;
}

function describeItem(item) {
  if (!item) return null;
  const isEpisode = item.type === 'episode';
  return {
    title: item.name,
    artist: isEpisode ? item.show?.name : (item.artists || []).map((a) => a.name).join(', '),
    album: isEpisode ? 'Podcast' : item.album?.name,
    imageUrl: pickImage(isEpisode ? item.images : item.album?.images, 160),
    duration: item.duration_ms || 0,
  };
}

async function toDataUri(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${res.headers.get('content-type') || 'image/jpeg'};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

async function buildCard(username, range, theme) {
  const { token, user } = await getAccessToken(username);

  // Everything in parallel: GitHub's image proxy gives up after a few seconds.
  const [current, recent, topTracks, topArtists] = await Promise.all([
    spotify(token, '/me/player/currently-playing?additional_types=episode'),
    spotify(token, '/me/player/recently-played?limit=1'),
    spotify(token, `/me/top/tracks?time_range=${range}&limit=5`),
    spotify(token, `/me/top/artists?time_range=${range}&limit=5`),
  ]);

  let hero = describeItem(current?.item);
  if (hero) {
    hero.status = current.is_playing ? 'playing' : 'paused';
    hero.progress = current.progress_ms || 0;
  } else if ((hero = describeItem(recent?.items?.[0]?.track))) {
    hero.status = 'recent';
    hero.progress = 0;
    hero.duration = 0;
  } else {
    hero = { title: 'Nothing playing', artist: 'Start listening on Spotify', status: 'offline', progress: 0, duration: 0 };
  }

  const tracks = (topTracks?.items || []).map((t) => ({
    title: t.name,
    subtitle: (t.artists || []).map((a) => a.name).join(', '),
    imageUrl: pickImage(t.album?.images, 48),
  }));
  const artists = (topArtists?.items || []).map((a) => ({
    title: a.name,
    imageUrl: pickImage(a.images, 48),
  }));

  const [heroImage, ...thumbs] = await Promise.all(
    [hero.imageUrl, ...tracks.map((t) => t.imageUrl), ...artists.map((a) => a.imageUrl)].map(toDataUri)
  );
  hero.image = heroImage;
  tracks.forEach((t, i) => (t.image = thumbs[i]));
  artists.forEach((a, i) => (a.image = thumbs[tracks.length + i]));

  return renderCard({ name: user.display_name || username, hero, tracks, artists, range, theme });
}

// ------- Handler -------
export default async function handler(req, res) {
  const { username } = req.query;
  const theme = parseTheme(req.query.theme);
  const range = RANGES[req.query.range] ? req.query.range : 'short_term';

  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Always answer 200 with an SVG: GitHub shows a broken image for error statuses.
  try {
    const svg = await buildCard(String(username || ''), range, theme);
    // Short CDN cache keeps "now playing" fresh while letting GitHub get an instant response.
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=20, stale-while-revalidate=120');
    res.status(200).send(svg);
  } catch (error) {
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30');
    const host = req.headers.host || 'spotify-for-readme-pi.vercel.app';
    if (error instanceof AuthError) {
      const title = error.message === 'not_found' ? 'Spotify not connected' : 'Spotify authorization expired';
      res.status(200).send(renderMessageCard(title, `Connect your account at ${host}`, theme));
    } else {
      console.error(`Spotify widget error for ${username}:`, error);
      res.status(200).send(renderMessageCard('Could not load Spotify activity', 'Try again in a moment', theme));
    }
  }
}
