// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/interfaces/IERC4906.sol";

import "erc721a-upgradeable/contracts/ERC721AUpgradeable.sol";

import "./libraries/ProxyUpgradeChecker.sol";

import "./interfaces/IDockMarketNFT.sol";

contract DockMarketNFT is 
    IDockMarketNFT, 
    ProxyUpgradeChecker, 
    ERC721AUpgradeable, 
    UUPSUpgradeable, 
    AccessControlUpgradeable, 
    OwnableUpgradeable 
{

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    uint64 public immutable MAX_TOTAL_SUPPLY;

    /// @custom:storage-location erc7201:DockMarket.storage.NFT
    struct DockMarketNFTStorage {
        string _tokenURI;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("DockMarket.storage.NFT")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant DOCKMARKET_NFT_STORAGE_LOCATION = 0x22ec383ec68b88ce64eb04f5ffb87f19de7090d49abc874d56d505d594eef300;

    error DockMarketNFT__TotalSupplyExceeded();

    event TokenURISet(string newTokenURI, address indexed caller);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(uint64 maxTotalSupply) {
        _disableInitializers();

        MAX_TOTAL_SUPPLY = maxTotalSupply;
    }

    function initialize(
        address defaultAdmin,
        string calldata name,
        string calldata symbol
    ) external initializerERC721A() initializer() {
        __AccessControl_init();
        __UUPSUpgradeable_init();
        __ERC721A_init(name, symbol);
        __Ownable_init(defaultAdmin);

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        require(MAX_TOTAL_SUPPLY >= totalSupply() + amount, DockMarketNFT__TotalSupplyExceeded());
        _safeMint(to, amount);
    }

    function setTokenURI(string calldata newTokenURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setTokenURI(newTokenURI);
    }

    function getIdsOfOwner(address owner) external view returns(uint64[] memory ids) {
        uint256 _ownerBalance = balanceOf(owner);
        if (_ownerBalance == 0) return new uint64[](0);

        ids = new uint64[](_ownerBalance);
        uint16 _counter;

        for (uint16 i; totalSupply() > i; i++) {
            if (ownerOf(i) == owner) {
                ids[_counter] = i;
                _counter += 1;
                if (_counter == _ownerBalance) return ids;
            }
        }
    }

    function tokenURI(uint256 /* tokenId */) public view override(IERC721AUpgradeable, ERC721AUpgradeable) returns(string memory uri) {
        DockMarketNFTStorage storage $ = _getDockMarketNFTStorage();
        return $._tokenURI;
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(IERC721AUpgradeable, ERC721AUpgradeable, AccessControlUpgradeable) returns(bool supported) {
        return 
            interfaceId == type(IDockMarketNFT).interfaceId ||
            interfaceId == type(IERC721AUpgradeable).interfaceId ||
            ERC721AUpgradeable.supportsInterface(interfaceId) ||
            AccessControlUpgradeable.supportsInterface(interfaceId);
    }

    function contractName() public view override returns(string memory thisContractName) {
        return "DockMarketNFT";
    }

    function _setTokenURI(string calldata newTokenURI) internal {
        DockMarketNFTStorage storage $ = _getDockMarketNFTStorage();
        $._tokenURI = newTokenURI;

        emit TokenURISet(newTokenURI, msg.sender);
        emit IERC4906.MetadataUpdate(type(uint256).max);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {
        _checkContractType(newImplementation);
    }
    
    function _getDockMarketNFTStorage() private pure returns(DockMarketNFTStorage storage $) {
        assembly {
            $.slot := DOCKMARKET_NFT_STORAGE_LOCATION
        }
    }

}