import { ChatInputCommandInteraction, EmbedBuilder, hyperlink, SlashCommandBuilder } from 'discord.js';
import { readFileSync } from 'fs';
import { suspectModel, suspect_to_userModel } from './../functions/database.js';
import { debug, error, highlight, info, warning } from './../functions/logger.js';
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const config = JSON.parse(readFileSync('./config.json', 'utf-8'));

export const data = new SlashCommandBuilder()
    .setName('suspect')
    .setDescription('Prints ban status of a given suspect')
    .addStringOption(option => option.setName('steam_id')
        .setDescription('The SteamID or profile URL of the suspect')
        .setRequired(true)
    );

/**
* @param {ChatInputCommandInteraction} interaction
*/
export async function execute(interaction) {

    await interaction.deferReply();

    let interaction_steam_id = interaction.options.getString('steam_id');
    if (!interaction_steam_id) return;

    let steam_id;
    let regex_steamURL = new RegExp(/(https:\/\/)?steamcommunity.com\/(profiles\/[0-9]{17}|id\/.+)\/?/);
    let regex_vanityUrl = new RegExp(/[A-Za-z0-9-_]{2,32}/);

    // check if parameter is a URL -> get steam64id
    if (interaction_steam_id.match(regex_steamURL)) {
        // check if URL contains steam64 or vanityURL
        if (interaction_steam_id.includes('/profiles/')) {
            steam_id = interaction_steam_id.split('/profiles/')[1].substring(0, 17);
        }
        else {
            if (interaction_steam_id.slice(-1) == '/') interaction_steam_id = interaction_steam_id.slice(0, -1);
            try {
                let res = await fetch(`https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${config.steam_API_key}&vanityurl=${interaction_steam_id.split('/id/')[1]}`);
                let json = await res.json();
                if (json.response.success == 1) {
                    steam_id = json.response.steamid;
                }
                else {
                    const errorEmbed = new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('API Error')
                        .setDescription(`Couldn't resolve the URL to a steam64 ID.`);

                    await interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
                    return;
                }
            }
            catch (err) {
                error(err);
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('API Error')
                    .setDescription(`Error while resolving URL to a steam64 id.`);

                await interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
                return;
            };
        }
    }
    else if (interaction_steam_id.length == 17 && interaction_steam_id.startsWith('7656')) {
        // NOTE: This may be stupid but if the ID is invalid there will be an API error
        steam_id = interaction_steam_id;
    }
    else if (!isNaN(interaction_steam_id)) {

        let all_entries = await suspect_to_userModel.findAll({ where: { discord_id: interaction.user.id }, order: [['createdAt', 'ASC']] });

        // check if the given parameter is an ID on the users watchlist
        if (all_entries[interaction_steam_id - 1]) {
            steam_id = all_entries[interaction_steam_id - 1].steam_id
        }
    }
    if (!steam_id && interaction_steam_id.match(regex_vanityUrl)) {

        // check if imput is a vanityURL -> try to resolve
        try {
            let res = await fetch(`https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${config.steam_API_key}&vanityurl=${interaction_steam_id}`);
            let json = await res.json()
            if (json.response.success == 1) {
                steam_id = json.response.steamid;
            }
        }
        catch (err) {
            warning(`Error while trying to resolve vanity URL ${interaction_steam_id}`);
            error(err);
            return;
        };
    }

    // if steam_id is null, let user know that the input is invalid
    if (!steam_id) {
        const errorEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('Error')
            .setDescription(`The specified input for the suspect is not valid.`);

        await interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
        return;
    }

    // get steam profile info of the suspect
    let suspect_profile;
    try {
        let res = await fetch(`http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${config.steam_API_key}&steamids=${steam_id}`)
        let json = await res.json();
        if (json.response.players.length == 0) {
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('API Error')
                .setDescription(`Error while getting suspect Steam profile info.`);

            await interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
            return;
        }
        suspect_profile = json.response.players[0];
    }
    catch (err) {
        error(err);
        const errorEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('API Error')
            .setDescription(`Error while getting suspect Steam profile info.`);

        await interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
        return;
    }

    // get the suspects DB entry
    let suspect_entry = await suspectModel.findOne({ where: { steam_id: steam_id } });

    let watchlist_entry = await suspect_to_userModel.findOne({ where: { steam_id: steam_id, discord_id: interaction.user.id } });

    let suspect_object = {};

    let watchlistInfoEmbed = new EmbedBuilder()

    if (suspect_entry) {
        suspect_object = {
            steam_id: suspect_entry.steam_id,
            vac_banned: suspect_entry.vac_banned,
            community_banned: suspect_entry.community_banned,
            economy_banned: suspect_entry.economy_banned,
            days_since_last_ban: suspect_entry.days_since_last_ban,
            vac_amount: suspect_entry.vac_amount,
            gameban_amount: suspect_entry.gameban_amount,
        }
    }
    else {
        try {
            let res = await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/?key=${config.steam_API_key}&steamids=${steam_id}`);
            let json = await res.json();
            if (json.players.length == 0) {
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('API Error')
                    .setDescription(`Couldn't get the current ban status of the suspect.`);

                await interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
                return;
            }
            json = json.players[0];

            suspect_object = {
                steam_id: json.SteamId,
                vac_banned: json.VACBanned,
                community_banned: json.CommunityBanned,
                economy_banned: json.EconomyBan,
                days_since_last_ban: json.DaysSinceLastBan,
                vac_amount: json.NumberOfVACBans,
                gameban_amount: json.NumberOfGameBans,
            }
        }
        catch (err) {
            error(err);
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('Error')
                .setDescription(`Error while fetching suspects ban status.`);

            await interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
            return;
        };
    }

    if (watchlist_entry) {

        let ban_types_text = '';
        switch (watchlist_entry.ban_types_to_track) {
            case 1: ban_types_text = 'Game bans & VAC bans'; break;
            case 2: ban_types_text = 'Community bans & economy bans'; break;
            case 3: ban_types_text = 'Game bans, VAC bans, community bans & economy bans'; break;
            default: break;
        }

        watchlistInfoEmbed
            .setColor(0x6A00FF)
            .setTitle('Watchlist entry info')
            .setDescription(`\
                **Added on:**\
                \n${dateFormat(watchlist_entry.createdAt)}\
                \n\
                \n**Original name:**\
                \n${watchlist_entry.name}\
                \n\
                \n**Tracked ban types:**\
                \n${ban_types_text}\
                \n\
                \n**Your notes about the suspect:**\
                \n${watchlist_entry.notes == '' ? '-' : watchlist_entry.notes}
            `)
    }
    else {
        watchlistInfoEmbed
            .setColor(0xFA6800)
            .setTitle('Suspect not on watchlist')
            .setDescription(`\
                This suspect is not on your watchlist.\
                \nUse the **/add** command to add them to your watchlist
            `)
    }

    let last_ban_date = new Date();
    last_ban_date.setDate(last_ban_date.getDate() - suspect_object.days_since_last_ban);

    const suspectInfoEmbed = new EmbedBuilder()
        .setColor(0x1BA1E2)
        .setTitle('Suspect')
        .setDescription(`\
            **Name**: ${suspect_profile.personaname}\
            \n**Steam64:** ${suspect_profile.steamid}\
            \n${hyperlink(`Profile link`, `https://steamcommunity.com/profiles/${suspect_profile.steamid}/`, `"${suspect_profile.personaname}" on Steam`)}\n\
        `)
        .setThumbnail(suspect_profile.avatarfull)
        .addFields(
            { name: 'Number of VAC bans', value: String(suspect_object.vac_amount), inline: true },
            { name: 'Number of game bans', value: String(suspect_object.gameban_amount), inline: true },
            { name: '\u200B', value: '\u200B', inline: true },

            { name: 'Days since last ban', value: suspect_object.vac_amount == 0 && suspect_object.gameban_amount == 0 ? '-' : `${suspect_object.days_since_last_ban} (${dateFormat(last_ban_date)})`, inline: true },
            { name: 'Account created on', value: suspect_profile.timecreated ? `${dateFormat(new Date(suspect_profile.timecreated * 1000))}` : '?', inline: true },
            { name: '\u200B', value: '\u200B', inline: true },

            { name: 'Community ban', value: String(suspect_object.community_banned), inline: true },
            { name: 'Economy ban', value: suspect_object.economy_banned, inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
        )
        .setTimestamp();

    await interaction.editReply({ embeds: [suspectInfoEmbed, watchlistInfoEmbed] });
}

function dateFormat(date) {
    return date.getUTCFullYear() + "-" +
        ("0" + (date.getUTCMonth() + 1)).slice(-2) + "-" +
        ("0" + date.getUTCDate()).slice(-2);
}