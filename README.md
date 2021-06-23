# Discord VAC Notification Bot
A discord bot for automated notifications when steam accounts get VAC or game banned

This is my first time working with JavaScript and I was learning the syntax on the go so don&apos;t expect perfect code. At first I had problems with asynchronous parts like file reading/writing and API calls. The bot is simple and should be working without any bigger problems. I&apos;ll probably improve it in the future. If you find any bugs please let me know. Also feel free to create a fork & merge request if you want to contribute.

## Setup
#### Windows
To use this bot you need to have [NodeJS](https://nodejs.org/en/download/) installed (I recommend the LTS version).
Clone the repository and rename &quot;config.json.example&quot; to &quot;config.json&quot;.
Put your discord bot token and steam api key inside the config file.
Start cmd / powershell in your directory and type `npm install` to install all the dependencies.
Then type `npm start` or `node index.js` to start the bot.

#### Linux
To use this bot you need to have [NodeJS](https://nodejs.org/en/download/) installed.
When installing NodeJs via package manager (at least with apt) you&apos;ll most likely get an outdated version.
You can run the following command to add the latest version:
`$ curl -sL https://deb.nodesource.com/setup_14.x | sudo bash -`
Then you can actually install NodeJS and NPM
`$ sudo apt-get install -y nodejs`
`$ sudo apt-get install -y npm`

Go to the directory you want the bot to be installed at and clone the repository
`$ git clone https://github.com/Moyomo/DiscordVacBot`
Then rename &quot;config.json.example&quot; to &quot;config.json&quot; with the following command:
`$ mv config.json.example config.json`
Put your discord bot token and steam api key inside the config file.
To load all the required dependencies use `$ npm install`
Then type `npm start` or `node index.js` to start the bot.

## To Do
- embed bot messages (and add hyperlinks for steam profiles)
- wrap everything in try catch blocks and improve error handling
- first time setup introduction (automated config renaming and asking for API key, token etc.)
- add a list command to list all saved steam profiles
- fix the message splitting to allow spaces after the prefix
- add timestamps to console output