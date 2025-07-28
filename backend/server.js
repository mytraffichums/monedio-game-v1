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

// Smart contract ABI (complete ABI)
const CONTRACT_ABI = [
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "string",
        "name": "sessionId",
        "type": "string"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "roundNumber",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "playerCount",
        "type": "uint256"
      }
    ],
    "name": "RoundSubmitted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "string",
        "name": "sessionId",
        "type": "string"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "roundNumber",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "playerId",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "score",
        "type": "uint256"
      }
    ],
    "name": "ScoreRecorded",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "sessionId",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "roundNumber",
        "type": "uint256"
      },
      {
        "internalType": "string",
        "name": "playerId",
        "type": "string"
      }
    ],
    "name": "getPlayerScore",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "sessionId",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "roundNumber",
        "type": "uint256"
      }
    ],
    "name": "getRoundScores",
    "outputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "roundNumber",
            "type": "uint256"
          },
          {
            "internalType": "string",
            "name": "playerId",
            "type": "string"
          },
          {
            "internalType": "uint256",
            "name": "score",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "timestamp",
            "type": "uint256"
          },
          {
            "internalType": "string",
            "name": "sessionId",
            "type": "string"
          }
        ],
        "internalType": "struct GameScores.RoundScore[]",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "roundScores",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "roundNumber",
        "type": "uint256"
      },
      {
        "internalType": "string",
        "name": "playerId",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "score",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      },
      {
        "internalType": "string",
        "name": "sessionId",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "sessionId",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "roundNumber",
        "type": "uint256"
      },
      {
        "internalType": "string[]",
        "name": "playerIds",
        "type": "string[]"
      },
      {
        "internalType": "uint256[]",
        "name": "scores",
        "type": "uint256[]"
      }
    ],
    "name": "submitRoundScores",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "transferOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
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

// New endpoint for getting scores with session top score
app.get('/api/get-scores', async (req, res) => {
  try {
    const { sessionId, roundNumber } = req.query;
    
    if (!sessionId || !roundNumber) {
      return res.status(400).json({
        error: 'sessionId and roundNumber query parameters are required'
      });
    }
    
    console.log(`Fetching scores for session ${sessionId}, round ${roundNumber}`);
    
    // Get current round scores
    const currentRoundScores = await publicClient.readContract({
      address: process.env.CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: 'getRoundScores',
      args: [sessionId, BigInt(roundNumber)]
    });
    
    // Format current round scores
    const formattedRoundScores = currentRoundScores.map(score => ({
      playerId: score.playerId,
      score: Number(score.score),
      timestamp: Number(score.timestamp),
      roundNumber: Number(score.roundNumber)
    })).sort((a, b) => b.score - a.score);
    
    // Calculate session top score by fetching all rounds for this session
    const playerTotals = new Map();
    const maxRoundToCheck = Math.max(10, parseInt(roundNumber)); // Check up to current round or 10, whichever is higher
    
    for (let round = 1; round <= maxRoundToCheck; round++) {
      try {
        const roundScores = await publicClient.readContract({
          address: process.env.CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: 'getRoundScores',
          args: [sessionId, BigInt(round)]
        });
        
        roundScores.forEach(score => {
          const playerId = score.playerId;
          const scoreValue = Number(score.score);
          
          if (!playerTotals.has(playerId)) {
            playerTotals.set(playerId, {
              playerId: playerId,
              totalScore: 0,
              roundCount: 0
            });
          }
          
          const playerData = playerTotals.get(playerId);
          playerData.totalScore += scoreValue;
          playerData.roundCount += 1;
          playerTotals.set(playerId, playerData);
        });
      } catch (roundError) {
        // Round doesn't exist yet or error fetching - skip it
        if (round > parseInt(roundNumber)) {
          break; // Stop if we've gone beyond current round
        }
      }
    }
    
    // Find session top score
    let sessionTopScore = null;
    let highestTotal = 0;
    
    for (const [playerId, data] of playerTotals) {
      if (data.totalScore > highestTotal) {
        highestTotal = data.totalScore;
        sessionTopScore = {
          playerId: data.playerId,
          totalScore: data.totalScore,
          roundCount: data.roundCount
        };
      }
    }
    
    console.log(`Found ${formattedRoundScores.length} scores for round ${roundNumber}`);
    console.log(`Session top score:`, sessionTopScore);
    
    res.json({
      sessionId,
      roundNumber: parseInt(roundNumber),
      roundScores: formattedRoundScores,
      sessionTopScore: sessionTopScore,
      retrievedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error retrieving scores:', error);
    res.status(500).json({
      error: 'Failed to retrieve scores from blockchain',
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