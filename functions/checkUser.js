import { ButtonInteraction, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { userModel } from './../functions/database.js';
import { debug, highlight } from './logger.js';

const welcomeEmbed = new EmbedBuilder()
    .setTitle('Welcome!')
    .setDescription(`\
        Hey :wave:\
        \nIt looks like you're a new user!\
        \nThis bot can be used for automated notifications about different kinds of bans or ban lifts on Steam profiles.\
        \nUse the **/help** command to see additional info and all available commands.
    `)
    .setColor(0x0099FF);

/**
* Checks if the given user already exists in the database.
*
* @param {ChatInputCommandInteraction | ButtonInteraction} interaction - The Discord interaction that triggered the check.
*/
export async function checkUser(interaction) {
    const user_entry = await userModel.findOne({ where: { discord_id: interaction.user.id } });

    if (user_entry) {
        if (interaction.inGuild() && user_entry.guild_id == null) {
            const affectedRows = await userModel.update({ guild_id: interaction.guild.id, channel_id: interaction.channel.id }, { where: { discord_id: interaction.user.id } });
            if (affectedRows > 0) {
                highlight(`updated database entry of user ${interaction.user.id}`);
            }
        }
        return;
    }
    else {

        let notificationType = 1;

        // check if interaction was in DMs
        if (!interaction.inGuild()) {
            interaction.user.send({ embeds: [welcomeEmbed] });
        }
        else {
            // try to dm user
            await interaction.user.send({ embeds: [welcomeEmbed] })
                .catch(async () => {
                    // if dm fails, let them know that they'll be notified here and that they can use the /notify command
                    const welcomeEmbedClosedDMs = new EmbedBuilder()
                        .setDescription(`\
                            Hey ${interaction.user.username} :wave:\
                            \nIt looks like this is your first time using this bot!\
                            \nUnfortunately your DMs are closed, so I can't directly notify you.\
                            \nIn the case that someone gets banned, I will send a message in this channel and ping you.\
                            \n\
                            \nIf you want to change the notification type, use the command **/notify**.\
                            \nTo see all available commands and some more info about the bot, use the command **/help**.
                        `)
                        .setColor(0x0099FF);

                    await interaction.channel.send({ content: `${interaction.user}`, embeds: [welcomeEmbedClosedDMs] });

                    notificationType = 2;
                });
        }

        // -> either way, create a DB entry for the user and save guild & channel
        await userModel.create({
            discord_id: interaction.user.id,
            notification_type: notificationType,
            guild_id: interaction.guildId,
            channel_id: interaction.channelId
        });
        highlight(`created new db entry for user ${interaction.user.tag} (${interaction.user.id})`);
    }
}