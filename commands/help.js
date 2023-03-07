import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('help')
    .setDescription('Info about the bot and all commands');

/**
* @param {ChatInputCommandInteraction} interaction
*/
export async function execute(interaction) {

    // print info about commands and the bot itself
    const helpEmbed = new EmbedBuilder()
        .setColor(0xF0A30A)
        .setTitle('Info & Commands')
        .setDescription(`\
            This bot can be used for automated notifications about different kinds of bans or ban lifts on Steam profiles.\
            \nYou can check out the source code of the bot on [GitHub](http://github.com/Moyomo/DiscordVacBot)\
            \n\
            \nEvery command that requires the __**steamID**__ parameter will accept the following values:\
            \n- Steam64 ID\
            \n- Steam profile link (/profile/ or /id/ links)\
            \n- vanity URL (custom profile URL)\
            \n- watchlist ID (entry number in /list command) [__doesn't work for **/add** command__]\
            \n\
            \n__All available commands:__\
            \n**/add <steamID> [notes] [ban types]**\
            \n\`Adds a Steam profile to your personal watchlist\`\
            \n\
            \n**/edit <steamID> [notes] [banTypes]**\
            \n\`Edits a suspect entry on your watchlist\`\
            \n\
            \n**/remove <steamID>**\
            \n\`Removes a suspect entry from your watchlist\`\
            \n\
            \n**/list**\
            \n\`Lists all suspect entries on your watchlist\`\
            \n\
            \n**/suspect <steamID>**\
            \n\`Shows ban status and general info about a specific Steam user. If they're on your watchlist it will also show info about your suspect entry\`\
            \n\
            \n**/notify <notification type>**\
            \n\`Changes the channel in which the bot will notify you about bans and ban lifts\`\
            \n\
            \n**/help**\
            \n\`Shows this message\`
        `);

    await interaction.reply({ embeds: [helpEmbed] });
}