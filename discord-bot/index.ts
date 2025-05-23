import { Client, GatewayIntentBits } from 'discord.js';
import { ServiceManager } from './services/ServiceManager';
import { handleCommand } from './commands';
import { BotConfig } from './config/config';

declare global {
  var discordClient: Client | undefined;
  var antiNuke: any;
  var autoMod: any;
  var roleManager: any;
  var userAnalytics: any;
  var customCommands: any;
  var multiServer: any;
  var wsService: any;
}

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildBans,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages
  ]
});

// Initialize service manager with all services
const services = new ServiceManager(client);

// When the client is ready, run this code (only once)
client.once('ready', () => {
  console.log(`Logged in as ${client.user?.tag}!`);
  console.log('All protection systems initialized!');
  console.log('WebSocket server running on port 8080');
  
  // Set bot status
  client.user?.setPresence({
    activities: [{ name: 'Protecting Discord Servers' }],
    status: 'online',
  });

  // Broadcast ready status
  services.wsService.broadcast('botStatus', { status: 'online' });
});

// Handle incoming messages
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  // Check custom commands first
  const prefix = services.multiServer.getServerPrefix(message.guild?.id || '');
  if (message.content.startsWith(prefix)) {
    const customCommand = await services.customCommands.getCommand(
      message.guild?.id || '',
      message.content.slice(prefix.length).split(' ')[0]
    );
    if (customCommand) return;
  }

  // Handle built-in commands
  await handleCommand(message);
});

// Error handling
client.on('error', error => {
  console.error('Discord client error:', error);
  services.wsService.broadcast('error', { message: 'Discord client error occurred' });
});

process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
  services.wsService.broadcast('error', { message: 'Unhandled promise rejection occurred' });
});

// Login to Discord
client.login(BotConfig.token).catch(error => {
  console.error('Failed to login:', error);
  process.exit(1);
});

// Handle graceful shutdown
const shutdown = () => {
  console.log('Shutting down...');
  services.wsService.broadcast('botStatus', { status: 'offline' });
  services.cleanup();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Export services for use in API routes
export { client, services };
