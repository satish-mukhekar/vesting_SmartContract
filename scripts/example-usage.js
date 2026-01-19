const { ethers } = require("hardhat");

async function main() {
    console.log("Token Vesting Platform - Usage Example");
    console.log("=====================================");

    // Get signers
    const [owner, creator, beneficiary] = await ethers.getSigners();

    // Deploy contracts
    console.log("\n1. Deploying contracts...");
    const TokenVesting = await ethers.getContractFactory("TokenVesting");
    const tokenVesting = await TokenVesting.deploy();
    await tokenVesting.waitForDeployment();

    const MockToken = await ethers.getContractFactory("MockToken");
    const mockToken = await MockToken.deploy("Test Token", "TEST", ethers.parseEther("1000000"));
    await mockToken.waitForDeployment();

    console.log("TokenVesting deployed to:", await tokenVesting.getAddress());
    console.log("MockToken deployed to:", await mockToken.getAddress());

    // Transfer tokens to creator
    console.log("\n2. Setting up tokens...");
    const vestingAmount = ethers.parseEther("1000");
    await mockToken.transfer(creator.address, vestingAmount);
    console.log(`Transferred ${ethers.formatEther(vestingAmount)} tokens to creator`);

    // Create vesting schedule
    console.log("\n3. Creating vesting schedule...");
    const currentTime = Math.floor(Date.now() / 1000);
    const startTime = currentTime + 60; // Start in 1 minute
    const cliffDuration = 6 * 30 * 24 * 60 * 60; // 6 months
    const vestingDuration = 24 * 30 * 24 * 60 * 60; // 24 months

    // Approve tokens
    await mockToken.connect(creator).approve(tokenVesting.target, vestingAmount);

    const tx = await tokenVesting.connect(creator).createVestingSchedule(
        beneficiary.address,
        mockToken.target,
        vestingAmount,
        startTime,
        cliffDuration,
        vestingDuration,
        true // revocable
    );

    const receipt = await tx.wait();
    const scheduleId = 0; // First schedule

    console.log("Vesting schedule created!");
    console.log("Schedule ID:", scheduleId);
    console.log("Beneficiary:", beneficiary.address);
    console.log("Total Amount:", ethers.formatEther(vestingAmount));
    console.log("Start Time:", new Date(startTime * 1000).toISOString());
    console.log("Cliff Duration:", cliffDuration / (30 * 24 * 60 * 60), "months");
    console.log("Vesting Duration:", vestingDuration / (30 * 24 * 60 * 60), "months");

    // Check schedule details
    console.log("\n4. Checking schedule details...");
    const schedule = await tokenVesting.getVestingSchedule(scheduleId);
    console.log("Schedule details:");
    console.log("- Beneficiary:", schedule.beneficiary);
    console.log("- Token:", schedule.token);
    console.log("- Total Amount:", ethers.formatEther(schedule.totalAmount));
    console.log("- Claimed Amount:", ethers.formatEther(schedule.claimedAmount));
    console.log("- Revocable:", schedule.revocable);
    console.log("- Revoked:", schedule.revoked);

    // Check vested amount (should be 0 before cliff)
    console.log("\n5. Checking vested amounts...");
    const vestedAmount = await tokenVesting.getVestedAmount(scheduleId);
    const claimableAmount = await tokenVesting.getClaimableAmount(scheduleId);
    
    console.log("Current vested amount:", ethers.formatEther(vestedAmount));
    console.log("Current claimable amount:", ethers.formatEther(claimableAmount));

    // Get beneficiary schedules
    console.log("\n6. Checking beneficiary schedules...");
    const beneficiarySchedules = await tokenVesting.getBeneficiarySchedules(beneficiary.address);
    console.log("Beneficiary has", beneficiarySchedules.length, "schedule(s)");

    // Check total locked tokens
    console.log("\n7. Platform statistics...");
    const totalLocked = await tokenVesting.totalLockedTokens(mockToken.target);
    console.log("Total locked tokens:", ethers.formatEther(totalLocked));

    console.log("\n✅ Example completed successfully!");
    console.log("\nNext steps:");
    console.log("- Wait for cliff period to end");
    console.log("- Call claimTokens() to claim vested tokens");
    console.log("- Use transferVestingSchedule() to transfer to another address");
    console.log("- Use revokeVestingSchedule() to revoke if needed");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });