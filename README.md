oken Vesting Platform
Project Overview

This project implements a Token Vesting Platform on the Polygon Amoy Testnet.
It allows organizations to lock tokens for beneficiaries, providing a cliff period and linear vesting over time. A revocable option is included for flexibility, enabling the owner to cancel vesting schedules if necessary.

Architecture & Design Decisions

TokenVesting.sol – The main smart contract that manages vesting schedules for multiple beneficiaries.

MockToken.sol – ERC20 token used for testing purposes.

Data Structure – Multiple schedules per beneficiary are stored using:

mapping(address => uint256[]) private beneficiarySchedules;


Linear Vesting – Tokens unlock gradually after the cliff period.

Revocable Option – The contract owner can revoke a vesting schedule to reclaim unvested tokens.

How Vesting Calculation Works

The formula for calculating vested tokens is:

if (time < start + cliff) 
    vested = 0
else if (time >= start + duration) 
    vested = totalAmount
else 
    vested = totalAmount * (time - start) / duration


Cliff period – No tokens can be claimed before this period.

Linear vesting – Tokens unlock gradually after the cliff until the vesting period ends.

Installation & Setup
# Clone the repository
git clone https://github.com/satish-mukhekar/vesting_SmartContract.git
cd vesting_SmartContract

# Install dependencies
npm install

# Compile smart contracts
npx hardhat compile

How to Run Tests
# Run all unit tests
npx hardhat test --network amoy

# Run deployment test script
npx hardhat run scripts/test-amoy-deployment.js --network amoy

How to Deploy
# Deploy contracts to Polygon Amoy Testnet
npx hardhat run scripts/deploy-amoy.js --network amoy

# Verify contracts on PolygonScan
npx hardhat verify --network amoy <TokenVesting_Contract_Address>
npx hardhat verify --network amoy <MockToken_Contract_Address> "Test Token" "TEST"


Tips:

Ensure your deployer account has enough MATIC on the testnet.

Use the .env file to securely store your PRIVATE_KEY and POLYGONSCAN_API_KEY.