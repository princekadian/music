const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, StreamType } = require('@discordjs/voice');
const ytdl = require('@distube/ytdl-core');
const ytsr = require('ytsr');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const queue = new Map();

client.once('clientReady', () => {
  console.log(`Logged in as ${client.user.tag}!`);
  console.log(`Bot is ready and online!`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith('>')) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === 'play') {
    if (!message.member.voice.channel) {
      return message.reply('❌ You need to be in a voice channel!');
    }

    if (!args.length) {
      return message.reply('❌ Please provide a song name or URL!');
    }

    const songQuery = args.join(' ');
    await play_song(message, songQuery);
  }

  if (command === 'skip') {
    skip(message);
  }

  if (command === 'stop') {
    stop(message);
  }

  if (command === 'queue') {
    showQueue(message);
  }

  if (command === 'help') {
    message.reply(
      `**🎵 Music Bot Commands:**
\`>play <song name or URL>\` - Play a song
\`>skip\` - Skip current song
\`>stop\` - Stop music and leave voice channel
\`>queue\` - Show the current queue
\`>help\` - Show this message`
    );
  }
});

async function play_song(message, songQuery) {
  const voiceChannel = message.member.voice.channel;
  const serverQueue = queue.get(message.guild.id);

  let song;
  
  try {
    // Check if it's a URL or search query
    if (ytdl.validateURL(songQuery)) {
      const songInfo = await ytdl.getInfo(songQuery);
      song = {
        title: songInfo.videoDetails.title,
        url: songInfo.videoDetails.video_url,
        duration: songInfo.videoDetails.lengthSeconds,
      };
    } else {
      const searchResults = await ytsr(songQuery, { limit: 1 });
      if (!searchResults || !searchResults.items || searchResults.items.length === 0) {
        return message.reply('❌ No results found!');
      }
      const video = searchResults.items.find(item => item.type === 'video');
      if (!video) {
        return message.reply('❌ No results found!');
      }
      song = {
        title: video.title,
        url: video.url,
        duration: video.duration,
      };
    }
  } catch (error) {
    console.error(error);
    return message.reply('❌ Error finding the song!');
  }

  if (!serverQueue) {
    const queueConstructor = {
      voiceChannel: voiceChannel,
      textChannel: message.channel,
      connection: null,
      player: null,
      songs: [],
    };

    queue.set(message.guild.id, queueConstructor);
    queueConstructor.songs.push(song);

    try {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
      });

      queueConstructor.connection = connection;
      queueConstructor.player = createAudioPlayer();

      connection.subscribe(queueConstructor.player);

      playSong(message.guild, queueConstructor.songs[0]);
    } catch (error) {
      console.error(error);
      queue.delete(message.guild.id);
      return message.reply('❌ Error connecting to voice channel!');
    }
  } else {
    serverQueue.songs.push(song);
    return message.reply(`✅ **${song.title}** added to queue!`);
  }
}

async function playSong(guild, song) {
  const serverQueue = queue.get(guild.id);

  if (!song) {
    serverQueue.connection.destroy();
    queue.delete(guild.id);
    return;
  }

  try {
    const stream = ytdl(song.url, {
      filter: 'audioonly',
      quality: 'highestaudio',
      highWaterMark: 1 << 25,
      dlChunkSize: 0
    });

    const resource = createAudioResource(stream, {
      inputType: StreamType.Arbitrary
    });

    serverQueue.player.play(resource);

    serverQueue.player.on(AudioPlayerStatus.Idle, () => {
      serverQueue.songs.shift();
      playSong(guild, serverQueue.songs[0]);
    });

    serverQueue.player.on('error', error => {
      console.error('Player error:', error);
      serverQueue.songs.shift();
      playSong(guild, serverQueue.songs[0]);
    });

    serverQueue.textChannel.send(`🎶 Now playing: **${song.title}**`);
  } catch (error) {
    console.error('Stream error:', error);
    serverQueue.textChannel.send('❌ Error playing the song!');
    serverQueue.songs.shift();
    playSong(guild, serverQueue.songs[0]);
  }
}

function skip(message) {
  const serverQueue = queue.get(message.guild.id);
  if (!message.member.voice.channel) {
    return message.reply('❌ You need to be in a voice channel!');
  }
  if (!serverQueue) {
    return message.reply('❌ Nothing is playing!');
  }
  serverQueue.player.stop();
  message.reply('⏭️ Skipped!');
}

function stop(message) {
  const serverQueue = queue.get(message.guild.id);
  if (!message.member.voice.channel) {
    return message.reply('❌ You need to be in a voice channel!');
  }
  if (!serverQueue) {
    return message.reply('❌ Nothing is playing!');
  }
  serverQueue.songs = [];
  serverQueue.player.stop();
  serverQueue.connection.destroy();
  queue.delete(message.guild.id);
  message.reply('⏹️ Stopped and disconnected!');
}

function showQueue(message) {
  const serverQueue = queue.get(message.guild.id);
  if (!serverQueue || serverQueue.songs.length === 0) {
    return message.reply('📭 Queue is empty!');
  }
  
  let queueMessage = '**📃 Current Queue:**\n';
  serverQueue.songs.forEach((song, index) => {
    queueMessage += `${index + 1}. ${song.title}\n`;
  });
  
  message.reply(queueMessage);
}

// Health check server for Render
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
