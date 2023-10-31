// Load banned users data from JSON file, or create an empty object if the file doesn't exist
let bannedUsersData = {};
try {
  const data = fs.readFileSync('bannedUsers.json', 'utf8');
  bannedUsersData = JSON.parse(data);
} catch (err) {
  console.error('Error reading or parsing bannedUsers.json:', err);
}

const pingCommand = "ping"; // Change this to your desired command name
const maxPingAttempts = 5; // Maximum number of allowed pings before temporary ban
const pingCooldownTime = 60 * 1000; // 60 seconds in milliseconds
const temporaryBanTime = 3600 * 1000; // 1 hour in milliseconds
const allowedChannelId = "1145799722800517233"; // Channel ID of allowed channel

// Create a Map to store user ping attempts and timestamps
const pingAttempts = new Map();

client.on("messageCreate", async (message) => {
  if (message.author.bot) {
    return; // Ignore messages from bots
  }

  // Check if the message was sent in the allowed channel
  if (message.channelId !== allowedChannelId && message.content.startsWith("!")) {
    return; // Ignore messages from other channels if they start with "!"
  }

  if (message.content.startsWith("!")) {
    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    //console.log("Received command:", command);

    if (command === pingCommand) {
      const userId = message.author.id;
      const now = Date.now();

      // Check if the user is banned
      if (bannedUsersData[userId] && now < bannedUsersData[userId].unbanAt) {
        // User is banned, prevent them from using the ping command
        return;
      }

      // Check if the user has exceeded the maximum ping attempts in the cooldown window
      const userPingAttempts = pingAttempts.get(userId) || [];

      // Remove previous ping attempts that are older than the cooldown time
      const currentTime = Date.now();
      const filteredPingAttempts = userPingAttempts.filter((timestamp) => currentTime - timestamp <= pingCooldownTime);

      if (filteredPingAttempts.length >= maxPingAttempts) {
        // User has exceeded the maximum attempts within the cooldown window, temporarily ban them
        pingAttempts.delete(userId);

        // Store the ban information in the JSON file
        bannedUsersData[userId] = {
          bannedAt: now,
          unbanAt: now + temporaryBanTime,
        };

        fs.writeFileSync('bannedUsers.json', JSON.stringify(bannedUsersData, null, 2));

        message.reply(`You are temporarily banned from using the ${pingCommand} command for 1 hour.`);

        setTimeout(() => {
          delete bannedUsersData[userId];
          fs.writeFileSync('bannedUsers.json', JSON.stringify(bannedUsersData, null, 2));
        }, temporaryBanTime);
      } else {
        // User hasn't exceeded the maximum attempts within the cooldown window, allow the ping
        pingAttempts.set(userId, [...filteredPingAttempts, now]);

        const pingMsg = await message.reply(`Pinging ${message.author}...`);
        const latency = pingMsg.createdTimestamp - message.createdTimestamp;
        pingMsg.edit(`Pong! ${message.author} Latency is ${latency}ms.`);
      }
    }
  }
});

// Check for and remove expired bans on bot startup
const now = Date.now();
for (const userId in bannedUsersData) {
  if (now >= bannedUsersData[userId].unbanAt) {
    delete bannedUsersData[userId];
  }
}
fs.writeFileSync('bannedUsers.json', JSON.stringify(bannedUsersData, null, 2));
