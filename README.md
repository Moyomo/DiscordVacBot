# Discord VAC Notification Bot

### Table of Contents

1. [General Info](#general-info)
2. [Commands](#commands)
3. [Setup](#setup)

## General Info

This Discord bot automatically notifies users when tracked Steam profiles receive any kind of ban.\
Every user can create their own personal watchlist which can contain an unlimited amount of Steam profiles.

The following ban types can be tracked:
- VAC bans
- game bans
- community bans
- economy bans

The bot will check for bans once during startup and then continually check every hour.

Whenever an untracked suspect gets added to a watchlist, the bot will create a database entry with the current ban status.\
So even if the bot is then offline for a while, as soon as it goes back online it will notify about all bans that happened during the downtime.

Since the ban status is saved in a database, the bot can also notify users about ban lifts. This is always enabled, so if a user tracks some suspect's VAC bans they will also get notified when an old VAC ban gets removed.

By default the bot will notify via direct message but if a user closed their DMs or doesn't want the bot to directly message them, there is a command that can be used to set the channel in which the bot should send notifications for them.

You can also use the `/suspect` command to get all the public ban info about a Steam user, even if they're not on your watchlist.

![Adding new suspects](https://i.imgur.com/E9XIi87.png)

![Show your watchlist](https://i.imgur.com/kGaHCyG.png)


## Commands
- `/add <steamID> [notes] [ban types]`\
Adds a Steam profile to your personal watchlist\
► **notes**: Your personal notes about the suspect\
► **ban types**: The ban types you want to track (VAC, community, ...) 

- `/edit <steamID> [notes] [banTypes]`\
Edits a suspect entry on your watchlist\
► **notes**: Your personal notes about the suspect\
► **ban types**: The ban types you want to track (VAC, community, ...) 

- `/remove <steamID>`\
Removes a suspect entry from your watchlist

- `/list`\
Lists all suspect entries on your watchlist

- `/suspect <steamID>`\
Shows ban status and general info about a specific Steam user\
→ If they're on your watchlist it will also show info about your suspect entry

- `/notify <notification type>`\
Changes the channel in which the bot will notify you about bans and ban lifts\
► **notification type**: Where you want to be notified (DMs, server channel)

- `/help`\
Sends a message with information about the bot and all commands

ℹ **Instead of the steam ID you can use the following values as parameter:**
- Steam 64 ID
- Steam profile link (/profile/ or /id/ URL)
- Vanity URL (custom profile URL)
- watchlist ID (entry number in `/list` command) [doesn't work for `/add` command]


## Setup

1. To use this bot you need to have [Node.js](https://nodejs.org/en/download/) installed (I recommend the LTS version)
2. Clone the repository and rename `config.json.example` to `config.json`
3. Put your Discord bot token and Steam API key inside the config file
4. Open a terminal window (or cmd / Powershell on Windows) in your bot directory\
 and type `npm install` to install the required dependencies
5. Type `npm start` or `node index.js` to start the bot