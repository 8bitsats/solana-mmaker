# Token Launch Guide - Bags Protocol Integration

This bot now includes full token launch capabilities via Bags Protocol, allowing you to launch tokens with customizable parameters, fee sharing, and automatic market making.

## 🚀 Quick Start

### Prerequisites
1. Set up your environment variables in `.env`:
```bash
BAGS_API_KEY=your_bags_api_key_here
HELIUS_RPC_URL=your_helius_rpc_url
USER_KEYPAIR=path_to_keypair.json
```

2. Get your Bags API key from: https://dev.bags.fm

### Installation
```bash
npm install
```

## 📋 Available Commands

### 1. Launch Token - Interactive Mode
```bash
npm run launch:interactive
# or
npm run bot launch -i
```
This will guide you through the launch process step by step.

### 2. Launch Token - From Config File
```bash
npm run bot launch -c launch-config.json
```
Create a config file with your token parameters (see `launch-config.example.json`).

### 3. Quick Launch
```bash
npm run bot launch -q
```
Uses default parameters from environment variables.

### 4. Get Token Information
```bash
npm run bot info <TOKEN_MINT_ADDRESS>
```
Shows lifetime fees and creator information.

### 5. Claim Fees
```bash
npm run claim
# or claim for specific token
npm run bot claim -t <TOKEN_MINT_ADDRESS>
```

### 6. Monitor Tokens
```bash
npm run monitor
# or monitor specific tokens
npm run bot monitor -t "mint1,mint2,mint3"
```

### 7. Run Market Maker
```bash
npm run mm
# or with trading enabled
npm run bot mm -e
```

## 🎯 Launch Configuration

### Basic Parameters
- **name**: Token name (e.g., "Solana Meme Coin")
- **symbol**: Token symbol (e.g., "SMEME")
- **description**: Token description
- **imageUrl**: URL to token image (or provide local file)
- **initialBuyAmountSol**: Initial SOL to buy (default: 0.01)

### Social Links (Optional)
- **twitter**: Twitter/X URL
- **telegram**: Telegram group URL
- **website**: Project website

### Fee Sharing (Optional)
- **feeShareTwitter**: Twitter handle for fee sharing (without @)
- **creatorFeeBps**: Your fee percentage in basis points (1000 = 10%)
- **feeShareBps**: Fee share percentage (must total 10000 with creatorFeeBps)

## 💰 Fee Structure

When launching with fee sharing:
- Total fees must equal 100% (10000 basis points)
- Common splits:
  - 10/90: Creator gets 10%, partner gets 90%
  - 50/50: Equal split
  - 20/80: Creator gets 20%, partner gets 80%

## 📊 Token Management

### Launch History
All launched tokens are saved in the `launches/` directory:
```
launches/
├── <token_mint_1>.json
├── <token_mint_2>.json
└── ...
```

### Monitoring Dashboard
The monitor command provides real-time fee tracking:
```bash
npm run monitor
```
This will:
- Load all tokens from launch history
- Display lifetime fees every 60 seconds
- Track fee accumulation over time

## 🔧 Advanced Usage

### Custom Launch Script
```typescript
import { TokenLauncher } from './launcher';
import { TokenLaunchParams } from './api/bags';

const params: TokenLaunchParams = {
    name: "My Token",
    symbol: "MTK",
    description: "Description here",
    imageUrl: "https://example.com/image.png",
    initialBuyAmountSol: 1.0,
    feeShareTwitter: "partner_handle",
    creatorFeeBps: 2000, // 20%
    feeShareBps: 8000   // 80%
};

const launcher = new TokenLauncher(bagsApiKey, connection, keypair);
const result = await launcher.quickLaunch(params);
```

### Programmatic Fee Claiming
```typescript
// Claim all fees
const signatures = await launcher.claimAllFees();

// Claim for specific token
const signatures = await bagsProtocol.claimFees(tokenMint);
```

## 🛡️ Security Notes

1. **Never share your private keys or API keys**
2. **Keep your `.env` file secure and never commit it**
3. **Test on devnet first if available**
4. **Verify all parameters before launching**
5. **Monitor your launched tokens regularly**

## 🆘 Troubleshooting

### Common Issues

1. **"BAGS_API_KEY is not set"**
   - Add your Bags API key to `.env` file
   - Get one from https://dev.bags.fm

2. **"Transaction failed"**
   - Check wallet balance for SOL
   - Ensure RPC endpoint is valid
   - Try increasing initial buy amount

3. **"Fee share wallet not found"**
   - Verify the Twitter handle exists
   - User must have connected wallet to Bags

4. **Rate Limiting**
   - Bags API has rate limits (1000 req/hour)
   - Implement delays between batch operations

## 📚 API Reference

### Bags Protocol Endpoints
- Base URL: `https://public-api-v2.bags.fm/api/v1/`
- Documentation: https://docs.bags.fm

### Key Features
- Token creation with metadata
- Automatic bonding curve setup
- Fee sharing configuration
- Claim transactions
- Analytics and monitoring

## 🎉 Example Launch Flow

1. **Prepare token assets**
   - Create/find token image
   - Write description
   - Set up social links

2. **Configure launch**
   ```bash
   npm run launch:interactive
   ```

3. **Monitor performance**
   ```bash
   npm run bot info <TOKEN_MINT>
   ```

4. **Claim accumulated fees**
   ```bash
   npm run claim
   ```

5. **Run market maker** (optional)
   ```bash
   npm run mm -e
   ```

## 📈 Market Making Integration

After launching a token, you can:
1. Add it to your market maker configuration
2. Set spread and position limits
3. Enable automated trading

Update `.env`:
```bash
TARGET_TOKEN_CA=<YOUR_NEW_TOKEN_MINT>
MM_ENABLED=true
MM_BASE_SPREAD=0.5
```

Then run:
```bash
npm run mm -e
```

## 🔗 Resources

- [Bags Protocol Docs](https://docs.bags.fm)
- [Solana Web3.js](https://solana-labs.github.io/solana-web3.js/)
- [Jupiter Aggregator](https://docs.jup.ag/)
- [Helius RPC](https://docs.helius.dev/)

## 📞 Support

For issues or questions:
- Bags Protocol: https://discord.gg/bags
- GitHub Issues: [Create an issue](https://github.com/yourusername/solana-mmaker/issues)

---

**⚠️ Disclaimer**: Token launching involves financial risk. Always DYOR and test thoroughly before mainnet deployment.