import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const BotConfig = {
    // Bot token from environment variables
    token: process.env.DISCORD_TOKEN,

    // Security settings
    security: {
        maxActions: parseInt(process.env.MAX_ACTIONS || '5', 10),
        timeFrame: parseInt(process.env.TIME_FRAME || '10000', 10), // 10 seconds
        securityLogChannel: 'security-logs',
        autoBackup: {
            enabled: true,
            interval: 86400000, // 24 hours
            maxBackups: 7 // Keep last 7 backups
        }
    },

    // Command settings
    commands: {
        prefix: process.env.COMMAND_PREFIX || '!',
        adminCommands: [
            'antinuke status',
            'antinuke trust',
            'antinuke untrust',
            'antinuke logs',
            'antinuke backup'
        ]
    },

    // Monitoring settings
    monitoring: {
        events: {
            channelDelete: true,
            roleDelete: true,
            guildBanAdd: true,
            memberUpdate: true,
            webhookUpdate: true
        },
        alertThresholds: {
            channelDeletions: 3,
            roleDeletions: 3,
            massBans: 5,
            permissionChanges: 5
        }
    }
};

// Validate required environment variables
if (!BotConfig.token) {
    throw new Error('DISCORD_TOKEN is not defined in environment variables');
}

export default BotConfig;
