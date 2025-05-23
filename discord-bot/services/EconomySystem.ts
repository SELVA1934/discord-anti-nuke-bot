import { Client, GuildMember, TextChannel, Message, EmbedBuilder } from 'discord.js';
import { EventEmitter } from 'events';

interface EconomyConfig {
    enabled: boolean;
    currencyName: string;
    startingBalance: number;
    dailyRewardAmount: number;
    shopItems: ShopItem[];
}

interface ShopItem {
    id: string;
    name: string;
    description: string;
    price: number;
    roleId?: string; // Role granted when purchased
}

interface UserEconomyData {
    balance: number;
    inventory: string[]; // item ids
    lastDailyClaim: number;
}

export class EconomySystem extends EventEmitter {
    private client: Client;
    private configs: Map<string, EconomyConfig>;
    private userData: Map<string, UserEconomyData>;

    constructor(client: Client) {
        super();
        this.client = client;
        this.configs = new Map();
        this.userData = new Map();

        this.initializeEconomy();
    }

    private initializeEconomy() {
        this.client.on('messageCreate', async (message: Message) => {
            if (message.author.bot) return;
            if (!message.guild) return;

            const config = this.configs.get(message.guild.id);
            if (!config?.enabled) return;

            // Example: simple daily reward command
            if (message.content.toLowerCase() === '!daily') {
                await this.handleDailyReward(message, config);
            }
        });
    }

    private async handleDailyReward(message: Message, config: EconomyConfig) {
        const userId = message.author.id;
        const now = Date.now();
        const user = this.getUserData(userId);

        if (user.lastDailyClaim && now - user.lastDailyClaim < 24 * 60 * 60 * 1000) {
            const nextClaim = new Date(user.lastDailyClaim + 24 * 60 * 60 * 1000);
            const channel = message.channel;
            if ('send' in channel) {
                await channel.send(`You have already claimed your daily reward. Next claim available at ${nextClaim.toUTCString()}.`);
            }
            return;
        }

        user.balance += config.dailyRewardAmount;
        user.lastDailyClaim = now;
        this.userData.set(userId, user);

        const channel = message.channel;
        if ('send' in channel) {
            await channel.send(`You have received your daily reward of ${config.dailyRewardAmount} ${config.currencyName}. Your new balance is ${user.balance} ${config.currencyName}.`);
        }
    }

    public getUserData(userId: string): UserEconomyData {
        return this.userData.get(userId) || {
            balance: 0,
            inventory: [],
            lastDailyClaim: 0
        };
    }

    public updateUserData(userId: string, data: Partial<UserEconomyData>) {
        const current = this.getUserData(userId);
        const updated = { ...current, ...data };
        this.userData.set(userId, updated);
    }

    public updateConfig(guildId: string, config: Partial<EconomyConfig>) {
        const current = this.configs.get(guildId) || {
            enabled: false,
            currencyName: 'Coins',
            startingBalance: 100,
            dailyRewardAmount: 50,
            shopItems: []
        };
        this.configs.set(guildId, { ...current, ...config });
    }

    public getConfig(guildId: string): EconomyConfig | undefined {
        return this.configs.get(guildId);
    }
}
