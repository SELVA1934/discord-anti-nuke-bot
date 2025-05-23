import { Client } from 'discord.js';
import { AntiNuke } from '../security/AntiNuke';
import { AutoMod } from './AutoMod';
import { RoleManager } from './RoleManager';
import { UserAnalytics } from './UserAnalytics';
import { CustomCommands } from './CustomCommands';
import { MultiServerManager } from './MultiServerManager';
import { WebSocketService } from './websocket';
import { VerificationSystem } from './VerificationSystem';
import { EconomySystem } from './EconomySystem';
import { TicketSystem } from './TicketSystem';
import { ServerBackupSystem } from './ServerBackupSystem';
import { AutoModAI } from './AutoModAI';
import { MiniGames } from './MiniGames';
import { LanguageService } from './LanguageService';

declare global {
    namespace NodeJS {
        interface Global {
            discordClient: Client | undefined;
            antiNuke: AntiNuke | undefined;
            autoMod: AutoMod | undefined;
            roleManager: RoleManager | undefined;
            userAnalytics: UserAnalytics | undefined;
            customCommands: CustomCommands | undefined;
            multiServer: MultiServerManager | undefined;
            wsService: WebSocketService | undefined;
            verificationSystem: VerificationSystem | undefined;
            economySystem: EconomySystem | undefined;
            ticketSystem: TicketSystem | undefined;
            serverBackup: ServerBackupSystem | undefined;
            autoModAI: AutoModAI | undefined;
        }
    }
}

export class ServiceManager {
    public readonly client: Client;
    public readonly antiNuke: AntiNuke;
    public readonly autoMod: AutoMod;
    public readonly roleManager: RoleManager;
    public readonly userAnalytics: UserAnalytics;
    public readonly customCommands: CustomCommands;
    public readonly multiServer: MultiServerManager;
    public readonly wsService: WebSocketService;
    public readonly verificationSystem: VerificationSystem;
    public readonly economySystem: EconomySystem;
    public readonly ticketSystem: TicketSystem;
    public readonly serverBackup: ServerBackupSystem;
    public readonly autoModAI: AutoModAI;
    public readonly miniGames: MiniGames;
    public readonly languageService: LanguageService;

    constructor(client: Client) {
        this.client = client;
        
        // Initialize all services
        this.antiNuke = new AntiNuke(client);
        this.autoMod = new AutoMod(client);
        this.roleManager = new RoleManager(client);
        this.userAnalytics = new UserAnalytics(client);
        this.customCommands = new CustomCommands(client);
        this.multiServer = new MultiServerManager(client);
        this.wsService = new WebSocketService(this.antiNuke);
        this.verificationSystem = new VerificationSystem(client);
        this.economySystem = new EconomySystem(client);
        this.ticketSystem = new TicketSystem(client);
        this.serverBackup = new ServerBackupSystem(client);
        this.autoModAI = new AutoModAI(client);
        this.miniGames = new MiniGames(client, this.economySystem);
        this.languageService = new LanguageService();

        // Make services globally available
        (global as any).discordClient = client;
        (global as any).antiNuke = this.antiNuke;
        (global as any).autoMod = this.autoMod;
        (global as any).roleManager = this.roleManager;
        (global as any).userAnalytics = this.userAnalytics;
        (global as any).customCommands = this.customCommands;
        (global as any).multiServer = this.multiServer;
        (global as any).wsService = this.wsService;
        (global as any).verificationSystem = this.verificationSystem;
        (global as any).economySystem = this.economySystem;
        (global as any).ticketSystem = this.ticketSystem;
        (global as any).serverBackup = this.serverBackup;
        (global as any).autoModAI = this.autoModAI;
        (global as any).miniGames = this.miniGames;
        (global as any).languageService = this.languageService;

        this.initializeEventHandlers();
    }

    private initializeEventHandlers() {
        // Forward events between services
        this.antiNuke.on('nukeAttempt', (data) => {
            this.wsService.broadcast('nukeAttempt', data);
            this.userAnalytics.incrementInfraction(data.userId);
        });

        this.autoMod.on('violation', (data) => {
            this.wsService.broadcast('modViolation', data);
            this.userAnalytics.incrementWarning(data.userId);
        });

        this.roleManager.on('unauthorizedRoleChangeReverted', (data) => {
            this.wsService.broadcast('roleProtection', data);
            this.userAnalytics.incrementWarning(data.userId);
        });

        this.verificationSystem.on('memberVerified', (data) => {
            this.wsService.broadcast('memberVerified', data);
            this.userAnalytics.incrementWarning(data.userId);
        });

        this.ticketSystem.on('ticketCreated', (data) => {
            this.wsService.broadcast('ticketCreated', data);
            this.userAnalytics.incrementWarning(data.userId);
        });

        this.serverBackup.on('backupCreated', (data) => {
            this.wsService.broadcast('backupCreated', data);
        });

        this.autoModAI.on('toxicMessage', (data) => {
            this.wsService.broadcast('toxicMessage', data);
            this.userAnalytics.incrementWarning(data.userId);
            // Removed call to non-existent method on autoMod
        });

        this.miniGames.on('gameCompleted', (data) => {
            this.wsService.broadcast('gameCompleted', data);
            this.userAnalytics.incrementWarning(data.userId);
        });

        // Handle messages
        this.client.on('messageCreate', async message => {
            if (message.author.bot) return;

            // Check custom commands first
            const prefix = this.multiServer.getServerPrefix(message.guild?.id || '');
            if (message.content.startsWith(prefix)) {
                const customCommand = await this.customCommands.getCommand(
                    message.guild?.id || '',
                    message.content.slice(prefix.length).split(' ')[0]
                );
                if (customCommand) return;
            }
        });
    }

    public cleanup() {
        // Cleanup all services
        this.userAnalytics.cleanup();
        this.wsService.close();
        this.client.destroy();
    }
}
