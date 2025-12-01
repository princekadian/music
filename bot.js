const { Client, GatewayIntentBits } = require('discord.js');
const { DisTube } = require('distube');
const { YtDlpPlugin } = require('@distube/yt-dlp');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// Initialize DisTube
const distube = new DisTube(client, {
  emitNewSongOnly: true,
  leaveOnFinish: false,
  leaveOnStop: true,
  plugins: [new YtDlpPlugin()],
});

client.once('clientReady', () => {
  console.log(`Logged in as ${client.user.tag}!`);
  console.log(`Bot is ready and online!`);
});

// DisTube event listeners
distube.on('playSong', (queue, song) => {
  queue.textChannel.send(`🎶 Now playing: **${song.name}** - \`${song.formattedDuration}\``);
});

distube.on('addSong', (queue, song) => {
  queue.textChannel.send(`✅ Added to queue: **${song.name}** - \`${song.formattedDuration}\``);
});

distube.on('error', (channel, error) => {
  console.error('DisTube error:', error);
  channel.send('❌ An error occurred while playing music!');
});

distube.on('searchNoResult', (message, query) => {
  message.channel.send(`❌ No results found for: **${query}**`);
});

distube.on('finish', (queue) => {
  queue.textChannel.send('✅ Queue finished!');
});

// Message handler
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith('>')) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === 'play' || command === 'p') {
    if (!message.member.voice.channel) {
      return message.reply('❌ You need to be in a voice channel!');
    }

    if (!args.length) {
      return message.reply('❌ Please provide a song name or URL!');
    }

    const songQuery = args.join(' ');

    // Handle Spotify links
    if (songQuery.includes('spotify.com')) {
      return message.reply('❌ Spotify links are not supported. Please search by song name or use a YouTube link!');
    }

    try {
      await distube.play(message.member.voice.channel, songQuery, {
        member: message.member,
        textChannel: message.channel,
        message,
      });
    } catch (error) {
      console.error('Play error:', error);
      message.reply('❌ Error playing the song!');
    }
  }

  if (command === 'skip' || command === 's') {
    if (!message.member.voice.channel) {
      return message.reply('❌ You need to be in a voice channel!');
    }

    try {
      const queue = distube.getQueue(message);
      if (!queue) {
        return message.reply('❌ Nothing is playing!');
      }
      await distube.skip(message);
      message.reply('⏭️ Skipped!');
    } catch (error) {
      message.reply('❌ There is no song to skip!');
    }
  }

  if (command === 'stop') {
    if (!message.member.voice.channel) {
      return message.reply('❌ You need to be in a voice channel!');
    }

    try {
      const queue = distube.getQueue(message);
      if (!queue) {
        return message.reply('❌ Nothing is playing!');
      }
      await distube.stop(message);
      message.reply('⏹️ Stopped and disconnected!');
    } catch (error) {
      message.reply('❌ Nothing is playing!');
    }
  }

  if (command === 'queue' || command === 'q') {
    const queue = distube.getQueue(message);
    if (!queue) {
      return message.reply('📭 Queue is empty!');
    }

    const queueList = queue.songs.map((song, index) => 
      `${index === 0 ? '🎵 **Now Playing:**' : `${index}.`} ${song.name} - \`${song.formattedDuration}\``
    ).slice(0, 10).join('\n');

    message.reply(`**📃 Current Queue:**\n${queueList}${queue.songs.length > 10 ? `\n... and ${queue.songs.length - 10} more` : ''}`);
  }

  if (command === 'pause') {
    if (!message.member.voice.channel) {
      return message.reply('❌ You need to be in a voice channel!');
    }

    const queue = distube.getQueue(message);
    if (!queue) {
      return message.reply('❌ Nothing is playing!');
    }

    if (queue.paused) {
      distube.resume(message);
      message.reply('▶️ Resumed!');
    } else {
      distube.pause(message);
      message.reply('⏸️ Paused!');
    }
  }

  if (command === 'help' || command === 'h') {
    message.reply(
      `**🎵 Music Bot Commands:**
\`>play <song name or URL>\` or \`>p\` - Play a song
\`>skip\` or \`>s\` - Skip current song
\`>stop\` - Stop music and leave voice channel
\`>queue\` or \`>q\` - Show the current queue
\`>pause\` - Pause/Resume playback
\`>help\` or \`>h\` - Show this message`
    );
  }
});

// Health check server for hosting services
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot is running!');
});
server.listen(process.env.PORT || 8080, () => {
  console.log('Health check server running on port', process.env.PORT || 8080);
});

// Login to Discord
client.login(process.env.TOKEN);
