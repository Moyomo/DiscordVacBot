import { Collection, EmbedBuilder, REST, Routes } from 'discord.js';
import { readdirSync, readFileSync } from 'fs';
import { client } from './client.js';
import { checkForBans } from './functions/checkForBans.js';
import { checkUser } from './functions/checkUser.js';
import { suspectModel, suspect_to_userModel, userModel } from './functions/database.js';
import { debug, error, highlight, info } from './functions/logger.js';
// button functions
import { entryDetails } from './buttons/entryDetails.js';
import { listFirst } from './buttons/listFirst.js';
import { listLast } from './buttons/listLast.js';
import { listNext } from './buttons/listNext.js';
import { listPrevious } from './buttons/listPrevious.js';
import { removeEntry } from './buttons/removeEntry.js';
const config = JSON.parse(readFileSync('./config.json', 'utf-8'));

// retrieve command files
client.commands = new Collection();
const commandFiles = readdirSync("./commands").filter(file => file.endsWith('.js'));
const rest = new REST({ version: '10' }).setToken(config.token);

for (const file of commandFiles) {
    const filePath = './commands/' + file;
    const command = await import(filePath);

    client.commands.set(command.data.name, command);
}

// bot initialization
client.once('ready', async () => {

    // sync database models
    // NOTE:
    // Use { alter: true } inside the brackets to sync newly added columns
    // Use { force: true } inside the brackets to reset the table and create a new one
    await suspectModel.sync();
    await userModel.sync();
    await suspect_to_userModel.sync();

    highlight(`Logged in as ${client.user.tag}`);

    const commands = [];
    for (const file of commandFiles) {
        const command = await import(`./commands/${file}`);
        commands.push(command.data.toJSON());
    }

    // reset registered commands for client
    // client.application.commands.set([]);

    // globally register commands
    try {
        info(`Started refreshing ${commands.length} slash commands.`);

        const global = await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );

        info(`Successfully reloaded ${global.length} global slash commands.`);
    }
    catch (err) {
        error(err);
    }

    // check for bans
    info(`Checking for bans...`);
    checkForBans();
    setInterval(() => {
        info(`Checking for bans...`);
        checkForBans();
    }, 3600000); // checking every hour
});

// interactions
client.on('interactionCreate', async interaction => {

    // check user
    await checkUser(interaction);

    // command interaction
    if (interaction.isChatInputCommand()) {
        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) return;

        info(`User ${interaction.user.tag} (${interaction.user.id}) used command "/${interaction.commandName}"`);

        try {
            await command.execute(interaction);
        }
        catch (err) {
            error(err);

            // send error message
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setDescription(`Error while executing command!`);

            if (interaction.deferred) await interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
            else await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
    // button interaction
    else if (interaction.isButton()) {

        info(`User ${interaction.user.tag} (${interaction.user.id}) pressed button "${interaction.customId}"`);

        switch (interaction.customId) {
            // remove watchlist entry button
            case interaction.customId.startsWith('remove_') ? interaction.customId : '': removeEntry(interaction); break;
            // watchlist entry details button
            case interaction.customId.startsWith('details_') ? interaction.customId : '': entryDetails(interaction); break;
            // list command navigation buttons
            case interaction.customId.startsWith('first_') ? interaction.customId : '': listFirst(interaction); break;
            case interaction.customId.startsWith('previous_') ? interaction.customId : '': listPrevious(interaction); break;
            case interaction.customId.startsWith('next_') ? interaction.customId : '': listNext(interaction); break;
            case interaction.customId.startsWith('last_') ? interaction.customId : '': listLast(interaction); break;
            default: break;
        }
    }
});

// Login with token
client.login(config.token);