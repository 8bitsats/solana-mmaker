import { BagsSDK } from '@bagsfm/bags-sdk';
import { 
    Connection, 
    Keypair, 
    PublicKey, 
    LAMPORTS_PER_SOL,
    VersionedTransaction 
} from '@solana/web3.js';
import bs58 from 'bs58';
import axios from 'axios';
import FormData from 'form-data';

export interface TokenLaunchParams {
    name: string;
    symbol: string;
    description: string;
    imageUrl?: string;
    imageFile?: Buffer;
    twitter?: string;
    telegram?: string;
    website?: string;
    initialBuyAmountSol?: number;
    feeShareTwitter?: string; // Twitter handle for fee sharing
    creatorFeeBps?: number; // Creator fee in basis points (100 = 1%)
    feeShareBps?: number; // Fee share in basis points
}

export interface LaunchResult {
    tokenMint: string;
    signature: string;
    metadataUrl: string;
    bagsUrl: string;
    configKey?: string;
    feeShareWallet?: string;
}

export class BagsProtocol {
    private sdk: BagsSDK;
    private apiKey: string;
    private connection: Connection;
    private keypair: Keypair;
    private baseUrl = 'https://public-api-v2.bags.fm/api/v1';

    constructor(
        apiKey: string,
        connection: Connection,
        keypair: Keypair
    ) {
        this.apiKey = apiKey;
        this.connection = connection;
        this.keypair = keypair;
        this.sdk = new BagsSDK(apiKey, connection, 'processed');
    }

    /**
     * Launch a new token on Bags Protocol
     */
    async launchToken(params: TokenLaunchParams): Promise<LaunchResult> {
        try {
            console.log(`🚀 Launching token ${params.symbol}...`);

            // Step 1: Get or create launch config
            const configResponse = await this.getOrCreateConfig();
            
            // Step 2: Create token info and metadata
            const tokenInfo = await this.createTokenInfo(params);
            
            // Step 3: Handle fee sharing if specified
            let finalConfigKey = configResponse.configKey;
            let feeShareWallet: string | undefined;
            
            if (params.feeShareTwitter) {
                const feeShareResult = await this.setupFeeSharing(
                    params.feeShareTwitter,
                    params.creatorFeeBps || 1000, // Default 10%
                    params.feeShareBps || 9000, // Default 90%
                    tokenInfo.tokenMint
                );
                finalConfigKey = feeShareResult.configKey;
                feeShareWallet = feeShareResult.feeShareWallet;
            }

            // Step 4: Create and send launch transaction
            const launchTx = await this.sdk.tokenLaunch.createLaunchTransaction({
                metadataUrl: tokenInfo.tokenMetadata,
                tokenMint: new PublicKey(tokenInfo.tokenMint),
                launchWallet: this.keypair.publicKey,
                initialBuyLamports: (params.initialBuyAmountSol || 0.01) * LAMPORTS_PER_SOL,
                configKey: finalConfigKey,
            });

            // Sign and send transaction
            launchTx.sign([this.keypair]);
            const signature = await this.sendTransaction(launchTx);

            const result: LaunchResult = {
                tokenMint: tokenInfo.tokenMint,
                signature,
                metadataUrl: tokenInfo.tokenMetadata,
                bagsUrl: `https://bags.fm/${tokenInfo.tokenMint}`,
                configKey: finalConfigKey.toString(),
                feeShareWallet
            };

            console.log(`🎉 Token launched successfully!`);
            console.log(`🪙 Token Mint: ${result.tokenMint}`);
            console.log(`🌐 View at: ${result.bagsUrl}`);

            return result;
        } catch (error) {
            console.error('Token launch failed:', error);
            throw error;
        }
    }

    /**
     * Get or create launch configuration
     */
    private async getOrCreateConfig() {
        console.log('⚙️ Getting launch configuration...');
        
        const configResponse = await this.sdk.config.getOrCreateConfig(
            this.keypair.publicKey
        );

        if (configResponse.transaction) {
            console.log('🔧 Creating new configuration...');
            configResponse.transaction.sign([this.keypair]);
            
            const signature = await this.sendTransaction(configResponse.transaction);
            console.log(`✅ Config created: ${signature}`);
        } else {
            console.log('♻️ Using existing configuration');
        }

        return configResponse;
    }

    /**
     * Create token info and upload metadata
     */
    private async createTokenInfo(params: TokenLaunchParams) {
        console.log('📝 Creating token info and metadata...');

        let imageBlob: Blob;
        
        if (params.imageUrl) {
            // Fetch image from URL
            const response = await fetch(params.imageUrl);
            imageBlob = await response.blob();
        } else if (params.imageFile) {
            // Use provided buffer
            imageBlob = new Blob([params.imageFile], { type: 'image/png' });
        } else {
            // Use default image
            const defaultImage = 'https://img.freepik.com/premium-vector/white-abstract-vactor-background-design_665257-153.jpg';
            const response = await fetch(defaultImage);
            imageBlob = await response.blob();
        }

        const tokenInfo = await this.sdk.tokenLaunch.createTokenInfoAndMetadata({
            image: imageBlob,
            name: params.name,
            symbol: params.symbol.toUpperCase().replace('$', ''),
            description: params.description,
            telegram: params.telegram,
            twitter: params.twitter,
            website: params.website,
        });

        console.log(`✨ Token info created: ${tokenInfo.tokenMint}`);
        return tokenInfo;
    }

    /**
     * Setup fee sharing configuration
     */
    private async setupFeeSharing(
        twitterHandle: string,
        creatorFeeBps: number,
        feeShareBps: number,
        tokenMint: string
    ) {
        console.log(`💰 Setting up fee sharing with @${twitterHandle}...`);

        // Get fee share wallet from Twitter handle
        const feeShareWallet = await this.sdk.state.getLaunchWalletForTwitterUsername(
            twitterHandle
        );

        if (!feeShareWallet) {
            throw new Error(`Could not find wallet for @${twitterHandle}`);
        }

        // Create fee share config
        const feeShareConfig = await this.sdk.config.createFeeShareConfig({
            users: [
                {
                    wallet: this.keypair.publicKey,
                    bps: creatorFeeBps,
                },
                {
                    wallet: feeShareWallet,
                    bps: feeShareBps,
                },
            ],
            payer: this.keypair.publicKey,
            baseMint: new PublicKey(tokenMint),
            quoteMint: new PublicKey('So11111111111111111111111111111111111111112'), // wSOL
        });

        if (feeShareConfig.transaction) {
            feeShareConfig.transaction.sign([this.keypair]);
            await this.sendTransaction(feeShareConfig.transaction);
        }

        console.log(`✅ Fee sharing configured`);
        console.log(`  Creator: ${creatorFeeBps / 100}%`);
        console.log(`  @${twitterHandle}: ${feeShareBps / 100}%`);

        return {
            configKey: feeShareConfig.configKey,
            feeShareWallet: feeShareWallet.toString()
        };
    }

    /**
     * Send a transaction with retry logic
     */
    private async sendTransaction(transaction: VersionedTransaction): Promise<string> {
        const blockhash = await this.connection.getLatestBlockhash();
        
        const signature = await this.connection.sendTransaction(transaction, {
            skipPreflight: true,
            maxRetries: 3,
        });

        const confirmation = await this.connection.confirmTransaction({
            blockhash: blockhash.blockhash,
            lastValidBlockHeight: blockhash.lastValidBlockHeight,
            signature,
        }, 'processed');

        if (confirmation.value.err) {
            throw new Error(`Transaction failed: ${confirmation.value.err}`);
        }

        return signature;
    }

    /**
     * Get token lifetime fees
     */
    async getTokenLifetimeFees(tokenMint: string): Promise<number> {
        const feesLamports = await this.sdk.state.getTokenLifetimeFees(
            new PublicKey(tokenMint)
        );
        return feesLamports / LAMPORTS_PER_SOL;
    }

    /**
     * Get token creators info
     */
    async getTokenCreators(tokenMint: string) {
        const creators = await this.sdk.state.getTokenCreators(
            new PublicKey(tokenMint)
        );
        return creators;
    }

    /**
     * Get claimable fees for a wallet
     */
    async getClaimablePositions() {
        const positions = await this.sdk.fee.getAllClaimablePositions(
            this.keypair.publicKey
        );
        return positions;
    }

    /**
     * Claim fees from positions
     */
    async claimFees(tokenMint?: string) {
        console.log('💰 Checking for claimable fees...');
        
        const positions = await this.getClaimablePositions();
        
        if (positions.length === 0) {
            console.log('No claimable positions found');
            return [];
        }

        // Filter by token if specified
        const targetPositions = tokenMint 
            ? positions.filter(p => p.baseMint === tokenMint)
            : positions;

        const signatures: string[] = [];

        for (const position of targetPositions) {
            console.log(`Claiming fees for ${position.baseMint}...`);
            
            const claimTxs = await this.sdk.fee.getClaimTransaction(
                this.keypair.publicKey,
                position
            );

            for (const tx of claimTxs) {
                tx.sign([this.keypair]);
                const sig = await this.sendTransaction(tx);
                signatures.push(sig);
                console.log(`✅ Claimed: ${sig}`);
            }
        }

        return signatures;
    }
}