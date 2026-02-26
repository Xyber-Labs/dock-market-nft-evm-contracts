// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IDockMarketNFTSale {

    enum State {Preparation, Whitelist, Public, Claim}

    struct UserData {
        uint32 whitelistDeposited;
        uint32 publicDeposited;
        uint32 presaleClaimed;
        uint32 whitelistClaimed;
        uint32 publicClaimed;
    }

    struct SaleData {
        State currentState;
        uint32 publicAllocation;
        uint64 whitelistPrice;
        uint64 publicPrice;
        uint32 whitelistStart;
        uint32 whitelistEnd;
        uint32 publicStart;
        uint32 presaleDeposited;
        uint32 whitelistDeposited;
        uint32 publicDeposited;
        uint32 presaleClaimed;
        uint32 whitelistClaimed;
        uint32 publicClaimed;
        bytes32 presaleRoot;
        bytes32 whitelistRoot;
        address fundAddress;
        address treasuryAddress;
        address dockMarketNFTAddress;
        uint256 maxTotalSupply;
        uint256 currentTotalSupply;
    }

    function getUserData(address user) external view returns(UserData memory userData);

    function getSaleData() external view returns(SaleData memory saleData);

    function deposit(uint32 whitelistAllocation, bytes32[] calldata whitelistProof) external payable returns(uint32 purchasedAmount);

    function claim(uint32 presaleAllocation, bytes32[] calldata presaleProof, address receiver) external returns(uint32 claimedAmount);

    function setReceivers(address newFundAddress, address newTreasuryAddress) external;

    function setTimestamps(uint32 newWhitelistStart, uint32 newWhitelistEnd, uint32 newPublicStart) external;

    function setRoots(uint32 newPresaleDeposited, bytes32 newPresaleRoot, bytes32 newWhitelistRoot) external;

}