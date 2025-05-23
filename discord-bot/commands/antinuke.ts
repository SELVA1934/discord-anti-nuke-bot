import { Message, PermissionFlagsBits } from 'discord.js';
import { ServiceManager } from '../services/ServiceManager';

export const antinukeCommand = {
    name: 'antinuke',
    description: 'Configure anti-nuke protection | إعداد حماية السيرفر من التخريب',
    usage: '!antinuke [enable/disable] [threshold]',
    execute: async (message: Message, args: string[], services?: ServiceManager) => {
        if (!message.guild || !message.member) return;

        const languageService = services?.languageService || (global as any).languageService;
        const antiNuke = services?.antiNuke || (global as any).antiNuke;
        const lang = languageService?.getServerLanguage(message.guild.id) || 'ar';

        // Check permissions
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            const response = languageService?.getBilingual('no_permission', message.guild.id) ||
                'You need administrator permissions | تحتاج إلى صلاحيات المسؤول';
            return message.reply(response);
        }

        const action = args[0]?.toLowerCase();
        const threshold = parseInt(args[1]) || 3;

        if (!action || !['enable', 'disable', 'تفعيل', 'تعطيل'].includes(action)) {
            const status = antiNuke.isEnabled(message.guild.id);
            const currentThreshold = antiNuke.getThreshold(message.guild.id);
            
            const statusText = lang === 'ar' ?
                `الحالة: ${status ? 'مفعل' : 'معطل'}\nالحد الأقصى: ${currentThreshold}` :
                `Status: ${status ? 'Enabled' : 'Disabled'}\nThreshold: ${currentThreshold}`;

            const usageText = lang === 'ar' ?
                'الاستخدام: !antinuke [تفعيل/تعطيل] [الحد الأقصى]' :
                'Usage: !antinuke [enable/disable] [threshold]';

            return message.reply(`${statusText}\n\n${usageText}`);
        }

        const isEnable = ['enable', 'تفعيل'].includes(action);

        try {
            if (isEnable) {
                await antiNuke.enable(message.guild.id, threshold);
                const response = languageService?.getBilingual('antinuke_enabled', message.guild.id) ||
                    `Anti-nuke protection enabled | تم تفعيل حماية السيرفر\n` +
                    `Threshold | الحد الأقصى: ${threshold}`;
                await message.reply(response);
            } else {
                await antiNuke.disable(message.guild.id);
                const response = languageService?.getBilingual('antinuke_disabled', message.guild.id) ||
                    'Anti-nuke protection disabled | تم تعطيل حماية السيرفر';
                await message.reply(response);
            }

            // Log the change
            const logChannel = message.guild.channels.cache.find(
                channel => channel.name === 'mod-logs'
            );

            if (logChannel?.isTextBased()) {
                const logMessage = lang === 'ar' ?
                    `تم ${isEnable ? 'تفعيل' : 'تعطيل'} حماية السيرفر بواسطة ${message.author.tag}` :
                    `Anti-nuke protection ${isEnable ? 'enabled' : 'disabled'} by ${message.author.tag}`;
                await logChannel.send(logMessage);
            }

        } catch (error) {
            console.error('Error configuring anti-nuke:', error);
            const response = languageService?.getBilingual('antinuke_error', message.guild.id) ||
                'Error configuring anti-nuke protection | حدث خطأ في إعداد حماية السيرفر';
            await message.reply(response);
        }
    }
};

export default antinukeCommand;
