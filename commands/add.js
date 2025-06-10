import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, hyperlink, SlashCommandBuilder } from 'discord.js';
import { readFileSync } from 'fs';
import { suspectModel, suspect_to_userModel } from './../functions/database.js';
import { debug, error, highlight, info, warning } from './../functions/logger.js';
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const config = JSON.parse(readFileSync('./config.json', 'utf-8'));

export const data = new SlashCommandBuilder()
    .setName('add')
    .setDescription('Add a new suspect to your watchlist')
    .addStringOption(option => option.setName('steam_id')
        .setDescription('The SteamID or profile URL of the suspect')
        .setRequired(true)
    )
    .addStringOption(option => option.setName('notes')
        .setDescription('Your personal notes about the suspect')
        .setRequired(false)
    )
    .addIntegerOption(option => option.setName('ban_types')
        .setDescription('Specify which types of bans you want to track')
        .setRequired(false)
        .addChoices(
            { name: 'game & VAC bans', value: 1 },
            { name: 'community & economy bans', value: 2 },
            { name: 'all types of bans', value: 3 },
        )
    );

/**
* @param {ChatInputCommandInteraction} interaction
*/
export async function execute(interaction) {

    await interaction.deferReply();

    let interaction_steam_id = interaction.options.getString('steam_id');
    if (!interaction_steam_id) return;
    let interaction_notes = interaction.options.getString('notes');
    if (!interaction_notes) interaction_notes = "";
    let interaction_bantypes = interaction.options.getInteger('ban_types');
    if (!interaction_bantypes) interaction_bantypes = 1;

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
    else if (interaction_steam_id.match(regex_vanityUrl)) {

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

    // check if suspect already has a DB entry
    let suspect = await suspectModel.findOne({ where: { steam_id: steam_id } });

    // if there is no DB entry, create one
    if (!suspect) {

        await new Promise(r => setTimeout(r, 1000));

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

            suspect = await suspectModel.create({
                steam_id: json.SteamId,
                vac_banned: json.VACBanned,
                community_banned: json.CommunityBanned,
                economy_banned: json.EconomyBan,
                days_since_last_ban: json.DaysSinceLastBan,
                vac_amount: json.NumberOfVACBans,
                gameban_amount: json.NumberOfGameBans,
            });

            if (suspect) info(`added new suspect ${suspect.steam_id} to the database`);
        }
        catch (err) {
            error(err);
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('Error')
                .setDescription(`Error while creating database entry for suspect.`);

            await interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
            return;
        };
    }

    // check if suspect is already on users watchlist
    const check = await suspect_to_userModel.findOne({ where: { steam_id: steam_id, discord_id: interaction.user.id } });

    if (check) {
        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('details_' + steam_id)
                    .setLabel('Show suspect details')
                    .setStyle(ButtonStyle.Primary)
            );

        const errorEmbed = new EmbedBuilder()
            .setColor(0xAA00FF)
            .setTitle('Error')
            .setDescription(`This suspect is already on your watchlist.`);

        await interaction.editReply({ embeds: [errorEmbed], ephemeral: true, components: [actionRow] });
        return;
    }

    // get Steam profile info
    try {
        
        await new Promise(r => setTimeout(r, 1000));

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
        json = json.response.players[0];

        // add entry in M:N table with interaction.user, steam_id and additional info
        const connection = await suspect_to_userModel.create({
            steam_id: steam_id,
            discord_id: interaction.user.id,
            notes: interaction_notes,
            ban_types_to_track: interaction_bantypes,
            name: json.personaname
        });

        if (!connection) {
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('Error')
                .setDescription(`Error while creating database entry for watchlist.`);

            await interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
            return;
        }

        let last_ban_date = new Date();
        last_ban_date.setDate(last_ban_date.getDate() - suspect.days_since_last_ban);

        const suspectInfoEmbed = new EmbedBuilder()
            .setColor(0x00FF55)
            .setTitle('Added new suspect')
            .setDescription(`\
                **Name**: ${json.personaname}\
                \n**Steam64:** ${json.steamid}\
                \n${hyperlink(`Profile link`, `https://steamcommunity.com/profiles/${json.steamid}/`, `"${json.personaname}" on Steam`)}\n\
            `)
            .setThumbnail(json.avatarfull)
            .addFields(
                { name: 'Number of VAC bans', value: String(suspect.vac_amount), inline: true },
                { name: 'Number of game bans', value: String(suspect.gameban_amount), inline: true },
                { name: '\u200B', value: '\u200B', inline: true },

                { name: 'Days since last ban', value: suspect.vac_amount == 0 && suspect.gameban_amount == 0 ? '-' : `${suspect.days_since_last_ban} (${dateFormat(last_ban_date)})`, inline: true },
                { name: 'Account created on', value: json.timecreated ? `${dateFormat(new Date(json.timecreated * 1000))}` : '?', inline: true },
                { name: '\u200B', value: '\u200B', inline: true },

                { name: 'Community ban', value: String(suspect.community_banned), inline: true },
                { name: 'Economy ban', value: suspect.economy_banned, inline: true },
                { name: '\u200B', value: '\u200B', inline: true },
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [suspectInfoEmbed] });
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
}

function dateFormat(date) {
    return date.getUTCFullYear() + "-" +
        ("0" + (date.getUTCMonth() + 1)).slice(-2) + "-" +
        ("0" + date.getUTCDate()).slice(-2);
}