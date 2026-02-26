// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IDockMarketNFTStaking {

    struct StakeData {
        address staker;
        uint64 stakedAt;
        uint64 lockedUntil;
    }

    struct StakeInfo {
        uint256 tokenId;
        address staker;
        uint64 stakedAt;
        uint64 lockedUntil;
    }

    function DOCK_MARKET_NFT() external view returns(address dockMarketNFTAddress);

    function stakers() external view returns(address[] memory stakersList);

    function stakedTokenIds(address staker) external view returns(uint256[] memory stakedTokensIds);

    function stakeData(uint256[] calldata tokenIds) external view returns(StakeData[] memory stakesData);

    function stakeDataByStaker(address staker) external view returns(StakeInfo[] memory stakesInfo);

    function stake(uint256[] calldata tokenIds) external returns(bool success);

    function stakeWithLockOnBehalfOf(
        uint256[] calldata tokenIds, 
        address[] calldata receivers, 
        uint64[] calldata lockDurations
    ) external returns(bool success);

    function unstake(uint256[] calldata tokenIds, address receiver) external returns(bool success);

    function setUnlockTimestamps(uint256[] calldata tokenIds, uint64[] calldata unlockTimestamps) external returns(bool success);

}