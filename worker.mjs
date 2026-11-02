import {validate, defaults} from './validate.mjs';

const SESSION_SECONDS = 12 * 60 * 60;
const MAX_UPLOAD = 10 * 1024 * 1024;
const encoder = new TextEncoder();

function reply(status, data, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers}
  });
}

function hex(bytes) {
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomId() {
  return hex(crypto.getRandomValues(new Uint8Array(32)));
}

async function sha256(text) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
}

async function passwordMatches(candidate, expected) {
  const [a, b] = await Promise.all([sha256(candidate), sha256(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function cookieValue(request, name) {
  const found = (request.headers.get('Cookie') || '').split(';').map(x => x.trim()).find(x => x.startsWith(name + '='));
  return found ? found.slice(name.length + 1) : null;
}

async function getSession(request, env) {
  const id = cookieValue(request, 'halli_session');
  if (!id || !/^[0-9a-f]{64}$/.test(id)) return null;
  const csrf = await env.HALLI_KV.get('session:' + id);
  return csrf ? {id, csrf} : null;
}

async function readJson(request, max = 2_000_000) {
  const text = await request.text();
  if (text.length > max) throw Object.assign(Error('That request is too large.'), {status: 413});
  return JSON.parse(text);
}

function imageType(bytes) {
  if (bytes.length > 12 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return ['jpg', 'image/jpeg'];
  const png = [137, 80, 78, 71, 13, 10, 26, 10];
  if (png.every((v, i) => bytes[i] === v)) return ['png', 'image/png'];
  const ascii = (from, to) => String.fromCharCode(...bytes.subarray(from, to));
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return ['webp', 'image/webp'];
  if (/^GIF8[79]a$/.test(ascii(0, 6))) return ['gif', 'image/gif'];
  return null;
}

async function handleApi(request, env, url) {
  const path = url.pathname;
  const method = request.method;

  if (method !== 'GET' && method !== 'HEAD') {
    const origin = request.headers.get('Origin');
    if (origin && origin !== url.origin) return reply(403, {error: 'Please make changes from the website itself.'});
  }

  if (path === '/api/content' && method === 'GET') {
    const stored = await env.HALLI_KV.get('content', 'json');
    return reply(200, stored || defaults);
  }

  if (path === '/api/admin/login' && method === 'POST') {
    if (!env.HALLI_ADMIN_PASSWORD) return reply(503, {error: 'The admin password has not been set up yet.'});
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const attemptKey = 'attempts:' + ip;
    const count = Number(await env.HALLI_KV.get(attemptKey)) || 0;
    if (count >= 12) return reply(429, {error: 'Too many attempts. Please wait one minute.'});
    await env.HALLI_KV.put(attemptKey, String(count + 1), {expirationTtl: 60});
    const input = await readJson(request, 1000);
    const ok = typeof input.password === 'string' && input.password.length <= 100 &&
      await passwordMatches(input.password, env.HALLI_ADMIN_PASSWORD);
    if (!ok) return reply(401, {error: 'That password isn’t right. Please try again.'});
    await env.HALLI_KV.delete(attemptKey);
    const id = randomId();
    const csrf = randomId();
    await env.HALLI_KV.put('session:' + id, csrf, {expirationTtl: SESSION_SECONDS});
    return reply(200, {authenticated: true, csrf}, {
      'Set-Cookie': `halli_session=${id}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_SECONDS}`
    });
  }

  if (path === '/api/admin/session' && method === 'GET') {
    const auth = await getSession(request, env);
    return reply(200, {authenticated: Boolean(auth), ...(auth ? {csrf: auth.csrf} : {})});
  }

  if (path.startsWith('/api/admin/')) {
    const auth = await getSession(request, env);
    if (!auth) return reply(401, {error: 'Please sign in again.'});
    if (request.headers.get('X-CSRF-Token') !== auth.csrf) {
      return reply(403, {error: 'Your session needs a refresh. Please reload the admin page.'});
    }

    if (path === '/api/admin/logout' && method === 'POST') {
      await env.HALLI_KV.delete('session:' + auth.id);
      return reply(200, {ok: true}, {'Set-Cookie': 'halli_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'});
    }

    if (path === '/api/admin/content' && method === 'PUT') {
      const content = validate(await readJson(request));
      const previous = await env.HALLI_KV.get('content');
      if (previous) await env.HALLI_KV.put('content.backup', previous);
      await env.HALLI_KV.put('content', JSON.stringify(content));
      return reply(200, {ok: true, savedAt: new Date().toISOString(), content});
    }

    if (path === '/api/admin/upload' && method === 'POST') {
      const buffer = await request.arrayBuffer();
      if (buffer.byteLength > MAX_UPLOAD) {
        return reply(413, {error: 'File is too large. Maximum image size is 10 MB.'});
      }
      const bytes = new Uint8Array(buffer);
      const type = imageType(bytes);
      if (!type) return reply(400, {error: 'Please use a JPG, PNG, WebP, or GIF image.'});
      const name = `${randomId().slice(0, 32)}.${type[0]}`;
      await env.HALLI_KV.put('upload:' + name, buffer, {metadata: {type: type[1]}});
      return reply(201, {url: `/uploads/${name}`});
    }
  }

  return reply(404, {error: 'Not found'});
}

async function handleUpload(request, env, url) {
  const name = url.pathname.slice('/uploads/'.length);
  if (!/^[0-9a-f]{32}\.(jpg|png|webp|gif)$/.test(name)) return reply(404, {error: 'Page not found'});
  const {value, metadata} = await env.HALLI_KV.getWithMetadata('upload:' + name, 'arrayBuffer');
  if (!value) return reply(404, {error: 'Page not found'});
  return new Response(value, {
    headers: {
      'Content-Type': metadata?.type || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith('/api/')) return await handleApi(request, env, url);
      if (url.pathname.startsWith('/uploads/') && ['GET', 'HEAD'].includes(request.method)) {
        return await handleUpload(request, env, url);
      }
      return env.ASSETS.fetch(request);
    } catch (error) {
      return reply(error.status || 400, {error: error.message || 'Unable to process this request.'});
    }
  }
};
