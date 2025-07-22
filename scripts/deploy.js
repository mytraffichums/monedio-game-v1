const { createWalletClient, createPublicClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { monadTestnet } = require('viem/chains');
const fs = require('fs');
require('dotenv').config();

// Contract bytecode and ABI (you would get these from compiling the Solidity contract)
// For now, this is a placeholder - you'll need to compile the contract first
const CONTRACT_BYTECODE = "0x..."; // Replace with actual bytecode
const CONTRACT_ABI = [
  // ... ABI from compilation
];

async function deployContract() {
  // Setup client
  const account = privateKeyToAccount(process.env.PRIVATE_KEY);
  const publicClient = createPublicClient({
    chain: monadTestnet,
    transport: http()
  });

  const walletClient = createWalletClient({
    account,
    chain: monadTestnet,
    transport: http()
  });

  console.log('Deploying from account:', account.address);
  
  try {
    // Deploy contract
    const hash = await walletClient.deployContract({
      abi: CONTRACT_ABI,
      bytecode: CONTRACT_BYTECODE,
      args: [], // Constructor arguments (none in our case)
    });

    console.log('Deployment transaction hash:', hash);
    
    // Wait for deployment
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    
    console.log('Contract deployed successfully!');
    console.log('Contract address:', receipt.contractAddress);
    console.log('Gas used:', receipt.gasUsed);
    console.log('Block number:', receipt.blockNumber);

    // Save deployment info
    const deploymentInfo = {
      contractAddress: receipt.contractAddress,
      transactionHash: hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
      deployedAt: new Date().toISOString(),
      network: 'monad-testnet',
      owner: account.address
    };

    fs.writeFileSync('./deployment.json', JSON.stringify(deploymentInfo, null, 2));
    console.log('Deployment info saved to deployment.json');

    return receipt.contractAddress;
  } catch (error) {
    console.error('Deployment failed:', error);
    throw error;
  }
}

if (require.main === module) {
  deployContract()
    .then(address => {
      console.log(`\n🎉 Deployment complete!`);
      console.log(`Contract address: ${address}`);
      console.log(`\nNext steps:`);
      console.log(`1. Update your backend .env file with:`);
      console.log(`   CONTRACT_ADDRESS=${address}`);
      console.log(`2. Start your backend server: cd backend && npm start`);
      console.log(`3. Your game will now submit scores to the blockchain!`);
    })
    .catch(error => {
      console.error('Deployment failed:', error.message);
      process.exit(1);
    });
}

module.exports = { deployContract }; 