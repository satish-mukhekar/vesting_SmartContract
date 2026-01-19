const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("TokenVesting", function () {
    let tokenVesting;
    let mockToken;
    let owner;
    let creator;
    let beneficiary;
    let newBeneficiary;
    let otherAccount;

    const TOTAL_SUPPLY = ethers.parseEther("1000000");
    const VESTING_AMOUNT = ethers.parseEther("1000");
    const CLIFF_DURATION = 6 * 30 * 24 * 60 * 60; // 6 months
    const VESTING_DURATION = 24 * 30 * 24 * 60 * 60; // 24 months

    beforeEach(async function () {
        [owner, creator, beneficiary, newBeneficiary, otherAccount] = await ethers.getSigners();

        // Deploy MockToken
        const MockToken = await ethers.getContractFactory("MockToken");
        mockToken = await MockToken.deploy("Test Token", "TEST", TOTAL_SUPPLY);

        // Deploy TokenVesting
        const TokenVesting = await ethers.getContractFactory("TokenVesting");
        tokenVesting = await TokenVesting.deploy();

        // Transfer tokens to creator for testing
        await mockToken.transfer(creator.address, ethers.parseEther("100000"));
    });

    describe("Deployment", function () {
        it("Should set the right owner", async function () {
            expect(await tokenVesting.owner()).to.equal(owner.address);
        });

        it("Should initialize with zero schedules", async function () {
            expect(await tokenVesting.nextScheduleId()).to.equal(0);
        });
    });

    describe("Creating Vesting Schedules", function () {
        it("Should create a vesting schedule successfully", async function () {
            const startTime = await time.latest() + 100;
            
            // Approve tokens
            await mockToken.connect(creator).approve(tokenVesting.target, VESTING_AMOUNT);

            await expect(
                tokenVesting.connect(creator).createVestingSchedule(
                    beneficiary.address,
                    mockToken.target,
                    VESTING_AMOUNT,
                    startTime,
                    CLIFF_DURATION,
                    VESTING_DURATION,
                    true
                )
            ).to.emit(tokenVesting, "VestingScheduleCreated")
             .withArgs(0, beneficiary.address, mockToken.target, VESTING_AMOUNT, startTime, CLIFF_DURATION, VESTING_DURATION, true);

            const schedule = await tokenVesting.getVestingSchedule(0);
            expect(schedule.beneficiary).to.equal(beneficiary.address);
            expect(schedule.totalAmount).to.equal(VESTING_AMOUNT);
            expect(schedule.claimedAmount).to.equal(0);
            expect(schedule.revocable).to.be.true;
            expect(schedule.revoked).to.be.false;
        });

        it("Should fail with invalid parameters", async function () {
            const startTime = await time.latest() + 100;

            await mockToken.connect(creator).approve(tokenVesting.target, VESTING_AMOUNT);

            // Invalid beneficiary
            await expect(
                tokenVesting.connect(creator).createVestingSchedule(
                    ethers.ZeroAddress,
                    mockToken.target,
                    VESTING_AMOUNT,
                    startTime,
                    CLIFF_DURATION,
                    VESTING_DURATION,
                    true
                )
            ).to.be.revertedWith("Invalid beneficiary address");

            // Invalid token
            await expect(
                tokenVesting.connect(creator).createVestingSchedule(
                    beneficiary.address,
                    ethers.ZeroAddress,
                    VESTING_AMOUNT,
                    startTime,
                    CLIFF_DURATION,
                    VESTING_DURATION,
                    true
                )
            ).to.be.revertedWith("Invalid token address");

            // Zero amount
            await expect(
                tokenVesting.connect(creator).createVestingSchedule(
                    beneficiary.address,
                    mockToken.target,
                    0,
                    startTime,
                    CLIFF_DURATION,
                    VESTING_DURATION,
                    true
                )
            ).to.be.revertedWith("Amount must be greater than 0");

            // Past start time
            await expect(
                tokenVesting.connect(creator).createVestingSchedule(
                    beneficiary.address,
                    mockToken.target,
                    VESTING_AMOUNT,
                    await time.latest() - 100,
                    CLIFF_DURATION,
                    VESTING_DURATION,
                    true
                )
            ).to.be.revertedWith("Start time cannot be in the past");

            // Cliff longer than vesting
            await expect(
                tokenVesting.connect(creator).createVestingSchedule(
                    beneficiary.address,
                    mockToken.target,
                    VESTING_AMOUNT,
                    startTime,
                    VESTING_DURATION + 1,
                    VESTING_DURATION,
                    true
                )
            ).to.be.revertedWith("Cliff duration cannot exceed vesting duration");
        });

        it("Should track total locked tokens", async function () {
            const startTime = await time.latest() + 100;
            
            await mockToken.connect(creator).approve(tokenVesting.target, VESTING_AMOUNT);
            
            await tokenVesting.connect(creator).createVestingSchedule(
                beneficiary.address,
                mockToken.target,
                VESTING_AMOUNT,
                startTime,
                CLIFF_DURATION,
                VESTING_DURATION,
                true
            );

            expect(await tokenVesting.totalLockedTokens(mockToken.target)).to.equal(VESTING_AMOUNT);
        });
    });
    describe("Vesting Calculations", function () {
        let scheduleId;
        let startTime;

        beforeEach(async function () {
            startTime = await time.latest() + 100;
            
            await mockToken.connect(creator).approve(tokenVesting.target, VESTING_AMOUNT);
            
            const tx = await tokenVesting.connect(creator).createVestingSchedule(
                beneficiary.address,
                mockToken.target,
                VESTING_AMOUNT,
                startTime,
                CLIFF_DURATION,
                VESTING_DURATION,
                true
            );
            
            scheduleId = 0;
        });

        it("Should return 0 vested amount before cliff", async function () {
            await time.increaseTo(startTime + CLIFF_DURATION - 1);
            expect(await tokenVesting.getVestedAmount(scheduleId)).to.equal(0);
        });

        it("Should return 0 vested amount at cliff end", async function () {
            await time.increaseTo(startTime + CLIFF_DURATION);
            expect(await tokenVesting.getVestedAmount(scheduleId)).to.equal(0);
        });

        it("Should calculate linear vesting correctly", async function () {
            // At 50% of vesting period after cliff
            const halfVestingTime = startTime + CLIFF_DURATION + (VESTING_DURATION - CLIFF_DURATION) / 2;
            await time.increaseTo(halfVestingTime);
            
            const vestedAmount = await tokenVesting.getVestedAmount(scheduleId);
            const expectedAmount = VESTING_AMOUNT / 2n;
            
            // Allow for small rounding differences
            expect(vestedAmount).to.be.closeTo(expectedAmount, ethers.parseEther("1"));
        });

        it("Should return full amount after vesting period", async function () {
            await time.increaseTo(startTime + VESTING_DURATION + 1);
            expect(await tokenVesting.getVestedAmount(scheduleId)).to.equal(VESTING_AMOUNT);
        });

        it("Should calculate claimable amount correctly", async function () {
            await time.increaseTo(startTime + VESTING_DURATION);
            expect(await tokenVesting.getClaimableAmount(scheduleId)).to.equal(VESTING_AMOUNT);
        });
    });

    describe("Token Claiming", function () {
        let scheduleId;
        let startTime;

        beforeEach(async function () {
            startTime = await time.latest() + 100;
            
            await mockToken.connect(creator).approve(tokenVesting.target, VESTING_AMOUNT);
            
            await tokenVesting.connect(creator).createVestingSchedule(
                beneficiary.address,
                mockToken.target,
                VESTING_AMOUNT,
                startTime,
                CLIFF_DURATION,
                VESTING_DURATION,
                true
            );
            
            scheduleId = 0;
        });

        it("Should fail to claim before cliff", async function () {
            await time.increaseTo(startTime + CLIFF_DURATION - 1);
            
            await expect(
                tokenVesting.connect(beneficiary).claimTokens(scheduleId)
            ).to.be.revertedWith("No tokens available for claim");
        });

        it("Should claim tokens successfully after vesting", async function () {
            await time.increaseTo(startTime + VESTING_DURATION);
            
            const initialBalance = await mockToken.balanceOf(beneficiary.address);
            
            await expect(
                tokenVesting.connect(beneficiary).claimTokens(scheduleId)
            ).to.emit(tokenVesting, "TokensClaimed")
             .withArgs(scheduleId, beneficiary.address, VESTING_AMOUNT);

            const finalBalance = await mockToken.balanceOf(beneficiary.address);
            expect(finalBalance - initialBalance).to.equal(VESTING_AMOUNT);

            const schedule = await tokenVesting.getVestingSchedule(scheduleId);
            expect(schedule.claimedAmount).to.equal(VESTING_AMOUNT);
        });

        it("Should prevent double claiming", async function () {
            await time.increaseTo(startTime + VESTING_DURATION);
            
            await tokenVesting.connect(beneficiary).claimTokens(scheduleId);
            
            await expect(
                tokenVesting.connect(beneficiary).claimTokens(scheduleId)
            ).to.be.revertedWith("No tokens available for claim");
        });

        it("Should only allow beneficiary to claim", async function () {
            await time.increaseTo(startTime + VESTING_DURATION);
            
            await expect(
                tokenVesting.connect(otherAccount).claimTokens(scheduleId)
            ).to.be.revertedWith("Not the beneficiary");
        });

        it("Should claim partial amounts correctly", async function () {
            // Move to 25% of vesting period after cliff
            const quarterTime = startTime + CLIFF_DURATION + (VESTING_DURATION - CLIFF_DURATION) / 4;
            await time.increaseTo(quarterTime);
            
            const claimableAmount = await tokenVesting.getClaimableAmount(scheduleId);
            const initialBalance = await mockToken.balanceOf(beneficiary.address);
            
            await tokenVesting.connect(beneficiary).claimTokens(scheduleId);
            
            const finalBalance = await mockToken.balanceOf(beneficiary.address);
            expect(finalBalance - initialBalance).to.be.closeTo(claimableAmount, ethers.parseEther("0.1"));

            // Move to 50% and claim again
            const halfTime = startTime + CLIFF_DURATION + (VESTING_DURATION - CLIFF_DURATION) / 2;
            await time.increaseTo(halfTime);
            
            const secondClaimableAmount = await tokenVesting.getClaimableAmount(scheduleId);
            const balanceBeforeSecondClaim = await mockToken.balanceOf(beneficiary.address);
            
            await tokenVesting.connect(beneficiary).claimTokens(scheduleId);
            
            const balanceAfterSecondClaim = await mockToken.balanceOf(beneficiary.address);
            expect(balanceAfterSecondClaim - balanceBeforeSecondClaim).to.be.closeTo(secondClaimableAmount, ethers.parseEther("0.1"));
        });
    });
    describe("Revocation System", function () {
        let revocableScheduleId;
        let irrevocableScheduleId;
        let startTime;

        beforeEach(async function () {
            startTime = await time.latest() + 100;
            
            await mockToken.connect(creator).approve(tokenVesting.target, VESTING_AMOUNT * 2n);
            
            // Create revocable schedule
            await tokenVesting.connect(creator).createVestingSchedule(
                beneficiary.address,
                mockToken.target,
                VESTING_AMOUNT,
                startTime,
                CLIFF_DURATION,
                VESTING_DURATION,
                true
            );
            revocableScheduleId = 0;

            // Create irrevocable schedule
            await tokenVesting.connect(creator).createVestingSchedule(
                beneficiary.address,
                mockToken.target,
                VESTING_AMOUNT,
                startTime,
                CLIFF_DURATION,
                VESTING_DURATION,
                false
            );
            irrevocableScheduleId = 1;
        });

        it("Should revoke revocable schedule successfully", async function () {
            const creatorInitialBalance = await mockToken.balanceOf(creator.address);
            
            await expect(
                tokenVesting.connect(creator).revokeVestingSchedule(revocableScheduleId)
            ).to.emit(tokenVesting, "VestingScheduleRevoked")
             .withArgs(revocableScheduleId, beneficiary.address, VESTING_AMOUNT);

            const schedule = await tokenVesting.getVestingSchedule(revocableScheduleId);
            expect(schedule.revoked).to.be.true;

            const creatorFinalBalance = await mockToken.balanceOf(creator.address);
            expect(creatorFinalBalance - creatorInitialBalance).to.equal(VESTING_AMOUNT);
        });

        it("Should fail to revoke irrevocable schedule", async function () {
            await expect(
                tokenVesting.connect(creator).revokeVestingSchedule(irrevocableScheduleId)
            ).to.be.revertedWith("Schedule is not revocable");
        });

        it("Should only allow creator to revoke", async function () {
            await expect(
                tokenVesting.connect(otherAccount).revokeVestingSchedule(revocableScheduleId)
            ).to.be.revertedWith("Not the creator");
        });

        it("Should prevent double revocation", async function () {
            await tokenVesting.connect(creator).revokeVestingSchedule(revocableScheduleId);
            
            await expect(
                tokenVesting.connect(creator).revokeVestingSchedule(revocableScheduleId)
            ).to.be.revertedWith("Schedule already revoked");
        });

        it("Should handle partial vesting before revocation", async function () {
            // Move to 50% of vesting period
            const halfTime = startTime + CLIFF_DURATION + (VESTING_DURATION - CLIFF_DURATION) / 2;
            await time.increaseTo(halfTime);
            
            // Claim some tokens
            await tokenVesting.connect(beneficiary).claimTokens(revocableScheduleId);
            
            const schedule = await tokenVesting.getVestingSchedule(revocableScheduleId);
            const claimedAmount = schedule.claimedAmount;
            
            const creatorInitialBalance = await mockToken.balanceOf(creator.address);
            
            // Revoke the schedule
            await tokenVesting.connect(creator).revokeVestingSchedule(revocableScheduleId);
            
            const creatorFinalBalance = await mockToken.balanceOf(creator.address);
            const returnedAmount = creatorFinalBalance - creatorInitialBalance;
            
            expect(returnedAmount).to.be.closeTo(VESTING_AMOUNT - claimedAmount, ethers.parseEther("0.1"));
        });

        it("Should prevent claiming from revoked schedule", async function () {
            await tokenVesting.connect(creator).revokeVestingSchedule(revocableScheduleId);
            
            await time.increaseTo(startTime + VESTING_DURATION);
            
            await expect(
                tokenVesting.connect(beneficiary).claimTokens(revocableScheduleId)
            ).to.be.revertedWith("Schedule has been revoked");
        });
    });

    describe("Transfer System", function () {
        let scheduleId;
        let startTime;

        beforeEach(async function () {
            startTime = await time.latest() + 100;
            
            await mockToken.connect(creator).approve(tokenVesting.target, VESTING_AMOUNT);
            
            await tokenVesting.connect(creator).createVestingSchedule(
                beneficiary.address,
                mockToken.target,
                VESTING_AMOUNT,
                startTime,
                CLIFF_DURATION,
                VESTING_DURATION,
                true
            );
            
            scheduleId = 0;
        });

        it("Should transfer schedule successfully", async function () {
            await expect(
                tokenVesting.connect(beneficiary).transferVestingSchedule(scheduleId, newBeneficiary.address)
            ).to.emit(tokenVesting, "VestingScheduleTransferred")
             .withArgs(scheduleId, beneficiary.address, newBeneficiary.address);

            const schedule = await tokenVesting.getVestingSchedule(scheduleId);
            expect(schedule.beneficiary).to.equal(newBeneficiary.address);

            const oldBeneficiarySchedules = await tokenVesting.getBeneficiarySchedules(beneficiary.address);
            const newBeneficiarySchedules = await tokenVesting.getBeneficiarySchedules(newBeneficiary.address);
            
            expect(oldBeneficiarySchedules.length).to.equal(0);
            expect(newBeneficiarySchedules.length).to.equal(1);
            expect(newBeneficiarySchedules[0]).to.equal(scheduleId);
        });

        it("Should only allow beneficiary to transfer", async function () {
            await expect(
                tokenVesting.connect(otherAccount).transferVestingSchedule(scheduleId, newBeneficiary.address)
            ).to.be.revertedWith("Not the beneficiary");
        });

        it("Should fail with invalid new beneficiary", async function () {
            await expect(
                tokenVesting.connect(beneficiary).transferVestingSchedule(scheduleId, ethers.ZeroAddress)
            ).to.be.revertedWith("Invalid new beneficiary address");
        });

        it("Should prevent transfer of revoked schedule", async function () {
            await tokenVesting.connect(creator).revokeVestingSchedule(scheduleId);
            
            await expect(
                tokenVesting.connect(beneficiary).transferVestingSchedule(scheduleId, newBeneficiary.address)
            ).to.be.revertedWith("Cannot transfer revoked schedule");
        });

        it("Should allow new beneficiary to claim after transfer", async function () {
            await tokenVesting.connect(beneficiary).transferVestingSchedule(scheduleId, newBeneficiary.address);
            
            await time.increaseTo(startTime + VESTING_DURATION);
            
            const initialBalance = await mockToken.balanceOf(newBeneficiary.address);
            
            await tokenVesting.connect(newBeneficiary).claimTokens(scheduleId);
            
            const finalBalance = await mockToken.balanceOf(newBeneficiary.address);
            expect(finalBalance - initialBalance).to.equal(VESTING_AMOUNT);
        });
    });
    describe("Multiple Schedules", function () {
        it("Should handle multiple schedules per beneficiary", async function () {
            const startTime = await time.latest() + 100;
            
            await mockToken.connect(creator).approve(tokenVesting.target, VESTING_AMOUNT * 3n);
            
            // Create three schedules for the same beneficiary
            await tokenVesting.connect(creator).createVestingSchedule(
                beneficiary.address,
                mockToken.target,
                VESTING_AMOUNT,
                startTime,
                CLIFF_DURATION,
                VESTING_DURATION,
                true
            );

            await tokenVesting.connect(creator).createVestingSchedule(
                beneficiary.address,
                mockToken.target,
                VESTING_AMOUNT,
                startTime + 1000,
                CLIFF_DURATION / 2,
                VESTING_DURATION / 2,
                false
            );

            await tokenVesting.connect(creator).createVestingSchedule(
                beneficiary.address,
                mockToken.target,
                VESTING_AMOUNT,
                startTime + 2000,
                0, // No cliff
                VESTING_DURATION / 4,
                true
            );

            const schedules = await tokenVesting.getBeneficiarySchedules(beneficiary.address);
            expect(schedules.length).to.equal(3);
            expect(schedules[0]).to.equal(0);
            expect(schedules[1]).to.equal(1);
            expect(schedules[2]).to.equal(2);
        });

        it("Should track total locked tokens across multiple schedules", async function () {
            const startTime = await time.latest() + 100;
            
            await mockToken.connect(creator).approve(tokenVesting.target, VESTING_AMOUNT * 2n);
            
            await tokenVesting.connect(creator).createVestingSchedule(
                beneficiary.address,
                mockToken.target,
                VESTING_AMOUNT,
                startTime,
                CLIFF_DURATION,
                VESTING_DURATION,
                true
            );

            await tokenVesting.connect(creator).createVestingSchedule(
                newBeneficiary.address,
                mockToken.target,
                VESTING_AMOUNT,
                startTime,
                CLIFF_DURATION,
                VESTING_DURATION,
                true
            );

            expect(await tokenVesting.totalLockedTokens(mockToken.target)).to.equal(VESTING_AMOUNT * 2n);
        });
    });

    describe("Edge Cases", function () {
        it("Should handle zero cliff duration", async function () {
            const startTime = await time.latest() + 100;
            
            await mockToken.connect(creator).approve(tokenVesting.target, VESTING_AMOUNT);
            
            await tokenVesting.connect(creator).createVestingSchedule(
                beneficiary.address,
                mockToken.target,
                VESTING_AMOUNT,
                startTime,
                0, // No cliff
                VESTING_DURATION,
                true
            );

            // Should start vesting immediately after start time
            await time.increaseTo(startTime + 1);
            
            const vestedAmount = await tokenVesting.getVestedAmount(0);
            expect(vestedAmount).to.be.gt(0);
        });

        it("Should handle same start and end time", async function () {
            const startTime = await time.latest() + 100;
            
            await mockToken.connect(creator).approve(tokenVesting.target, VESTING_AMOUNT);
            
            await tokenVesting.connect(creator).createVestingSchedule(
                beneficiary.address,
                mockToken.target,
                VESTING_AMOUNT,
                startTime,
                0,
                1, // 1 second vesting
                true
            );

            await time.increaseTo(startTime + 1);
            
            const vestedAmount = await tokenVesting.getVestedAmount(0);
            expect(vestedAmount).to.equal(VESTING_AMOUNT);
        });

        it("Should handle minimum token amounts", async function () {
            const startTime = await time.latest() + 100;
            const minAmount = 1;
            
            await mockToken.connect(creator).approve(tokenVesting.target, minAmount);
            
            await tokenVesting.connect(creator).createVestingSchedule(
                beneficiary.address,
                mockToken.target,
                minAmount,
                startTime,
                CLIFF_DURATION,
                VESTING_DURATION,
                true
            );

            await time.increaseTo(startTime + VESTING_DURATION);
            
            const vestedAmount = await tokenVesting.getVestedAmount(0);
            expect(vestedAmount).to.equal(minAmount);
        });
    });

    describe("Admin Controls", function () {
        it("Should pause and unpause the contract", async function () {
            await tokenVesting.connect(owner).pause();
            
            const startTime = await time.latest() + 100;
            await mockToken.connect(creator).approve(tokenVesting.target, VESTING_AMOUNT);
            
            await expect(
                tokenVesting.connect(creator).createVestingSchedule(
                    beneficiary.address,
                    mockToken.target,
                    VESTING_AMOUNT,
                    startTime,
                    CLIFF_DURATION,
                    VESTING_DURATION,
                    true
                )
            ).to.be.reverted;

            await tokenVesting.connect(owner).unpause();
            
            await expect(
                tokenVesting.connect(creator).createVestingSchedule(
                    beneficiary.address,
                    mockToken.target,
                    VESTING_AMOUNT,
                    startTime,
                    CLIFF_DURATION,
                    VESTING_DURATION,
                    true
                )
            ).to.not.be.reverted;
        });

        it("Should allow emergency withdrawal of excess tokens", async function () {
            // Send extra tokens to the contract
            const extraAmount = ethers.parseEther("100");
            await mockToken.transfer(tokenVesting.target, extraAmount);
            
            const initialBalance = await mockToken.balanceOf(owner.address);
            
            await expect(
                tokenVesting.connect(owner).emergencyWithdraw(mockToken.target, extraAmount, owner.address)
            ).to.emit(tokenVesting, "EmergencyWithdrawal")
             .withArgs(mockToken.target, extraAmount, owner.address);

            const finalBalance = await mockToken.balanceOf(owner.address);
            expect(finalBalance - initialBalance).to.equal(extraAmount);
        });

        it("Should prevent emergency withdrawal of locked tokens", async function () {
            const startTime = await time.latest() + 100;
            
            await mockToken.connect(creator).approve(tokenVesting.target, VESTING_AMOUNT);
            
            await tokenVesting.connect(creator).createVestingSchedule(
                beneficiary.address,
                mockToken.target,
                VESTING_AMOUNT,
                startTime,
                CLIFF_DURATION,
                VESTING_DURATION,
                true
            );

            await expect(
                tokenVesting.connect(owner).emergencyWithdraw(mockToken.target, VESTING_AMOUNT, owner.address)
            ).to.be.revertedWith("Cannot withdraw locked tokens");
        });

        it("Should only allow owner to perform admin functions", async function () {
            await expect(
                tokenVesting.connect(otherAccount).pause()
            ).to.be.reverted;

            await expect(
                tokenVesting.connect(otherAccount).emergencyWithdraw(mockToken.target, 100, otherAccount.address)
            ).to.be.reverted;
        });
    });
});