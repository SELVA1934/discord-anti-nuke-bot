import { Message, GuildMember, PermissionFlagsBits } from 'discord.js';
import { ServiceManager } from '../services/ServiceManager';

export const banCommand = {
    name: 'ban',
    description: 'Ban a member from the server | حظر عضو من السيرفر',
    usage: '!ban @user [reason]',
    execute: async (message: Message, args: string[], services?: ServiceManager) => {
        if (!message.guild || !message.member) return;

        const languageService = services?.languageService || (global as any).languageService;
        const lang = languageService?.getServerLanguage(message.guild.id) || 'ar';

        // Check permissions
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            const response = languageService?.getBilingual('no_permission', message.guild.id) ||
                'You don\'t have permission to ban members | ليس لديك صلاحية حظر الأعضاء';
            return message.reply(response);
        }

        // Get target member
        const target = message.mentions.members?.first();
        if (!target) {
            const response = languageService?.getBilingual('mention_user', message.guild.id) ||
                'Please mention a user to ban | يرجى الإشارة إلى العضو المراد حظره';
            return message.reply(response);
        }

        // Check if target is bannable
        if (!target.bannable) {
            const response = languageService?.getBilingual('cannot_ban', message.guild.id) ||
                'I cannot ban this user | لا يمكنني حظر هذا العضو';
            return message.reply(response);
        }

        // Get reason
        const reason = args.slice(1).join(' ') || 
            (lang === 'ar' ? 'لم يتم تحديد سبب' : 'No reason provided');

        try {
            await target.ban({ reason });
            
            const response = languageService?.getBilingual('user_banned', message.guild.id) ||
                `User has been banned | تم حظر العضو\n` +
                `Reason | السبب: ${reason}`;
            await message.reply(response);

            // Log the ban
            const logChannel = message.guild.channels.cache.find(
                channel => channel.name === 'mod-logs'
            );

            if (logChannel?.isTextBased()) {
                const logMessage = lang === 'ar' ?
                    `تم حظر ${target.user.tag} بواسطة ${message.author.tag}\nالسبب: ${reason}` :
                    `${target.user.tag} was banned by ${message.author.tag}\nReason: ${reason}`;
                await logChannel.send(logMessage);
            }

        } catch (error) {
            console.error('Error banning user:', error);
            const response = languageService?.getBilingual('ban_error', message.guild.id) ||
                'Error banning user | حدث خطأ أثناء حظر العضو';
            await message.reply(response);
        }
    }
};

export default banCommand;
