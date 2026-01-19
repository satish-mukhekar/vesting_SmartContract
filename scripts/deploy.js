const { ethers } = require("hardhat");

async function main() {
    console.log("Deploying Token Vesting Platform...");

    // Get the deployer account
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);
    console.log("Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)));

    // Deploy TokenVesting contract
    const TokenVesting = await ethers.getContractFactory("TokenVesting");
    const tokenVesting = await TokenVesting.deploy();
    await tokenVesting.waitForDeployment();

    console.log("TokenVesting deployed to:", await tokenVesting.getAddress());

    // Deploy MockToken for testing (optional)
    const MockToken = await ethers.getContractFactory("MockToken");
    const mockToken = await MockToken.deploy(
        "Test Token",
        "TEST",
        ethers.parseEther("1000000") // 1M tokens
    );
    await mockToken.waitForDeployment();

    console.log("MockToken deployed to:", await mockToken.getAddress());

    // Verify deployment
    console.log("\nDeployment Summary:");
    console.log("==================");
    console.log("TokenVesting:", await tokenVesting.getAddress());
    console.log("MockToken:", await mockToken.getAddress());
    console.log("Owner:", await tokenVesting.owner());
    console.log("Next Schedule ID:", await tokenVesting.nextScheduleId());

    return {
        tokenVesting: await tokenVesting.getAddress(),
        mockToken: await mockToken.getAddress()
    };
}

// Execute deployment
main()
    .then((addresses) => {
        console.log("\nDeployment completed successfully!");
        console.log("Contract addresses:", addresses);
        process.exit(0);
    })
    .catch((error) => {
        console.error("Deployment failed:", error);
        process.exit(1);
    });