# Polarity Slack Bot 🤖

Connect your Slack workspace to [Polarity](https://polarity.io) and enrich conversations with threat-intel look-ups straight from chat.

## What the Bot Does

• Detects entities (IPs, URLs, hashes, domains, etc.) in slash-command text or messages where it is mentioned.  
• Queries every **running Polarity integration** and shows hit / no-hit summaries.  
• Lets users expand **Show details** for full JSON data or **Show error** to inspect failures.  
• Tracks long-running requests with live progress bars.  
• Provides an **App Home** with usage tips; admins can **Refresh Integrations** without redeploying.

---

## Installing the Slack App

1. **Create a Slack App** at <https://api.slack.com/apps> → “From scratch”.  
2. Add these **Bot Token Scopes** (OAuth & Permissions → Scopes):  
   ```
   app_mentions:read
   chat:write
   commands
   im:history
   incoming-webhook
   reactions:write
   users:read
   ```
3. **Slash Command**  
   • Command: `/polarity`  
   • Request URL: `https://<your-domain>/slack/commands/polarity`  
4. **Event Subscriptions**  
   • Enable events and set Request URL: `https://<your-domain>/slack/events`  
   • Subscribe to bot events: `app_home_opened`, `app_mention`  
5. **Interactivity & Shortcuts** → Enable and set Request URL: `https://<your-domain>/slack/interactions`  
6. **Install to Workspace** and copy the generated credentials:

   ```env
   SLACK_BOT_TOKEN=xoxb-…
   SLACK_SIGNING_SECRET=abcd1234…
   ```

7. Duplicate the sample env file and fill in your values:

   ```bash
   cp .env.example .env
   ```

   Required variables:

   ```env
   SLACK_BOT_TOKEN=…
   SLACK_SIGNING_SECRET=…
   POLARITY_HOST=polarity.example.com
   POLARITY_API_KEY=…
   ```

---

## Running the Server with Docker

Use the helper script which builds the image and runs it with sane defaults.

```bash
./run-polarity.sh
```

Common flags:

```
-e, --env-file PATH   Custom env file (default .env)
-c, --ca-file  PATH   Extra CA bundle for TLS
-n, --network  MODE   Docker network (e.g. host)
-d, --detach          Run container in background
```

Examples:

```bash
./run-polarity.sh -n host                 # host networking
./run-polarity.sh -d -c ./my-ca.pem       # detached with extra CAs
```

Logs rotate according to `LOG_MAX_SIZE` (default `10m`) and `LOG_MAX_FILE` (default `3`).

Prefer running locally? Simply:

```bash
npm ci
npm start
```

(Node 24 or later required.)

---

## Using the Bot in Slack

### Slash Command

Type:

```
/polarity 1.1.1.1 example.com eicar
```

You will see:

1. A progress bar while entities are processed.  
2. A grouped result block per entity with ✅ / ❌ statuses.  
3. Buttons to **Show details** or **Show error** for each integration.

### App Mentions

Mention the bot in a channel:

```
@polarity check 8.8.8.8 please
```

Results are posted in-thread.

### App Home

Open the bot’s Home tab for quick instructions. Admins see a **Refresh Integrations** button.

---

## Development

```bash
npm ci          # install deps
npm test        # run Jest tests
npm run lint    # ESLint
npm run format  # Prettier
```

---

© 2024 Polarity – MIT License
