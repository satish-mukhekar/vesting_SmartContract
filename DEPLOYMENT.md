Deployment Summary
Network

Polygon Amoy Testnet

Chain ID: 80002

RPC: https://rpc-amoy.polygon.technology

Explorer: https://amoy.polygonscan.com

Stack

Solidity: 0.8.20

Framework: Hardhat

Optimiser: Enabled (runs: 200)

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

Trnsactions
https://amoy.polygonscan.com/tx/0x5efda78ebe71ff4253e84b480e775efb6a161b2048f17511dbed944524df8c82
https://amoy.polygonscan.com/tx/0x7f19f236af96f0438d03011f6678b6720bfda446ab1c47031a77d85ac278cfe7
https://amoy.polygonscan.com/tx/0xe90497024adb878f51c4a4fccb64b892c98004cb92b29086d6245ce32a8bfc4c

https://amoy.polygonscan.com/tx/0x5efda78ebe71ff4253e84b480e775efb6a161b2048f17511dbed944524df8c82
https://amoy.polygonscan.com/tx/0x7f19f236af96f0438d03011f6678b6720bfda446ab1c47031a77d85ac278cfe7

# Verify MockToken

npx hardhat verify --network amoy 0xC6a3AD8a7A70aea32e6B12560fF9C8E6283547d5 "Test Token" "TEST" 
