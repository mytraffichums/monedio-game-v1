// Copy this file to .env and fill in the values

/*
Backend Configuration:
PORT=3001
FRONTEND_URL=http://localhost:3000

Blockchain Configuration:
PRIVATE_KEY=0x...your_private_key_here...
CONTRACT_ADDRESS=0x...your_deployed_contract_address_here...

Optional RPC URL for custom endpoint (defaults to Monad testnet):
RPC_URL=https://testnet-rpc.monad.xyz
*/

module.exports = {
  port: process.env.PORT || 3001,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  privateKey: process.env.PRIVATE_KEY,
  contractAddress: process.env.CONTRACT_ADDRESS,
  rpcUrl: process.env.RPC_URL || 'https://testnet-rpc.monad.xyz'
}; 