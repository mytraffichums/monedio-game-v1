# Monedio Game - Blockchain Score Submission

A secure multiplayer game with blockchain-based score storage on Monad Testnet.

## Architecture Overview

This implementation provides secure score submission through:

1. **Smart Contract** (`contracts/GameScores.sol`) - Stores scores on Monad Testnet
2. **Backend Service** (`backend/`) - Validates and submits scores securely  
3. **Frontend Game** (`index.html`) - Multiplayer game with score UI
4. **Owner-Only Security** - Only the game owner can submit scores

## Security Features

- ✅ Private key never exposed to frontend
- ✅ Server-side score validation
- ✅ Owner-only smart contract submission
- ✅ Rate limiting and security middleware
- ✅ Transaction confirmation and status tracking

## Setup Instructions

### 1. Smart Contract Deployment

#### Prerequisites
- Node.js and npm installed
- Monad Testnet tokens for deployment
- A wallet private key with testnet funds

#### Deploy the Contract

```bash
# Install dependencies for deployment
npm install viem dotenv

# Create .env file with your private key
echo "PRIVATE_KEY=0x..." > .env

# Compile and deploy (you'll need to compile the Solidity first)
# Use Remix, Hardhat, or Foundry to compile contracts/GameScores.sol
# Then update scripts/deploy.js with the bytecode and ABI

node scripts/deploy.js
```

### 2. Backend Service Setup

```bash
cd backend

# Install dependencies
npm install

# Create environment file
cp config.example.js .env

# Edit .env with your values:
# PORT=3001
# PRIVATE_KEY=0x...your_private_key...
# CONTRACT_ADDRESS=0x...deployed_contract_address...

# Start the backend server
npm start
```

The backend will run on `http://localhost:3001`

### 3. Frontend Game Setup

Your game (`index.html`) is already configured to:
- Submit scores to the backend when rounds end
- Display blockchain submission status
- Show transaction links to Monad Explorer

Just open `index.html` in a browser and the game will connect to your backend.

## API Endpoints

### POST `/api/submit-scores`
Submit round scores to blockchain
```json
{
  "sessionId": "string",
  "roundNumber": number,
  "scores": [
    {"playerId": "string", "score": number}
  ]
}
```

### GET `/api/scores/:sessionId/:roundNumber`
Retrieve scores from blockchain
```json
{
  "sessionId": "string",
  "roundNumber": number,
  "scores": [
    {"playerId": "string", "score": number, "timestamp": number}
  ]
}
```

## Environment Variables

### Backend (.env)
```bash
PORT=3001
FRONTEND_URL=http://localhost:3000
PRIVATE_KEY=0x...your_private_key...
CONTRACT_ADDRESS=0x...deployed_contract_address...
```

## Development

### Running in Development Mode

```bash
# Backend with hot reload
cd backend
npm run dev

# Frontend
# Just open index.html or serve via local server
python -m http.server 3000
```

### Testing Score Submission

1. Start the backend service
2. Open the game in browser
3. Play until a round ends
4. Check the score overlay for blockchain status
5. View transaction on Monad Explorer

## Smart Contract Interface

The `GameScores` contract provides:

- `submitRoundScores()` - Owner-only score submission
- `getRoundScores()` - Public score retrieval  
- `getPlayerScore()` - Individual player score lookup
- Events for tracking submissions

## Security Considerations

- Private keys are stored server-side only
- All transactions originate from the game owner account
- Rate limiting prevents abuse
- Score validation happens server-side
- Frontend only displays status, cannot forge scores

## Troubleshooting

### Common Issues

**Backend fails to start:**
- Check that `PRIVATE_KEY` and `CONTRACT_ADDRESS` are set
- Verify the private key format (should start with 0x)
- Ensure contract is deployed on Monad Testnet

**Scores not submitting:**
- Check backend logs for errors
- Verify the owner account has testnet funds for gas
- Confirm the contract address is correct

**Transaction not confirming:**
- Monad Testnet may have delays
- Check the explorer link for transaction status
- Ensure sufficient gas funds in owner account

## Monitoring

Watch backend logs for:
- Score submission requests
- Blockchain transaction status
- Gas usage and costs
- Error conditions

## Next Steps

Consider adding:
- Database backup of scores
- Batch submission for gas efficiency  
- Player authentication/verification
- Leaderboard aggregation across sessions
- Automated testing suite

## Contributing

1. Fork the repository
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

MIT License - see LICENSE file for details 