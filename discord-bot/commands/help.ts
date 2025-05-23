import { Message, EmbedBuilder } from 'discord.js';
import { ServiceManager } from '../services/ServiceManager';
import { getCommands } from './index';

export const helpCommand = {
    name: 'help',
    description: 'Show available commands | عرض الأوامر المتاحة',
    usage: '!help [command]',
    execute: async (message: Message, args: string[], services?: ServiceManager) => {
        if (!message.guild) return;

        const languageService = services?.languageService || (global as any).languageService;
        const commands = getCommands();
        const lang = languageService?.getServerLanguage(message.guild.id) || 'ar';

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(languageService?.getBilingual('help_title', message.guild.id) || 'Help | المساعدة');

        if (args.length) {
            // Show help for specific command
            const commandName = args[0].toLowerCase();
            const command = commands.get(commandName);

            if (!command) {
                const response = languageService?.getBilingual('command_not_found', message.guild.id) || 
                    'Command not found | الأمر غير موجود';
                return message.reply(response);
            }

            embed.setDescription(command.description)
                .addFields([
                    { 
                        name: languageService?.getBilingual('usage', message.guild.id) || 'Usage | الاستخدام',
                        value: command.usage || commandName
                    }
                ]);
        } else {
            // Show all commands
            const commandsList = Array.from(commands.values()).map(cmd => {
                return {
                    name: cmd.name,
                    value: cmd.description
                };
            });

            embed.setDescription(
                languageService?.getBilingual('available_commands', message.guild.id) || 
                'Available Commands | الأوامر المتاحة'
            )
            .addFields(commandsList);
        }

        embed.setFooter({
            text: languageService?.getText('help_footer', message.guild.id) || 
                (lang === 'ar' ? 'استخدم !help [الأمر] لمزيد من المعلومات' : 'Use !help [command] for more info')
        });

        await message.reply({ embeds: [embed] });
    }
};

export default helpCommand;
