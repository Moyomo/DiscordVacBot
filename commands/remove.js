import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { readFileSync } from 'fs';
import { suspectModel, suspect_to_userModel } from './../functions/database.js';
import { debug, error, highlight, info, warning } from './../functions/logger.js';
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const config = JSON.parse(readFileSync('./config.json', 'utf-8'));

export const data = new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove a suspect from your watchlist')
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

    // check if suspect has a DB entry
    let suspect = await suspectModel.findOne({ where: { steam_id: steam_id } });

    // show an error if there is no DB entry
    if (!suspect) {
        const errorEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('Error')
            .setDescription(`This suspect is not on your watchlist.`);

        await interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
        return;
    }

    // check if there's a M:N entry
    let watchlist_entry = await suspect_to_userModel.findOne({ where: { steam_id: steam_id, discord_id: interaction.user.id } });

    if (!watchlist_entry) {
        const errorEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('Error')
            .setDescription(`This suspect is not on your watchlist.`);

        await interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
        return;
    }

    // remove the M:N entry
    await suspect_to_userModel.destroy({ where: { steam_id: steam_id, discord_id: interaction.user.id } });

    // check if the suspect is on other users watchlists
    let additional_entries = await suspect_to_userModel.findAll({ where: { steam_id: steam_id }, limit: 1 });

    // if not, remove the entry
    if (additional_entries.length == 0) {
        await suspectModel.destroy({ where: { steam_id: steam_id } });
    }

    const errorEmbed = new EmbedBuilder()
        .setColor(0x30E4F7)
        .setTitle('Suspect removed')
        .setDescription(`The suspect was successfully removed from your watchlist.`);

    await interaction.editReply({ embeds: [errorEmbed] });
}