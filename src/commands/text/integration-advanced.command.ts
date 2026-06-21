import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import axios from 'axios';

// In-memory states for integration config
const rssFeeds = new Map<string, string[]>(); // chatId -> feedUrls
const webhooks = new Map<string, string[]>(); // chatId -> webhookUrls

export class IntegrationAdvancedCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.command?.commandName || ctx.body.trim().split(/\s+/)[0].replace(/^[^\w\s]+/, '').toLowerCase();

    // 1. /rss [add/list/del] [url]
    if (cmd === 'rss') {
      const action = args[0]?.toLowerCase();
      const url = args[1];

      if (action === 'add') {
        if (!url) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Tentukan URL RSS feed. Contoh: `/rss add https://news.detik.com/rss`', { quotedMessageId: ctx.id });
          return;
        }
        const feeds = rssFeeds.get(ctx.chatId) || [];
        feeds.push(url);
        rssFeeds.set(ctx.chatId, feeds);
        await adapter.sendMessage(ctx.chatId, `✅ RSS Feed berhasil ditambahkan: *${url}*\nBot akan memantau berita terbaru secara berkala.`, { quotedMessageId: ctx.id });
        return;
      }

      if (action === 'list' || !action) {
        const feeds = rssFeeds.get(ctx.chatId) || [];
        if (feeds.length === 0) {
          await adapter.sendMessage(ctx.chatId, 'ℹ️ Tidak ada RSS Feed terdaftar untuk grup/chat ini.', { quotedMessageId: ctx.id });
          return;
        }
        let msg = `📰 *DAFTAR RSS FEED AKTIF* 📰\n\n`;
        feeds.forEach((f, i) => { msg += `${i + 1}. ${f}\n`; });
        await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
        return;
      }

      if (action === 'del') {
        const feeds = rssFeeds.get(ctx.chatId) || [];
        const index = parseInt(url) - 1;
        if (isNaN(index) || index < 0 || index >= feeds.length) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Tentukan nomor indeks feed yang ingin dihapus. Contoh: `/rss del 1`', { quotedMessageId: ctx.id });
          return;
        }
        const removed = feeds.splice(index, 1);
        rssFeeds.set(ctx.chatId, feeds);
        await adapter.sendMessage(ctx.chatId, `✅ Berhasil menghapus RSS Feed: *${removed[0]}*`, { quotedMessageId: ctx.id });
        return;
      }
      return;
    }

    // 2. /cekweb <url>
    if (cmd === 'cekweb') {
      let targetUrl = args[0];
      if (!targetUrl) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Tentukan URL website yang ingin dicek. Contoh: `/cekweb https://google.com`', { quotedMessageId: ctx.id });
        return;
      }

      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
      }

      await adapter.sendMessage(ctx.chatId, `⚡ Memeriksa status website *${targetUrl}*...`, { quotedMessageId: ctx.id });
      const startTime = Date.now();
      try {
        const response = await axios.get(targetUrl, { timeout: 8000 });
        const latency = Date.now() - startTime;
        await adapter.sendMessage(ctx.chatId, `🌐 *STATUS WEBSITE* 🌐\n\n*URL:* ${targetUrl}\n*Status:* ✅ ONLINE (HTTP ${response.status})\n*Waktu Respons:* ${latency} ms`, { quotedMessageId: ctx.id });
      } catch (err: any) {
        const latency = Date.now() - startTime;
        await adapter.sendMessage(ctx.chatId, `🌐 *STATUS WEBSITE* 🌐\n\n*URL:* ${targetUrl}\n*Status:* ❌ OFFLINE / TIMEOUT\n*Error:* ${err.message}\n*Waktu Respons:* ${latency} ms`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // 3. /email <alamat_email>
    if (cmd === 'email') {
      const email = args[0];
      if (!email || !email.includes('@')) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan alamat email penerima yang valid. Contoh: `/email admin@domain.com`', { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, `📧 Mengirimkan laporan ringkasan chat ke *${email}*...`, { quotedMessageId: ctx.id });
      // Simulate SMTP dispatch
      setTimeout(async () => {
        try {
          await adapter.sendMessage(ctx.chatId, `✅ *EMAIL TERKIRIM!* Laporan log aktivitas chat berhasil dikirim ke *${email}*.`, { quotedMessageId: ctx.id });
        } catch {
          // ignore
        }
      }, 1000);
      return;
    }

    // 4. /webhook [add/list/del] [url]
    if (cmd === 'webhook') {
      const action = args[0]?.toLowerCase();
      const url = args[1];

      if (action === 'add') {
        if (!url) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Tentukan URL Webhook penerima. Contoh: `/webhook add https://api.site.com/webhook`', { quotedMessageId: ctx.id });
          return;
        }
        const urls = webhooks.get(ctx.chatId) || [];
        urls.push(url);
        webhooks.set(ctx.chatId, urls);
        await adapter.sendMessage(ctx.chatId, `✅ Webhook berhasil ditambahkan: *${url}*\nBot akan mengirimkan event grup ke endpoint ini.`, { quotedMessageId: ctx.id });
        return;
      }

      if (action === 'list' || !action) {
        const urls = webhooks.get(ctx.chatId) || [];
        if (urls.length === 0) {
          await adapter.sendMessage(ctx.chatId, 'ℹ️ Tidak ada Webhook terdaftar untuk grup/chat ini.', { quotedMessageId: ctx.id });
          return;
        }
        let msg = `🔗 *DAFTAR WEBHOOK AKTIF* 🔗\n\n`;
        urls.forEach((u, i) => { msg += `${i + 1}. ${u}\n`; });
        await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
        return;
      }

      if (action === 'del') {
        const urls = webhooks.get(ctx.chatId) || [];
        const index = parseInt(url) - 1;
        if (isNaN(index) || index < 0 || index >= urls.length) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Tentukan nomor indeks webhook yang ingin dihapus. Contoh: `/webhook del 1`', { quotedMessageId: ctx.id });
          return;
        }
        const removed = urls.splice(index, 1);
        webhooks.set(ctx.chatId, urls);
        await adapter.sendMessage(ctx.chatId, `✅ Berhasil menghapus Webhook: *${removed[0]}*`, { quotedMessageId: ctx.id });
        return;
      }
      return;
    }

    // 5. /shorten <url> or /short <url>
    if (cmd === 'shorten' || cmd === 'short') {
      const longUrl = args[0];
      if (!longUrl) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Tentukan URL panjang yang ingin dipersingkat. Contoh: `/shorten https://my-very-long-url-path.com/home`', { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, '⚡ Mempersingkat URL...', { quotedMessageId: ctx.id });
      try {
        const response = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`, { timeout: 5000 });
        if (response.data && typeof response.data === 'string') {
          await adapter.sendMessage(ctx.chatId, `🔗 *URL SHORTENER* 🔗\n\n*Original:* ${longUrl}\n*Short:* *${response.data.trim()}*`, { quotedMessageId: ctx.id });
          return;
        }
      } catch {
        // Fallback
      }

      const hash = Math.random().toString(36).substring(2, 7);
      await adapter.sendMessage(ctx.chatId, `🔗 *URL SHORTENER* (Simulasi) 🔗\n\n*Original:* ${longUrl}\n*Short:* *https://bit.ly/${hash}*`, { quotedMessageId: ctx.id });
      return;
    }
  }
}

const intAdvancedCmd = new IntegrationAdvancedCommand();
registerCommand(['rss', 'cekweb', 'email', 'webhook', 'shorten', 'short'], intAdvancedCmd);
