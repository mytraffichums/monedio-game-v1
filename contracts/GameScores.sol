// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract GameScores {
    address public owner;
    
    struct RoundScore {
        uint256 roundNumber;
        string playerId;
        uint256 score;
        uint256 timestamp;
        string sessionId;
    }
    
    // Mapping from session -> round -> array of scores
    mapping(string => mapping(uint256 => RoundScore[])) public roundScores;
    
    // Events
    event RoundSubmitted(string indexed sessionId, uint256 indexed roundNumber, uint256 playerCount);
    event ScoreRecorded(string indexed sessionId, uint256 indexed roundNumber, string playerId, uint256 score);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can submit scores");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    function submitRoundScores(
        string calldata sessionId,
        uint256 roundNumber,
        string[] calldata playerIds,
        uint256[] calldata scores
    ) external onlyOwner {
        require(playerIds.length == scores.length, "Arrays must have same length");
        require(playerIds.length > 0, "Must submit at least one score");
        
        // Clear previous scores for this round (in case of resubmission)
        delete roundScores[sessionId][roundNumber];
        
        for (uint256 i = 0; i < playerIds.length; i++) {
            RoundScore memory roundScore = RoundScore({
                roundNumber: roundNumber,
                playerId: playerIds[i],
                score: scores[i],
                timestamp: block.timestamp,
                sessionId: sessionId
            });
            
            roundScores[sessionId][roundNumber].push(roundScore);
            emit ScoreRecorded(sessionId, roundNumber, playerIds[i], scores[i]);
        }
        
        emit RoundSubmitted(sessionId, roundNumber, playerIds.length);
    }
    
    function getRoundScores(string calldata sessionId, uint256 roundNumber) 
        external view returns (RoundScore[] memory) {
        return roundScores[sessionId][roundNumber];
    }
    
    function getPlayerScore(string calldata sessionId, uint256 roundNumber, string calldata playerId) 
        external view returns (uint256) {
        RoundScore[] memory scores = roundScores[sessionId][roundNumber];
        for (uint256 i = 0; i < scores.length; i++) {
            if (keccak256(bytes(scores[i].playerId)) == keccak256(bytes(playerId))) {
                return scores[i].score;
            }
        }
        return 0; // Player not found
    }
    
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner cannot be zero address");
        owner = newOwner;
    }
} 