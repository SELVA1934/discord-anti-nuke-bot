import { Message } from 'discord.js';
import { ServiceManager } from '../services/ServiceManager';

export const languageCommand = {
    name: 'language',
    description: 'Set the bot language for this server (Arabic/English) | تعيين لغة البوت لهذا السيرفر (عربي/إنجليزي)',
    usage: '!language [ar/en]',
    execute: async (message: Message, args: string[], services?: ServiceManager) => {
        if (!message.guild) return;

        // Get languageService from global if not provided through services
        const languageService = services?.languageService || (global as any).languageService;
        if (!languageService) {
            await message.reply('Language service not available | خدمة اللغة غير متوفرة');
            return;
        }

        const language = args[0]?.toLowerCase();
        if (!language || !['ar', 'en'].includes(language)) {
            const currentLang = languageService.getServerLanguage(message.guild.id);
            await message.reply(
                `Current language | اللغة الحالية: ${currentLang}\n` +
                `Usage | الاستخدام: !language [ar/en]`
            );
            return;
        }

        try {
            languageService.setServerLanguage(message.guild.id, language as 'ar' | 'en');
            const successMessage = language === 'ar' 
                ? 'تم تغيير لغة البوت إلى العربية'
                : 'Bot language changed to English';
            await message.reply(`✅ ${successMessage}`);
        } catch (error) {
            console.error('Error setting language:', error);
            await message.reply('Error setting language | خطأ في تعيين اللغة');
        }
    }
};

export default languageCommand;
