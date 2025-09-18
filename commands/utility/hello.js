const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("hello")
    .setDescription("Sends a personalized hello message to the user."),
  async execute(interaction) {
    // Retrieve the user's nickname or username
    const user = interaction.member;
    const nickname = user.nickname || user.user.username;

    // Reply with the personalized hello message
    await interaction.reply(`Ahoy, ${nickname}!`);
  },
};
