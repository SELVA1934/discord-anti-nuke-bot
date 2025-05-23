import { Client } from 'discord.js';
import { EventEmitter } from 'events';

interface TranslationMap {
    [key: string]: {
        ar: string;
        en: string;
    };
}

export class LanguageService extends EventEmitter {
    private translations: TranslationMap = {
        // System Messages
        'error': {
            ar: 'حدث خطأ',
            en: 'An error occurred'
        },
        'success': {
            ar: 'تم بنجاح',
            en: 'Success'
        },
        'unknown_command': {
            ar: 'أمر غير معروف. استخدم !help لرؤية الأوامر المتاحة',
            en: 'Unknown command. Use !help to see available commands'
        },
        'command_error': {
            ar: 'حدث خطأ أثناء تنفيذ الأمر',
            en: 'There was an error executing the command'
        },
        'current_language': {
            ar: 'اللغة الحالية',
            en: 'Current language'
        },
        'language_updated': {
            ar: 'تم تحديث اللغة',
            en: 'Language updated'
        },

        // Game Messages
        'not_enough_coins': {
            ar: 'لا تملك عملات كافية',
            en: 'Not enough coins'
        },
        'invalid_bet': {
            ar: 'رهان غير صالح',
            en: 'Invalid bet'
        },
        'bet_range': {
            ar: 'يجب أن يكون الرهان بين {min} و {max}',
            en: 'Bet must be between {min} and {max}'
        },
        'game_over': {
            ar: 'انتهت اللعبة',
            en: 'Game Over'
        },
        'you_won': {
            ar: 'لقد فزت',
            en: 'You won'
        },
        'you_lost': {
            ar: 'لقد خسرت',
            en: 'You lost'
        },
        'time_up': {
            ar: 'انتهى الوقت',
            en: 'Time\'s up'
        },

        // Game Names
        'sirah_quiz': {
            ar: 'مسابقة السيرة',
            en: 'Sirah Quiz'
        },
        'guess_game': {
            ar: 'لعبة التخمين',
            en: 'Guessing Game'
        },
        'caravan_journey': {
            ar: 'رحلة القافلة',
            en: 'Caravan Journey'
        },
        'bazaar': {
            ar: 'السوق',
            en: 'Bazaar'
        },

        // Game Instructions
        'guess_prompt': {
            ar: 'خمن رقماً بين 1 و 100',
            en: 'Guess a number between 1 and 100'
        },
        'higher': {
            ar: 'أعلى',
            en: 'Higher'
        },
        'lower': {
            ar: 'أقل',
            en: 'Lower'
        },
        'continue_prompt': {
            ar: 'اكتب "استمر" للمتابعة أو "توقف" للحصول على أرباحك',
            en: 'Type "continue" to proceed or "stop" to collect your earnings'
        },

        // Items
        'carpet': {
            ar: 'سجاد فاخر',
            en: 'Luxury Carpet'
        },
        'spices': {
            ar: 'توابل نادرة',
            en: 'Rare Spices'
        },
        'jewelry': {
            ar: 'مجوهرات ذهبية',
            en: 'Gold Jewelry'
        },
        'scrolls': {
            ar: 'مخطوطات قديمة',
            en: 'Ancient Scrolls'
        },
        'artifacts': {
            ar: 'تحف ثمينة',
            en: 'Precious Artifacts'
        },

        // Events
        'oasis_found': {
            ar: 'وجدت واحة',
            en: 'Found an oasis'
        },
        'bandits_attack': {
            ar: 'هجوم قطاع الطرق',
            en: 'Bandits attack'
        },
        'treasure_found': {
            ar: 'اكتشفت كنزاً قديماً',
            en: 'Discovered ancient treasure'
        },
        'sandstorm': {
            ar: 'عاصفة رملية',
            en: 'Sandstorm'
        },
        'caravan_met': {
            ar: 'التقيت بقافلة تجارية',
            en: 'Met a trading caravan'
        }
    };

    private serverLanguages: Map<string, 'ar' | 'en'>;
    private defaultLanguage: 'ar' | 'en';

    constructor() {
        super();
        this.serverLanguages = new Map();
        this.defaultLanguage = 'ar';
        this.initializeLanguageService();
    }

    private initializeLanguageService() {
        // Load any saved language preferences
        try {
            // Future implementation: Load from database/config
        } catch (error) {
            console.error('Error initializing language service:', error);
        }
    }

    public setServerLanguage(serverId: string, language: 'ar' | 'en'): void {
        try {
            this.serverLanguages.set(serverId, language);
            this.emit('languageChanged', { serverId, language });
        } catch (error) {
            console.error('Error setting server language:', error);
            throw new Error('Failed to set server language');
        }
    }

    public getServerLanguage(serverId: string): 'ar' | 'en' {
        return this.serverLanguages.get(serverId) || this.defaultLanguage;
    }

    public getText(key: string, serverId: string, replacements: { [key: string]: string } = {}): string {
        try {
            const lang = this.getServerLanguage(serverId);
            let text = this.translations[key]?.[lang] || key;

            // Replace placeholders with actual values
            Object.entries(replacements).forEach(([placeholder, value]) => {
                text = text.replace(`{${placeholder}}`, value);
            });

            return text;
        } catch (error) {
            console.error('Error getting text:', error);
            return key;
        }
    }

    public getBilingual(key: string, serverId: string, replacements: { [key: string]: string } = {}): string {
        try {
            const translation = this.translations[key];
            if (!translation) return key;

            let ar = translation.ar;
            let en = translation.en;

            // Replace placeholders with actual values
            Object.entries(replacements).forEach(([placeholder, value]) => {
                ar = ar.replace(`{${placeholder}}`, value);
                en = en.replace(`{${placeholder}}`, value);
            });

            return `${ar} | ${en}`;
        } catch (error) {
            console.error('Error getting bilingual text:', error);
            return key;
        }
    }

    public getAllTranslations(): TranslationMap {
        return this.translations;
    }

    public addTranslation(key: string, ar: string, en: string): void {
        try {
            this.translations[key] = { ar, en };
            this.emit('translationAdded', { key, ar, en });
        } catch (error) {
            console.error('Error adding translation:', error);
            throw new Error('Failed to add translation');
        }
    }
}
