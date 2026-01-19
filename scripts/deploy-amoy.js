const { ethers } = require("hardhat");

async function main() {
    console.log("Deploying Token Vesting Platform to Polygon Amoy Testnet...");
    console.log("==========================================================");

    const [deployer] = await ethers.getSigners(); // uses your PRIVATE_KEY from hardhat.config.js
    console.log("Deploying contracts with account:", deployer.address);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", ethers.formatEther(balance), "MATIC");

    if (balance < ethers.parseEther("0.01")) {
        console.log("⚠️ Low balance. Get MATIC from: https://faucet.polygon.technology/");
    }

    // Deploy TokenVesting
    const TokenVesting = await ethers.getContractFactory("TokenVesting");
    const tokenVesting = await TokenVesting.deploy();
    await tokenVesting.waitForDeployment();
    const vestingAddress = await tokenVesting.getAddress();
    console.log("✅ TokenVesting deployed to:", vestingAddress);

    // Deploy MockToken
    const MockToken = await ethers.getContractFactory("MockToken");
    const mockToken = await MockToken.deploy("Test Token", "TEST", ethers.parseEther("1000000"));
    await mockToken.waitForDeployment();
    const tokenAddress = await mockToken.getAddress();
    console.log("✅ MockToken deployed to:", tokenAddress);

    console.log("\n🎉 Deployment completed successfully!");
}

main().catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
});
