# PRD — Javas Bot WA: Stabilization, Security, Feature Expansion, and Productization

## 1. Product Name

Javas Bot WA

## 2. Target Implementation Agent

Codex / AI Coding Agent

## 3. Repository Context

This project is a WhatsApp bot built with Node.js, TypeScript, Baileys, Prisma ORM, and SQLite. It already contains a modular command system, plugin manager, group feature flags, owner dashboard, economy, games, media tools, document tools, moderation features, backup, usage logs, error logs, and worker-style background tasks.

The goal of this PRD is to guide Codex to improve the existing bot in structured phases without breaking current functionality.

## 4. Product Vision

Turn Javas Bot WA from a feature-rich WhatsApp utility bot into a stable, secure, scalable, and monetizable WhatsApp bot platform for Indonesian communities, schools, gaming groups, jual-beli groups, and bot rental/reseller use cases.

The bot should support:

1. Reliable WhatsApp bot operation.
2. Safe moderation and anti-spam.
3. Useful AI-assisted learning and productivity.
4. School/community management tools.
5. Premium/sewa/reseller workflows.
6. Dashboard and analytics.
7. Privacy-conscious data handling.
8. Scalable backend architecture using Redis/PostgreSQL when needed.

## 5. High-Level Goals

### 5.1 Stability Goals

* Bot should survive restarts without losing critical state.
* Commands should fail safely with clear error IDs.
* Heavy media/downloader jobs should not crash the bot.
* Queue processing should be observable and cancelable.
* Runtime configuration should be validated before startup.

### 5.2 Security Goals

* Remove sensitive logs.
* Harden dashboard authentication.
* Prevent SSRF and unsafe URL downloads.
* Add CSRF protection to dashboard POST actions.
* Add privacy mode and data retention controls.
* Add security self-check command.

### 5.3 Product Goals

* Add setup wizard for new groups.
* Add dynamic/smart menu and command help.
* Add advanced group moderation.
* Add school, business, community, and premium features.
* Add owner analytics, reseller tools, and billing/quota features.

### 5.4 Developer Experience Goals

* Add CI workflow.
* Add tests for critical flows.
* Add build/start scripts.
* Add Docker/Docker Compose.
* Add command documentation generator.
* Keep implementation modular and incremental.

## 6. Non-Goals

For the first phase, do not implement all feature backlog items at once. Codex must implement the project in safe, incremental pull requests.

Do not introduce paid third-party APIs as hard requirements. All AI/downloader/OCR/STT integrations must support optional providers and graceful fallback.

Do not store unnecessary message content unless a feature explicitly requires it and privacy settings allow it.

Do not implement unsafe auto-kick/auto-ban behavior without confirmation, logs, and rollback support.

## 7. Current Problems to Fix

## 7.1 Environment Validation

### Problem

Environment variables are currently loaded with defaults but are not strictly validated.

### Requirement

Add a validated config layer using Zod.

### Acceptance Criteria

* Invalid `ADAPTER_MODE` causes startup failure with clear message.
* `DASHBOARD_PORT` must be a valid number.
* If `DASHBOARD_ENABLED=true`, dashboard password must be required.
* `OWNER_IDS` should warn or fail depending on mode.
* Add `LOG_LEVEL`, `NODE_ENV`, `REDIS_ENABLED`, `DATABASE_PROVIDER`, and `PUBLIC_BASE_URL`.
* Add `.env.example` updates.

## 7.2 Sensitive Logging

### Problem

Owner IDs and permission checks may expose phone numbers in logs.

### Requirement

Remove or mask sensitive logs.

### Acceptance Criteria

* No raw owner phone numbers printed in production.
* Add `maskPhone()` utility.
* Debug logs only appear when `LOG_LEVEL=debug`.
* Error logs should not expose tokens, cookies, session IDs, or full phone numbers.

## 7.3 Memory-Only State

### Problem

Rate limit, cooldown, mute state, quiz state, queue, dashboard sessions, and downloader cooldown are memory-only.

### Requirement

Introduce persistent/distributed state support.

### Acceptance Criteria

* Add Redis adapter interface with memory fallback.
* Rate limiter supports Redis TTL keys.
* Mute and spam states are scoped per group and can survive restart when Redis is enabled.
* Queue can later use BullMQ; initial abstraction must support memory and Redis-backed implementation.
* Dashboard sessions have TTL.

## 7.4 Group-Scoped Moderation State

### Problem

Spam/mute maps use only sender ID, causing cross-group side effects.

### Requirement

Scope moderation keys by group.

### Acceptance Criteria

* Use `groupId:userId` for group moderation state.
* Private chat uses `private:userId`.
* Existing moderation behavior preserved.
* Add tests for user muted in one group but not another.

## 7.5 Permission Consistency

### Problem

There are duplicate admin-checking paths. Owner/admin behavior can become inconsistent.

### Requirement

Create a single permission service.

### Acceptance Criteria

* All command permission checks use one `permission.service.ts`.
* Owner is consistently treated as highest role.
* Admin checks use Baileys metadata with cache.
* Console adapter test users still work in dev mode.
* Add unit tests for owner, admin, premium, and regular users.

## 7.6 Dashboard Hardening

### Problem

Dashboard has password login but needs stronger production security.

### Requirement

Harden dashboard.

### Acceptance Criteria

* Add login rate limit.
* Add CSRF token for POST actions.
* Add session expiry.
* Add `Secure` cookie when HTTPS is detected.
* Add `Max-Age` to session cookie.
* Add request body size limit.
* Add audit log for dashboard actions.
* Add optional bind host, default `127.0.0.1` in production.
* Add `/dashboard/security` or `/securitycheck`.

## 7.7 SSRF and URL Safety

### Problem

URL validation blocks only basic localhost/private IP patterns.

### Requirement

Improve URL safety for downloader, screenshot, QR safety, and file features.

### Acceptance Criteria

* Resolve hostname to IP before download.
* Block private, loopback, link-local, multicast, reserved IPv4/IPv6 ranges.
* Validate redirect targets.
* Limit max redirects.
* Validate content-type and content-length.
* Add domain allowlists for supported downloader platforms.
* Add tests for localhost, private IP, metadata IP, obfuscated IP, redirect to private IP.

## 7.8 Media Memory Usage

### Problem

Media is buffered fully in memory before processing.

### Requirement

Support safer media streaming and file-size limits.

### Acceptance Criteria

* Download media to temp file with streaming size limit where possible.
* Avoid repeated `Buffer.concat` for large files.
* Add max input file size per feature and per plan.
* Add FFmpeg timeout.
* Add temp file cleanup on success/failure.
* Add `/fileinfo` command.

## 7.9 Database Production Readiness

### Problem

SQLite is good for development but limited for production scale.

### Requirement

Support PostgreSQL production path while keeping SQLite dev compatibility.

### Acceptance Criteria

* Add Prisma config guidance for PostgreSQL.
* Add indexes for frequently queried fields.
* Add migration scripts.
* Add `npm run db:migrate`, `db:push`, `db:studio`.
* Add data retention cleanup worker.
* Add backup compatibility for SQLite/PostgreSQL.

## 7.10 Plugin State Storage

### Problem

Plugin state is stored inside source folder.

### Requirement

Move plugin state to database or data directory.

### Acceptance Criteria

* Store plugin status in database.
* Existing plugin defaults still work.
* Dashboard plugin toggle persists across restart and redeploy.
* Add migration from existing JSON file if present.

## 7.11 Error Handling

### Problem

Some commands expose raw error messages to users.

### Requirement

Use safe error responses everywhere.

### Acceptance Criteria

* Every command failure returns generic message plus Error ID.
* Full stack stored only in database/log file.
* `/error <id>` owner command shows detail.
* `/retry` retries the last failed command when safe.

## 7.12 CI, Build, and Test Coverage

### Requirement

Add developer tooling.

### Acceptance Criteria

* Add `npm run build`.
* Add `npm run start`.
* Add `npm run lint`.
* Add GitHub Actions CI for install, typecheck, test, build.
* Add tests for config, permission, URL validator, command registry, rate limiter, feature flags, dashboard auth helpers.

## 8. Implementation Strategy

Codex must implement this PRD in phases.

Recommended PR order:

1. Stabilization and security.
2. Observability and dashboard improvements.
3. Core UX improvements.
4. Moderation and group safety.
5. School/community tools.
6. AI and media enhancements.
7. Monetization and reseller features.
8. Advanced automation and enterprise features.

Each PR must include:

* Code changes.
* Tests.
* Documentation updates.
* Migration notes if data model changes.
* No unrelated refactors.

## 9. Phase 0 — Foundation and Safety

## 9.1 Config Validation

Add `src/config/env.schema.ts`.

Fields:

* `NODE_ENV`
* `LOG_LEVEL`
* `DATABASE_URL`
* `ADAPTER_MODE`
* `BOT_PREFIX`
* `WA_SESSION_NAME`
* `OWNER_IDS`
* `DASHBOARD_ENABLED`
* `DASHBOARD_PORT`
* `DASHBOARD_HOST`
* `OWNER_DASHBOARD_PASSWORD`
* `AUTO_BACKUP_ENABLED`
* `BACKUP_RETENTION_DAYS`
* `REDIS_ENABLED`
* `REDIS_URL`
* `LIBRETRANSLATE_URL`
* `OCR_COMMAND`
* `STT_COMMAND`
* `AI_PROVIDER`
* `AI_API_BASE_URL`
* `AI_API_KEY`
* `PUBLIC_BASE_URL`

## 9.2 Logging and Error IDs

Add:

* `logger.service.ts`
* `error-id.util.ts`
* `mask.util.ts`

Commands:

* `/error <errorId>`
* `/errorstats`
* `/clearerrors`

## 9.3 State Store Abstraction

Create:

* `StateStore` interface
* `MemoryStateStore`
* `RedisStateStore`

Operations:

* `get`
* `set`
* `setex`
* `del`
* `incr`
* `ttl`
* `listPush`
* `listRange`

Use it for:

* rate limit
* cooldown
* mute
* dashboard session
* quiz/session state where possible

## 9.4 Queue Abstraction

Create queue interface:

* `add`
* `cancel`
* `status`
* `list`
* `retry`
* `pause`
* `resume`

Implement:

* `MemoryQueueV2`
* optional future `BullMQQueue`

Commands:

* `/queue`
* `/queue mine`
* `/canceljob <id>`
* `/job <id>`

## 9.5 Security Commands

Commands:

* `/securitycheck`
* `/setupcheck`
* `/diagnose`
* `/providerstatus`
* `/dbstatus`

Checks:

* owner configured
* dashboard password set
* dashboard HTTPS warning
* Redis status
* DB status
* FFmpeg availability
* OCR availability
* STT availability
* temp folder writable
* backup folder writable
* session folder exists
* plugin state persistence
* active queue count

## 10. Phase 1 — Core UX Improvements

## 10.1 Status Commands

Add:

* `/ping`
* `/statusbot`
* `/health`
* `/uptime`
* `/workers`
* `/workerstatus`

Display:

* latency
* uptime
* memory usage
* adapter mode
* WA connection status
* DB status
* Redis status
* queue length
* commands today
* error count today
* active groups

## 10.2 Smart Help System

Add:

* `/help`
* `/help <command>`
* `/cmd <keyword>`
* `/cari <keyword>`
* `/menu search <keyword>`
* `/menu <category>`
* `/menu saya`
* `/premiumguide`
* `/start`

Requirements:

* Menu respects role.
* Menu respects active group features.
* Menu respects plugin status.
* Menu respects plan restrictions.
* Menu shows aliases, usage, examples, role, cooldown, premium status.
* Menu recommends frequently used commands.

## 10.3 Command Suggestion

If user types unknown command:

* Suggest closest command.
* Show usage.
* Do not spam suggestions repeatedly.

Examples:

* `/stikre` → “Maksud kamu /stiker?”
* `/tranlsate` → “Maksud kamu /translate?”

## 10.4 Custom Alias Per Group

Commands:

* `/addcmd /alias = /realcommand`
* `/delcmd /alias`
* `/listcmd`
* `/cmdalias`

Requirements:

* Admin only.
* Prevent overriding owner commands.
* Resolve aliases before command execution.
* Store aliases in database.

## 10.5 Group Language and Persona

Commands:

* `/setlang id`
* `/setlang en`
* `/setlang jawa`
* `/setlang sunda`
* `/setpersona formal`
* `/setpersona santai`
* `/setpersona lucu`
* `/setpersona islami`
* `/setpersona sekolah`

Requirements:

* Store per group.
* Default Indonesian.
* Responses use localization layer.
* Persona affects optional response style, not security messages.

## 10.6 Setup Wizard

Command:

* `/setupwizard`

Wizard asks:

1. Enable welcome?
2. Enable goodbye?
3. Enable anti-link?
4. Enable anti-spam?
5. Enable badword filter?
6. Enable captcha?
7. Set prefix.
8. Set punishment mode.
9. Set group mode.
10. Confirm settings.

Also add:

* `/setupcheck`
* `/groupmode sekolah`
* `/groupmode jualbeli`
* `/groupmode gaming`
* `/groupmode islami`
* `/groupmode komunitas`
* `/groupmode private`
* `/groupmode publik`
* `/groupmode event`

## 10.7 Command Packs

Commands:

* `/pack sekolah`
* `/pack jualan`
* `/pack gaming`
* `/pack islami`
* `/pack komunitas`

Each pack enables recommended features.

## 11. Phase 2 — Moderation, Safety, and Group Protection

## 11.1 Advanced Anti-Spam

Features:

* Anti-flood per group.
* Anti-forwarded spam.
* Anti-sticker spam by count and duplicate hash.
* Anti-mention spam.
* Anti-virtex.
* Anti-link invite group.
* Anti-media flood.
* Anti-view-once.
* Anti-executable file.
* Anti-APK.
* Anti-shortlink suspicious.
* Anti-judi.
* Anti-pinjol.
* Anti-scam.
* Anti-toxic with normalized words.
* Anti-promosi rekening/e-wallet.
* Anti-new-member link.

Commands:

* `/antispam on/off`
* `/antitoxic on/off`
* `/antijudi on/off`
* `/antipinjol on/off`
* `/antiscam on/off`
* `/newmemberlinkblock on/off`
* `/mediafilter on/off`
* `/filtermedia apk on/off`
* `/whitelistdomain add <domain>`
* `/whitelistdomain list`
* `/whitelistword add <word>`

## 11.2 Risk Score Moderation

Compute risk score from:

* spam frequency
* duplicate message
* toxic words
* links
* suspicious shortlinks
* forwarded message
* new member age
* mention count
* media flood
* previous warnings

Actions:

* score 30: delete
* score 60: warn
* score 80: mute
* score 100: admin review or kick depending settings

Commands:

* `/risk @user`
* `/riskconfig`
* `/riskmode on/off`

## 11.3 Silent Moderation

Command:

* `/silentmod on/off`

Behavior:

* Delete message silently.
* DM warning to user.
* Log to admin room.
* Avoid public shaming.

## 11.4 Auto Slow Mode

Command:

* `/autoslowmode on/off`

Behavior when group is too noisy:

* Tighten cooldowns.
* Temporarily pause auto-reply.
* Limit downloader/media.
* Enable stricter anti-spam.

## 11.5 Anti-Raid and Quarantine

Commands:

* `/raidmode on/off`
* `/quarantine on/off`
* `/lock <duration>`
* `/lock media <duration>`
* `/lock link <duration>`
* `/lock sticker <duration>`
* `/unlock`
* `/setuju`

Features:

* Detect many joins in short time.
* Auto-lock group.
* Captcha member verification.
* Read-rules confirmation.
* Restrict new members for X hours.
* Auto-kick if not verified after timeout.
* Notify admin room.

## 11.6 Welcome and Goodbye V2

Commands:

* `/welcome on/off`
* `/goodbye on/off`
* `/setwelcome <template>`
* `/setgoodbye <template>`
* `/welcomecard on/off`
* `/captcha on/off`

Template variables:

* `{user}`
* `{group}`
* `{date}`
* `{time}`
* `{memberCount}`
* `{rules}`
* `{prefix}`

Features:

* Welcome image/card.
* Auto-send rules.
* Auto-tag new member.
* Captcha verification.
* Quiet-hours support.

## 11.7 Admin Tools

Commands:

* `/tagall <message>`
* `/hidetag <message>`
* `/kick @user`
* `/promote @user`
* `/demote @user`
* `/open`
* `/close`
* `/setname`
* `/setdesc`
* `/setppgc`
* `/linkgc`
* `/resetlink`
* `/tempmute @user 10m`
* `/tempadmin @user 1h`

## 11.8 Admin Approval

Commands:

* `/approval on kick`
* `/approval on broadcast`
* `/approve <id>`
* `/reject <id>`
* `/kickvote @user`

Sensitive actions need second admin approval if enabled.

## 11.9 Evidence and Case Management

Commands:

* `/evidence @user`
* `/evidence <caseId>`
* `/case open @user <reason>`
* `/case note <id> <note>`
* `/case close <id>`
* `/report @user <reason>`
* `/reportmsg`
* `/listreport`
* `/closereport <id>`

Store:

* user
* group
* message excerpt if privacy mode allows
* reason
* action
* admin
* timestamp
* evidence file reference if applicable

## 11.10 Global and Shared Banlist

Commands:

* `/globalblacklist add @user <reason>`
* `/globalblacklist remove @user`
* `/globalblacklist check @user`
* `/banlist join <network>`
* `/banlist report @user`
* `/banlist sync`

## 11.11 Private Admin Room

Commands:

* `/setadminroom`
* `/adminroom off`

Send alerts for:

* spam
* raid
* scam
* user reports
* failed jobs
* high-risk user
* subscription expiry
* dashboard action

## 12. Phase 3 — Analytics, Health, Logs, and Dashboard

## 12.1 Group Stats

Commands:

* `/groupstats`
* `/topchat`
* `/topcmd`
* `/topsticker`
* `/topactive`
* `/inactive 7d`
* `/inactive 30d`
* `/sentiment hariini`
* `/grouphealth`
* `/rekomendasigroup`
* `/weeklyreport`

Metrics:

* total messages
* command usage
* active users
* inactive users
* warnings
* top features
* spam trend
* toxic trend
* mood/sentiment
* engagement score
* health score

## 12.2 Admin Stats

Commands:

* `/adminstats`
* `/topadmin`

Track:

* warns issued
* mutes
* kicks
* reports handled
* false positives reversed
* settings changed

## 12.3 Owner Analytics

Commands:

* `/analytics`
* `/income`
* `/activegroups`
* `/expiredsoon`
* `/topgroups`
* `/errorstats`
* `/coststats`
* `/activefeatures`

Dashboard pages:

* usage chart
* error chart
* queue monitor
* revenue/sewa stats
* resource usage
* group subscription status
* provider status
* broadcast report
* admin audit log

## 12.4 Dashboard Improvements

Add pages:

* Real-time status
* Security check
* Provider status
* Queue jobs
* Failed jobs
* Group detail
* Group settings
* Welcome template editor
* Badword editor
* Warning log
* Reports/cases
* Premium/sewa manager
* Reseller manager
* Broadcast segmented
* Backup/restore
* Audit log
* Privacy/data retention settings

## 12.5 Admin Group Dashboard

Add optional dashboard for group admins.

Features:

* OTP login via WhatsApp.
* Only manage own group.
* Toggle features.
* Edit welcome/rules.
* View warnings.
* View logs.
* Manage badwords.
* Manage auto-reply.
* View stats.

## 13. Phase 4 — School and Learning Features

## 13.1 School Mode

Commands:

* `/groupmode sekolah`
* `/tugas add <mapel> <deadline> <deskripsi>`
* `/tugas list`
* `/tugas selesai <id>`
* `/deadline`
* `/rekaptugas`
* `/jadwal hariini`
* `/jadwal besok`
* `/jadwalpelajaran`
* `/ujian add <mapel> <tanggal>`
* `/calendar add <event> <tanggal>`
* `/calendar list`
* `/calendar month`

Features:

* Task reminders.
* Deadline countdown.
* Assignment recap.
* Late detection.
* Export tasks.
* Schedule reminders.

## 13.2 Attendance V2

Commands:

* `/absen buka <judul>`
* `/absen hadir`
* `/absen izin <alasan>`
* `/absen sakit <alasan>`
* `/absen list`
* `/absen tutup`
* `/absen rekap`
* `/absen export`

Features:

* Auto-close.
* Late detection.
* CSV/PDF export.
* Permission per admin/bendahara.
* Attendance stats.

## 13.3 Learning AI

Commands:

* `/belajar <topik>`
* `/jelaskan <topik>`
* `/buatsoal <mapel> <level>`
* `/latihan <mapel> <mudah|sedang|sulit>`
* `/jawabsoal`
* `/bahas`
* `/koreksiesai`
* `/flashcard`
* `/quiz <mapel>`
* `/rumus <topik>`
* `/glossary add <term> <definition>`
* `/glossary <term>`
* `/glossary quiz`

Features:

* OCR image question to explanation.
* Essay feedback.
* Tiered practice questions.
* Leaderboard belajar.
* Flashcards.
* Glossary per group.
* Safe mode for school groups.

## 13.4 Language Learning

Commands:

* `/kamus id en <word>`
* `/kamus jawa id <word>`
* `/kamus sunda id <word>`
* `/grammar <sentence>`
* `/vocab`
* `/listening`
* `/speaking`
* `/translatequiz`
* `/wordoftheday`

## 13.5 Document Generators for Students

Commands:

* `/surat izin sakit`
* `/surat lamaran`
* `/surat resmi`
* `/surat undangan`
* `/cv buat`
* `/cv exportpdf`
* `/proposal kegiatan <tema>`
* `/proposal usaha <tema>`
* `/notulen`
* `/actionitems`

Outputs:

* Text
* PDF
* DOCX if later supported

## 14. Phase 5 — AI, Text, Audio, Media, and Document Tools

## 14.1 AI Provider Abstraction

Add provider system:

* local/offline fallback
* OpenAI-compatible endpoint
* Gemini-compatible endpoint if configured
* self-hosted provider
* disabled mode

Commands:

* `/ai <question>`
* `/chatmode on/off`
* `/provider list`
* `/provider set ai <provider>`
* `/providerstatus`
* `/quota`

## 14.2 AI Text Tools

Improve:

* `/ringkas`
* `/summarize`
* `/ubah`
* `/typo`
* `/balas`
* `/translate`
* `/ocr cleanup`
* `/rangkumchat 1h`
* `/rangkumchat hariini`
* `/rangkumchat 100`

Add:

* `/caption ig <tema>`
* `/bio ig <gaya>`
* `/idekonten <niche>`
* `/hashtag <topik>`
* `/scriptvideo <tema>`

## 14.3 Audio/STT/Subtitle

Commands:

* `/transkrip`
* `/vntext`
* `/subtitle`
* `/srt`
* `/translateaudio`
* `/ringkasaudio`

Requirements:

* Use `STT_COMMAND` or provider abstraction.
* Generate real transcript, not static subtitle.
* Support SRT output.
* Timeouts and file size limits.
* Premium gates for heavy processing.

## 14.4 Image and Design Tools

Commands:

* `/poster <judul> | <deskripsi>`
* `/sertifikat <nama>`
* `/twibbon <nama>`
* `/banner <teks>`
* `/thumbnail <judul>`
* `/profilecard`
* `/checkimage`

Features:

* Generate simple image cards locally using SVG/Sharp.
* Optional AI/image provider later.
* Safety check for NSFW/phishing screenshots if provider enabled.

## 14.5 File and Document Tools

Existing document tools should be extended with:

* `/pdftext`
* `/pdfsplit <range>`
* `/pdfwatermark <text>`
* `/docx2pdf`
* `/txt2pdf`
* `/ocrpdf`
* `/ziplist`
* `/fileinfo`
* `/scanfile`
* `/tableocr`
* `/struk`
* `/exportpdf`
* `/exportexcel`
* `/exportcsv`
* `/exportjson`

Requirements:

* Safe ZIP extraction.
* Block executable files.
* OCR table to Excel.
* Receipt parsing.
* File hash and MIME check.
* QR safety scanner.

## 14.6 QR and Link Safety

Commands:

* `/qr <text>`
* `/readqr`
* `/readqr safe`
* `/checklink <url>`
* `/cekpenipuan`

Features:

* Decode QR.
* If QR contains URL, run URL safety analysis.
* Detect shortlink, redirects, APK links, phishing-like domains.
* Analyze scam screenshots using OCR and keyword/risk scoring.

## 15. Phase 6 — Community, Productivity, and Knowledge Features

## 15.1 Notes, FAQ, Wiki, and Bookmarks

Commands:

* `/note add <key> <value>`
* `/note get <key>`
* `/note list`
* `/note delete <key>`
* `/faq add <key> <answer>`
* `/faq <key>`
* `/faq list`
* `/wiki add <page> <content>`
* `/wiki edit <page>`
* `/wiki <page>`
* `/wiki search <keyword>`
* `/bookmark`
* `/bookmarks`
* `/bookmark delete <id>`
* `/pinbot <message>`
* `/pinlist`
* `/unpinbot <id>`

## 15.2 Reminders, Calendar, Countdown

Commands:

* `/remind <time> <message>`
* `/ingat <natural language reminder>`
* `/autoremind <name> setiap <time> <message>`
* `/autoremind hapus <id>`
* `/countdown <name> <date>`
* `/countdownlist`
* `/hariini`
* `/besok`
* `/quiethours 22:00-06:00`
* `/autoclose 22:00`
* `/autoopen 06:00`

## 15.3 Personal Assistant

Private chat commands:

* `/todo add`
* `/todo list`
* `/catatan`
* `/jadwalpribadi`
* `/targetharian`
* `/fokus`
* `/ringkashariini`
* `/setnama`
* `/setgaya`
* `/preferensi`
* `/memory`
* `/deletememory`

## 15.4 Productivity

Commands:

* `/pomodoro start 25`
* `/pomodoro break 5`
* `/pomodoro stop`
* `/habit add <name>`
* `/habit done <name>`
* `/habit streak`
* `/habit leaderboard`
* `/mood <mood>`
* `/moodstat`
* `/diary tulis <text>`
* `/diary lihat`
* `/diary hapus`

## 15.5 Group Forms and Dynamic Forms

Commands:

* `/form create <title>`
* `/form field <name> text`
* `/form field <name> pilihan <options>`
* `/form open`
* `/form jawab`
* `/form hasil`
* `/form export`

Use cases:

* registration
* survey
* event signup
* class data collection
* voting
* product orders

## 16. Phase 7 — Economy, Games, Profile, Reputation

## 16.1 Profile Card and Member Progression

Commands:

* `/profile`
* `/profile @user`
* `/achievements`
* `/badge`
* `/title`
* `/role`
* `/toprole`

Profile includes:

* name
* level
* XP
* balance
* badge
* title
* reputation
* warnings
* command count
* join date if available

## 16.2 Reputation and Trust

Commands:

* `/rep @user`
* `/-rep @user`
* `/rep`
* `/toprep`
* `/score`
* `/topscore`
* `/trustlevel`
* `/audit @user`

Trust levels:

* New
* Trusted
* Active
* Senior
* VIP
* Restricted

Effects:

* New members cannot send links.
* Trusted users get higher limits.
* Restricted users get stricter moderation.

## 16.3 Daily Missions and Season Pass

Commands:

* `/mission`
* `/claimmission`
* `/season`
* `/pass`
* `/reward`
* `/tier`

Mission examples:

* send 10 messages
* use 3 commands
* answer 1 quiz
* make 1 sticker
* login streak
* help another member

## 16.4 Game Expansion

Add:

* competitive game leaderboard
* weekly reset
* tournaments
* bracket generator
* game season
* clan/guild system

Commands:

* `/tournament create <name>`
* `/tournament join`
* `/tournament bracket`
* `/tournament win @team`
* `/clan create <name>`
* `/clan join <name>`
* `/clan war`
* `/clan top`
* `/clan donate`

## 16.5 Giveaway and Raffle

Commands:

* `/giveaway create <duration> <prize>`
* `/giveaway join`
* `/giveaway draw`
* `/raffle 1-100`
* `/tebakangka`
* `/undi @user1 @user2`

Requirements:

* One entry per user.
* Cooldown.
* Anti-alt/spam basic detection.
* Admin controls.

## 16.6 Marketplace Economy

Commands:

* `/market sell <item> <price>`
* `/market list`
* `/market buy <id>`
* `/lelang create`
* `/lelang bid`
* `/giftitem @user <item>`
* `/dailyshop`

Features:

* marketplace listings
* auction
* rare items
* tax
* anti-cheat checks

## 17. Phase 8 — Business, Jual-Beli, Kas, and Finance

## 17.1 Jual-Beli Mode

Commands:

* `/jual <nama> | <harga> | <deskripsi>`
* `/listjual`
* `/cariitem <keyword>`
* `/hapusjual <id>`
* `/sold <id>`
* `/formatjual <item> <harga> <kondisi>`
* `/produk add <nama> | <harga> | <deskripsi>`
* `/produk list`
* `/produk cari <keyword>`
* `/produk hapus <id>`

Features:

* listing moderation
* seller rating
* anti-scam keywords
* blacklist nomor penipu
* product catalog

## 17.2 Kas Grup

Commands:

* `/kas masuk <amount> @user`
* `/kas keluar <amount> <reason>`
* `/kas saldo`
* `/kas laporan`
* `/kas export`

Roles:

* Admin
* Bendahara
* Owner

## 17.3 Split Bill

Commands:

* `/split <amount> @user1 @user2`
* `/splitadd <name> <amount>`
* `/splitdone @user`
* `/splitstatus`

## 17.4 Personal Finance

Commands:

* `/catat <amount> <category>`
* `/pengeluaran hariini`
* `/pengeluaran bulanini`
* `/budget add <category> <amount>`
* `/budget status`

## 17.5 Bills, Arisan, Iuran

Commands:

* `/tagihan add @user <name> <amount> deadline <date>`
* `/tagihan list`
* `/tagihan done <id>`
* `/tagihan remind`
* `/arisan add <amount>`
* `/arisan undi`
* `/arisan list`
* `/iuran add`
* `/iuran rekap`

## 17.6 Invoice, Contract, CRM

Commands:

* `/invoice buat <item> | <amount> | <client>`
* `/invoice list`
* `/invoice paid <id>`
* `/kontrak jualbeli`
* `/kontrak jasa desain`
* `/kontrak sewa bot`
* `/customer add @user`
* `/order add @user <product> <price>`
* `/order status`

## 17.7 Ongkir and Resi

Commands:

* `/ongkir <origin> <destination> <weight>`
* `/resi <courier> <trackingNumber>`

Provider should be optional and disabled by default until API configured.

## 17.8 Escrow Simple

Commands:

* `/escrow create @seller @buyer <amount>`
* `/escrow paid`
* `/escrow release`
* `/escrow dispute`

Important:

* Must include legal disclaimer.
* No actual money handling unless a verified payment provider is added.
* Store status only.

## 18. Phase 9 — Premium, Sewa, Billing, Reseller

## 18.1 Premium and Sewa V2

Commands:

* `/sewa`
* `/ceksewa`
* `/invoice`
* `/remindersewa`
* `/addsewa`
* `/extendsewa`
* `/delsewa`
* `/listsewa`
* `/setplan`
* `/trial <feature> <duration>`

Features:

* Auto reminder before expiry.
* Auto downgrade on expiry.
* Trial group.
* Plan feature matrix.
* Premium onboarding guide.
* Voucher/redeem code.

## 18.2 Quota and Credits

Commands:

* `/quota`
* `/credit`
* `/buycredit`
* `/giftcredit @user <amount>`
* `/usage`
* `/buyquota`

Quotas:

* AI requests
* downloader
* HD 4x
* OCR
* STT
* PDF tools

## 18.3 Usage-Based Billing

Add billing model:

* monthly plan
* credits
* add-ons
* quota packs
* feature trials

## 18.4 Coupons and Referral

Commands:

* `/coupon create <code> <discount>`
* `/coupon use <code>`
* `/coupon list`
* `/referral`
* `/refclaim`

Rewards:

* premium days
* command credits
* badge
* economy balance

## 18.5 Reseller System

Commands:

* `/addreseller @user`
* `/reseller balance`
* `/resellerorder`
* `/resellerextend`
* `/resellerpanel`
* `/reseller createorder`
* `/reseller listgroups`

Dashboard:

* reseller customers
* group expiry
* commission
* invoice
* credit balance

## 18.6 Bot Store and Add-ons

Commands:

* `/store`
* `/buyaddon school`
* `/addonlist`
* `/trial ai 1h`
* `/trial antiraid 1d`

Add-ons:

* AI pack
* downloader pack
* school pack
* business pack
* anti-raid pack
* dashboard pack

## 19. Phase 10 — Owner, Operations, Deployment

## 19.1 Owner Security Commands

Commands:

* `/sessionstatus`
* `/logoutwa`
* `/restart`
* `/maintenance on/off`
* `/maintenance <feature> on/off`
* `/blockcmd <command>`
* `/allowgroup <groupId>`
* `/denygroup <groupId>`
* `/ownerlog`
* `/exportdata`
* `/panicmode`
* `/sandbox on/off`
* `/demomode on/off`
* `/simulate <command>`

## 19.2 Broadcast V2

Commands:

* `/broadcast preview`
* `/broadcast confirm`
* `/broadcast cancel`
* `/broadcast premium <message>`
* `/broadcast free <message>`
* `/broadcast expired <message>`
* `/broadcast active <message>`
* `/broadcast group <id> <message>`
* `/broadcasttemplate add <name>`
* `/broadcasttemplate use <name>`
* `/broadcasttemplate list`

Requirements:

* Preview target count.
* Send gradually.
* Delay between groups.
* Cancel support.
* Exclude groups.
* Report success/failure.
* Admin approval if configured.

## 19.3 Backup and Safe Update

Commands:

* `/backup`
* `/backupsend`
* `/autobackup on/off`
* `/backupgd`
* `/update check`
* `/update backup`
* `/update apply`
* `/update rollback`
* `/updateannounce`
* `/changelog`

Requirements:

* Backup before update.
* Rollback on failure.
* Changelog broadcast.
* Optional cloud/Google Drive provider later.

## 19.4 Maintenance and Provider Controls

Commands:

* `/provider list`
* `/provider set translate libretranslate`
* `/provider set ai openai`
* `/providerstatus`
* `/config set <key> <value>`
* `/config reload`
* `/resourceguard on/off`
* `/lowresource on/off`

Resource guard actions:

* reduce queue concurrency
* disable HD 4x
* limit video duration
* reject large files
* activate slow mode
* disable broken provider temporarily

## 19.5 Auto-Disable Failing Commands

If a command fails repeatedly:

* disable it temporarily
* notify owner/admin room
* show fallback message to users
* allow owner to re-enable

Commands:

* `/commandstatus`
* `/enablecmd <command>`
* `/disablecmd <command>`

## 19.6 Crash Report and Diagnostics

Features:

* Store last fatal error.
* On restart, notify owner.
* Attach Error ID and recent system context.

Commands:

* `/diagnose`
* `/repair temp`
* `/repair plugins`
* `/repair db`
* `/repair session`

## 20. Phase 11 — Automation and Workflow

## 20.1 Automation Builder

Commands:

* `/auto when join send <message>`
* `/auto when badword warn`
* `/auto when 3warn kick`
* `/auto list`
* `/auto delete <id>`

## 20.2 Custom Workflow

Commands:

* `/workflow create <name>`
* `/workflow list`
* `/workflow delete <id>`

Example workflow:

* when user_join
* send rules
* wait 5m
* if not_verified kick

Another example:

* when link_detected
* delete
* warn
* notify_admin

## 20.3 Custom Variables

Commands:

* `/var set <key> <value>`
* `/var get <key>`
* `/var list`
* `/var delete <key>`

Variables can be used in templates:

* `{sekolah}`
* `{wali_kelas}`
* `{rules}`
* `{owner}`
* `{plan}`
* `{expired}`

## 20.4 Smart Rules

Commands:

* `/rule tambah <natural language rule>`
* `/rule list`
* `/rule delete <id>`

Example:

* `/rule tambah jangan kirim link selain YouTube dan Instagram`
* `/rule tambah kalau spam 5 kali mute 10 menit`

Implementation:

* Initially rule-based parser.
* Later optional AI parser if provider configured.

## 21. Phase 12 — Privacy, Data, Consent

## 21.1 Privacy Mode

Commands:

* `/privacymode strict`
* `/privacymode balanced`
* `/privacymode off`

Strict mode:

* Do not store ordinary message content.
* Mask logs.
* Disable auto-summary unless admin explicitly consents.
* Store metadata only.

## 21.2 Data Retention

Commands:

* `/retention logs 30d`
* `/retention messages off`
* `/retention media 1h`
* `/cleandb logs 30d`
* `/cleandb temp`
* `/cleandb usage 90d`

## 21.3 User Data Rights

Commands:

* `/mydata`
* `/deletemydata`

Allow user to:

* view stored profile
* delete personal data where safe
* preserve group moderation records if legally/operationally required

## 21.4 Consent

Commands:

* `/consent autosummary on/off`
* `/consent ai on/off`
* `/consent analytics on/off`

Consent required for:

* auto-summary
* AI analysis of chat
* sentiment
* conversation snapshot
* advanced analytics involving message content

## 21.5 Rules Versioning

Commands:

* `/generaterules sekolah`
* `/generaterules jualbeli`
* `/generaterules komunitas`
* `/rules edit`
* `/rules version`
* `/rules rollback`
* `/ruleslog`

Features:

* Store rule versions.
* Track `/setuju` acceptance by user, group, rule version, timestamp.
* Ask members to accept again when rules change.

## 22. Phase 13 — Announcements and Communication

Commands:

* `/announce <message>`
* `/announcements`
* `/announcement <id>`

Features:

* Format announcement automatically.
* Add title/time.
* Mention selected roles.
* Store announcement history.
* Allow new members to read old announcements.

## 23. Phase 14 — API, Webhook, Landing Page

## 23.1 Landing Page

Add optional public page:

* feature list
* pricing/sewa info
* command docs
* demo screenshots
* bot status
* contact owner
* request sewa form

## 23.2 Internal API

Endpoints:

* `GET /api/status`
* `GET /api/groups`
* `GET /api/usage`
* `GET /api/errors`
* `POST /api/broadcast`
* `POST /api/group/:id/features`

Requirements:

* API key auth.
* Audit log.
* Rate limit.
* Disabled by default.

## 23.3 Webhooks

Commands:

* `/webhook set <url>`
* `/webhook test`
* `/webhook off`

Events:

* command used
* group joined
* high severity error
* subscription expired
* backup completed
* raid detected
* payment/invoice update

## 24. Phase 15 — Scaling and Multi-Instance

## 24.1 Server Cluster

Architecture:

* main bot process
* media worker
* downloader worker
* AI worker
* dashboard process
* Redis queue
* PostgreSQL database

Commands:

* `/workers`
* `/workerstatus`

## 24.2 Multi-Bot Instance

Commands:

* `/botinstance add <name>`
* `/instance status`
* `/movegroup <groupId> <instance>`

Features:

* manage multiple WA numbers
* group assignment
* instance health
* load balancing

## 24.3 Failover

Commands:

* `/failover status`

Features:

* heartbeat
* backup session strategy
* secondary bot notification
* owner alert on failure

## 25. Database Additions

Codex should add models gradually as features are implemented.

Recommended new models:

* `BotSetting`
* `PluginState`
* `DashboardSession`
* `AuditLog`
* `CommandAlias`
* `CommandPermissionOverride`
* `GroupLanguageSetting`
* `GroupPersonaSetting`
* `GroupMode`
* `GroupRule`
* `GroupRuleAcceptance`
* `WarningRule`
* `ModerationCase`
* `Evidence`
* `Report`
* `AdminRoom`
* `RiskEvent`
* `GlobalBlacklist`
* `SharedBanlist`
* `QueueJobRecord`
* `ErrorRecord`
* `UserCommandHistory`
* `UserPreference`
* `UserMemory`
* `UserConsent`
* `UserReputation`
* `TrustLevel`
* `DailyMission`
* `Season`
* `SeasonProgress`
* `Giveaway`
* `GiveawayEntry`
* `GroupNote`
* `GroupFAQ`
* `WikiPage`
* `Bookmark`
* `VirtualPin`
* `Form`
* `FormField`
* `FormResponse`
* `GroupCalendarEvent`
* `GroupTask`
* `AttendanceRecord`
* `KasTransaction`
* `SplitBill`
* `ProductListing`
* `Invoice`
* `Coupon`
* `Referral`
* `ResellerProfile`
* `Addon`
* `UsageQuota`
* `CreditTransaction`
* `Webhook`
* `BroadcastTemplate`
* `BroadcastJob`
* `Workflow`
* `WorkflowStep`
* `CustomVariable`
* `DataRetentionPolicy`

Add indexes on:

* `groupId`
* `userId`
* `createdAt`
* `status`
* `expiresAt`
* `command`
* `feature`
* `plan`
* `errorId`

## 26. Command Categories

The bot should organize commands into these categories:

1. General
2. Help/Menu
3. Owner
4. Admin
5. Moderation
6. Security
7. Dashboard
8. Group Setup
9. Welcome
10. Anti-Spam
11. AI
12. Text
13. Audio
14. Media
15. Sticker
16. Document
17. Downloader
18. School
19. Productivity
20. Community
21. Economy
22. Games
23. Business
24. Finance
25. Premium/Sewa
26. Reseller
27. Analytics
28. Automation
29. Privacy
30. Developer/Ops

## 27. Acceptance Criteria for Codex Overall

Codex must not produce a single giant unsafe PR. It must split implementation into phases.

For every implemented feature:

* Add command metadata.
* Add permission metadata.
* Add feature flag if group-scoped.
* Add plugin mapping.
* Add menu/help documentation.
* Add rate limit config if needed.
* Add tests where practical.
* Add safe error handling.
* Add audit log for admin/owner actions.
* Add database migration if needed.
* Add README or COMMANDS docs update.

## 28. Priority Roadmap

## P0 — Must Fix First

1. Zod env validation.
2. Mask sensitive logs.
3. Permission service unification.
4. Group-scoped moderation state.
5. Dashboard hardening.
6. URL/SSRF protection.
7. Safe error ID system.
8. CI/build/test scripts.
9. Queue/state abstraction.
10. Plugin state persistence outside source.

## P1 — Core Product

1. `/ping`, `/statusbot`, `/health`.
2. Smart `/menu` and `/help <command>`.
3. `/setupwizard`.
4. `/securitycheck`.
5. `/queue`, `/canceljob`.
6. Welcome/goodbye V2.
7. Anti-spam/anti-toxic V2.
8. Admin group tools.
9. Broadcast V2.
10. Dashboard analytics.

## P2 — Community and School

1. School mode.
2. Tasks/deadlines.
3. Attendance V2.
4. Calendar.
5. Notes/FAQ/wiki.
6. Group stats.
7. Profile card.
8. Reputation/trust level.
9. Daily mission.
10. Auto-summary.

## P3 — AI and Media

1. AI provider abstraction.
2. Real STT/transcript.
3. Real subtitle/SRT.
4. OCR PDF/table to Excel.
5. QR safety scanner.
6. Scam screenshot detection.
7. Image safety check.
8. Better document tools.
9. Content creator commands.
10. Study assistant commands.

## P4 — Monetization

1. Premium/sewa V2.
2. Quota/credit system.
3. Coupon/referral.
4. Reseller dashboard.
5. Add-on store.
6. Usage-based billing.
7. Cost stats.
8. Resource guard.
9. Segmented broadcast.
10. Trial features.

## P5 — Advanced Platform

1. Custom workflow.
2. Automation builder.
3. Smart rules.
4. Admin approval.
5. Evidence locker.
6. Privacy mode.
7. Internal API.
8. Webhooks.
9. Multi-instance support.
10. Failover.

## 29. Suggested First Codex Task

Implement P0 in small steps:

1. Create env schema using Zod.
2. Replace existing env export with validated env.
3. Add mask utilities and remove sensitive logs.
4. Create unified permission service.
5. Change moderation state keys to group-scoped keys.
6. Add safe error ID utility.
7. Add tests for config, permission, and moderation keys.

## 30. Definition of Done

A phase is done when:

* All new commands are registered.
* All new commands appear in `/help`.
* TypeScript typecheck passes.
* Tests pass.
* Bot starts in console mode.
* Bot starts in Baileys mode if configured.
* No sensitive data is printed by default.
* Admin/owner actions are audited.
* User-facing errors are safe.
* README/COMMANDS docs are updated.
