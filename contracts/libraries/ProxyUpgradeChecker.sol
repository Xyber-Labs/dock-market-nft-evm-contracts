// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/access/IAccessControl.sol";

import "solady/src/utils/LibString.sol";

import "./IProxyUpgradeChecker.sol";

abstract contract ProxyUpgradeChecker is IProxyUpgradeChecker {
    using LibString for *;

    error ProxyUpgradeChecker__InvalidImplementation();

    function contractName() public view virtual returns(string memory thisContractName);
    
    function _checkContractType(address newImplementation) internal view virtual {
        require(
            IProxyUpgradeChecker(newImplementation).contractName().eq(contractName()), 
            ProxyUpgradeChecker__InvalidImplementation()
        );

        require(
            IERC165(newImplementation).supportsInterface(type(IAccessControl).interfaceId), 
            ProxyUpgradeChecker__InvalidImplementation()
        );
    }
}