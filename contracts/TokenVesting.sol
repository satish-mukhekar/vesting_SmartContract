// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title TokenVesting
 * @dev A token vesting contract with cliff and linear release functionality
 */
contract TokenVesting is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    struct VestingSchedule {
        address beneficiary;
        address token;
        uint256 totalAmount;
        uint256 claimedAmount;
        uint256 startTime;
        uint256 cliffDuration;
        uint256 vestingDuration;
        bool revocable;
        bool revoked;
        address creator;
    }

    // Mapping from schedule ID to vesting schedule
    mapping(uint256 => VestingSchedule) public vestingSchedules;
    
    // Mapping from beneficiary to list of schedule IDs
    mapping(address => uint256[]) public beneficiarySchedules;
    
    // Mapping from token to total locked amount
    mapping(address => uint256) public totalLockedTokens;
    
    // Counter for schedule IDs
    uint256 public nextScheduleId;

    // Events
    event VestingScheduleCreated(
        uint256 indexed scheduleId,
        address indexed beneficiary,
        address indexed token,
        uint256 totalAmount,
        uint256 startTime,
        uint256 cliffDuration,
        uint256 vestingDuration,
        bool revocable
    );

    event TokensClaimed(
        uint256 indexed scheduleId,
        address indexed beneficiary,
        uint256 amount
    );

    event VestingScheduleRevoked(
        uint256 indexed scheduleId,
        address indexed beneficiary,
        uint256 unvestedAmount
    );

    event VestingScheduleTransferred(
        uint256 indexed scheduleId,
        address indexed oldBeneficiary,
        address indexed newBeneficiary
    );

    event EmergencyWithdrawal(
        address indexed token,
        uint256 amount,
        address indexed to
    );

    constructor() Ownable(msg.sender) {}

    /**
     * @dev Creates a new vesting schedule
     * @param beneficiary Address of the beneficiary
     * @param token Address of the ERC20 token
     * @param totalAmount Total amount of tokens to vest
     * @param startTime Start time of the vesting (unix timestamp)
     * @param cliffDuration Duration of the cliff period in seconds
     * @param vestingDuration Total vesting duration in seconds (including cliff)
     * @param revocable Whether the schedule can be revoked
     */
    function createVestingSchedule(
        address beneficiary,
        address token,
        uint256 totalAmount,
        uint256 startTime,
        uint256 cliffDuration,
        uint256 vestingDuration,
        bool revocable
    ) external nonReentrant whenNotPaused returns (uint256) {
        require(beneficiary != address(0), "Invalid beneficiary address");
        require(token != address(0), "Invalid token address");
        require(totalAmount > 0, "Amount must be greater than 0");
        require(startTime >= block.timestamp, "Start time cannot be in the past");
        require(vestingDuration > 0, "Vesting duration must be greater than 0");
        require(cliffDuration <= vestingDuration, "Cliff duration cannot exceed vesting duration");

        // Transfer tokens from creator to this contract
        IERC20(token).safeTransferFrom(msg.sender, address(this), totalAmount);

        uint256 scheduleId = nextScheduleId++;

        vestingSchedules[scheduleId] = VestingSchedule({
            beneficiary: beneficiary,
            token: token,
            totalAmount: totalAmount,
            claimedAmount: 0,
            startTime: startTime,
            cliffDuration: cliffDuration,
            vestingDuration: vestingDuration,
            revocable: revocable,
            revoked: false,
            creator: msg.sender
        });

        beneficiarySchedules[beneficiary].push(scheduleId);
        totalLockedTokens[token] += totalAmount;

        emit VestingScheduleCreated(
            scheduleId,
            beneficiary,
            token,
            totalAmount,
            startTime,
            cliffDuration,
            vestingDuration,
            revocable
        );

        return scheduleId;
    }

    /**
     * @dev Claims vested tokens for a specific schedule
     * @param scheduleId ID of the vesting schedule
     */
    function claimTokens(uint256 scheduleId) external nonReentrant whenNotPaused {
        VestingSchedule storage schedule = vestingSchedules[scheduleId];
        
        require(schedule.beneficiary == msg.sender, "Not the beneficiary");
        require(!schedule.revoked, "Schedule has been revoked");
        
        uint256 vestedAmount = getVestedAmount(scheduleId);
        uint256 claimableAmount = vestedAmount - schedule.claimedAmount;
        
        require(claimableAmount > 0, "No tokens available for claim");

        schedule.claimedAmount += claimableAmount;
        totalLockedTokens[schedule.token] -= claimableAmount;

        IERC20(schedule.token).safeTransfer(schedule.beneficiary, claimableAmount);

        emit TokensClaimed(scheduleId, schedule.beneficiary, claimableAmount);
    }
    /**
     * @dev Revokes a vesting schedule (only for revocable schedules)
     * @param scheduleId ID of the vesting schedule to revoke
     */
    function revokeVestingSchedule(uint256 scheduleId) external nonReentrant whenNotPaused {
        VestingSchedule storage schedule = vestingSchedules[scheduleId];
        
        require(schedule.creator == msg.sender, "Not the creator");
        require(schedule.revocable, "Schedule is not revocable");
        require(!schedule.revoked, "Schedule already revoked");

        uint256 vestedAmount = getVestedAmount(scheduleId);
        uint256 unvestedAmount = schedule.totalAmount - vestedAmount;

        schedule.revoked = true;

        if (unvestedAmount > 0) {
            totalLockedTokens[schedule.token] -= unvestedAmount;
            IERC20(schedule.token).safeTransfer(schedule.creator, unvestedAmount);
        }

        emit VestingScheduleRevoked(scheduleId, schedule.beneficiary, unvestedAmount);
    }

    /**
     * @dev Transfers a vesting schedule to a new beneficiary
     * @param scheduleId ID of the vesting schedule
     * @param newBeneficiary Address of the new beneficiary
     */
    function transferVestingSchedule(uint256 scheduleId, address newBeneficiary) external nonReentrant whenNotPaused {
        VestingSchedule storage schedule = vestingSchedules[scheduleId];
        
        require(schedule.beneficiary == msg.sender, "Not the beneficiary");
        require(newBeneficiary != address(0), "Invalid new beneficiary address");
        require(!schedule.revoked, "Cannot transfer revoked schedule");

        address oldBeneficiary = schedule.beneficiary;
        schedule.beneficiary = newBeneficiary;

        // Remove from old beneficiary's list
        _removeScheduleFromBeneficiary(oldBeneficiary, scheduleId);
        
        // Add to new beneficiary's list
        beneficiarySchedules[newBeneficiary].push(scheduleId);

        emit VestingScheduleTransferred(scheduleId, oldBeneficiary, newBeneficiary);
    }

    /**
     * @dev Calculates the vested amount for a given schedule
     * @param scheduleId ID of the vesting schedule
     * @return The amount of tokens that have vested
     */
    function getVestedAmount(uint256 scheduleId) public view returns (uint256) {
        VestingSchedule memory schedule = vestingSchedules[scheduleId];
        
        if (schedule.revoked) {
            return schedule.claimedAmount;
        }

        if (block.timestamp < schedule.startTime + schedule.cliffDuration) {
            return 0;
        }

        if (block.timestamp >= schedule.startTime + schedule.vestingDuration) {
            return schedule.totalAmount;
        }

        // Linear vesting after cliff
        uint256 timeFromCliff = block.timestamp - (schedule.startTime + schedule.cliffDuration);
        uint256 vestingTimeAfterCliff = schedule.vestingDuration - schedule.cliffDuration;
        
        return (schedule.totalAmount * timeFromCliff) / vestingTimeAfterCliff;
    }

    /**
     * @dev Gets the claimable amount for a specific schedule
     * @param scheduleId ID of the vesting schedule
     * @return The amount of tokens that can be claimed
     */
    function getClaimableAmount(uint256 scheduleId) external view returns (uint256) {
        VestingSchedule memory schedule = vestingSchedules[scheduleId];
        
        if (schedule.revoked) {
            return 0;
        }

        uint256 vestedAmount = getVestedAmount(scheduleId);
        return vestedAmount - schedule.claimedAmount;
    }

    /**
     * @dev Gets all schedule IDs for a beneficiary
     * @param beneficiary Address of the beneficiary
     * @return Array of schedule IDs
     */
    function getBeneficiarySchedules(address beneficiary) external view returns (uint256[] memory) {
        return beneficiarySchedules[beneficiary];
    }

    /**
     * @dev Gets detailed information about a vesting schedule
     * @param scheduleId ID of the vesting schedule
     * @return All schedule details
     */
    function getVestingSchedule(uint256 scheduleId) external view returns (VestingSchedule memory) {
        return vestingSchedules[scheduleId];
    }

    /**
     * @dev Emergency withdrawal function (only owner)
     * @param token Address of the token to withdraw
     * @param amount Amount to withdraw
     * @param to Address to send tokens to
     */
    function emergencyWithdraw(address token, uint256 amount, address to) external onlyOwner {
        require(to != address(0), "Invalid recipient address");
        
        uint256 contractBalance = IERC20(token).balanceOf(address(this));
        uint256 lockedAmount = totalLockedTokens[token];
        uint256 availableAmount = contractBalance - lockedAmount;
        
        require(amount <= availableAmount, "Cannot withdraw locked tokens");
        
        IERC20(token).safeTransfer(to, amount);
        
        emit EmergencyWithdrawal(token, amount, to);
    }

    /**
     * @dev Pauses the contract (only owner)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpauses the contract (only owner)
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Internal function to remove a schedule from beneficiary's list
     * @param beneficiary Address of the beneficiary
     * @param scheduleId ID of the schedule to remove
     */
    function _removeScheduleFromBeneficiary(address beneficiary, uint256 scheduleId) internal {
        uint256[] storage schedules = beneficiarySchedules[beneficiary];
        
        for (uint256 i = 0; i < schedules.length; i++) {
            if (schedules[i] == scheduleId) {
                schedules[i] = schedules[schedules.length - 1];
                schedules.pop();
                break;
            }
        }
    }
}