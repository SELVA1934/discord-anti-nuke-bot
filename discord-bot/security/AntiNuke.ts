import { 
    Client, 
    GuildMember,
    PartialGuildMember, 
    AuditLogEvent, 
    Guild,
    PermissionsBitField,
    User,
    Channel,
    Role,
    GuildBan,
    TextChannel,
    VoiceChannel
} from 'discord.js';
import { EventEmitter } from 'events';

interface RateLimit {
    actions: number;
    timestamp: number;
}

interface SecurityLog {
    userId: string;
    action: string;
    timestamp: number;
}

export class AntiNuke extends EventEmitter {
    private rateLimits: Map<string, RateLimit>;
    private securityLogs: SecurityLog[];
    private readonly MAX_ACTIONS = 5; // Maximum actions allowed in timeframe
    private readonly TIME_FRAME = 10000; // Timeframe in milliseconds (10 seconds)
    private readonly client: Client;
    private readonly trustedRoles: string[] = []; // Add trusted role IDs here

    constructor(client: Client) {
        super();
        this.client = client;
        this.rateLimits = new Map();
        this.securityLogs = [];
        this.initializeSecuritySystem();
    }

    private initializeSecuritySystem() {
        // Monitor channel deletions
        this.client.on('channelDelete', async (channel: Channel) => {
            if (!('guild' in channel)) return;
            
            const guild = channel.guild;
            if (!guild) return;
            
            const auditLogs = await guild.fetchAuditLogs({
                limit: 1,
                type: AuditLogEvent.ChannelDelete
            });
            
            const deletion = auditLogs.entries.first();
            if (deletion) {
                this.checkForNuking(deletion.executor as User, guild, 'CHANNEL_DELETE');
            }
        });

        // Monitor role deletions
        this.client.on('roleDelete', async (role: Role) => {
            const auditLogs = await role.guild.fetchAuditLogs({
                limit: 1,
                type: AuditLogEvent.RoleDelete
            });
            
            const deletion = auditLogs.entries.first();
            if (deletion) {
                this.checkForNuking(deletion.executor as User, role.guild, 'ROLE_DELETE');
            }
        });

        // Monitor mass member bans
        this.client.on('guildBanAdd', async (ban: GuildBan) => {
            const auditLogs = await ban.guild.fetchAuditLogs({
                limit: 1,
                type: AuditLogEvent.MemberBanAdd
            });
            
            const banAction = auditLogs.entries.first();
            if (banAction) {
                this.checkForNuking(banAction.executor as User, ban.guild, 'MEMBER_BAN');
            }
        });

        // Monitor permission updates
        this.client.on('guildMemberUpdate', async (oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) => {
            if (this.hasPermissionsChanged(oldMember, newMember)) {
                const auditLogs = await newMember.guild.fetchAuditLogs({
                    limit: 1,
                    type: AuditLogEvent.MemberRoleUpdate
                });
                
                const permUpdate = auditLogs.entries.first();
                if (permUpdate) {
                    this.checkForNuking(permUpdate.executor as User, newMember.guild, 'PERMISSION_UPDATE');
                }
            }
        });

        // Emit ready event
        this.emit('ready', true);
    }

    private hasPermissionsChanged(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember): boolean {
        if (!('permissions' in oldMember)) return false;
        return oldMember.permissions.bitfield !== newMember.permissions.bitfield;
    }

    private async checkForNuking(executor: User, guild: Guild, actionType: string) {
        if (!executor || executor.bot) return;
        
        // Skip checks for trusted roles
        const member = await guild.members.fetch(executor.id);
        if (this.hasTrustedRole(member)) return;

        // Update rate limits
        const rateLimit = this.rateLimits.get(executor.id) || { actions: 0, timestamp: Date.now() };
        
        // Reset rate limit if time frame has passed
        if (Date.now() - rateLimit.timestamp > this.TIME_FRAME) {
            rateLimit.actions = 1;
            rateLimit.timestamp = Date.now();
        } else {
            rateLimit.actions++;
        }

        this.rateLimits.set(executor.id, rateLimit);
        
        // Log and emit the security event
        const logEntry = {
            userId: executor.id,
            action: actionType,
            timestamp: Date.now()
        };
        this.securityLogs.push(logEntry);
        this.emit('securityEvent', logEntry);

        // Check if action limit exceeded
        if (rateLimit.actions >= this.MAX_ACTIONS) {
            await this.handleNukeAttempt(executor, guild);
        }
    }

    private hasTrustedRole(member: GuildMember): boolean {
        return member.roles.cache.some(role => this.trustedRoles.includes(role.id));
    }

    private async handleNukeAttempt(executor: User, guild: Guild) {
        try {
            // Remove all roles from the user
            const member = await guild.members.fetch(executor.id);
            await member.roles.remove(member.roles.cache);

            // Ban the user
            await guild.members.ban(executor.id, {
                reason: 'Anti-Nuke: Suspicious activity detected'
            });

            // Log to a security channel if configured
            const securityChannel = guild.channels.cache.find(
                channel => channel.name === 'security-logs'
            ) as TextChannel;

            if (securityChannel?.isTextBased()) {
                await securityChannel.send({
                    embeds: [{
                        title: '🚨 Anti-Nuke System: Threat Detected',
                        description: `User ${executor.tag} has been banned for suspicious activity.`,
                        color: 0xFF0000,
                        fields: [
                            {
                                name: 'User ID',
                                value: executor.id
                            },
                            {
                                name: 'Action Taken',
                                value: 'Banned and roles removed'
                            },
                            {
                                name: 'Timestamp',
                                value: new Date().toISOString()
                            }
                        ]
                    }]
                });
            }

            // Emit nuke attempt event
            this.emit('nukeAttempt', {
                user: executor.tag,
                userId: executor.id,
                guildId: guild.id,
                timestamp: new Date().toISOString()
            });

            // Create server backup
            await this.createServerBackup(guild);

        } catch (error) {
            console.error('Error handling nuke attempt:', error);
            this.emit('error', error);
        }
    }

    public async createServerBackup(guild: Guild) {
        const backup = {
            timestamp: new Date().toISOString(),
            channels: Array.from(guild.channels.cache.values())
                .filter(channel => 'position' in channel)
                .map(channel => ({
                    name: channel.name || 'unnamed',
                    type: channel.type,
                    position: 'position' in channel ? channel.position : 0
                })),
            roles: Array.from(guild.roles.cache.values()).map(role => ({
                name: role.name || 'unnamed',
                permissions: role.permissions.bitfield,
                color: role.color || 0,
                hoist: role.hoist || false,
                position: role.position || 0
            }))
        };

        this.emit('backupCreated', backup);
        return backup;
    }

    public getTrustedRoles(): string[] {
        return [...this.trustedRoles];
    }

    public addTrustedRole(roleId: string) {
        if (!this.trustedRoles.includes(roleId)) {
            this.trustedRoles.push(roleId);
            this.emit('trustedRoleAdded', roleId);
        }
    }

    public removeTrustedRole(roleId: string) {
        const index = this.trustedRoles.indexOf(roleId);
        if (index > -1) {
            this.trustedRoles.splice(index, 1);
            this.emit('trustedRoleRemoved', roleId);
        }
    }

    public getSecurityLogs(): SecurityLog[] {
        return [...this.securityLogs];
    }

    public clearOldLogs(maxAge: number = 86400000) { // Default: 24 hours
        const now = Date.now();
        this.securityLogs = this.securityLogs.filter(log => now - log.timestamp < maxAge);
        this.emit('logsCleared', maxAge);
    }
}
