import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, hyperlink } from 'discord.js';
import { suspect_to_userModel } from './../functions/database.js';
import { debug, error, highlight, info } from './../functions/logger.js';

/**
* @param {ButtonInteraction} interaction
*/
export async function listFirst(interaction) {

    let owner = Number(interaction.customId.split('_')[1]);

    if (interaction.user.id != owner) {
        const errorEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription(`This isn't your watchlist!\nUse the command **/list** to see your own watchlist.`);

        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        return;
    }

    // get all watchlist entries of the user
    let all_entries = await suspect_to_userModel.findAll({ where: { discord_id: interaction.user.id }, order: [['createdAt', 'ASC']] });

    if (all_entries.length == 0) {
        const watchlistEmbed = new EmbedBuilder()
            .setColor(0x6A00FF)
            .setTitle('Your watchlist')
            .setDescription(`There are currently no suspects on your watchlist.`);

        await interaction.update({ content: null, embeds: [watchlistEmbed], components: [] });
        return;
    }

    let pageCount = Math.ceil(all_entries.length / 10);

    let fitsOnOnePage = all_entries.length < 11;

    let steam_links = [];
    let date_added = [];
    let notes = [];

    for (let i = 0; i < (fitsOnOnePage ? all_entries.length : 10); i++) {
        const entry = all_entries[i];
        steam_links.push(`${i + 1}\u200b. ` + hyperlink(`${entry.name}`, `https://steamcommunity.com/profiles/${entry.steam_id}/`));
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

    const watchlistEmbed = new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle(`Your watchlist (Page 1 of ${pageCount})`)
        .addFields(
            { name: 'Steam profile', value: steam_links.join('\n'), inline: true },
            { name: 'Date added', value: date_added.join('\n'), inline: true },
            { name: 'Notes', value: notes.join('\n'), inline: true }
        );

    interaction.update({ content: null, embeds: [watchlistEmbed], components: [actionRow] });
}

function dateFormat(date) {
    return date.getUTCFullYear() + "-" +
        ("0" + (date.getUTCMonth() + 1)).slice(-2) + "-" +
        ("0" + date.getUTCDate()).slice(-2);
}