require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createWalletClient, createPublicClient, http, parseEther } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { monadTestnet } = require('viem/chains');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:5500'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing
app.use(express.json());

// Environment variables validation
const requiredEnvVars = ['PRIVATE_KEY', 'CONTRACT_ADDRESS'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Blockchain setup
const account = privateKeyToAccount(process.env.PRIVATE_KEY);
console.log(`teeest`, monadTestnet);
const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(monadTestnet.rpcUrls.default.http[0])
});

const walletClient = createWalletClient({
  account,
  chain: monadTestnet,
  transport: http()
});

// Smart contract ABI (minimal for our needs)
const CONTRACT_ABI = [
  {
    "type": "function",
    "name": "submitRoundScores",
    "inputs": [
      {"name": "sessionId", "type": "string"},
      {"name": "roundNumber", "type": "uint256"},
      {"name": "playerIds", "type": "string[]"},
      {"name": "scores", "type": "uint256[]"}
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getRoundScores",
    "inputs": [
      {"name": "sessionId", "type": "string"},
      {"name": "roundNumber", "type": "uint256"}
    ],
    "outputs": [
      {
        "type": "tuple[]",
        "components": [
          {"name": "roundNumber", "type": "uint256"},
          {"name": "playerId", "type": "string"},
          {"name": "score", "type": "uint256"},
          {"name": "timestamp", "type": "uint256"},
          {"name": "sessionId", "type": "string"}
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "RoundSubmitted",
    "inputs": [
      {"name": "sessionId", "type": "string", "indexed": true},
      {"name": "roundNumber", "type": "uint256", "indexed": true},
      {"name": "playerCount", "type": "uint256", "indexed": false}
    ]
  }
];

// Validation functions
function validateScoreSubmission(data) {
  const { sessionId, roundNumber, scores } = data;
  
  if (!sessionId || typeof sessionId !== 'string') {
    return { valid: false, error: 'Invalid sessionId' };
  }
  
  if (!roundNumber || typeof roundNumber !== 'number' || roundNumber < 1) {
    return { valid: false, error: 'Invalid roundNumber' };
  }
  
  if (!Array.isArray(scores) || scores.length === 0) {
    return { valid: false, error: 'Scores must be a non-empty array' };
  }
  
  for (const score of scores) {
    if (!score.playerId || typeof score.playerId !== 'string') {
      return { valid: false, error: 'Invalid playerId in scores' };
    }
    
    if (typeof score.score !== 'number' || score.score < 0) {
      return { valid: false, error: 'Invalid score value' };
    }
  }
  
  return { valid: true };
}

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.post('/api/submit-scores', async (req, res) => {
  try {
    console.log('Received score submission:', req.body);
    
    // Validate request
    const validation = validateScoreSubmission(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
    
    const { sessionId, roundNumber, scores, gameValidationToken } = req.body;
    
    // Optional: Add additional validation logic here
    // For example, verify gameValidationToken if you implement it
    
    // Prepare contract parameters
    const playerIds = scores.map(s => s.playerId);
    const scoreValues = scores.map(s => BigInt(Math.floor(s.score)));
    
    console.log('Submitting to contract:', {
      sessionId,
      roundNumber: BigInt(roundNumber),
      playerIds,
      scoreValues
    });
    
    // Submit to smart contract
    const hash = await walletClient.writeContract({
      address: process.env.CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: 'submitRoundScores',
      args: [sessionId, BigInt(roundNumber), playerIds, scoreValues]
    });
    
    console.log('Transaction submitted:', hash);
    
    // Wait for transaction confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    
    console.log('Transaction confirmed:', receipt);
    
    res.json({
      success: true,
      transactionHash: hash,
      blockNumber: receipt.blockNumber.toString(),
      gasUsed: receipt.gasUsed.toString(),
      submittedAt: new Date().toISOString(),
      playerCount: scores.length
    });
    
  } catch (error) {
    console.error('Error submitting scores:', error);
    
    let errorMessage = 'Failed to submit scores';
    let statusCode = 500;
    
    if (error.message.includes('insufficient funds')) {
      errorMessage = 'Insufficient funds for transaction';
    } else if (error.message.includes('Only owner can submit')) {
      errorMessage = 'Unauthorized to submit scores';
      statusCode = 403;
    } else if (error.message.includes('execution reverted')) {
      errorMessage = 'Smart contract execution failed';
    }
    
    res.status(statusCode).json({
      error: errorMessage,
      details: error.message
    });
  }
});

app.get('/api/scores/:sessionId/:roundNumber', async (req, res) => {
  try {
    const { sessionId, roundNumber } = req.params;
    
    const scores = await publicClient.readContract({
      address: process.env.CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: 'getRoundScores',
      args: [sessionId, BigInt(roundNumber)]
    });
    
    // Format the response
    const formattedScores = scores.map(score => ({
      playerId: score.playerId,
      score: Number(score.score),
      timestamp: Number(score.timestamp),
      roundNumber: Number(score.roundNumber)
    })).sort((a, b) => b.score - a.score); // Sort by score descending
    
    res.json({
      sessionId,
      roundNumber: parseInt(roundNumber),
      scores: formattedScores
    });
    
  } catch (error) {
    console.error('Error retrieving scores:', error);
    res.status(500).json({
      error: 'Failed to retrieve scores',
      details: error.message
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log(`Contract address: ${process.env.CONTRACT_ADDRESS}`);
  console.log(`Owner address: ${account.address}`);
}); 