import dotenv from 'dotenv';
import { JupiterClient } from './api/jupiter';
import { setupSolanaConnection } from './api/solana';
import { MarketMaker } from './strategies/basicMM';
import { loadKeypair } from './wallet';
import { TokenLauncher } from './launcher';
import { Command } from 'commander';
import { TokenLaunchParams } from './api/bags';
import * as fs from 'fs';

dotenv.config();

const program = new Command();

program
    .name('solana-mmaker')
    .description('Solana Market Maker Bot with Token Launch Capability')
    .version('2.0.0');

// Market making command
program
    .command('mm')
    .description('Run market maker bot')
    .option('-e, --enable', 'Enable real trading')
    .action(async (options) => {
        await runMarketMaker(options.enable);
    });

// Token launch command
program
    .command('launch')
    .description('Launch a new token on Bags Protocol')
    .option('-i, --interactive', 'Interactive mode')
    .option('-c, --config <path>', 'Load config from JSON file')
    .option('-q, --quick', 'Quick launch with minimal params')
    .action(async (options) => {
        await launchToken(options);
    });

// Token info command
program
    .command('info <tokenMint>')
    .description('Get token information and fees')
    .action(async (tokenMint) => {
        await getTokenInfo(tokenMint);
    });

// Claim fees command
program
    .command('claim')
    .description('Claim all available fees')
    .option('-t, --token <mint>', 'Claim fees for specific token')
    .action(async (options) => {
        await claimFees(options.token);
    });

// Monitor command
program
    .command('monitor')
    .description('Monitor launched tokens')
    .option('-t, --tokens <mints>', 'Comma-separated list of token mints')
    .option('-f, --file <path>', 'Load token list from file')
    .option('-i, --interval <ms>', 'Update interval in milliseconds', '60000')
    .action(async (options) => {
        await monitorTokens(options);
    });

// Market maker function
async function runMarketMaker(enableTrading: boolean = false) {
    if (!process.env.SOLANA_RPC_ENDPOINT) {
        throw new Error('SOLANA_RPC_ENDPOINT is not set');
    }

    if (!process.env.USER_KEYPAIR) {
        throw new Error('USER_KEYPAIR is not set');
    }

    const connection = setupSolanaConnection(process.env.SOLANA_RPC_ENDPOINT);
    console.log(`Network: ${connection.rpcEndpoint}`);
    
    const userKeypair = loadKeypair();
    console.log('MarketMaker PubKey:', userKeypair.publicKey.toBase58());
    
    const jupiterClient = new JupiterClient(connection, userKeypair);
    const marketMaker = new MarketMaker();
    
    await marketMaker.runMM(jupiterClient, enableTrading);
}

// Token launch function
async function launchToken(options: any) {
    const bagsApiKey = process.env.BAGS_API_KEY;
    const heliusRpcUrl = process.env.HELIUS_RPC_URL || process.env.SOLANA_RPC_ENDPOINT;
    
    if (!bagsApiKey) {
        throw new Error('BAGS_API_KEY is not set in .env file');
    }
    
    if (!heliusRpcUrl) {
        throw new Error('HELIUS_RPC_URL or SOLANA_RPC_ENDPOINT is not set');
    }

    const connection = setupSolanaConnection(heliusRpcUrl);
    const userKeypair = loadKeypair();
    const launcher = new TokenLauncher(bagsApiKey, connection, userKeypair);

    try {
        let result;

        if (options.interactive) {
            result = await launcher.launchInteractive();
        } else if (options.config) {
            result = await launcher.launchFromConfig(options.config);
        } else if (options.quick) {
            // Quick launch with minimal params
            const params: TokenLaunchParams = {
                name: process.env.TOKEN_NAME || 'Test Token',
                symbol: process.env.TOKEN_SYMBOL || 'TEST',
                description: process.env.TOKEN_DESCRIPTION || 'A test token',
                initialBuyAmountSol: parseFloat(process.env.INITIAL_BUY_SOL || '0.01'),
                imageUrl: process.env.TOKEN_IMAGE_URL
            };
            result = await launcher.quickLaunch(params);
        } else {
            // Default to interactive
            result = await launcher.launchInteractive();
        }

        console.log('\n✅ Launch successful!');
        console.log('Token Mint:', result.tokenMint);
        console.log('Signature:', result.signature);
        console.log('View at:', result.bagsUrl);

        // Save launch result
        const launchFile = `launches/${result.tokenMint}.json`;
        fs.mkdirSync('launches', { recursive: true });
        fs.writeFileSync(launchFile, JSON.stringify(result, null, 2));
        console.log(`\nLaunch details saved to ${launchFile}`);

    } catch (error) {
        console.error('Launch failed:', error);
        process.exit(1);
    }
}

// Get token info function
async function getTokenInfo(tokenMint: string) {
    const bagsApiKey = process.env.BAGS_API_KEY;
    const rpcUrl = process.env.HELIUS_RPC_URL || process.env.SOLANA_RPC_ENDPOINT;
    
    if (!bagsApiKey || !rpcUrl) {
        throw new Error('BAGS_API_KEY and RPC URL must be set');
    }

    const connection = setupSolanaConnection(rpcUrl);
    const userKeypair = loadKeypair();
    const launcher = new TokenLauncher(bagsApiKey, connection, userKeypair);

    await launcher.getTokenInfo(tokenMint);
}

// Claim fees function
async function claimFees(tokenMint?: string) {
    const bagsApiKey = process.env.BAGS_API_KEY;
    const rpcUrl = process.env.HELIUS_RPC_URL || process.env.SOLANA_RPC_ENDPOINT;
    
    if (!bagsApiKey || !rpcUrl) {
        throw new Error('BAGS_API_KEY and RPC URL must be set');
    }

    const connection = setupSolanaConnection(rpcUrl);
    const userKeypair = loadKeypair();
    const launcher = new TokenLauncher(bagsApiKey, connection, userKeypair);

    await launcher.claimAllFees();
}

// Monitor tokens function
async function monitorTokens(options: any) {
    const bagsApiKey = process.env.BAGS_API_KEY;
    const rpcUrl = process.env.HELIUS_RPC_URL || process.env.SOLANA_RPC_ENDPOINT;
    
    if (!bagsApiKey || !rpcUrl) {
        throw new Error('BAGS_API_KEY and RPC URL must be set');
    }

    const connection = setupSolanaConnection(rpcUrl);
    const userKeypair = loadKeypair();
    const launcher = new TokenLauncher(bagsApiKey, connection, userKeypair);

    let tokenMints: string[] = [];

    if (options.tokens) {
        tokenMints = options.tokens.split(',').map((t: string) => t.trim());
    } else if (options.file) {
        const content = fs.readFileSync(options.file, 'utf-8');
        tokenMints = content.split('\n').filter(t => t.trim());
    } else {
        // Load from launches directory
        const launchFiles = fs.readdirSync('launches').filter(f => f.endsWith('.json'));
        for (const file of launchFiles) {
            const content = fs.readFileSync(`launches/${file}`, 'utf-8');
            const launch = JSON.parse(content);
            tokenMints.push(launch.tokenMint);
        }
    }

    if (tokenMints.length === 0) {
        console.log('No tokens to monitor');
        return;
    }

    await launcher.monitorTokens(tokenMints, parseInt(options.interval));
}

// Parse command line arguments
program.parse(process.argv);

// If no command specified, show help
if (!process.argv.slice(2).length) {
    program.outputHelp();
}