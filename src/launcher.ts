import { Connection, Keypair } from '@solana/web3.js';
import { BagsProtocol, TokenLaunchParams, LaunchResult } from './api/bags';
import * as fs from 'fs';
import * as path from 'path';
import readline from 'readline';

export class TokenLauncher {
    private bagsProtocol: BagsProtocol;
    private connection: Connection;
    private keypair: Keypair;

    constructor(
        bagsApiKey: string,
        connection: Connection,
        keypair: Keypair
    ) {
        this.connection = connection;
        this.keypair = keypair;
        this.bagsProtocol = new BagsProtocol(bagsApiKey, connection, keypair);
    }

    /**
     * Interactive token launch
     */
    async launchInteractive(): Promise<LaunchResult> {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const question = (prompt: string): Promise<string> => {
            return new Promise((resolve) => {
                rl.question(prompt, (answer) => {
                    resolve(answer);
                });
            });
        };

        try {
            console.log('\n🚀 Token Launch Configuration\n');

            // Basic info
            const name = await question('Token Name: ');
            const symbol = await question('Token Symbol: ');
            const description = await question('Description: ');

            // Social links (optional)
            const twitter = await question('Twitter URL (optional): ');
            const telegram = await question('Telegram URL (optional): ');
            const website = await question('Website URL (optional): ');

            // Image
            const imageChoice = await question('Image source (1=URL, 2=Local file, 3=Default): ');
            let imageUrl: string | undefined;
            let imageFile: Buffer | undefined;

            if (imageChoice === '1') {
                imageUrl = await question('Image URL: ');
            } else if (imageChoice === '2') {
                const imagePath = await question('Image file path: ');
                imageFile = fs.readFileSync(imagePath);
            }

            // Initial buy
            const initialBuyStr = await question('Initial buy amount in SOL (default 0.01): ');
            const initialBuyAmountSol = parseFloat(initialBuyStr) || 0.01;

            // Fee sharing (optional)
            const useFeeShare = await question('Use fee sharing? (y/n): ');
            let feeShareTwitter: string | undefined;
            let creatorFeeBps: number | undefined;
            let feeShareBps: number | undefined;

            if (useFeeShare.toLowerCase() === 'y') {
                feeShareTwitter = await question('Fee share Twitter handle (without @): ');
                const creatorPercent = await question('Your fee percentage (default 10%): ');
                creatorFeeBps = (parseFloat(creatorPercent) || 10) * 100;
                feeShareBps = 10000 - creatorFeeBps; // Remainder goes to fee share
            }

            const params: TokenLaunchParams = {
                name,
                symbol,
                description,
                imageUrl,
                imageFile,
                twitter: twitter || undefined,
                telegram: telegram || undefined,
                website: website || undefined,
                initialBuyAmountSol,
                feeShareTwitter,
                creatorFeeBps,
                feeShareBps
            };

            console.log('\n📋 Launch Configuration:');
            console.log(params);
            
            const confirm = await question('\nProceed with launch? (y/n): ');
            
            if (confirm.toLowerCase() !== 'y') {
                throw new Error('Launch cancelled by user');
            }

            rl.close();

            // Launch token
            return await this.bagsProtocol.launchToken(params);

        } catch (error) {
            rl.close();
            throw error;
        }
    }

    /**
     * Quick launch with predefined parameters
     */
    async quickLaunch(params: TokenLaunchParams): Promise<LaunchResult> {
        return await this.bagsProtocol.launchToken(params);
    }

    /**
     * Launch token from config file
     */
    async launchFromConfig(configPath: string): Promise<LaunchResult> {
        const configContent = fs.readFileSync(configPath, 'utf-8');
        const config = JSON.parse(configContent) as TokenLaunchParams;
        
        // Handle local image file if specified
        if (config.imageFile && typeof config.imageFile === 'string') {
            config.imageFile = fs.readFileSync(config.imageFile);
        }

        return await this.bagsProtocol.launchToken(config);
    }

    /**
     * Get token info and fees
     */
    async getTokenInfo(tokenMint: string) {
        console.log(`\n📊 Token Info for ${tokenMint}\n`);

        // Get lifetime fees
        const fees = await this.bagsProtocol.getTokenLifetimeFees(tokenMint);
        console.log(`💰 Lifetime fees: ${fees.toFixed(4)} SOL`);

        // Get creators
        const creators = await this.bagsProtocol.getTokenCreators(tokenMint);
        console.log('\n👥 Creators:');
        creators.forEach(creator => {
            const role = creator.isCreator ? 'Creator' : 'Fee Share';
            console.log(`  ${role}: ${creator.username || creator.twitterUsername || 'Unknown'}`);
            console.log(`    Wallet: ${creator.wallet}`);
            console.log(`    Royalty: ${creator.royaltyBps / 100}%`);
        });

        return { fees, creators };
    }

    /**
     * Claim all available fees
     */
    async claimAllFees() {
        console.log('\n💰 Claiming all available fees...\n');
        
        const positions = await this.bagsProtocol.getClaimablePositions();
        
        if (positions.length === 0) {
            console.log('No fees to claim');
            return [];
        }

        console.log(`Found ${positions.length} claimable positions:`);
        
        let totalClaimable = 0;
        positions.forEach((pos, i) => {
            const amount = (Number(pos.virtualPoolClaimableAmount || 0) + 
                           Number(pos.dammPoolClaimableAmount || 0)) / 1e9;
            totalClaimable += amount;
            console.log(`  ${i + 1}. ${pos.baseMint.slice(0, 8)}... - ${amount.toFixed(6)} SOL`);
        });

        console.log(`\nTotal claimable: ${totalClaimable.toFixed(6)} SOL`);

        const signatures = await this.bagsProtocol.claimFees();
        console.log(`\n✅ Claimed ${signatures.length} positions`);
        
        return signatures;
    }

    /**
     * Monitor launched tokens
     */
    async monitorTokens(tokenMints: string[], intervalMs: number = 60000) {
        console.log(`\n📊 Monitoring ${tokenMints.length} tokens...\n`);

        const monitor = async () => {
            for (const mint of tokenMints) {
                try {
                    const fees = await this.bagsProtocol.getTokenLifetimeFees(mint);
                    const timestamp = new Date().toISOString();
                    console.log(`[${timestamp}] ${mint.slice(0, 8)}... - Fees: ${fees.toFixed(4)} SOL`);
                } catch (error) {
                    console.error(`Error monitoring ${mint}:`, error);
                }
            }
        };

        // Initial check
        await monitor();

        // Set up interval
        setInterval(monitor, intervalMs);
    }
}

// Export a factory function
export function createTokenLauncher(
    bagsApiKey: string,
    rpcUrl: string,
    keypair: Keypair
): TokenLauncher {
    const connection = new Connection(rpcUrl, 'confirmed');
    return new TokenLauncher(bagsApiKey, connection, keypair);
}