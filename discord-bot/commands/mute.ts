import { Message, GuildMember, PermissionFlagsBits } from 'discord.js';
import { ServiceManager } from '../services/ServiceManager';

export const muteCommand = {
    name: 'mute',
    description: 'Mute a member in the server | كتم صوت عضو في السيرفر',
    usage: '!mute @user [duration] [reason]',
    execute: async (message: Message, args: string[], services?: ServiceManager) => {
        if (!message.guild || !message.member) return;

        const languageService = services?.languageService || (global as any).languageService;
        const lang = languageService?.getServerLanguage(message.guild.id) || 'ar';

        // Check permissions
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            const response = languageService?.getBilingual('no_permission', message.guild.id) ||
                'You don\'t have permission to mute members | ليس لديك صلاحية كتم الأعضاء';
            return message.reply(response);
        }

        // Get target member
        const target = message.mentions.members?.first();
        if (!target) {
            const response = languageService?.getBilingual('mention_user', message.guild.id) ||
                'Please mention a user to mute | يرجى الإشارة إلى العضو المراد كتمه';
            return message.reply(response);
        }

        // Check if target is mutable
        if (!target.moderatable) {
            const response = languageService?.getBilingual('cannot_mute', message.guild.id) ||
                'I cannot mute this user | لا يمكنني كتم هذا العضو';
            return message.reply(response);
        }

        // Parse duration (in minutes)
        const duration = parseInt(args[1]) || 60; // Default 60 minutes
        if (duration < 1 || duration > 40320) { // Max 28 days
            const response = languageService?.getBilingual('invalid_duration', message.guild.id) ||
                'Duration must be between 1 minute and 28 days | المدة يجب أن تكون بين دقيقة و28 يوم';
            return message.reply(response);
        }

        // Get reason
        const reason = args.slice(2).join(' ') || 
            (lang === 'ar' ? 'لم يتم تحديد سبب' : 'No reason provided');

        try {
            await target.timeout(duration * 60 * 1000, reason);
            
            const durationText = lang === 'ar' ?
                `${duration} دقيقة` :
                `${duration} minutes`;

            const response = languageService?.getBilingual('user_muted', message.guild.id) ||
                `User has been muted | تم كتم العضو\n` +
                `Duration | المدة: ${durationText}\n` +
                `Reason | السبب: ${reason}`;
            await message.reply(response);

            // Log the mute
            const logChannel = message.guild.channels.cache.find(
                channel => channel.name === 'mod-logs'
            );

            if (logChannel?.isTextBased()) {
                const logMessage = lang === 'ar' ?
                    `تم كتم ${target.user.tag} بواسطة ${message.author.tag}\nالمدة: ${durationText}\nالسبب: ${reason}` :
                    `${target.user.tag} was muted by ${message.author.tag}\nDuration: ${durationText}\nReason: ${reason}`;
                await logChannel.send(logMessage);
            }

            // Set up unmute timer
            setTimeout(async () => {
                try {
                    if (target.isCommunicationDisabled()) {
                        await target.timeout(null);
                        if (logChannel?.isTextBased()) {
                            const unmutedMessage = lang === 'ar' ?
                                `تم إلغاء كتم ${target.user.tag} تلقائياً` :
                                `${target.user.tag} has been automatically unmuted`;
                            await logChannel.send(unmutedMessage);
                        }
                    }
                } catch (error) {
                    console.error('Error unmuting user:', error);
                }
            }, duration * 60 * 1000);

        } catch (error) {
            console.error('Error muting user:', error);
            const response = languageService?.getBilingual('mute_error', message.guild.id) ||
                'Error muting user | حدث خطأ أثناء كتم العضو';
            await message.reply(response);
        }
    }
};

export default muteCommand;
