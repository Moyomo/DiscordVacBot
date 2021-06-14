const Discord = require('discord.js')
const request = require('request');
const fs      = require('fs');
const { emitKeypressEvents } = require('readline');

const config = JSON.parse(fs.readFileSync('config.json','utf-8'))

var client = new Discord.Client()

client.on('ready', () => {
    console.log('\x1b[36m%s\x1b[0m',`Logged in as ${client.user.username}...`);

    if(!fs.existsSync('./users/')){
        fs.mkdirSync('./users/');
    }

    setInterval(() => {
        console.log('\x1b[92m%s\x1b[0m','Checking for bans...');
        checkForVacs();
    }, 3600000); //checking every 60 minutes
})

//map of all bot commands
var cmdmap = {
    notify: cmd_notify,
    help: cmd_help,
    add: cmd_add
}

function cmd_notify(msg, args) {
    //check args (dm, channel, here?)
    //change notification type in userconfig file
    let notificationType;

    switch(args[0]){
        case 'dm':
            notificationType = 'dm';
            break;
        case 'channel':
            notificationType = 'channel';
            break;
        case 'here':
            if(msg.channel.type == 'dm') notificationType = 'dm';
            else notificationType = 'channel';
            break;
        default:
            break;
    }

    if(notificationType != null){
        const path = './users/' + msg.author.id + '.json';
        try{
            if(!fs.existsSync(path)){
                //create new user file
                var data = {
                    notify: notificationType,
                    channel: msg.channel.id,
                    urls: [],
                    banned: []
                }
                jsonData = JSON.stringify(data, null, 4);
                fs.writeFileSync(path,jsonData, function(err){
                    if(err){
                        console.log(err);
                    }
                })
                //message for first time users?
                msg.channel.send(`Config file has been created. Use \"${config.prefix}help\" for additional informations`);
            }
            else{
                let jsonRaw = fs.readFileSync(path);
                let jsonObj = JSON.parse(jsonRaw);
    
                jsonObj.notify = notificationType;
                if(notificationType == 'channel' && msg.channel.type != 'dm'){
                    jsonObj.channel = msg.channel.id;
                }

                var jsonStr = JSON.stringify(jsonObj, null, 4);
                fs.writeFileSync(path,jsonStr, function(err){
                    if(err){
                        console.log(err);
                    }
                })
                if(notificationType == 'channel'){
                    msg.channel.send('changed notification channel to: <#' + msg.channel.id + '>');
                }
                else{
                    msg.channel.send('changed notification type to: direct message');
                }
            }
        }
        catch (err){
            console.log(err.message);
            return;
        }
    }
    else{
        msg.channel.send(`Please use one of the following keywords to set the notification type: \`dm\`,\`channel\`,\`here\`\nExample: \`${config.prefix}notify dm\` -> set notification type to direct message`)
    }
}

const help_info =
`This bot automatically notifies you as soon as one of the added steam profiles gets either VAC banned or game banned.
Use the \`${config.prefix}add\` command followed by a steam profile link to add it to your personal watchlist.
By default the bot will notify you via direct message on discord. If you want to change the notification channel use the \`${config.prefix}notify\` command.
All commands:
\`\`\`
${config.prefix}add [steam profile link]
${config.prefix}notify [dm / channel / here]
${config.prefix}help
\`\`\`
For more informations and instructions on how to set this bot up yourself visit http://github.com/Moyomo/DiscordVacBot`;

function cmd_help(msg, args) {
    msg.channel.send(help_info);
}

async function cmd_add(msg, args) {
    var expression = /https:\/\/steamcommunity.com\/(profiles\/[0-9]{17}|id\/.+)\/?/gi
    var regex = new RegExp(expression)
    var url = args[0]

    if(args[0] == null) {
        msg.channel.send(`To use this command type \"${config.prefix}add\" followed by a steam profile URL\nExample: \`${config.prefix}add https://steamcommunity.com/id/popflashed/\``);
        return;
    }

    if(url.match(regex)) {
        var steam64 = 'id:'
        if(url.includes('/id/')){
            //API Call GET SteamId64 from vanityURL
            if(url.slice(-1) == '/') url = url.slice(0, -1);
            let res = await resolveVanityURL(url.split('/id/')[1]);
            if(res == 'error'){
                msg.channel.send("couldn't resolve vanity URL!");
                return;
            }
            steam64 = res;
        }
        else{
            // /profiles/ url substring steam64
            steam64 = url.split('/profiles/')[1].substr(0,17);
        }

        const path = './users/' + msg.author.id + '.json';
        try{
            if(!fs.existsSync(path)){
                //create new user file
                var data = {
                    notify: 'dm',
                    channel: msg.channel.id,
                    urls: [
                        steam64
                    ],
                    banned: []
                }
                jsonData = JSON.stringify(data, null, 4);
                fs.writeFileSync(path,jsonData, function(err){
                    if(err){
                        console.log(err);
                    }
                })
                //message for first time users?
                msg.channel.send(`\`Config file has been created. Use \"${config.prefix}help\" for additional informations\``);
            }
            else{
                //file exists and can be opened
                let jsonRaw = fs.readFileSync(path);
                let jsonObj = JSON.parse(jsonRaw);

                if(jsonObj['urls'].includes(steam64)){
                    console.log('\x1b[31m%s\x1b[0m','WARNING: Steam64ID already in URLs array!')
                    msg.channel.send('You already added this profile to the watchlist');
                    return;
                }

                jsonObj['urls'].push(steam64);
                var jsonStr = JSON.stringify(jsonObj, null, 4);
                fs.writeFileSync(path,jsonStr, function(err){
                    if(err){
                        console.log(err);
                    }
                })
                msg.channel.send('added steam64ID: ' + steam64);
                console.log('added steam64id: ' + steam64);
            }
            msg.channel.send('Steam Profile successfully added to your watchlist')
        }
        catch (err){
            console.log(err.message);
            return;
        }
    }
    else{
        msg.channel.send("That's not a valid Steam Profile URL!")
    }
}

function checkForVacs(){
    fs.readdir('./users/', function(err, files){
        if(err){
            return console.log('\x1b[31m%s\x1b[0m','unable to read userconfig files');
        }
        files.forEach(async function(file){
            var discordid = file.slice(0,17);
            let jsonRaw = fs.readFileSync('./users/' + file);
            let jsonObj = JSON.parse(jsonRaw);

            let res = await getBanStatus(jsonObj.urls.join());
            let obj = await checkPlayerArray(jsonObj, res['players'], discordid);
            saveFile(obj, file);
        });
    });
}

function saveFile(obj, file){
    //save the changed config file
    var jsonStr = JSON.stringify(obj, null, 4);
    fs.writeFileSync('./users/' + file,jsonStr, function(err){
        if(err){
            console.log(err);
        }
    })
}

function checkPlayerArray(jsonObj, resArray, discordid){
    return new Promise(async function (resolve, reject){

        const user = await client.users.fetch(discordid).catch(() => null);
        const channel = await client.channels.fetch(jsonObj['channel']).catch(() => null);

        resArray.forEach(element => {
            //if(element.VACBanned == true){ //if condition for testing purposes
            if((element.VACBanned == true || element.NumberOfGameBans > 0) && DaysSinceLastBan == 0){
                console.log(element.SteamId + " has been VAC banned.");
                if(jsonObj['notify'] == 'dm'){
                    if(!user) return console.log('\x1b[31m%s\x1b[0m','user not found');
                    user.send('User ' + element.SteamId + ' has been banned.\nhttps://steamcommunity.com/profiles/' + element.SteamId).catch(() => {
                        console.log('\x1b[31m%s\x1b[0m','can\'t dm user. Trying saved channel');
                        if(!channel) return console.log('\x1b[31m%s\x1b[0m','channel not found');
                        channel.send('<@' + discordid + '> User ' + element.SteamId + ' has been banned.\nhttps://steamcommunity.com/profiles/' + element.SteamId).catch(() => {
                            console.log('\x1b[31m%s\x1b[0m','can\'t find channel')
                        })
                    })
                }
                else{
                    if(!channel) return console.log('user not found');
                    channel.send('<@' + discordid + '> User ' + element.SteamId + ' has been banned.\nhttps://steamcommunity.com/profiles/' + element.SteamId).catch(() => {
                        console.log('\x1b[31m%s\x1b[0m','can\'t find channel')
                    })
                }
                //remove steamid from saved URL array
                for(var i = 0; i < jsonObj['urls'].length; i++){
                    if(jsonObj['urls'][i] == element.SteamId){
                        jsonObj['urls'].splice(i,1);
                    } 
                }
                //add steamid to banned array
                jsonObj['banned'].push(element.SteamId);
            }
        });
        resolve(jsonObj);
    })
}

function resolveVanityURL(vanityURL){
    return new Promise(function (resolve, reject) {
        request('https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=' + config.steamApiKey + '&vanityurl=' + vanityURL, function (error, response, body) {
            if(!error && response.statusCode == 200){
                var resp = JSON.parse(body);
                if(resp.response.success == 1) resolve(resp.response.steamid);
                else resolve('error');
            }
            else{
                reject('error');
            }
        })
    })
}

function getBanStatus(id64array){
    return new Promise(function (resolve, reject) {
        request('https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/?key=' + config.steamApiKey + '&steamids=' + id64array, function (error, response, body) {
            if(!error && response.statusCode == 200){
                var resp = JSON.parse(body);
                resolve(resp);
            }
            else{
                reject('error');
            }
        })
    })
}

client.on('message', (msg) => {
    var cont   = msg.content,
        author = msg.author,
        chan   = msg.channel,
        guild  = msg.guild

    if (author.id != client.user.id && cont.startsWith(config.prefix)){
        console.log(`Command from ${author.username} (${author.id}): ${msg.content}`);
        var invoke = cont.split(' ')[0].substr(config.prefix.length),
            args   = cont.split(' ').slice(1);
        
        if(invoke in cmdmap){
            cmdmap[invoke](msg, args)
        }
    }
})

client.login(config.token)