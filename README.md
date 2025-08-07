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
1. Navigate to <https://api.slack.com/apps>  and select “Create an App”.
2. Select "From a manifest"
3. Select the appropriate workspace for the app to live in and click "Next"
4. Paste the following JSON App Manifest and click "Save"

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
                "chat:write",
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

5. Click "Next" and then click "Create" to create the App

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


# Running the Polarity Slack Bot Server

Ensure the server where you plan to run the Polarity Slack Bot meets the following software and hardware requirements.  We recommend installing the SlackBot on a server separate from your Polarity Server but the two can be co-located if the server has resources for both.

## Requirements

### Software Requirements

The Polarity Slack Bot should be run on a server with the following software pre-installed and available on `$PATH`:

```
bash
docker
curl
jq
tar
gzip
```

### Hardware Requirements

We recommend running the server on an Ubuntu system with a minimum of 2 logical cores, 4 GB of RAM, and 40GB of disk space.

## Download the Server Software

Navigate to the releases page of the GitHub repo and download the latest installer found here https://github.com/polarityio/polarity-slack-bot/releases/latest.  You can find the installer under the "Assets" section of the release. The installer has a `.run` extension.  As an example, the installer file will look like:

```
polarity-slack-bot-{{version}}.run
```

The full download URL for the installer will look like this:

```
https://github.com/polarityio/polarity-slack-bot/releases/download/v{{version}}/polarity-slack-bot-{{version}}.run
```

You can download the installer directly onto your server using `wget` or `curl`.

We recommend running the installer from your user's home directory or `/opt`.

## Run the downloaded installer

Once the installer is downloaded you will need to make it executable:

```bash
chmod u+x polarity-slack-bot-*.run
```

Finally, execute the installer:

```bash
./polarity-slack-bot-*.run
```

The self extracting installer will run an integrity check using cosign.  This requires network access to the GitHub Container Registry so the installer can run a containerized version of cosign to validate the installer.  If cosign cannot be run, the container will fall back to doing a sha256 checksum validation.

### Configure .env file

Once the software is downloaded you will need to set up your `.env` file.

1. Copy the `.env.example` file into a `.env` file

```bash
cp .env.example .env
```
2. Fill in the required variables:

```env
POLARITY_SLACK_BOT_TOKEN=…
POLARITY_SLACK_BOT_SIGNING_SECRET=…
POLARITY_SLACK_BOT_APP_TOKEN=…
POLARITY_HOSTNAME=…
POLARITY_API_KEY=…
POLARITY_SLACK_BOT_ADMIN_MEMBER_IDS=…
```

The `POLARITY_SLACK_BOT_ADMIN_MEMBER_IDS` is only required if non Slack admins will be managing the Polarity Slack Bot.

The variable is a comma-separated list of Slack member IDs that should be treated as admins for the Slack Bot
even if they are not workspace admins/owners. Admins have an ability to refresh which integrations
are searched after permissions changes are made to the Polarity API key configured for the bot.

Example: U123ABC,U456DEF

To view your member id:
1. Click your name under "Direct Message"
2. Click your avatar (top-left).
3. In the pop-up, click “View full profile”.
4. In the three-dot “More” menu choose “Copy member ID”.
5. The clipboard now contains something like U012ABCDEF which is your member id

Additional supported environment variables are documented in the `.env.example` file.

---

## Install/Update the Polarity Slack Bot Docker Image

Run the `./update-bot.sh` script to fetch the latest release of the Polarity Slack Bot from the GitHub releases page if the image is not already downloaded.

The `./update-bot.sh` script will check if the polarity-slack-bot image is installed, if not, it will prompt you to download and install the latest image.  If the image is already installed then it will check for updates and prompt you to update.

```
./update-bot.sh
```

## Running the Server with Docker

Once you have the `.env` file configured and the docker image installed you can start the server using the `./start-bot.sh` script: 

```bash
./start-bot.sh --detach
```

The `--detach` flag runs the container in the background.  You can view the container using the `docker ps` command:

```
docker ps
```

Common flags:

```
-e, --env-file PATH   Custom env file (default .env)
-c, --ca-file  PATH   Extra CA bundle for TLS
-n, --network  MODE   Docker network (e.g. host)
-d, --detach          Run container in background
-b, --build-local     Build and run image from current source (developer mode)
```

Examples:

```bash
./start-bot.sh -n host                 # host networking
./start-bot.sh -d -c ./my-ca.pem       # detached with extra CAs
```

Logs rotate according to `LOG_MAX_SIZE` (default `10m`) and `LOG_MAX_FILE` (default `3`).

To stop the bot you can use the `stop-bot.sh` script.

```
./stop-bot.sh
```

To view logs for the bot you can use the docker logs command with the container name:

```
docker logs polarity_slack_bot
```

To uninstall all Polarity Slack Bot docker images you can use the `uninstall-bot.sh` script:

```bash
./uninstall-bot.sh
```


If you'd like to build a local docker image instead of using an official release image you can run the `./start-bot.sh` script with the `--build-local` flag:

```bash
./start-bot.sh --build-local
```

This will build and run a docker image called `polarity-slack-bot-dev`.  For this to work you must download the full source code from the GitHub repo.  We recommend using `git` to do this:

```
git clone https://github.com/polarityio/polarity-slack-bot.git
```

If you prefer running locally without Docker you can install the Node dependencies and start the server:

```bash
npm ci
npm run start
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
