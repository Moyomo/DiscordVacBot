import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { readFileSync } from 'fs';
import { Op } from 'sequelize';
import { client } from './../client.js';
import { suspectModel, suspect_to_userModel, userModel } from './../functions/database.js';
import { debug, error, highlight, info, warning } from './../functions/logger.js';
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const config = JSON.parse(readFileSync('./config.json', 'utf-8'));

export async function checkForBans() {
    // NOTE: This function is scuffed af

    let all_suspects = await suspectModel.findAll();

    let suspect_ids = [];
    all_suspects.forEach(suspect => {
        suspect_ids.push(suspect.steam_id);
    });

    while (suspect_ids.length) {

        // sleep for 5 seconds to prevent rate limiting
        await new Promise(r => setTimeout(r, 5000));

        let suspects = suspect_ids.splice(0, 99);
        let json = {};

        try {
            let res = await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/?key=${config.steam_API_key}&steamids=${suspects.join(',')}`);
            if (!res.ok) throw new Error(`API call returned HTTP response code ${res.status} - ${res.statusText ?? ""}`);
            json = await res.json();
        }
        catch (err) {
            warning('API Error while checking for player bans!');
            error(err);
            return;
        };

        for (let i = 0; i < json.players.length; i++) {
            const suspect = json.players[i];

            let suspect_entry = await suspectModel.findOne({ where: { steam_id: suspect.SteamId } });
            if (!suspect_entry) continue;

            let changes = true;
            let notification_embed = new EmbedBuilder();

            const actionRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('details_' + suspect.SteamId)
                        .setLabel('Show suspect details')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('remove_' + suspect.SteamId)
                        .setLabel('Remove from watchlist')
                        .setStyle(ButtonStyle.Danger),
                );

            // check for VAC & game bans
            if (suspect.NumberOfVACBans > suspect_entry.vac_amount) {
                // suspect got vac banned
                notification_embed
                    .setColor(0xFF0000)
                    .setTitle('VAC BAN')
                    .setDescription(`\
                        The suspect **${suspect.SteamId}** just got a __VAC ban__. ([Link to Steam Profile](https://steamcommunity.com/profiles/${suspect.SteamId}/))\
                        \nFor more information about the suspect use the **/suspect** command.
                    `);
            }
            else if (suspect.NumberOfGameBans > suspect_entry.gameban_amount) {
                // suspect got game banned
                notification_embed
                    .setColor(0xFF0000)
                    .setTitle('GAMEBAN')
                    .setDescription(`\
                        The suspect **${suspect.SteamId}** just got a __game ban__. ([Link to Steam Profile](https://steamcommunity.com/profiles/${suspect.SteamId}/))\
                        \nFor more information about the suspect use the **/suspect** command.
                    `);
            }
            else if (suspect.NumberOfVACBans < suspect_entry.vac_amount) {
                // a vac ban got lifted
                notification_embed
                    .setColor(0x00ABA9)
                    .setTitle('VAC ban lifted')
                    .setDescription(`\
                        The suspect **${suspect.SteamId}** just got a __VAC ban__ lifted. ([Link to Steam Profile](https://steamcommunity.com/profiles/${suspect.SteamId}/))\
                        \nFor more information about the suspect use the **/suspect** command.
                    `);
            }
            else if (suspect.NumberOfGameBans < suspect_entry.gameban_amount) {
                // a game ban got lifted
                notification_embed
                    .setColor(0x00ABA9)
                    .setTitle('Game ban lifted')
                    .setDescription(`\
                        The suspect **${suspect.SteamId}** just got a __game ban__ lifted. ([Link to Steam Profile](https://steamcommunity.com/profiles/${suspect.SteamId}/))\
                        \nFor more information about the suspect use the **/suspect** command.
                    `);
            }
            else {
                // no changes were found
                changes = false;
            }

            let notification_map = {};

            // send a notification to all users who track game bans and vac bans
            if (changes) {

                let users_to_notify = await suspect_to_userModel.findAll({ where: { steam_id: suspect.SteamId, ban_types_to_track: { [Op.or]: [1, 3] } } });

                for (let index = 0; index < users_to_notify.length; index++) {
                    const user = users_to_notify[index];

                    let user_entry = await userModel.findOne({ where: { discord_id: user.discord_id } });

                    try {
                        if (user_entry.notification_type == 1) {
                            // try to DM the user
                            let userObj = await client.users.fetch(user_entry.discord_id);
                            if (!userObj) continue;

                            let ban_types_text = '';
                            switch (user.ban_types_to_track) {
                                case 1: ban_types_text = 'Game bans & VAC bans'; break;
                                case 2: ban_types_text = 'Community bans & economy bans'; break;
                                case 3: ban_types_text = 'Game bans, VAC bans, community bans & economy bans'; break;
                                default: break;
                            }

                            let watchlistInfoEmbed = new EmbedBuilder()
                                .setColor(0x6A00FF)
                                .setTitle('Watchlist entry info')
                                .setDescription(`\
                                    **Added on:**\
                                    \n${dateFormat(user.createdAt)}\
                                    \n\
                                    \n**Original name:**\
                                    \n${user.name}\
                                    \n\
                                    \n**Tracked ban types:**\
                                    \n${ban_types_text}\
                                    \n\
                                    \n**Your notes about the suspect:**\
                                    \n${user.notes == '' ? '-' : user.notes}
                                `)

                            await userObj.send({ embeds: [notification_embed, watchlistInfoEmbed], components: [actionRow] });
                        }
                        else {
                            // add user & channel to map
                            if (!notification_map[user_entry.channel_id]) notification_map[user_entry.channel_id] = [user_entry.discord_id];
                            else notification_map[user_entry.channel_id].push(user_entry.discord_id);
                        }
                    }
                    catch (err) {
                        // add user & channel to map
                        if (!notification_map[user_entry.channel_id]) notification_map[user_entry.channel_id] = [user_entry.discord_id];
                        else notification_map[user_entry.channel_id].push(user_entry.discord_id);
                    };

                }

                // loop over map and try to notify in channels
                for (const [channel, user_array] of Object.entries(notification_map)) {
                    try {
                        let channelObj = await client.channels.fetch(channel);
                        if (!channelObj) continue;

                        await channelObj.send({ content: `<@${user_array.join('> <@')}>`, embeds: [notification_embed], components: [actionRow] });
                    }
                    catch { continue }
                }
            }

            changes = true;
            notification_map = {};

            // check for community & economy bans
            if (suspect.CommunityBanned && suspect_entry.community_banned == false) {
                // suspect got community banned
                notification_embed
                    .setColor(0xFF0000)
                    .setTitle('COMMUNITY BAN')
                    .setDescription(`\
                        The suspect **${suspect.SteamId}** just got a __community ban__. ([Link to Steam Profile](https://steamcommunity.com/profiles/${suspect.SteamId}/))\
                        \nFor more information about the suspect use the **/suspect** command.
                    `);
            }
            else if (suspect.EconomyBan == 'banned' && suspect_entry.economy_banned != 'banned') {
                // suspect got economy banned
                notification_embed
                    .setColor(0xFF0000)
                    .setTitle('COMMUNITY BAN')
                    .setDescription(`\
                        The suspect **${suspect.SteamId}** just got an __economy ban__. ([Link to Steam Profile](https://steamcommunity.com/profiles/${suspect.SteamId}/))\
                        \nFor more information about the suspect use the **/suspect** command.
                    `);
            }
            else if (suspect.CommunityBanned == false && suspect_entry.community_banned == true) {
                // a community ban got lifter
                notification_embed
                    .setColor(0x00ABA9)
                    .setTitle('Community ban lifted')
                    .setDescription(`\
                        The suspect **${suspect.SteamId}** just got a __community ban__ lifted. ([Link to Steam Profile](https://steamcommunity.com/profiles/${suspect.SteamId}/))\
                        \nFor more information about the suspect use the **/suspect** command.
                    `);
            }
            else if (suspect.EconomyBan != 'banned' && suspect_entry.economy_banned == 'banned') {
                // an economy ban got lifted
                notification_embed
                    .setColor(0x00ABA9)
                    .setTitle('Economy ban lifted')
                    .setDescription(`\
                        The suspect **${suspect.SteamId}** just got an __economy ban__ lifted. ([Link to Steam Profile](https://steamcommunity.com/profiles/${suspect.SteamId}/))\
                        \nFor more information about the suspect use the **/suspect** command.
                    `);
            }
            else {
                changes = false;
            }

            // send a notification to all users who track community bans and economy bans
            if (changes) {

                let users_to_notify = await suspect_to_userModel.findAll({ where: { steam_id: suspect.SteamId, ban_types_to_track: { [Op.or]: [2, 3] } } });

                for (let index = 0; index < users_to_notify.length; index++) {
                    const user = users_to_notify[index];

                    let user_entry = await userModel.findOne({ where: { discord_id: user.discord_id } });

                    try {
                        if (user_entry.notification_type == 1) {
                            // try to DM the user
                            let userObj = await client.users.fetch(user_entry.discord_id);
                            if (!userObj) continue;

                            let ban_types_text = '';
                            switch (user.ban_types_to_track) {
                                case 1: ban_types_text = 'Game bans & VAC bans'; break;
                                case 2: ban_types_text = 'Community bans & economy bans'; break;
                                case 3: ban_types_text = 'Game bans, VAC bans, community bans & economy bans'; break;
                                default: break;
                            }

                            let watchlistInfoEmbed = new EmbedBuilder()
                                .setColor(0x6A00FF)
                                .setTitle('Watchlist entry info')
                                .setDescription(`\
                                    **Added on:**\
                                    \n${dateFormat(user.createdAt)}\
                                    \n\
                                    \n**Original name:**\
                                    \n${user.name}\
                                    \n\
                                    \n**Tracked ban types:**\
                                    \n${ban_types_text}\
                                    \n\
                                    \n**Your notes about the suspect:**\
                                    \n${user.notes == '' ? '-' : user.notes}
                                `)

                            await userObj.send({ embeds: [notification_embed, watchlistInfoEmbed], components: [actionRow] });
                        }
                        else {
                            // add user & channel to map
                            if (!notification_map[user_entry.channel_id]) notification_map[user_entry.channel_id] = [user_entry.discord_id];
                            else notification_map[user_entry.channel_id].push(user_entry.discord_id);
                        }
                    }
                    catch (err) {
                        // add user & channel to map
                        if (!notification_map[user_entry.channel_id]) notification_map[user_entry.channel_id] = [user_entry.discord_id];
                        else notification_map[user_entry.channel_id].push(user_entry.discord_id);
                    };

                }

                // loop over map and try to notify in channels
                for (const [channel, user_array] of Object.entries(notification_map)) {
                    try {
                        let channelObj = await client.channels.fetch(channel);
                        if (!channelObj) continue;

                        await channelObj.send({ content: `<@${user_array.join('> <@')}>`, embeds: [notification_embed], components: [actionRow] });
                    }
                    catch { continue }
                }
            }

            // update date database entry
            await suspectModel.update({
                vac_banned: suspect.VACBanned,
                community_banned: suspect.CommunityBanned,
                economy_banned: suspect.EconomyBan,
                days_since_last_ban: suspect.DaysSinceLastBan,
                vac_amount: suspect.NumberOfVACBans,
                gameban_amount: suspect.NumberOfGameBans,
            }, { where: { steam_id: suspect.SteamId } });
        }
    }
}

function dateFormat(date) {
    return date.getUTCFullYear() + "-" +
        ("0" + (date.getUTCMonth() + 1)).slice(-2) + "-" +
        ("0" + date.getUTCDate()).slice(-2);
}