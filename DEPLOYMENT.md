Deployment Summary
Network

Polygon Amoy Testnet

Chain ID: 80002

RPC: https://rpc-amoy.polygon.technology

Explorer: https://amoy.polygonscan.com

Stack

Solidity: 0.8.20

Framework: Hardhat

Optimizer: Enabled (runs: 200)

Verification: Polygonscan (Etherscan API v2)

Deployment Commands
npx hardhat compile
npx hardhat run scripts/deploy-amoy.js --network amoy

Deployed Contracts
TokenVesting

Address: 0x0F28d7c269f188AE919b44FaFC7BC225603e29F0

Constructor: None

Explorer: https://amoy.polygonscan.com/address/0x0F28d7c269f188AE919b44FaFC7BC225603e29F0

MockToken

Address: 0xC6a3AD8a7A70aea32e6B12560fF9C8E6283547d5

Constructor Arguments:

"Test Token"

"TEST"

"1000000000000000000000000" (1M tokens in wei)

Explorer: https://amoy.polygonscan.com/address/0xC6a3AD8a7A70aea32e6B12560fF9C8E6283547d5

Verification Commands
# Verify TokenVesting
npx hardhat verify --network amoy 0x0F28d7c269f188AE919b44FaFC7BC225603e29F0

# Verify MockToken
npx hardhat verify --network amoy 0xC6a3AD8a7A70aea32e6B12560fF9C8E6283547d5 "Test Token" "TEST" 