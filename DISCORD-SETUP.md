# ODL Discord setup

Two pieces:
- **Feed** (GitHub Action, every 10 min): #final, #scores, #top-25, #big-performances,
  #recruiting, #transfer-portal, Players of the Week (national + conference role pings),
  #commish-board, and the weekly matchup chats with previews.
- **Slash commands** (Cloudflare Worker): `/player /team /box /schedule /standings /top25 /leaders /rta`.

---

## 1. Discord server: channels and roles

Create these **text channels** (names must match `discord.config.json`; rename there if you prefer others):

| Channel | What posts there |
|---|---|
| **#final** ← new | Box score for every game with a user team |
| #scores | Weekly roundup once every game in a week is played |
| #top-25 | Poll after each advance, with ▲▼ movement |
| #big-performances | 400-yd passers, 200-yd rushers, 3-sack games… (thresholds in config) |
| #recruiting | Per-user-team report each advance: class rank, commits/flips, top battles |
| #transfer-portal | Portal entries (3★+ or leaving a user team) and commitments |
| #national-potw | National offensive + defensive POTW |
| #acc #big-12 #big-ten #sec | Conference POTW, pinging that conference's role |
| #commish-board | One message, edited every run: RTA, unplayed games, autopilot |
| #live-stream | (yours — the bot only mentions it) |

Create a **category** named **Matchups**. The bot makes one chat per user-vs-user game each week inside it:
everyone can read, only the two coaches (and the Commish role) can type. Chats older than last week are deleted
(their box scores stay in #final). Change `keep_previous_weeks` in the config to keep more.

Create **roles**: `ACC`, `B12`, `B1G`, `SEC` (and `Commish` for you). Turn on **Allow anyone to @mention this role**
for the four conference roles. The bot assigns each coach the role for their team's real conference.

## 2. Create the bot

1. https://discord.com/developers/applications → **New Application** → name it "ODL".
2. **General Information**: copy **Application ID** and **Public Key**.
3. **Bot** → **Reset Token** → copy the token (shown once). Leave the intents off; none are needed.
4. **Invite it**: open this URL with your Application ID filled in, pick your server, Authorize:
   `https://discord.com/oauth2/authorize?client_id=APP_ID&scope=bot+applications.commands&permissions=268684304`
   (Manage Channels, Manage Roles, View Channels, Send Messages, Embed Links, Attach Files, Read History, Mention roles.)
5. Server Settings → **Roles**: drag the bot's role **above** ACC / B12 / B1G / SEC, or it can't hand them out.

## 3. Fill in `discord.config.json`

Turn on Discord **Developer Mode** (User Settings → Advanced). Then right-click → **Copy ID**:
- your server icon → `guild_id`
- each coach → the `coaches` map, keyed by their team's name exactly as the game spells it:
  `"Penn State": "123456789012345678"`

This file is in a public repo. Discord IDs are safe to show; **never put tokens in it**.

## 4. GitHub (repo pirateflag23/dynasty-site)

Settings → Secrets and variables → Actions → **New repository secret** (you already have `DYNASTY_API_KEY`):
- `DISCORD_BOT_TOKEN`: the bot token
- `DISCORD_APP_ID`: the Application ID

Add or replace these files (Add file → Create new file, type the path, paste, commit):

| Path in repo | File |
|---|---|
| `.github/workflows/player-stats.yml` | **replace** (now runs every 10 min and posts to Discord) |
| `.github/workflows/register-commands.yml` | new |
| `.github/workflows/scripts/discord-feed.mjs` | new |
| `.github/workflows/scripts/register-commands.mjs` | new |
| `discord.config.json` | new, at the top level of the repo |

Then **Actions** → **Register Discord slash commands** → Run workflow (once, and again whenever commands change).

**First real run:** Actions → **ODL sync** → Run workflow. The first run only *records* what already exists
(no flood of old box scores), creates this week's matchup chats and posts the commish board.
To see each post type right away: Run workflow with **replay** = `final,big,scores,top25,potw,recruiting,portal`.
Use **dry_run** to print posts in the log without sending anything.

## 5. Slash commands (Cloudflare)

1. Workers & Pages → **Create application** → **Start with Hello World** → name `odl-bot` → Deploy.
2. **Edit code** → replace everything with `bot/worker.js` → **Deploy**.
3. Settings → **Variables and Secrets** → add:
   - `DISCORD_PUBLIC_KEY` (Secret): Public Key from step 2
   - `DYNASTY_API_KEY` (Secret): make a new API key named `discord-bot` in the Dynasty API dashboard
   - `DISCORD_APP_ID` (Text): Application ID
   - `SITE_URL` (Text): `https://thedynastycfb.com`
   - `DATA_URL` (Text): `https://pirateflag23.github.io/dynasty-site/data/bot`
4. Copy the worker's URL (`https://odl-bot.jw1388954.workers.dev`). In the Discord Developer Portal → General
   Information → **Interactions Endpoint URL** → paste → Save. (Discord tests it; it saves only if the Worker answers.)
5. In Discord type `/player name: Gio Lopez`.

## Timing
- Data reaches Discord after the Dynasty API syncs **and** the next Action run (≤10 min, GitHub sometimes runs late).
- Top 25 and the recruiting report wait until that week's deep sync has run, so they're never stale.
