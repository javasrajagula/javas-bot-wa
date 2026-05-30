import http, { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';
import { URL } from 'url';
import prisma from '../../db/client.js';
import { env } from '../../config/env.js';
import { pluginManager } from '../../config/plugins.js';
import { DEFAULT_FEATURES, parseFeatureFlags } from '../../config/feature-flags.js';
import { backupService } from '../backup/backup.service.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import { downloaderQueue, generalQueue, hdQueue } from '../../queues/queue.js';

interface SessionData {
  createdAt: number;
}

const sessions = new Map<string, SessionData>();
const pendingBroadcasts = new Map<string, { text: string; createdAt: number }>();

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseCookies(req: IncomingMessage): Record<string, string> {
  const header = req.headers.cookie || '';
  return Object.fromEntries(header.split(';').map(part => {
    const [key, ...value] = part.trim().split('=');
    return [key, decodeURIComponent(value.join('='))];
  }).filter(([key]) => key));
}

function safePasswordEquals(input: string, expected: string): boolean {
  const inputHash = crypto.createHash('sha256').update(input).digest();
  const expectedHash = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(inputHash, expectedHash);
}

async function readBody(req: IncomingMessage): Promise<URLSearchParams> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return new URLSearchParams(Buffer.concat(chunks).toString('utf-8'));
}

function redirect(res: ServerResponse, location: string) {
  res.writeHead(303, { Location: location });
  res.end();
}

function renderPage(title: string, body: string): string {
  const nav = [
    ['Overview', '/overview'],
    ['Groups', '/groups'],
    ['Features', '/features'],
    ['Plugins', '/plugins'],
    ['Premium', '/premium'],
    ['Subscriptions', '/subscriptions'],
    ['Queue', '/queue'],
    ['Usage', '/usage'],
    ['Errors', '/errors'],
    ['Group Logs', '/group-logs'],
    ['Broadcast', '/broadcast'],
    ['Backup', '/backup'],
    ['Settings', '/settings']
  ].map(([label, href]) => `<a href="${href}">${label}</a>`).join('');

  return `<!doctype html>
  <html lang="id">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escapeHtml(title)} - Javas Bot Dashboard</title>
    <style>
      body{font-family:Arial,sans-serif;margin:0;background:#f6f7fb;color:#1f2937}
      header{background:#111827;color:#fff;padding:14px 20px;display:flex;justify-content:space-between;align-items:center}
      nav{display:flex;gap:8px;flex-wrap:wrap;background:#fff;border-bottom:1px solid #e5e7eb;padding:10px 20px}
      nav a{color:#2563eb;text-decoration:none;font-size:14px}
      main{padding:20px;max-width:1200px;margin:auto}
      .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
      .card{background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:14px}
      table{width:100%;border-collapse:collapse;background:#fff}
      th,td{border-bottom:1px solid #e5e7eb;padding:8px;text-align:left;font-size:14px;vertical-align:top}
      input,select,textarea,button{font:inherit;padding:8px;border:1px solid #d1d5db;border-radius:6px}
      textarea{width:100%;min-height:120px}
      button{background:#2563eb;color:white;border:0;cursor:pointer}
      form.inline{display:inline}
      .danger{background:#dc2626}
      .muted{color:#6b7280}
      .ok{color:#047857}
      .bad{color:#b91c1c}
    </style>
  </head>
  <body>
    <header><strong>Javas Bot Owner Dashboard</strong><a style="color:#fff" href="/logout">Logout</a></header>
    <nav>${nav}</nav>
    <main><h1>${escapeHtml(title)}</h1>${body}</main>
  </body>
  </html>`;
}

async function renderOverview() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [groups, users, premium, commandsToday, errors] = await Promise.all([
    prisma.groupConfig.count(),
    prisma.userProfile.count(),
    prisma.premiumUser.count({ where: { expiresAt: { gt: new Date() } } }),
    prisma.usageLog.count({ where: { createdAt: { gte: today } } }),
    prisma.errorLog.count()
  ]);

  return renderPage('Overview', `<div class="grid">
    <div class="card"><strong>Groups</strong><h2>${groups}</h2></div>
    <div class="card"><strong>Users</strong><h2>${users}</h2></div>
    <div class="card"><strong>Premium Active</strong><h2>${premium}</h2></div>
    <div class="card"><strong>Commands Today</strong><h2>${commandsToday}</h2></div>
    <div class="card"><strong>Error Logs</strong><h2>${errors}</h2></div>
  </div>`);
}

async function renderGroups() {
  const groups = await prisma.groupConfig.findMany({ orderBy: { updatedAt: 'desc' } });
  const rows = groups.map(group => `<tr>
    <td><a href="/groups?id=${encodeURIComponent(group.groupId)}">${escapeHtml(group.groupId)}</a></td>
    <td>${group.botEnabled ? '<span class="ok">ON</span>' : '<span class="bad">OFF</span>'}</td>
    <td>${escapeHtml(group.prefix)}</td>
    <td>${escapeHtml(group.updatedAt.toISOString())}</td>
  </tr>`).join('');
  return renderPage('Groups', `<table><tr><th>Group ID</th><th>Bot</th><th>Prefix</th><th>Updated</th></tr>${rows}</table>`);
}

async function renderGroupDetail(groupId: string) {
  const group = await prisma.groupConfig.findUnique({ where: { groupId } });
  if (!group) return renderPage('Group Detail', '<p>Group tidak ditemukan.</p>');
  const flags = parseFeatureFlags(group.featuresJson);
  const features = Object.keys(DEFAULT_FEATURES).filter(key => typeof DEFAULT_FEATURES[key] === 'boolean')
    .map(key => `<tr><td>${key}</td><td>${flags[key] ? 'ON' : 'OFF'}</td><td>
      <form class="inline" method="post" action="/features/toggle">
        <input type="hidden" name="groupId" value="${escapeHtml(groupId)}">
        <input type="hidden" name="feature" value="${key}">
        <input type="hidden" name="value" value="${flags[key] ? 'false' : 'true'}">
        <button>${flags[key] ? 'Disable' : 'Enable'}</button>
      </form>
    </td></tr>`).join('');
  return renderPage('Group Detail', `<p><strong>${escapeHtml(groupId)}</strong></p><table><tr><th>Feature</th><th>Status</th><th>Action</th></tr>${features}</table>`);
}

async function renderPlugins() {
  const rows = pluginManager.listPlugins().map(plugin => `<tr>
    <td>${escapeHtml(plugin.name)}</td><td>${escapeHtml(plugin.category)}</td><td>${plugin.enabled ? 'ON' : 'OFF'}</td>
    <td><form class="inline" method="post" action="/plugins/toggle">
      <input type="hidden" name="name" value="${escapeHtml(plugin.name)}">
      <input type="hidden" name="enabled" value="${plugin.enabled ? 'false' : 'true'}">
      <button>${plugin.enabled ? 'Disable' : 'Enable'}</button>
    </form></td>
  </tr>`).join('');
  return renderPage('Plugins', `<table><tr><th>Name</th><th>Category</th><th>Status</th><th>Action</th></tr>${rows}</table>`);
}

async function renderPremium() {
  const rows = (await prisma.premiumUser.findMany({ orderBy: { expiresAt: 'desc' } }))
    .map(user => `<tr><td>${escapeHtml(user.userId)}</td><td>${escapeHtml(user.expiresAt.toISOString())}</td></tr>`).join('');
  return renderPage('Premium Users', `<form method="post" action="/premium/add" class="card">
    <input name="userId" placeholder="628xxx@s.whatsapp.net" required>
    <input name="days" type="number" value="30" min="1">
    <button>Add / Extend</button>
  </form><br><table><tr><th>User</th><th>Expires</th></tr>${rows}</table>`);
}

async function renderSubscriptions() {
  const rows = (await prisma.groupSubscription.findMany({ orderBy: { updatedAt: 'desc' } }))
    .map(sub => `<tr><td>${escapeHtml(sub.groupId)}</td><td>${escapeHtml(sub.plan)}</td><td>${sub.expiresAt ? escapeHtml(sub.expiresAt.toISOString()) : 'Lifetime'}</td></tr>`).join('');
  return renderPage('Group Subscriptions', `<form method="post" action="/subscriptions/save" class="card">
    <input name="groupId" placeholder="group@g.us" required>
    <select name="plan"><option>free</option><option>basic</option><option>premium</option></select>
    <input name="days" type="number" value="30" min="0">
    <button>Save</button>
  </form><br><table><tr><th>Group</th><th>Plan</th><th>Expires</th></tr>${rows}</table>`);
}

async function renderQueue() {
  return renderPage('Queue Monitor', `<div class="grid">
    <div class="card"><strong>HD</strong><h2>${hdQueue.getLength()}</h2></div>
    <div class="card"><strong>Downloader</strong><h2>${downloaderQueue.getLength()}</h2></div>
    <div class="card"><strong>General</strong><h2>${generalQueue.getLength()}</h2></div>
  </div>`);
}

async function renderUsage() {
  const logs = await prisma.usageLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  const rows = logs.map(log => `<tr><td>${escapeHtml(log.createdAt.toISOString())}</td><td>${escapeHtml(log.userId)}</td><td>${escapeHtml(log.groupId || '-')}</td><td>${escapeHtml(log.feature)}</td></tr>`).join('');
  return renderPage('Usage Stats', `<table><tr><th>Time</th><th>User</th><th>Group</th><th>Feature</th></tr>${rows}</table>`);
}

async function renderErrors() {
  const errors = await prisma.errorLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  const rows = errors.map(error => `<tr><td>${escapeHtml(error.createdAt.toISOString())}</td><td>${escapeHtml(error.scope || '-')}</td><td>${escapeHtml(error.feature || '-')}</td><td>${escapeHtml(error.message)}</td></tr>`).join('');
  return renderPage('Error Logs', `<table><tr><th>Time</th><th>Scope</th><th>Feature</th><th>Message</th></tr>${rows}</table>`);
}

async function renderGroupLogs() {
  const logs = await prisma.groupLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  const rows = logs.map(log => `<tr><td>${escapeHtml(log.createdAt.toISOString())}</td><td>${escapeHtml(log.groupId)}</td><td>${escapeHtml(log.type)}</td><td>${escapeHtml(log.action || '-')}</td><td>${escapeHtml(log.message || '-')}</td></tr>`).join('');
  return renderPage('Group Logs', `<table><tr><th>Time</th><th>Group</th><th>Type</th><th>Action</th><th>Message</th></tr>${rows}</table>`);
}

async function renderBroadcast(sessionId: string) {
  const pending = pendingBroadcasts.get(sessionId);
  const preview = pending ? `<div class="card"><h3>Preview</h3><p>${escapeHtml(pending.text)}</p>
    <form method="post" action="/broadcast/confirm"><button class="danger">Confirm Send</button></form></div>` : '';
  return renderPage('Broadcast Panel', `<form method="post" action="/broadcast/preview" class="card">
    <textarea name="text" placeholder="Tulis broadcast..." required></textarea><br><br>
    <button>Preview</button>
  </form><br>${preview}`);
}

async function renderBackup() {
  const backups = backupService.listBackups();
  const rows = backups.map(backup => `<tr><td>${escapeHtml(backup.id)}</td><td>${backup.kind}</td><td>${Math.ceil(backup.size / 1024)} KB</td><td>${escapeHtml(backup.createdAt.toISOString())}</td></tr>`).join('');
  return renderPage('Backup & Restore', `<form method="post" action="/backup/create" class="card">
    <button>Create Full Backup</button>
  </form><br><table><tr><th>ID</th><th>Kind</th><th>Size</th><th>Created</th></tr>${rows}</table>`);
}

async function renderSettings() {
  return renderPage('Settings', `<div class="card">
    <p>Adapter mode: ${escapeHtml(env.ADAPTER_MODE)}</p>
    <p>Dashboard port: ${escapeHtml(env.DASHBOARD_PORT)}</p>
    <p>Backup retention days: ${escapeHtml(env.BACKUP_RETENTION_DAYS)}</p>
    <p class="muted">Credential WhatsApp dan .env tidak ditampilkan di dashboard.</p>
  </div>`);
}

export function startDashboardServer(adapter?: WhatsAppAdapter): http.Server | null {
  if (!env.DASHBOARD_ENABLED) return null;
  if (!env.OWNER_DASHBOARD_PASSWORD) {
    console.warn('[Dashboard] DASHBOARD_ENABLED=true but OWNER_DASHBOARD_PASSWORD/OWNER_PASSWORD is missing. Dashboard not started.');
    return null;
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const cookies = parseCookies(req);
      const sessionId = cookies.dashboard_session;
      const authed = Boolean(sessionId && sessions.has(sessionId));

      if (url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true, time: new Date().toISOString() }));
        return;
      }

      if (url.pathname === '/login' && req.method === 'POST') {
        const form = await readBody(req);
        const password = form.get('password') || '';
        if (safePasswordEquals(password, env.OWNER_DASHBOARD_PASSWORD)) {
          const token = crypto.randomBytes(24).toString('hex');
          sessions.set(token, { createdAt: Date.now() });
          res.writeHead(303, { Location: '/overview', 'Set-Cookie': `dashboard_session=${token}; HttpOnly; SameSite=Lax; Path=/` });
          res.end();
          return;
        }
        redirect(res, '/');
        return;
      }

      if (url.pathname === '/logout') {
        if (sessionId) sessions.delete(sessionId);
        res.writeHead(303, { Location: '/', 'Set-Cookie': 'dashboard_session=; Max-Age=0; Path=/' });
        res.end();
        return;
      }

      if (!authed) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html><form method="post" action="/login" style="max-width:360px;margin:80px auto;font-family:Arial">
          <h1>Owner Login</h1><input name="password" type="password" placeholder="Password" style="width:100%;padding:10px"><br><br><button>Login</button>
        </form>`);
        return;
      }

      if (req.method === 'POST') {
        const form = await readBody(req);
        if (url.pathname === '/features/toggle') {
          const groupId = String(form.get('groupId') || '');
          const feature = String(form.get('feature') || '');
          const value = form.get('value') === 'true';
          const group = await prisma.groupConfig.findUnique({ where: { groupId } });
          if (group && feature in DEFAULT_FEATURES) {
            const flags = parseFeatureFlags(group.featuresJson);
            flags[feature] = value;
            await prisma.groupConfig.update({ where: { groupId }, data: { featuresJson: JSON.stringify(flags) } });
          }
          redirect(res, `/groups?id=${encodeURIComponent(groupId)}`);
          return;
        }
        if (url.pathname === '/plugins/toggle') {
          pluginManager.setPluginStatus(String(form.get('name') || ''), form.get('enabled') === 'true');
          redirect(res, '/plugins');
          return;
        }
        if (url.pathname === '/premium/add') {
          const userId = String(form.get('userId') || '');
          const days = Number(form.get('days') || 30);
          await prisma.premiumUser.upsert({
            where: { userId },
            create: { userId, expiresAt: new Date(Date.now() + days * 86400000) },
            update: { expiresAt: new Date(Date.now() + days * 86400000) }
          });
          redirect(res, '/premium');
          return;
        }
        if (url.pathname === '/subscriptions/save') {
          const groupId = String(form.get('groupId') || '');
          const plan = String(form.get('plan') || 'free');
          const days = Number(form.get('days') || 0);
          await prisma.groupSubscription.upsert({
            where: { groupId },
            create: { groupId, plan, expiresAt: days > 0 ? new Date(Date.now() + days * 86400000) : null },
            update: { plan, expiresAt: days > 0 ? new Date(Date.now() + days * 86400000) : null }
          });
          redirect(res, '/subscriptions');
          return;
        }
        if (url.pathname === '/broadcast/preview') {
          pendingBroadcasts.set(sessionId!, { text: String(form.get('text') || ''), createdAt: Date.now() });
          redirect(res, '/broadcast');
          return;
        }
        if (url.pathname === '/broadcast/confirm') {
          const pending = pendingBroadcasts.get(sessionId!);
          if (pending && Date.now() - pending.createdAt < 5 * 60_000) {
            const groups = await prisma.groupConfig.findMany({ select: { groupId: true } });
            let sent = 0;
            for (const group of groups) {
              if (!adapter) break;
              await adapter.sendMessage(group.groupId, `📢 *BROADCAST OWNER*\n\n${pending.text}`);
              sent++;
            }
            await prisma.groupLog.create({
              data: {
                groupId: 'dashboard',
                type: 'broadcast',
                action: adapter ? 'sent' : 'queued',
                message: `Dashboard broadcast confirmed. Sent ${sent}/${groups.length}.`
              }
            }).catch(() => undefined);
            pendingBroadcasts.delete(sessionId!);
          }
          redirect(res, '/broadcast');
          return;
        }
        if (url.pathname === '/backup/create') {
          await backupService.createFullBackup();
          redirect(res, '/backup');
          return;
        }
      }

      let html = '';
      if (url.pathname === '/' || url.pathname === '/overview') html = await renderOverview();
      else if (url.pathname === '/groups' && url.searchParams.has('id')) html = await renderGroupDetail(url.searchParams.get('id')!);
      else if (url.pathname === '/groups' || url.pathname === '/features') html = await renderGroups();
      else if (url.pathname === '/plugins') html = await renderPlugins();
      else if (url.pathname === '/premium') html = await renderPremium();
      else if (url.pathname === '/subscriptions') html = await renderSubscriptions();
      else if (url.pathname === '/queue') html = await renderQueue();
      else if (url.pathname === '/usage') html = await renderUsage();
      else if (url.pathname === '/errors') html = await renderErrors();
      else if (url.pathname === '/group-logs') html = await renderGroupLogs();
      else if (url.pathname === '/broadcast') html = await renderBroadcast(sessionId!);
      else if (url.pathname === '/backup') html = await renderBackup();
      else if (url.pathname === '/settings') html = await renderSettings();
      else html = renderPage('Not Found', '<p>Halaman tidak ditemukan.</p>');

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch (err: any) {
      console.error('[Dashboard] Request failed:', err);
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Internal dashboard error');
    }
  });

  server.listen(env.DASHBOARD_PORT, () => {
    console.log(`[Dashboard] Owner dashboard listening on http://localhost:${env.DASHBOARD_PORT}`);
  });
  return server;
}
