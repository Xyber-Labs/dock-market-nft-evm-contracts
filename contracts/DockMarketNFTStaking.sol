// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import "./libraries/ProxyUpgradeChecker.sol";

import "./interfaces/IDockMarketNFT.sol";
import "./interfaces/IDockMarketNFTStaking.sol";

contract DockMarketNFTStaking is IDockMarketNFTStaking, ProxyUpgradeChecker, UUPSUpgradeable, AccessControlUpgradeable {
    using EnumerableSet for *;

    address public immutable DOCK_MARKET_NFT;

    /// @custom:storage-location erc7201:DockMarket.storage.NFTStaking
    struct DockMarketNFTStakingStorage {
        EnumerableSet.AddressSet _stakers;
        mapping(uint256 tokenId => StakeData) _stakeData;
        mapping(address staker => EnumerableSet.UintSet) _stakedTokenIds;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("DockMarket.storage.NFTStaking")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant DOCKMARKET_NFT_STAKING_STORAGE_LOCATION = 0xea0aca84277d96d77759a5ee48c9f441d86b11a823f6cf4f8febbd26c0730200;

    error DockMarketNFTStaking__NotAnOwner();
    error DockMarketNFTStaking__LockedToken();
    error DockMarketNFTStaking__ZeroAddress();
    error DockMarketNFTStaking__InvalidLength();
    error DockMarketNFTStaking__UnstakedToken();

    event Staked(
        address indexed holder,
        address indexed staker,
        uint256 indexed tokenId,
        uint64 stakedAt,
        uint64 stakedUntil
    );

    event Unstaked(
        address indexed staker,
        address indexed receiver,
        uint256 indexed tokenId,
        uint64 unstakedAt
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address dockMarketNFTAddress) {
        _disableInitializers();

        DOCK_MARKET_NFT = dockMarketNFTAddress;
    }

    function initialize(address defaultAdmin) external initializer() {
        __UUPSUpgradeable_init();
        __AccessControl_init();

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
    }

    function stake(uint256[] calldata tokenIds) external returns(bool success) {
        require(tokenIds.length > 0, DockMarketNFTStaking__InvalidLength());

        for (uint256 i; tokenIds.length > i; i++) {
            _stake(msg.sender, msg.sender, tokenIds[i], 0);
        }
        
        return true;
    }

    function stakeWithLockOnBehalfOf(
        uint256[] calldata tokenIds, 
        address[] calldata receivers, 
        uint64[] calldata lockDurations
    ) external returns(bool success) {
        require(tokenIds.length > 0, DockMarketNFTStaking__InvalidLength());
        require(
            tokenIds.length == receivers.length && 
            tokenIds.length == lockDurations.length, 
            DockMarketNFTStaking__InvalidLength()
        );

        for (uint256 i; tokenIds.length > i; i++) {
            _stake(msg.sender, receivers[i], tokenIds[i], lockDurations[i]);
        }

        return true;
    }

    function unstake(uint256[] calldata tokenIds, address receiver) external returns(bool success) {
        require(tokenIds.length > 0, DockMarketNFTStaking__InvalidLength());

        for (uint256 i; tokenIds.length > i; i++) {
            _unstake(tokenIds[i], receiver);
        }

        return true;
    }

    function setUnlockTimestamps(
        uint256[] calldata tokenIds, 
        uint64[] calldata unlockTimestamps
    ) external onlyRole(DEFAULT_ADMIN_ROLE) returns(bool success) {
        require(tokenIds.length > 0, DockMarketNFTStaking__InvalidLength());
        require(tokenIds.length == unlockTimestamps.length, DockMarketNFTStaking__InvalidLength());

        DockMarketNFTStakingStorage storage $ = _getDockMarketNFTStakingStorage();

        for (uint256 i; tokenIds.length > i; i++) {
            require($._stakeData[tokenIds[i]].staker != address(0), DockMarketNFTStaking__UnstakedToken());

            $._stakeData[tokenIds[i]].lockedUntil = unlockTimestamps[i];
        }

        return true;
    }

    function stakers() external view returns(address[] memory stakersList) {
        DockMarketNFTStakingStorage storage $ = _getDockMarketNFTStakingStorage();
        return $._stakers.values();
    }

    function stakedTokenIds(address staker) external view returns(uint256[] memory stakedTokensIds) {
        DockMarketNFTStakingStorage storage $ = _getDockMarketNFTStakingStorage();
        return $._stakedTokenIds[staker].values();
    }

    function stakeData(uint256[] calldata tokenIds) external view returns(StakeData[] memory stakesData) {
        DockMarketNFTStakingStorage storage $ = _getDockMarketNFTStakingStorage();
        stakesData = new StakeData[](tokenIds.length);
        for (uint256 i; tokenIds.length > i; i++) stakesData[i] = $._stakeData[tokenIds[i]];
    }

    function stakeDataByStaker(address staker) external view returns(StakeInfo[] memory stakesInfo) {
        DockMarketNFTStakingStorage storage $ = _getDockMarketNFTStakingStorage();
        uint256[] memory _stakedTokensIds = $._stakedTokenIds[staker].values();
        stakesInfo = new StakeInfo[](_stakedTokensIds.length);

        for (uint256 i; stakesInfo.length > i; i++) {
            stakesInfo[i] = StakeInfo ({
                tokenId: _stakedTokensIds[i],
                staker: $._stakeData[_stakedTokensIds[i]].staker,
                stakedAt: $._stakeData[_stakedTokensIds[i]].stakedAt,
                lockedUntil: $._stakeData[_stakedTokensIds[i]].lockedUntil
            });
        }
    }

    function supportsInterface(bytes4 interfaceId) public view override returns(bool supported) {
        return interfaceId == type(IDockMarketNFTStaking).interfaceId || super.supportsInterface(interfaceId);
    }

    function contractName() public view override returns(string memory thisContractName) {
        return "DockMarketNFTStaking";
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {
        _checkContractType(newImplementation);
    }

    function _stake(address holder, address receiver, uint256 tokenId, uint256 lockDuration) internal {
        DockMarketNFTStakingStorage storage $ = _getDockMarketNFTStakingStorage();

        require(receiver != address(0), DockMarketNFTStaking__ZeroAddress());
        require(IDockMarketNFT(DOCK_MARKET_NFT).ownerOf(tokenId) == holder, DockMarketNFTStaking__NotAnOwner());

        $._stakers.add(receiver);
        $._stakedTokenIds[receiver].add(tokenId);
        $._stakeData[tokenId] = StakeData({
            staker: receiver,
            stakedAt: uint64(block.timestamp),
            lockedUntil: uint64(block.timestamp + lockDuration)
        });

        emit Staked(holder, receiver, tokenId, uint64(block.timestamp), uint64(block.timestamp + lockDuration));

        IDockMarketNFT(DOCK_MARKET_NFT).transferFrom(holder, address(this), tokenId);
    }

    function _unstake(uint256 tokenId, address receiver) internal {
        DockMarketNFTStakingStorage storage $ = _getDockMarketNFTStakingStorage();

        address _staker = $._stakeData[tokenId].staker;

        require(_staker == msg.sender, DockMarketNFTStaking__NotAnOwner());
        require(block.timestamp >= $._stakeData[tokenId].lockedUntil, DockMarketNFTStaking__LockedToken());

        delete $._stakeData[tokenId];
        $._stakedTokenIds[_staker].remove(tokenId);
        if ($._stakedTokenIds[_staker].length() == 0) $._stakers.remove(_staker);

        emit Unstaked(_staker, receiver, tokenId, uint64(block.timestamp));

        IDockMarketNFT(DOCK_MARKET_NFT).safeTransferFrom(address(this), receiver, tokenId);
    }

    function _getDockMarketNFTStakingStorage() private pure returns(DockMarketNFTStakingStorage storage $) {
        assembly {
            $.slot := DOCKMARKET_NFT_STAKING_STORAGE_LOCATION
        }
    }

}