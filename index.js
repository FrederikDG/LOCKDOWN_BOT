const { Client, Events, GatewayIntentBits } = require("discord.js");

require("dotenv").config();

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");
const path = require("path");
const fs = require("fs");
const { setupLoopedMessages } = require("./commands/utility/loopedmessage");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = [];
const commandFiles = fs.readdirSync(path.join(__dirname, "commands")).flatMap((folder) =>
  fs
    .readdirSync(path.join(__dirname, "commands", folder))
    .filter((file) => file.endsWith(".js"))
    .map((file) => require(`./commands/${folder}/${file}`))
);

commandFiles.forEach((command) => {
  if (command.data) {
    commands.push(command.data.toJSON());
  }
});

const registerCommands = async () => {
  const rest = new REST({ version: "9" }).setToken(token);

  try {
    console.log("Started refreshing application (/) commands.");
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error("Error registering commands:", error);
  }
};

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
  await registerCommands();
  setupLoopedMessages(readyClient);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isCommand()) {
    const command = commandFiles.find((cmd) => cmd.data.name === interaction.commandName);

    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error("Error executing command:", error);
      await interaction.reply({ content: "There was an error while executing this command!", ephemeral: true });
    }
  } else if (interaction.isButton()) {

    const command = commandFiles.find((cmd) => typeof cmd.handleButtonInteraction === "function");
    if (command) {
      try {
        await command.handleButtonInteraction(interaction);
      } catch (error) {
        console.error("Error handling button interaction:", error);
        await interaction.reply({ content: "There was an error while processing this interaction.", ephemeral: true });
      }
    }
  }
});


client.login(token);

