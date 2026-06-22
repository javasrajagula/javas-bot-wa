# Feature Catalog — Javas Bot WA

This document catalogs all functional components, features, and their associated configurations in Javas Bot WA.

## Feature Registry & lazy Loading

To optimize bot runtime performance, startup memory footprint, and CPU utilization, Javas Bot WA implements an asynchronous lazy-loaded registry model. Command modules are dynamically imported on-demand.

### Directory Mapping Structure

Commands are organized into modules based on their domain:

| Domain | File/Module Path | Description |
|---|---|---|
| Menu | `menu.command.js` | Help, compact menus, rules, and navigation |
| Admin | `admin.command.js` | Core administrative utilities |
| Setup | `setup.command.js` | Onboarding wizard and feature status panel |
| Downloader | `downloader.command.js` | TikTok, Instagram, YouTube MP3/MP4, FB, Twitter/X, Threads |
| Economy | `economy.command.js` | virtual currency, leveling, shop, inventory |
| Sticker | `sticker/sticker.command.js` | Converting images and videos to stickers |
| Media | `media/media.command.js` | HD enhancer, crop, compress, watermark, reverse |
| Audio | `audio/audio.command.js` | MP3 extraction, TTS, voice morphing, audio trimmer |
| Text | `text/text.command.js` | OCR, translation, summarizer, paraphraser |
| AI | `text/ai.command.js` | Conversational LLM chat |
| Games | `games/games.command.js` | TOD, Tebak Kata, Tebak Gambar, Suit, TicTacToe |
| community | `community/community.command.js` | Member management, announcements, stats |
| Document | `document/document.command.js` | PDF split/merge, ZIP extractor, QR reader |
| Moderation | `moderation/moderation.command.js` | Anti-flood, anti-spam, mute loops, blacklists |
| Owner | `owner/owner.command.js` | System orchestration, sewa, API key management |

---

## Global and Group Feature Flags

Every modular command uses explicit feature flags configured at group levels.

| Feature Flag | Default Value | Scope | Description |
|---|---|---|---|
| `sticker` | `true` | group / user | Enable/disable sticker creation tools |
| `downloader` | `false` | group / premium | Downloader queue and bandwidth limits |
| `werewolf` | `true` | group | Werewolf games and session timers |
| `economy` | `true` | group / user | Balance checks, claims, and claims streak |
| `antiviewonce` | `false` | group | Auto-reveal view once media |
| `autoreply` | `true` | group | Trigger-based auto-replies |
| `cleancmd` | `false` | group | Auto-delete incoming command messages |
