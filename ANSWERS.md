1. Vesting Calculation

Formula:

if time < start + cliff → vested = 0  
if time >= start + duration → vested = totalAmount  
else → vested = totalAmount * (time - start) / duration


Cliff: Tokens cannot be claimed before cliff ends.

Linear Vesting: Tokens unlock gradually after cliff until full vesting.

2. Data Structure

Mapping: mapping(address => uint256[]) beneficiarySchedules

Stores multiple schedule IDs per beneficiary.

Reason: Efficient tracking and easy retrieval of schedules.

3. Revocation Logic

Owner can revoke revocable schedules.

Unvested tokens returned to owner.

Vested tokens remain claimable by the beneficiary.

Ensures correct token distribution without losses.

4. Edge Cases Handled
#	Edge Case	Handling
1	Schedule created in the past	Correctly calculates vested tokens
2	Claim before cliff	Returns 0, prevents early access
3	Partial vesting + revocation	Only vested tokens claimable
4	Zero-token schedule	Rejected at creation
5	Multiple schedules per beneficiary	Tracked via array; no overlap issues
5. Gas Optimization

Minimized storage writes for efficiency.

Used appropriate integer sizes (uint128) where possible.

Avoided expensive loops on-chain; used mappings and arrays.

6. Security Considerations

ReentrancyGuard for safe token transfers.

Checks for zero addresses and zero amounts.

Only owner can revoke schedules.

Uses SafeERC20 for token operations.

7. Precision Handling

Calculations in uint256 → rounds down naturally.

Prevents exploitable rounding errors for small fractions.