import { 
    Client, 
    Role, 
    GuildMember,
    PartialGuildMember, 
    Guild,
    PermissionsBitField,
    Collection,
    TextChannel,
    AuditLogEvent
} from 'discord.js';
import { EventEmitter } from 'events';

interface RoleConfig {
    autoRoles: string[];
    protectedRoles: string[];
    roleHierarchy: string[];
    logChannelId?: string;
    requireVerification: boolean;
    verificationRole?: string;
    maxRolesPerUser: number;
}

interface RoleChange {
    userId: string;
    roleId: string;
    action: 'add' | 'remove';
    timestamp: number;
}

export class RoleManager extends EventEmitter {
    private client: Client;
    private config: RoleConfig;
    private roleChanges: Map<string, RoleChange[]>;

    constructor(client: Client) {
        super();
        this.client = client;
        this.roleChanges = new Map();
        
        // Default configuration
        this.config = {
            autoRoles: [],
            protectedRoles: [],
            roleHierarchy: [],
            requireVerification: false,
            maxRolesPerUser: 10
        };

        this.initializeRoleManager();
    }

    private initializeRoleManager() {
        // Handle new member joins
        this.client.on('guildMemberAdd', async (member) => {
            await this.handleNewMember(member);
        });

        // Monitor role changes
        this.client.on('guildMemberUpdate', async (oldMember, newMember) => {
            // Fetch full member data if partial
            const fullOldMember = oldMember.partial ? await oldMember.fetch() : oldMember;
            const fullNewMember = newMember.partial ? await newMember.fetch() : newMember;
            await this.handleRoleUpdate(fullOldMember, fullNewMember);
        });

        // Monitor role deletions
        this.client.on('roleDelete', async (role) => {
            await this.handleRoleDelete(role);
        });

        // Monitor role permission changes
        this.client.on('roleUpdate', async (oldRole, newRole) => {
            await this.handleRolePermissionUpdate(oldRole, newRole);
        });
    }

    private async handleNewMember(member: GuildMember) {
        try {
            // If verification is required, only add verification role
            if (this.config.requireVerification && this.config.verificationRole) {
                await member.roles.add(this.config.verificationRole);
                this.emit('memberVerificationNeeded', member.id);
                return;
            }

            // Add auto-roles
            for (const roleId of this.config.autoRoles) {
                const role = member.guild.roles.cache.get(roleId);
                if (role) {
                    await member.roles.add(role);
                    this.logRoleChange(member, role, 'add');
                }
            }

            this.emit('autoRolesApplied', {
                userId: member.id,
                roles: this.config.autoRoles,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('Error applying auto-roles:', error);
            this.emit('error', error);
        }
    }

    private async handleRoleUpdate(oldMember: GuildMember, newMember: GuildMember) {
        const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
        const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));

        // Check for protected role modifications
        for (const role of [...addedRoles.values(), ...removedRoles.values()]) {
            if (this.config.protectedRoles.includes(role.id)) {
                const audit = await this.getLatestRoleAudit(newMember.guild);
                if (audit && !this.hasRoleManagementPermission(audit.executor?.id, newMember.guild)) {
                    // Revert unauthorized changes
                    await this.revertRoleChange(newMember, role, addedRoles.has(role.id));
                    continue;
                }
            }
        }

        // Enforce role hierarchy
        if (addedRoles.size > 0) {
            await this.enforceRoleHierarchy(newMember);
        }

        // Check max roles per user
        if (newMember.roles.cache.size > this.config.maxRolesPerUser) {
            const excess = newMember.roles.cache.size - this.config.maxRolesPerUser;
            const rolesToRemove = Array.from(addedRoles.values()).slice(-excess);
            await newMember.roles.remove(rolesToRemove);
            this.emit('maxRolesExceeded', {
                userId: newMember.id,
                removedRoles: rolesToRemove.map(r => r.id)
            });
        }

        // Log role changes
        for (const role of addedRoles.values()) {
            this.logRoleChange(newMember, role, 'add');
        }
        for (const role of removedRoles.values()) {
            this.logRoleChange(newMember, role, 'remove');
        }
    }

    private async handleRoleDelete(role: Role) {
        if (this.config.protectedRoles.includes(role.id)) {
            const audit = await this.getLatestRoleAudit(role.guild);
            if (audit && !this.hasRoleManagementPermission(audit.executor?.id, role.guild)) {
                // Attempt to recreate the protected role
                try {
                    const newRole = await role.guild.roles.create({
                        name: role.name,
                        color: role.color,
                        hoist: role.hoist,
                        position: role.position,
                        permissions: role.permissions,
                        mentionable: role.mentionable
                    });

                    this.config.protectedRoles = this.config.protectedRoles.map(id => 
                        id === role.id ? newRole.id : id
                    );

                    this.emit('protectedRoleRestored', {
                        oldRoleId: role.id,
                        newRoleId: newRole.id
                    });
                } catch (error) {
                    console.error('Error restoring protected role:', error);
                    this.emit('error', error);
                }
            }
        }
    }

    private async handleRolePermissionUpdate(oldRole: Role, newRole: Role) {
        if (this.config.protectedRoles.includes(newRole.id)) {
            const audit = await this.getLatestRoleAudit(newRole.guild);
            if (audit && !this.hasRoleManagementPermission(audit.executor?.id, newRole.guild)) {
                // Revert unauthorized permission changes
                try {
                    await newRole.setPermissions(oldRole.permissions);
                    this.emit('protectedRoleReverted', {
                        roleId: newRole.id,
                        oldPermissions: oldRole.permissions.bitfield
                    });
                } catch (error) {
                    console.error('Error reverting role permissions:', error);
                    this.emit('error', error);
                }
            }
        }
    }

    private async getLatestRoleAudit(guild: Guild) {
        const audit = await guild.fetchAuditLogs({
            limit: 1,
            type: AuditLogEvent.RoleUpdate
        });
        return audit.entries.first();
    }

    private hasRoleManagementPermission(userId: string | undefined, guild: Guild): boolean {
        if (!userId) return false;
        const member = guild.members.cache.get(userId);
        return member?.permissions.has(PermissionsBitField.Flags.ManageRoles) ?? false;
    }

    private async revertRoleChange(member: GuildMember, role: Role, wasAdded: boolean) {
        try {
            if (wasAdded) {
                await member.roles.remove(role);
            } else {
                await member.roles.add(role);
            }
            this.emit('unauthorizedRoleChangeReverted', {
                userId: member.id,
                roleId: role.id,
                action: wasAdded ? 'remove' : 'add'
            });
        } catch (error) {
            console.error('Error reverting role change:', error);
            this.emit('error', error);
        }
    }

    private async enforceRoleHierarchy(member: GuildMember) {
        const memberRoles = member.roles.cache;
        const hierarchyViolations = this.findHierarchyViolations(memberRoles);

        if (hierarchyViolations.length > 0) {
            try {
                await member.roles.remove(hierarchyViolations);
                this.emit('hierarchyEnforced', {
                    userId: member.id,
                    removedRoles: hierarchyViolations
                });
            } catch (error) {
                console.error('Error enforcing role hierarchy:', error);
                this.emit('error', error);
            }
        }
    }

    private findHierarchyViolations(memberRoles: Collection<string, Role>): string[] {
        const violations: string[] = [];
        const memberRoleIds = memberRoles.map(r => r.id);

        for (let i = 0; i < this.config.roleHierarchy.length; i++) {
            const currentRole = this.config.roleHierarchy[i];
            if (memberRoleIds.includes(currentRole)) {
                // Check if member has any roles that should be higher in hierarchy
                const lowerRoles = this.config.roleHierarchy.slice(i + 1);
                violations.push(...memberRoleIds.filter(id => lowerRoles.includes(id)));
            }
        }

        return violations;
    }

    private async logRoleChange(member: GuildMember, role: Role, action: 'add' | 'remove') {
        const change: RoleChange = {
            userId: member.id,
            roleId: role.id,
            action,
            timestamp: Date.now()
        };

        // Update role changes history
        const userChanges = this.roleChanges.get(member.id) || [];
        userChanges.push(change);
        this.roleChanges.set(member.id, userChanges);

        // Emit event for tracking
        this.emit('roleChange', change);

        // Log to channel if configured
        if (this.config.logChannelId) {
            const logChannel = member.guild.channels.cache.get(this.config.logChannelId) as TextChannel;
            if (logChannel?.isTextBased()) {
                await logChannel.send({
                    embeds: [{
                        title: '👥 Role Update',
                        description: `Role ${action === 'add' ? 'added to' : 'removed from'} ${member.user.tag}`,
                        fields: [
                            { name: 'User', value: member.user.tag, inline: true },
                            { name: 'Role', value: role.name, inline: true },
                            { name: 'Action', value: action, inline: true }
                        ],
                        color: action === 'add' ? 0x00FF00 : 0xFF0000,
                        timestamp: new Date().toISOString()
                    }]
                });
            }
        }
    }

    // Configuration methods
    public updateConfig(newConfig: Partial<RoleConfig>) {
        this.config = { ...this.config, ...newConfig };
        this.emit('configUpdated', this.config);
    }

    public getRoleChanges(userId: string): RoleChange[] {
        return this.roleChanges.get(userId) || [];
    }

    public addAutoRole(roleId: string) {
        if (!this.config.autoRoles.includes(roleId)) {
            this.config.autoRoles.push(roleId);
            this.emit('autoRolesUpdated', this.config.autoRoles);
        }
    }

    public removeAutoRole(roleId: string) {
        this.config.autoRoles = this.config.autoRoles.filter(id => id !== roleId);
        this.emit('autoRolesUpdated', this.config.autoRoles);
    }

    public addProtectedRole(roleId: string) {
        if (!this.config.protectedRoles.includes(roleId)) {
            this.config.protectedRoles.push(roleId);
            this.emit('protectedRolesUpdated', this.config.protectedRoles);
        }
    }

    public removeProtectedRole(roleId: string) {
        this.config.protectedRoles = this.config.protectedRoles.filter(id => id !== roleId);
        this.emit('protectedRolesUpdated', this.config.protectedRoles);
    }

    public updateRoleHierarchy(hierarchy: string[]) {
        this.config.roleHierarchy = hierarchy;
        this.emit('hierarchyUpdated', hierarchy);
    }

    public setVerificationRequired(required: boolean, roleId?: string) {
        this.config.requireVerification = required;
        if (roleId) {
            this.config.verificationRole = roleId;
        }
        this.emit('verificationConfigUpdated', {
            required,
            roleId: this.config.verificationRole
        });
    }
}
