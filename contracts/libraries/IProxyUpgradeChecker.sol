// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IProxyUpgradeChecker {

    function contractName() external view returns(string memory thisContractName);

}