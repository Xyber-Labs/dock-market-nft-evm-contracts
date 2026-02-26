// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "erc721a-upgradeable/contracts/IERC721AUpgradeable.sol";

interface IDockMarketNFT is IERC721AUpgradeable {

    function MAX_TOTAL_SUPPLY() external view returns(uint64 maxTotalSupply);

    function getIdsOfOwner(address owner) external view returns(uint64[] memory ids);

    function mint(address to, uint256 amount) external;

    function setTokenURI(string calldata newTokenURI) external;

}