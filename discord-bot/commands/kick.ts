import { Message, GuildMember, PermissionFlagsBits } from 'discord.js';
import { ServiceManager } from '../services/ServiceManager';

export const kickCommand = {
    name: 'kick',
    description: 'Kick a member from the server | طرد عضو من السيرفر',
    usage: '!kick @user [reason]',
    execute: async (message: Message, args: string[], services?: ServiceManager) => {
        if (!message.guild || !message.member) return;

        const languageService = services?.languageService || (global as any).languageService;
        const lang = languageService?.getServerLanguage(message.guild.id) || 'ar';

        // Check permissions
        if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) {
            const response = languageService?.getBilingual('no_permission', message.guild.id) ||
                'You don\'t have permission to kick members | ليس لديك صلاحية طرد الأعضاء';
            return message.reply(response);
        }

        // Get target member
        const target = message.mentions.members?.first();
        if (!target) {
            const response = languageService?.getBilingual('mention_user', message.guild.id) ||
                'Please mention a user to kick | يرجى الإشارة إلى العضو المراد طرده';
            return message.reply(response);
        }

        // Check if target is kickable
        if (!target.kickable) {
            const response = languageService?.getBilingual('cannot_kick', message.guild.id) ||
                'I cannot kick this user | لا يمكنني طرد هذا العضو';
            return message.reply(response);
        }

        // Get reason
        const reason = args.slice(1).join(' ') || 
            (lang === 'ar' ? 'لم يتم تحديد سبب' : 'No reason provided');

        try {
            await target.kick(reason);
            
            const response = languageService?.getBilingual('user_kicked', message.guild.id) ||
                `User has been kicked | تم طرد العضو\n` +
                `Reason | السبب: ${reason}`;
            await message.reply(response);

            // Log the kick
            const logChannel = message.guild.channels.cache.find(
                channel => channel.name === 'mod-logs'
            );

            if (logChannel?.isTextBased()) {
                const logMessage = lang === 'ar' ?
                    `تم طرد ${target.user.tag} بواسطة ${message.author.tag}\nالسبب: ${reason}` :
                    `${target.user.tag} was kicked by ${message.author.tag}\nReason: ${reason}`;
                await logChannel.send(logMessage);
            }

        } catch (error) {
            console.error('Error kicking user:', error);
            const response = languageService?.getBilingual('kick_error', message.guild.id) ||
                'Error kicking user | حدث خطأ أثناء طرد العضو';
            await message.reply(response);
        }
    }
};

export default kickCommand;
