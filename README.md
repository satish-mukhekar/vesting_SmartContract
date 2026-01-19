Project Overview

This project implements a Token Vesting platform on the Polygon Amoy Testnet. It allows organizations to lock tokens for beneficiaries, providing a cliff period and linear vesting over time. A revocable option is included for flexibility.

Architecture and Design Decisions

TokenVesting.sol: Main contract managing vesting schedules.

MockToken.sol: ERC20 token used for testing.

Mapping for schedules: mapping(address => uint256[]) to store multiple schedules per beneficiary.

Linear vesting: Tokens unlock gradually after cliff.

Vesting Calculation

Vested tokens =

if (time < start + cliff) => 0
else if (time >= start + duration) => totalAmount
else => totalAmount * (time - start) / duration

Installation & Setup
git clone <repo-url>
cd token-vesting-project
npm install
npx hardhat compile

Run Tests
npx hardhat test --network amoy
npx hardhat run scripts/test-amoy-deployment.js --network amoy

Deploy Contracts
npx hardhat run scripts/deploy-amoy.js --network amoy
npx hardhat verify --network amoy <TokenVestingAddress>
npx hardhat verify --network amoy <MockTokenAddress> "Test Token" "TEST"