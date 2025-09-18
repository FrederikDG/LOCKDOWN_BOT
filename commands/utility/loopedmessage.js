const cron = require("node-cron");

/**
 * @param {Client}
 */
function setupLoopedMessages(client) {
  const schedule = [
    {
      time: "0 19 * * 7", // Sunday 19:00
      message: "Vergeet niet de vuilniszakken naar de kelder te brengen en de drankvoorraad door te geven!",
      channelId: "1293671348379582525", // stapelplein
    },
    {
      time: "0 19 * * 7", // Sunday 19:00
      message: "Vergeet niet de vuilniszakken buiten te zetten en de drankvoorraad door te geven!",
      channelId: "1293671224811065406", // dok noord
    },
    {
      time: "0 19 * * 7", // Sunday 19:00
      message: "Vergeet niet de drankvoorraad door te geven en de bakken buiten te zetten!",
      channelId: "1293671435839082506", // kortrijk
    },
    {
      time: "0 19 * * 3", // Wednesday 19:00
      message: "Vergeet niet de vuilniszakken buiten te zetten!",
      channelId: "1293671435839082506", // kortrijk
    },
    {
      time: "0 12 * * 1", // Monday 12:00
      message: "Vergeet de contracten niet te bevestigen!",
      channelId: "1411060234235019400", // vaste medewerkers
    },
    {
      time: "0 09 * * 5", // Friday 09:00
      message: "Vergeet de feedbackformulieren niet te sturen naar de klanten!",
      channelId: "1411060234235019400", // vaste medewerkers
    },
  ];

  schedule.forEach(({ time, message, channelId }) => {
    cron.schedule(time, () => {
      const channel = client.channels.cache.get(channelId);
      if (channel) {
        channel.send(message);
        console.log(`Sent scheduled message to channel ${channelId}`);
      } else {
        console.error(`Channel with ID ${channelId} not found.`);
      }
    });
  });
}

module.exports = { setupLoopedMessages };
