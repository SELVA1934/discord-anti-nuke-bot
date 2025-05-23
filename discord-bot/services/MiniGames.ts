import { Client, Message, EmbedBuilder, TextChannel, Collection, MessageCollector } from 'discord.js';
import { EventEmitter } from 'events';
import { EconomySystem } from './EconomySystem';

interface GameConfig {
    enabled: boolean;
    minBet: number;
    maxBet: number;
    cooldownMinutes: number;
}

interface GameSession {
    userId: string;
    gameType: string;
    bet: number;
    timestamp: number;
}

interface CollectedMessages {
    first(): Message | undefined;
    size: number;
}

export class MiniGames extends EventEmitter {
    private client: Client;
    private economy: EconomySystem;
    private configs: Map<string, GameConfig>;
    private sessions: Map<string, GameSession>;
    private activeGames: Collection<string, string>;

    constructor(client: Client, economy: EconomySystem) {
        super();
        this.client = client;
        this.economy = economy;
        this.configs = new Map();
        this.sessions = new Map();
        this.activeGames = new Collection();

        this.initializeGames();
    }

    private initializeGames() {
        this.client.on('messageCreate', async (message: Message) => {
            if (message.author.bot || !message.guild) return;

            const config = this.configs.get(message.guild.id);
            if (!config?.enabled) return;

            // Check if user has an active game
            if (this.activeGames.has(message.author.id) && 
                !message.content.startsWith('!bid') && 
                !message.content.startsWith('!call')) {
                if (message.channel instanceof TextChannel) {
                    await message.channel.send('You already have an active game!');
                }
                return;
            }

            const command = message.content.toLowerCase().split(' ')[0];
            const args = message.content.split(' ').slice(1);

            switch (command) {
                case '!sirah':
                    await this.playSirah(message, args);
                    break;
                case '!guess':
                    await this.playGuessGame(message, args);
                    break;
                case '!caravan':
                    await this.playCaravan(message, args);
                    break;
                case '!bazaar':
                    await this.playBazaar(message, args);
                    break;
            }
        });
    }

    private async playSirah(message: Message, args: string[]) {
        const bet = parseInt(args[0]);
        if (!this.validateBet(message, bet)) return;

        if (!(message.channel instanceof TextChannel)) return;

        const questions = [
            {
                question: "من هو أول من هاجر في الإسلام؟",
                answer: "عثمان بن عفان",
                hints: ["كان من العشرة المبشرين بالجنة", "كان ثالث الخلفاء الراشدين", "لُقب بذي النورين"]
            }
            // ... other questions
        ];

        const selectedQuestion = questions[Math.floor(Math.random() * questions.length)];
        let hintsUsed = 0;
        let attempts = 3;
        let reward = bet * 3;

        const gameEmbed = new EmbedBuilder()
            .setTitle('📚 سيرة | Sirah Quiz')
            .setDescription(`
                السؤال | Question:
                ${selectedQuestion.question}
                الجائزة | Prize: ${reward} coins
                المحاولات المتبقية | Attempts left: ${attempts}
            `)
            .setColor('#FFA500');

        await message.channel.send({ embeds: [gameEmbed] });

        const filter = (m: Message) => m.author.id === message.author.id;
        const collector = message.channel.createMessageCollector({ 
            filter, 
            time: 60000,
            max: attempts
        });

        collector.on('collect', async (msg: Message) => {
            if (msg.content.toLowerCase() === '!hint') {
                if (hintsUsed < selectedQuestion.hints.length) {
                    reward = Math.floor(reward * 0.7);
                    const hint = selectedQuestion.hints[hintsUsed++];
                    await message.channel.send(`🔍 تلميح | Hint: ${hint}`);
                } else {
                    await message.channel.send('لا توجد تلميحات أخرى | No more hints available');
                }
                return;
            }

            attempts--;
            if (msg.content.toLowerCase() === selectedQuestion.answer.toLowerCase()) {
                collector.stop('win');
            } else if (attempts <= 0) {
                collector.stop('lose');
            } else {
                await message.channel.send(`❌ إجابة خاطئة | Wrong answer. ${attempts} محاولات متبقية | attempts left`);
            }
        });

        collector.on('end', async (collected: Collection<string, Message>, reason: string) => {
            if (reason === 'win') {
                await this.updateUserBalance(message, reward);
                await message.channel.send(`🎉 أحسنت! ربحت ${reward} عملات | Congratulations! You won ${reward} coins`);
            } else if (reason === 'time') {
                await this.updateUserBalance(message, -bet);
                await message.channel.send('⏰ انتهى الوقت! | Time's up!');
            } else {
                await this.updateUserBalance(message, -bet);
                await message.channel.send(`❌ خسرت! الإجابة الصحيحة كانت: ${selectedQuestion.answer}`);
            }
        });
    }

    private async playGuessGame(message: Message, args: string[]) {
        const bet = parseInt(args[0]);
        if (!this.validateBet(message, bet)) return;

        if (!(message.channel instanceof TextChannel)) return;

        const number = Math.floor(Math.random() * 100) + 1;
        let attempts = 7;
        let reward = bet * 2;

        const gameEmbed = new EmbedBuilder()
            .setTitle('🔢 لعبة التخمين | Number Guessing')
            .setDescription(`
                خمن الرقم بين 1 و 100
                Guess the number between 1 and 100
                الجائزة | Prize: ${reward} coins
                المحاولات المتبقية | Attempts left: ${attempts}
            `)
            .setColor('#3498db');

        await message.channel.send({ embeds: [gameEmbed] });

        const filter = (m: Message) => 
            m.author.id === message.author.id && 
            !isNaN(parseInt(m.content));

        const collector = message.channel.createMessageCollector({ 
            filter, 
            time: 60000,
            max: attempts
        });

        collector.on('collect', async (msg: Message) => {
            const guess = parseInt(msg.content);
            attempts--;

            if (guess === number) {
                collector.stop('win');
            } else if (attempts <= 0) {
                collector.stop('lose');
            } else {
                const hint = guess > number ? 'أقل | Lower' : 'أعلى | Higher';
                await message.channel.send(`${hint} | ${attempts} محاولات متبقية | attempts left`);
            }
        });

        collector.on('end', async (collected: Collection<string, Message>, reason: string) => {
            if (reason === 'win') {
                await this.updateUserBalance(message, reward);
                await message.channel.send(`🎉 أحسنت! الرقم كان ${number}. ربحت ${reward} عملات`);
            } else if (reason === 'time') {
                await this.updateUserBalance(message, -bet);
                await message.channel.send(`⏰ انتهى الوقت! الرقم كان ${number}`);
            } else {
                await this.updateUserBalance(message, -bet);
                await message.channel.send(`❌ خسرت! الرقم كان ${number}`);
            }
        });
    }

    private validateBet(message: Message, bet: number): boolean {
        const config = this.configs.get(message.guild!.id);
        if (!config) return false;

        if (isNaN(bet) || bet < config.minBet || bet > config.maxBet) {
            if (message.channel instanceof TextChannel) {
                message.channel.send(`الرهان يجب أن يكون بين ${config.minBet} و ${config.maxBet} عملات`);
            }
            return false;
        }

        const userData = this.economy.getUserData(message.author.id);
        if (userData.balance < bet) {
            if (message.channel instanceof TextChannel) {
                message.channel.send('لا تملك عملات كافية | Not enough coins');
            }
            return false;
        }

        return true;
    }

    private async updateUserBalance(message: Message, amount: number) {
        const userData = this.economy.getUserData(message.author.id);
        await this.economy.updateUserData(message.author.id, {
            balance: userData.balance + amount
        });

        this.emit('gameCompleted', {
            userId: message.author.id,
            guildId: message.guild?.id,
            game: message.content.split(' ')[0].slice(1),
            amount
        });
    }

    public updateConfig(guildId: string, config: Partial<GameConfig>) {
        const current = this.configs.get(guildId) || {
            enabled: false,
            minBet: 10,
            maxBet: 1000,
            cooldownMinutes: 5
        };
        this.configs.set(guildId, { ...current, ...config });
    }

    public getConfig(guildId: string): GameConfig | undefined {
        return this.configs.get(guildId);
    }
}
