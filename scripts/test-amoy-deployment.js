const { ethers } = require("hardhat");

async function main() {
    console.log("Testing Token Vesting Transactions on Polygon Amoy Testnet");
    console.log("==========================================================");

    // ---------------------------
    // Deployed contract addresses
    // ---------------------------
    const VESTING_ADDRESS = "0x0F28d7c269f188AE919b44FaFC7BC225603e29F0";
    const TOKEN_ADDRESS = "0xC6a3AD8a7A70aea32e6B12560fF9C8E6283547d5";

    const [tester] = await ethers.getSigners();
    console.log("Testing with account:", tester.address);

    // ---------------------------
    // Get contract instances
    // ---------------------------
    const tokenVesting = await ethers.getContractAt("TokenVesting", VESTING_ADDRESS);
    const mockToken = await ethers.getContractAt("MockToken", TOKEN_ADDRESS);

    console.log("\n1. Checking initial state...");
    const owner = await tokenVesting.owner().catch(() => "Different deployer");
    const nextId = await tokenVesting.nextScheduleId();
    const balance = await mockToken.balanceOf(tester.address);

    console.log("✅ TokenVesting owner:", owner);
    console.log("✅ Next schedule ID:", nextId.toString());
    console.log("✅ Tester token balance:", ethers.formatEther(balance));

    // ---------------------------
    // Transaction 1: Approve Tokens
    // ---------------------------
    const vestingAmount = ethers.parseEther("1000");
    console.log("\n2. Approving tokens for vesting...");
    const approveTx = await mockToken.approve(VESTING_ADDRESS, vestingAmount);
    await approveTx.wait();
    console.log("✅ Approved", ethers.formatEther(vestingAmount), "tokens");

    // ---------------------------
    // Transaction 2: Create Vesting Schedule
    // ---------------------------
    console.log("\n3. Creating vesting schedule...");
    const currentTime = Math.floor(Date.now() / 1000);
    const startTime = currentTime + 60; // start 1 min later
    const cliff = 30 * 24 * 60 * 60; // 30 days
    const duration = 365 * 24 * 60 * 60; // 1 year

    const createTx = await tokenVesting.createVestingSchedule(
        tester.address,
        TOKEN_ADDRESS,
        vestingAmount,
        startTime,
        cliff,
        duration,
        true
    );
    const receipt = await createTx.wait();
    console.log("✅ Vesting schedule created. Tx:", receipt.transactionHash);

    // ---------------------------
    // Transaction 3: Fetch Schedule
    // ---------------------------
    const schedule = await tokenVesting.getVestingSchedule(0);
    console.log("\n4. Schedule details:");
    console.log("Beneficiary:", schedule.beneficiary);
    console.log("Total amount:", ethers.formatEther(schedule.totalAmount));
    console.log("Start:", new Date(Number(schedule.startTime) * 1000).toISOString());
    console.log("Cliff (days):", Number(schedule.cliffDuration)/(24*60*60));
    console.log("Vesting duration (days):", Number(schedule.vestingDuration)/(24*60*60));
    console.log("Revocable:", schedule.revocable);

    // ---------------------------
    // Transaction 4: Check vested and claimable
    // ---------------------------
    const vested = await tokenVesting.getVestedAmount(0);
    const claimable = await tokenVesting.getClaimableAmount(0);
    console.log("\n5. Vesting status:");
    console.log("Vested amount:", ethers.formatEther(vested));
    console.log("Claimable amount:", ethers.formatEther(claimable));

    console.log("\n✅ Transactions and testing completed successfully!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("💥 Testing failed:", error);
        process.exit(1);
    });
