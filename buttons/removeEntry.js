import { ButtonInteraction, EmbedBuilder } from 'discord.js';
import { suspectModel, suspect_to_userModel } from './../functions/database.js';
import { debug, error, highlight, info } from './../functions/logger.js';

/**
* @param {ButtonInteraction} interaction
*/
export async function removeEntry(interaction) {

    let steam_id = interaction.customId.slice(7);

    let watchlist_entry = await suspect_to_userModel.findOne({ where: { steam_id: steam_id, discord_id: interaction.user.id } });
    if (!watchlist_entry) {
        const errorEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('Error')
            .setDescription(`This suspect is not on your watchlist.`);

        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
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

    await interaction.reply({ content: `${interaction.user}`, embeds: [errorEmbed] });
}