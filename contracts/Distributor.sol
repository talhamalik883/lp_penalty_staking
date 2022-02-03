//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;

import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/utils/EnumerableSet.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import './Token.sol';

contract Distributor is Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    struct StakeInfo {
        uint256 amount; // How many LP tokens the user has provided.
        uint256 timeStamp;
        uint256 rewardDebt; // how much reward debt pending on user end
    }
    struct UserInfo {
        uint256 amount; // How many LP tokens the user has provided.
        StakeInfo[] stakeInfo; // this array hold all the stakes enteries for each user
    }
    struct PoolInfo {
        IERC20 lpToken; // Address of LP token contract.
        uint256 lastRewardBlock; // Last block number that Tokens distribution occurs.
        uint256 rewardTokensPerBlock; //  Reward tokens created per block.
        uint256 totalStaked; // total Staked For one pool
        uint256 accTokensPerShare; // Accumulated Tokens per share, times 1e12. See below.
        bool isStopped; // represent either pool is farming or not
        uint256 fromBlock; // fromBlock represent block number from which reward is going to be governed
        uint256 toBlock; // fromBlock represent block number till which multplier remain active
        uint256 actualMultiplier; // represent the mutiplier value that will reamin active until fromBlock and toBlock,
        uint256 lockPeriod; // represent the locktime of pool
        uint256 penaltyPercentage; // represent the penalty percentage incured before withdrawing locktime
        uint256 poolEndTime; // poolEndTime represent block number when the pool ends. Note: its just for reading purpose over frontend
    }

    mapping(address => UserInfo) public userInfo;

    address public lockWallet;

    Token public stakingToken;

    uint256 public constant maxLockPeriod = 63072000;

    uint256 public constant maxLockPenaltyPercentage = 100;

    bool public doMint;
    // Info of each pool.
    PoolInfo[] public poolInfo;
    // Info of each user stakes.

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount, uint256 accTokensPerShare);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount, uint256 accTokensPerShare);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);

    constructor(
        Token _stakingToken,
        bool _doMint,
        address _lockWallet
    ) public {
        stakingToken = _stakingToken;
        doMint = _doMint;
        lockWallet = _lockWallet;
    }

    function updateMintStatus(bool _doMint) external onlyOwner {
        doMint = _doMint;
    }

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    // Owner can update multiplier of the function
    function updatePoolMultiplier(
        uint256 _pid,
        uint256 _fromBlock,
        uint256 _toBlock,
        uint256 _actualMultiplier
    ) external onlyOwner {
        require(_fromBlock < _toBlock, 'Distributor: _fromBlock Should be less than _toBlock');
        PoolInfo storage pool = poolInfo[_pid];
        // PoolMultiplier storage poolMulti = poolMultipliers[_index];
        pool.fromBlock = _fromBlock;
        pool.toBlock = _toBlock;
        pool.actualMultiplier = _actualMultiplier;
        updatePool(_pid);
    }

    // Owner Can Update locktime and PenaltyPecentage for a pool
    function updateLockPeriod(
        uint256 _pid,
        uint256 _lockPeriod,
        uint256 _penaltyPercentage
    ) external onlyOwner {
        require(_lockPeriod < maxLockPeriod, ' Lock Period Exceeded ');

        require(_penaltyPercentage < maxLockPenaltyPercentage, ' Lock Percentage Exceeded');

        PoolInfo storage pool = poolInfo[_pid];
        pool.lockPeriod = _lockPeriod;
        pool.penaltyPercentage = _penaltyPercentage;
    }

    // Owner can stop farming at anypoint of time
    function stopFarming(uint256 _pid) external onlyOwner {
        PoolInfo storage pool = poolInfo[_pid];
        pool.isStopped = true;
    }

    // Owner can change lockWallet address
    function changeLockWalletAddress(address _lockWallet) external onlyOwner {
        lockWallet = _lockWallet;
    }

    // Owner can add pool in the contract and max one pool can be added
    function addPool(
        IERC20 _lpToken,
        uint256 _fromBlock,
        uint256 _toBlock,
        uint256 _actualMultiplier,
        uint256 _rewardTokensPerBlock,
        uint256 _lockPeriod,
        uint256 _penaltyPercentage,
        uint256 _poolEndTime
    ) external onlyOwner {
        require(_fromBlock < _toBlock, 'Distributor: _fromBlock Should be less than _toBlock');
        require(poolInfo.length < 1, 'Distributor: Pool Already Added');
        require(address(_lpToken) != address(0), 'Distributor: _lpToken should not be address zero');

        uint256 lastRewardBlock = block.number > _fromBlock ? block.number : _fromBlock;
        poolInfo.push(
            PoolInfo({
                lpToken: _lpToken,
                rewardTokensPerBlock: _rewardTokensPerBlock,
                totalStaked: 0,
                fromBlock: _fromBlock,
                toBlock: _toBlock,
                actualMultiplier: _actualMultiplier,
                lastRewardBlock: lastRewardBlock,
                accTokensPerShare: 0,
                isStopped: false,
                lockPeriod: _lockPeriod,
                penaltyPercentage: _penaltyPercentage,
                poolEndTime: _poolEndTime
            })
        );
    }

    // For anytwo block range multplier can be computer using this finction
    function getMultiplier(
        uint256 _pid,
        uint256 _from,
        uint256 _to
    ) public view returns (uint256) {
        PoolInfo storage pool = poolInfo[_pid];

        if (_to <= pool.toBlock) {
            return _to.sub(_from).mul(pool.actualMultiplier);
        } else if (_from >= pool.toBlock) {
            return _to.sub(_from);
        } else {
            return pool.toBlock.sub(_from).mul(pool.actualMultiplier).add(_to.sub(pool.toBlock));
        }
    }

    // View function to see pending on frontend
    function pendingReward(uint256 _pid, address _user) external view returns (uint256, uint256) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_user];
        uint256 accTokensPerShare = pool.accTokensPerShare;
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));

        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 multiplier = getMultiplier(_pid, pool.lastRewardBlock, block.number);
            uint256 totalReward = multiplier.mul(pool.rewardTokensPerBlock);
            accTokensPerShare = accTokensPerShare.add(totalReward.mul(1e12).div(lpSupply));

            if (user.amount > 0) {
                uint256 pending = 0;
                uint256 rewardwithoutLockPeriod;
                uint256 currentTimeStamp = now;

                for (uint256 index = 0; index < user.stakeInfo.length; index++) {
                    if (user.stakeInfo[index].amount == 0) {
                        continue;
                    }

                    if ((currentTimeStamp.sub(user.stakeInfo[index].timeStamp)) >= pool.lockPeriod) {
                        uint256 currentReward = user.stakeInfo[index].amount.mul(accTokensPerShare).div(1e12).sub(
                            user.stakeInfo[index].rewardDebt
                        );
                        pending = pending.add(currentReward);
                        rewardwithoutLockPeriod = rewardwithoutLockPeriod.add(currentReward);
                    } else {
                        uint256 reward = user.stakeInfo[index].amount.mul(accTokensPerShare).div(1e12).sub(
                            user.stakeInfo[index].rewardDebt
                        );
                        rewardwithoutLockPeriod = rewardwithoutLockPeriod.add(reward);
                    }
                }
                return (pending, rewardwithoutLockPeriod);
            }
        }
        return (0, 0);
    }

    // Lets user deposit any amount of Lp tokens
    // 0 amount represent that user is only interested in claiming the reward
    function deposit(uint256 _pid, uint256 _amount) external {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[msg.sender];
        require(pool.isStopped == false, 'Distributor: Staking Ended, Please withdraw your tokens');
        updatePool(_pid);
        if (user.amount > 0) {
            uint256 pending = 0;

            uint256 currentTimeStamp = now;

            for (uint256 index = 0; index < user.stakeInfo.length; index++) {
                if (user.stakeInfo[index].amount == 0) {
                    continue;
                }

                if ((currentTimeStamp.sub((user.stakeInfo[index].timeStamp))) >= pool.lockPeriod) {
                    pending = pending.add(
                        user.stakeInfo[index].amount.mul(pool.accTokensPerShare).div(1e12).sub(
                            user.stakeInfo[index].rewardDebt
                        )
                    );
                    user.stakeInfo[index].rewardDebt = user.stakeInfo[index].amount.mul(pool.accTokensPerShare).div(
                        1e12
                    );
                }
            }

            if (pending > 0) {
                safeStakingTokensTransfer(msg.sender, pending);
            }
        }
        if (_amount > 0) {
            pool.lpToken.safeTransferFrom(address(msg.sender), address(this), _amount);
            user.amount = user.amount.add(_amount);
            pool.totalStaked = pool.totalStaked.add(_amount);

            user.stakeInfo.push(
                StakeInfo({amount: _amount, rewardDebt: _amount.mul(pool.accTokensPerShare).div(1e12), timeStamp: now})
            );
            emit Deposit(msg.sender, _pid, _amount, (pool.accTokensPerShare).div(1e12));
        }
    }

    // Lets user withdraw any amount of LPs user needs
    function withdraw(uint256 _pid, uint256 _amount) external {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[msg.sender];
        require(user.amount >= _amount, 'Distributor: Withdraw not good');
        updatePool(_pid);

        uint256 totalSelected = 0;
        uint256 rewardForTransfers = 0;
        uint256 totalPenalty = 0;
        uint256 currentTimeStamp = now;
        bool timeToBreak = false;

        for (uint256 index = 0; index < user.stakeInfo.length; index++) {
            if (timeToBreak) {
                break;
            }

            if (user.stakeInfo[index].amount == 0) {
                continue;
            }

            uint256 deductionAmount = 0;
            if (totalSelected.add(user.stakeInfo[index].amount) >= _amount) {
                deductionAmount = _amount.sub(totalSelected);
                timeToBreak = true;
            } else {
                deductionAmount = user.stakeInfo[index].amount;
            }

            totalSelected = totalSelected.add(deductionAmount);

            // if the lockperiod is not over for the stake amount then apply panelty

            uint256 currentAmountReward = user.stakeInfo[index].amount.mul(pool.accTokensPerShare).div(1e12).sub(
                user.stakeInfo[index].rewardDebt
            );
            user.stakeInfo[index].amount = user.stakeInfo[index].amount.sub(deductionAmount);
            uint256 rewardPenalty = (currentTimeStamp.sub((user.stakeInfo[index].timeStamp))) < pool.lockPeriod
                ? currentAmountReward.mul(pool.penaltyPercentage).div(10**2)
                : 0;

            rewardForTransfers = rewardForTransfers.add(currentAmountReward.sub(rewardPenalty));
            // accumulating penalty amount on each staked withdrawal to be sent to lockwallet
            totalPenalty = totalPenalty.add(rewardPenalty);
            // calculate rewardDebt for the deduction amount
            user.stakeInfo[index].rewardDebt = user.stakeInfo[index].amount.mul(pool.accTokensPerShare).div(1e12);
        }

        if (rewardForTransfers > 0) {
            safeStakingTokensTransfer(msg.sender, rewardForTransfers);
        }
        // penalty amount transfered to lockwallet.
        if (totalPenalty > 0) {
            safeStakingTokensTransfer(lockWallet, totalPenalty);
        }

        if (_amount > 0) {
            user.amount = user.amount.sub(_amount);
            pool.totalStaked = pool.totalStaked.sub(_amount);
            pool.lpToken.safeTransfer(address(msg.sender), _amount);
        }
        emit Withdraw(msg.sender, _pid, _amount, (pool.accTokensPerShare).div(1e12));
    }

    // Let the user see stake info for any of deposited LP for frontend
    function getStakeInfo(uint256 index)
        external
        view
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        UserInfo storage user = userInfo[msg.sender];
        return (user.stakeInfo[index].amount, user.stakeInfo[index].rewardDebt, user.stakeInfo[index].timeStamp);
    }

    // Let user see total deposits
    function getUserStakesLength() external view returns (uint256) {
        return userInfo[msg.sender].stakeInfo.length;
    }

    // Withdraw without caring about rewards. EMERGENCY ONLY.
    function emergencyWithdraw(uint256 _pid) external {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[msg.sender];
        uint256 totalLps = 0;
        for (uint256 index = 0; index < user.stakeInfo.length; index++) {
            if (user.stakeInfo[index].amount > 0) {
                totalLps = totalLps.add(user.stakeInfo[index].amount);
                user.stakeInfo[index].amount = 0;
                user.stakeInfo[index].rewardDebt = 0;
            }
        }
        pool.totalStaked = pool.totalStaked.sub(totalLps);
        pool.lpToken.safeTransfer(address(msg.sender), totalLps);
        emit EmergencyWithdraw(msg.sender, _pid, totalLps);
        user.amount = 0;
    }

    // Update reward variables for all pools. Be careful of gas spending!

    function massUpdatePools() external {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

    // Update reward variables of the given pool to be up-to-date.
    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];

        if (block.number <= pool.lastRewardBlock || pool.isStopped) {
            return;
        }

        uint256 lpSupply = pool.lpToken.balanceOf(address(this));

        if (lpSupply == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }

        uint256 multiplier = getMultiplier(_pid, pool.lastRewardBlock, block.number);

        uint256 stakingReward = multiplier.mul(pool.rewardTokensPerBlock);

        if (doMint) {
            stakingToken.mint(address(this), stakingReward);
        }

        pool.accTokensPerShare = pool.accTokensPerShare.add(stakingReward.mul(1e12).div(lpSupply));

        pool.lastRewardBlock = block.number;
    }

    // Transfer reward tokens on users address
    function safeStakingTokensTransfer(address _to, uint256 _amount) internal {
        uint256 stakingTokenBalanceOnChef = stakingToken.balanceOf(address(this));

        if (_amount > stakingTokenBalanceOnChef) {
            stakingToken.transfer(_to, stakingTokenBalanceOnChef);
        } else {
            stakingToken.transfer(_to, _amount);
        }
    }
}
