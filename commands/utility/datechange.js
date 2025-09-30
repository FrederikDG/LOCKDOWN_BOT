const { SlashCommandBuilder } = require("discord.js");
require("dotenv").config();
const { google } = require("googleapis");

const calendarIds = {
  AV: process.env.CALENDAR_ID_AV,
  RR: process.env.CALENDAR_ID_RR,
  SZ: process.env.CALENDAR_ID_SZ,
  GY: process.env.CALENDAR_ID_GY,
  R7: process.env.CALENDAR_ID_R7,
  RA: process.env.CALENDAR_ID_RA,
  PT: process.env.CALENDAR_ID_PT,
  FI: process.env.CALENDAR_ID_FI,
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("shift")
    .setDescription("Allows you to specify a shift request.")
    .addStringOption((option) => option.setName("date").setDescription("Enter the date in DD/MM/YYYY format").setRequired(true))
    .addStringOption((option) => option.setName("room").setDescription("Enter the room name (AV, RR, SZ, GY, R7, RA, PT, FI)").setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true }); // Set ephemeral to true for private message

    const date = interaction.options.getString("date");
    const room = interaction.options.getString("room");

    const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!dateRegex.test(date)) {
      return interaction.editReply("Please provide a valid date in the format DD/MM/YYYY.");
    }

    const [day, month, year] = date.split("/").map((part) => parseInt(part, 10));
    const inputDate = new Date(year, month - 1, day);
    const currentDate = new Date();

    currentDate.setHours(0, 0, 0, 0);

    if (inputDate < currentDate) {
      return interaction.editReply("The shift date must be today or in the future.");
    }

    const validRooms = ["AV", "RR", "SZ", "GY", "R7", "RA", "PT", "FI"];
    if (!validRooms.includes(room)) {
      return interaction.editReply("Please provide a valid room name (AV, RR, SZ, GY, R7, RA, PT, FI).");
    }

    try {
      const events = await getCalendarEvents(room, inputDate);
      if (events.length > 0) {
        const rows = [];
        events.forEach((event, index) => {
          const button = {
            type: 2, // Type for a button
            style: 1, // Primary button (blue)
            label: event.summary,
            customId: `event_${room}_${date}_${index}`, // Unique ID for the button
          };

          if (index % 5 === 0) rows.push({ type: 1, components: [] });
          rows[rows.length - 1].components.push(button);
        });

        await interaction.editReply({
          content: `Events for ${room} on ${date}:`,
          components: rows,
        });
      } else {
        await interaction.editReply(`No events found for ${room} on ${date}.`);
      }
    } catch (error) {
      console.error("Error fetching calendar events:", error);
      await interaction.editReply("There was an error fetching events for the specified room and date.");
    }
  },
  // Modify the handleButtonInteraction function

  async handleButtonInteraction(interaction) {
    if (interaction.isButton()) {
      const [action, room, date, index] = interaction.customId.split("_");

      if (action === "event") {
        const publicMessage = `Someone is asking for a shift replacement for ${room} on ${date}.`;

        const acceptButton = {
          type: 2,
          style: 3, // Green button
          label: "Accept",
          customId: `accept_${room}_${date}_${index}_${interaction.user.id}`, // Store original requester ID
        };

        const row = {
          type: 1,
          components: [acceptButton],
        };

        const channel = interaction.channel;

        try {
          if (channel) {
            await channel.send({
              content: publicMessage,
              components: [row],
            });

            await interaction.update({
              content: "Your shift request has been submitted.",
              components: [],
            });
          } else {
            await interaction.reply({
              content: "Could not send the message to the current channel.",
              ephemeral: true,
            });
          }
        } catch (error) {
          console.error("Error sending or updating messages:", error);
          await interaction.reply({
            content: "There was an error processing your request.",
            ephemeral: true,
          });
        }
      } else if (action === "accept") {
        const user = interaction.member;
        const nickname = interaction.member?.displayName || interaction.user.globalName || interaction.user.username;
        const requesterId = interaction.customId.split("_")[4]; // Extract requester ID

        try {
          const events = await getCalendarEvents(room, new Date(date.split("/").reverse().join("-")));
          const event = events[index];

          if (!event) {
            return interaction.reply({
              content: "The event could not be found or has been modified.",
              ephemeral: true,
            });
          }

          const summary = event.summary;
          const timeMatch = summary.match(/\(.*?\)/); // Capture anything inside parentheses

          const namePattern = /^[^\(]+/;
          let newSummary = summary.replace(namePattern, nickname);

          if (timeMatch) {
            newSummary = nickname + " " + timeMatch[0];
          }
          await updateCalendarEvent(room, event.id, newSummary);

          console.log(`User ${nickname} accepted the shift replacement for ${room} on ${date}.`);

          await interaction.update({
            content: "Shift replacement request has been accepted and updated in the calendar!",
            components: [],
          });

          // Notify the original requester via DM
          const requester = await interaction.client.users.fetch(requesterId);
          if (requester) {
            await requester.send(`Your shift on ${date} for ${room} has been taken by ${nickname}.`);
          }

          // Delete original message
          const message = await interaction.channel.messages.fetch(interaction.message.id);
          if (message) {
            try {
              await message.delete();
            } catch (err) {
              console.error("Error deleting original message:", err);
            }
          }
        } catch (error) {
          console.error("Error updating calendar event:", error);
          await interaction.reply({
            content: "There was an error updating the calendar event. Please try again.",
            ephemeral: true,
          });
        }
      }
    }
  },
};

async function getCalendarEvents(room, date) {
  const calendarId = calendarIds[room];

  if (!calendarId) {
    throw new Error("Invalid room ID.");
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    },
    projectId: process.env.GOOGLE_PROJECT_ID,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });

  const calendar = google.calendar({ version: "v3", auth });

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const res = await calendar.events.list({
    calendarId: calendarId,
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
  });

  return res.data.items || [];
}

async function updateCalendarEvent(room, eventId, newSummary) {
  const calendarId = calendarIds[room];

  if (!calendarId) {
    throw new Error("Invalid room ID.");
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    },
    projectId: process.env.GOOGLE_PROJECT_ID,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });

  const calendar = google.calendar({ version: "v3", auth });

  await calendar.events.patch({
    calendarId: calendarId,
    eventId: eventId,
    requestBody: {
      summary: newSummary,
    },
  });
}