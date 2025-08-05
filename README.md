# Polarity Slack Bot

Connect your Slack workspace to [Polarity](https://threatconnect.com/polarity-by-threatconnect/) and search indicators directly from Slack using the `/polarity` command.

## What the Bot Does

* Detects entities (IPs, URLs, hashes, domains, etc.) in slash-command text
* Queries **running Polarity integration** and shows hit / no-hit summaries.  
* Lets users expand **Show details** for full JSON data from each integration or **Show error** to inspect failures.  
* Tracks long-running requests with live progress bars.  
* Provides an **App Home** with usage tips; Slack Admins can **Refresh Integrations** without redeploying.

---

## Installing the Slack App

### Create Slack App
1. NAvigate to <https://api.slack.com/apps>  and select “From scratch”.  

### Add App Manifest
1. Click on "Features" -> "App Manifest"  
2. Paste the following JSON App Manifest and click "Save"

```
{
    "display_information":
    {
        "name": "Polarity"
    },
    "features":
    {
        "app_home":
        {
            "home_tab_enabled": true,
            "messages_tab_enabled": false,
            "messages_tab_read_only_enabled": true
        },
        "bot_user":
        {
            "display_name": "Polarity",
            "always_online": true
        },
        "slash_commands":
        [
            {
                "command": "/polarity",
                "description": "Search Polarity",
                "usage_hint": "[entity]",
                "should_escape": false
            }
        ]
    },
    "oauth_config":
    {
        "scopes":
        {
            "bot":
            [
                "app_mentions:read",
                "canvases:write",
                "commands",
                "users:read",
                "channels:join",
                "chat:write.public",
                "channels:read",
                "groups:read",
                "mpim:read",
                "im:read"
            ]
        }
    },
    "settings":
    {
        "event_subscriptions":
        {
            "bot_events":
            [
                "app_home_opened"
            ]
        },
        "interactivity":
        {
            "is_enabled": true
        },
        "org_deploy_enabled": false,
        "socket_mode_enabled": true,
        "token_rotation_enabled": false
    }
}
```

### Permission Requirements

The following permissions are required for the Polarity Slack Bot to be able to determine if it is a member of a private channel when being invoked.  If the Polarity Bot is not a member of the channel, the Bot will prompt the user to invite it.
```
"channels:read",
"groups:read",
"mpim:read",
"im:read"
```


### Add App Level Token 
1. Click on "Basic Information" and scroll down to "App-Level Tokens". 
2. Click on "Generate Token and Scopes"
3. Add a token name.  For example, ""
4. Add the Scope "connections:write"
5. Click "Generate"
6. Copy the generated token which should start with "xapp-".  This token is your `POLARITY_SLACK_BOT_APP_TOKEN` environment variable value.

### Record Required Credentials

1. You should already have the App Level Token which starts with "xapp-"
2. Additionally, you will need the Signing Secret which you can find under "Basic Information".  The Signing Secret should be used for the `POLARITY_SLACK_BOT_SIGNING_SECRET` environment variable.
3. Finally, you will need the "Bot User OAuth Token" which you can get by going to "Feature" -> "OAuth & Permissions".  The "Bot User OAuth Token" is used for the `POLARITY_SLACK_BOT_APP_TOKEN` environment variable and should start with "xoxb-"

You will use these three credentials when configuring the Slack Bot `.env` file below.


### Configure .env fie

1. Copy the `.env.example` file into a `.env` file

```bash
cp .env.example .env
```
2. Fill in the required variables:

```env
POLARITY_SLACK_BOT_TOKEN=…
POLARITY_SLACK_BOT_SIGNING_SECRET=…
POLARITY_SLACK_BOT_APP_TOKEN=
POLARITY_API_KEY=
POLARITY_HOSTNAME
```

Additional supported environment variables are documented in the `.env.example` file.


---

## Running the Server with Docker

Once you have the `.env` file configured, use the helper script which builds the image and runs it with default values.

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

If you prefer running locally without Docker you can install the Node dependencies and start the server:

```bash
npm ci
npm start
```
Running locally requires that Node24+ is installed.

---

## Using the Bot in Slack

### Slash Command

Type:

```
/polarity 8.8.8.8 example.com
```

You will see:

1. A progress bar while entities are processed.  
2. A grouped result block per entity
3. Buttons to **Show details** or **Show error** for each integration.

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
