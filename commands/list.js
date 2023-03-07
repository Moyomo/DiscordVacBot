import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, hyperlink, SlashCommandBuilder } from 'discord.js';
import { suspect_to_userModel } from './../functions/database.js';
import { debug, error, highlight, info } from './../functions/logger.js';

export const data = new SlashCommandBuilder()
    .setName('list')
    .setDescription('List all the suspects on your watchlist');

/**
* @param {ChatInputCommandInteraction} interaction
*/
export async function execute(interaction) {

    // get all watchlist entries of the user
    let all_entries = await suspect_to_userModel.findAll({ where: { discord_id: interaction.user.id }, order: [['createdAt', 'ASC']] });

    if (all_entries.length == 0) {
        const watchlistEmbed = new EmbedBuilder()
            .setColor(0x6A00FF)
            .setTitle('Your watchlist')
            .setDescription(`There are currently no suspects on your watchlist.`);

        await interaction.reply({ embeds: [watchlistEmbed] });
        return;
    }

    let pageCount = Math.ceil(all_entries.length / 10);

    let fitsOnOnePage = all_entries.length < 11;

    let steam_links = [];
    let date_added = [];
    let notes = [];

    for (let i = 0; i < (fitsOnOnePage ? all_entries.length : 10); i++) {
        const entry = all_entries[i];
        steam_links.push(`${i + 1}. ` + hyperlink(`${entry.name}`, `https://steamcommunity.com/profiles/${entry.steam_id}/`));
        date_added.push(dateFormat(entry.createdAt));
        notes.push(entry.notes == '' ? '-' : entry.notes.length > 40 ? `${entry.notes.slice(0, 40)}...` : entry.notes.slice(0, 43));
    }

    const actionRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('first_' + interaction.user.id)
                .setEmoji('⏪')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId('previous_1_' + interaction.user.id)
                .setEmoji('◀')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId('next_1_' + interaction.user.id)
                .setEmoji('▶')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(fitsOnOnePage),
            new ButtonBuilder()
                .setCustomId('last_' + interaction.user.id)
                .setEmoji('⏩')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(fitsOnOnePage),
        );

    // send message
    const watchlistEmbed = new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle(`Your watchlist (Page 1 of ${pageCount})`)
        .addFields(
            { name: 'Steam profile', value: steam_links.join('\n'), inline: true },
            { name: 'Date added', value: date_added.join('\n'), inline: true },
            { name: 'Notes', value: notes.join('\n'), inline: true }
        );

    await interaction.reply({ embeds: [watchlistEmbed], components: [actionRow] });
}

function dateFormat(date) {
    return date.getUTCFullYear() + "-" +
        ("0" + (date.getUTCMonth() + 1)).slice(-2) + "-" +
        ("0" + date.getUTCDate()).slice(-2);
}