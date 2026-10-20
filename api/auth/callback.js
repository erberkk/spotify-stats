// api/auth/callback.js - Spotify OAuth Callback & Token Storage
import { getRedis, userKey } from '../_lib/redis.js';

const WIDGET_HOST = 'spotify-for-readme-pi.vercel.app';

function esc(s) {
  return String(s ?? '').replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);
}

async function exchangeCodeForTokens(code, redirectUri) {
  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env;
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: SPOTIFY_CLIENT_ID,
      client_secret: SPOTIFY_CLIENT_SECRET,
    }),
  });
  if (!response.ok) throw new Error(`Token exchange failed: ${await response.text()}`);
  return response.json();
}

async function getUserProfile(accessToken) {
  const response = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error('Failed to get user profile');
  return response.json();
}

function page(title, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <main>${body}</main>
</body>
</html>`;
}

function errorPage(message) {
  return page('Authorization failed', `
    <h1>Authorization failed</h1>
    <p class="lead">${esc(message)}</p>
    <a class="button" href="/api/auth/login">Try again</a>`);
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  try {
    const { code, error } = req.query;
    if (error) return res.status(400).send(errorPage(`Spotify returned: ${error}`));
    if (!code) return res.status(400).send(errorPage('Missing authorization code'));

    const baseUrl = req.headers.host.includes('localhost') ? 'http://localhost:3000' : `https://${req.headers.host}`;
    const tokenData = await exchangeCodeForTokens(code, `${baseUrl}/api/auth/callback`);
    const profile = await getUserProfile(tokenData.access_token);
    const username = profile.id;
    const profileUrl = profile.external_urls?.spotify || `https://open.spotify.com/user/${username}`;

    const redis = await getRedis();
    await redis.hSet(userKey(username), {
      refresh_token: tokenData.refresh_token,
      access_token: tokenData.access_token,
      expires_at: String(Date.now() + (tokenData.expires_in || 3600) * 1000),
      username,
      display_name: profile.display_name || username,
      profile_url: profileUrl,
      created_at: String(Date.now()),
    });

    const widget = `https://${WIDGET_HOST}/api/spotify/${username}`;
    const markdown = `[![Spotify](${widget})](${profileUrl})`;

    res.status(200).send(page('Spotify connected', `
      <h1>You're connected, ${esc(profile.display_name || username)}</h1>
      <p class="lead">Add this to your GitHub profile README. The card follows the viewer's light or dark mode.</p>
      <img class="preview" src="/api/spotify/${esc(username)}" alt="Your Spotify card" width="800" height="280">
      <div class="snippet">
        <div class="snippet-head"><span>Markdown</span><button id="copy">Copy</button></div>
        <code id="markdown">${esc(markdown)}</code>
      </div>
      <p class="hint">Options: <code>?theme=dark</code> or <code>?theme=light</code>, and <code>?range=medium_term</code> or <code>?range=long_term</code> for top lists over 6 months or all time.</p>
      <script>
        document.getElementById('copy').onclick = async (e) => {
          await navigator.clipboard.writeText(document.getElementById('markdown').textContent);
          e.target.textContent = 'Copied!';
          setTimeout(() => (e.target.textContent = 'Copy'), 1500);
        };
      </script>`));
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send(errorPage('Something went wrong while connecting your account.'));
  }
}
