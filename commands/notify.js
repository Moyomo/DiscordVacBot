import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { userModel } from './../functions/database.js';

export const data = new SlashCommandBuilder()
    .setName('notify')
    .setDescription('Change how the bot should notify you')
    .addIntegerOption(option => option.setName('notification_types')
        .setDescription('Where should the bot notify you?')
        .setRequired(true)
        .addChoices(
            { name: 'in DMs', value: 1 },
            { name: 'on a server', value: 2 },
            { name: 'in the current channel', value: 3 },
        )
    );

/**
* @param {ChatInputCommandInteraction} interaction
*/
export async function execute(interaction) {

    let notification_type = interaction.options.getInteger('notification_types');
    if (!notification_type) return;

    let user_entry = await userModel.findOne({ where: { discord_id: interaction.user.id } });

    if (!user_entry) {
        const errorEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('Error')
            .setDescription(`Couldn't find user database entry.`);

        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        return;
    }

    let new_channel = '';

    switch (notification_type) {
        case 1:
            await userModel.update({ notification_type: 1 }, { where: { discord_id: interaction.user.id } });
            new_channel = 'DMs';
            break;
        case 2:
            if (interaction.inGuild()) {
                await userModel.update({ notification_type: 2, guild_id: interaction.guild.id, channel_id: interaction.channel.id }, { where: { discord_id: interaction.user.id } });
                new_channel = `<#${interaction.channel.id}>`;
            }
            else {
                await userModel.update({ notification_type: 2 }, { where: { discord_id: interaction.user.id } });
                new_channel = `<#${user_entry.channel_id}>`;
            }
            break;
        case 3:
            if (interaction.inGuild()) {
                await userModel.update({ notification_type: 2, guild_id: interaction.guild.id, channel_id: interaction.channel.id }, { where: { discord_id: interaction.user.id } });
                new_channel = `<#${interaction.channel.id}>`;
            }
            else {
                await userModel.update({ notification_type: 1 }, { where: { discord_id: interaction.user.id } });
                new_channel = 'DMs';
            }
            break;
        default: break;
    }

    const successEmbed = new EmbedBuilder()
        .setColor(0xA4C400)
        .setTitle('Changed notification type')
        .setDescription(`The bot will now notify you in ${new_channel}`);

    await interaction.reply({ embeds: [successEmbed] });
}