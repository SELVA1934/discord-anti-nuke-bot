import { Collection, Message } from 'discord.js';
import { BotConfig } from '../config/config';

// Import commands
import ban from './ban';
import kick from './kick';
import mute from './mute';
import help from './help';
import { languageCommand as language } from './language';

// Command interface
interface Command {
  name: string;
  description: string;
  execute: (message: Message, args: string[]) => Promise<unknown> | unknown;
}

// Create commands collection
const commands = new Collection<string, Command>();

// Register commands
commands.set('ban', ban);
commands.set('kick', kick);
commands.set('mute', mute);
commands.set('help', help);
commands.set('language', language);

// Command handler function
export const handleCommand = async (message: Message) => {
  const prefix = BotConfig.commands.prefix;

  if (!message.content.startsWith(prefix) || message.author.bot) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const commandName = args.shift()?.toLowerCase();

  if (!commandName) return;

  // Check if command exists
  const command = commands.get(commandName);
  if (!command) {
    const serverId = message.guild?.id;
    const response = serverId ? 
      (global as any).languageService.getBilingual('unknown_command', serverId) :
      'Unknown command. Use !help to see available commands. | أمر غير معروف. استخدم !help لرؤية الأوامر المتاحة';
    return message.reply(response);
  }

  try {
    // Execute command
    await command.execute(message, args);
  } catch (error) {
    console.error('Error executing command:', error);
    const serverId = message.guild?.id;
    const response = serverId ? 
      (global as any).languageService.getBilingual('command_error', serverId) :
      'There was an error executing that command. | حدث خطأ أثناء تنفيذ هذا الأمر';
    message.reply(response);
  }
};

// Export commands for use in help command
export const getCommands = () => commands;
