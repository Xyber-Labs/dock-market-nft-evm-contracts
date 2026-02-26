// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import "./libraries/ProxyUpgradeChecker.sol";

import "./interfaces/IDockMarketNFTSale.sol";
import "./interfaces/IDockMarketNFT.sol";

contract DockMarketNFTSale is IDockMarketNFTSale, ProxyUpgradeChecker, UUPSUpgradeable, AccessControlUpgradeable {
    using Address for address payable;

    address private immutable DOCK_MARKET_NFT;

    uint32 private immutable PUBLIC_ALLOCATION;
    uint64 private immutable WHITELIST_PRICE;
    uint64 private immutable PUBLIC_PRICE;

    /// @custom:storage-location erc7201:DockMarket.storage.NFTSale
    struct DockMarketNFTSaleStorage {
        uint32 _whitelistStart;
        uint32 _whitelistEnd;
        uint32 _publicStart;
        uint32 _presaleDeposited;
        uint32 _whitelistDeposited;
        uint32 _publicDeposited;
        uint32 _presaleClaimed;
        uint32 _whitelistClaimed;
        uint32 _publicClaimed;
        bytes32 _presaleRoot;
        bytes32 _whitelistRoot;
        address _fundAddress;
        address _treasuryAddress;
        mapping(address user => UserData) _userData;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("DockMarket.storage.NFTSale")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant DOCKMARKET_NFT_SALE_STORAGE_LOCATION = 0x58a7106e4bb767da92dd85cbfd5701741fd374b8a444987abe86b50cc2a34f00;

    error DockMarketNFTSale__ZeroAddress();
    error DockMarketNFTSale__InvalidValue();
    error DockMarketNFTSale__NoAllocation();
    error DockMarketNFTSale__IncorrectState();
    error DockMarketNFTSale__NothingToClaim();
    error DockMarketNFTSale__InvalidTimestamp();
    error DockMarketNFTSale__MerkleProofFailed();
    error DockMarketNFTSale__TotalSupplyExceeded();
    
    event Deposited(
        address indexed user,
        uint256 depositedAmount,
        bool indexed isWhitelist,
        uint32 purchasedAmount
    );

    event Claimed(
        address indexed user,
        address indexed receiver,
        uint32 presaleAmount,
        uint32 whitelistAmount,
        uint32 publicAmount
    );

    event ReceiverSet(
        address newFundAddress,
        address newTreasuryAddress,
        address indexed caller
    );

    event TimestampsSet(
        uint32 newWhitelistStart,
        uint32 newWhitelistEnd,
        uint32 newPublicStart,
        address indexed caller
    );

    event RootsSet(
        uint32 newPresaleReserve,
        bytes32 newPresaleRoot,
        bytes32 newWhitelistRoot,
        address indexed caller
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address dockMarketNFTAddress, uint32 publicAllocation, uint64 whitelistPrice, uint64 publicPrice) {
        _disableInitializers();

        DOCK_MARKET_NFT = dockMarketNFTAddress;
        PUBLIC_ALLOCATION = publicAllocation;
        WHITELIST_PRICE = whitelistPrice;
        PUBLIC_PRICE = publicPrice;
    }

    function initialize(address defaultAdmin) external initializer() {
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _setReceivers(defaultAdmin, defaultAdmin);
    }

    function deposit(uint32 whitelistAllocation, bytes32[] calldata whitelistProof) external payable returns(uint32 purchasedAmount) {
        require(msg.value > 0, DockMarketNFTSale__InvalidValue());

        State _currentState = _getState();

        require(_currentState == State.Whitelist || _currentState == State.Public, DockMarketNFTSale__IncorrectState());

        DockMarketNFTSaleStorage storage $ = _getDockMarketNFTSaleStorage();
        UserData storage userData = $._userData[msg.sender];

        if (_currentState == State.Whitelist) {
            require(msg.value >= WHITELIST_PRICE, DockMarketNFTSale__InvalidValue());
            require(msg.value % WHITELIST_PRICE == 0, DockMarketNFTSale__InvalidValue());
            _merkleProofVerify(whitelistProof, $._whitelistRoot, abi.encode(msg.sender, whitelistAllocation));
            
            purchasedAmount += uint32(msg.value / WHITELIST_PRICE);

            require(whitelistAllocation >= purchasedAmount + userData.whitelistDeposited, DockMarketNFTSale__NoAllocation());

            userData.whitelistDeposited += purchasedAmount;
            $._whitelistDeposited += purchasedAmount; 
        } else { 
            require(msg.value >= PUBLIC_PRICE, DockMarketNFTSale__InvalidValue());
            require(msg.value % PUBLIC_PRICE == 0, DockMarketNFTSale__InvalidValue());

            purchasedAmount += uint32(msg.value / PUBLIC_PRICE);

            require(PUBLIC_ALLOCATION >= purchasedAmount + userData.publicDeposited, DockMarketNFTSale__NoAllocation());

            userData.publicDeposited += purchasedAmount;
            $._publicDeposited += purchasedAmount;
        }

        require(IDockMarketNFT(DOCK_MARKET_NFT).MAX_TOTAL_SUPPLY() >= _getPurchasedAmount(), DockMarketNFTSale__TotalSupplyExceeded());

        emit Deposited(msg.sender, msg.value, _currentState == State.Whitelist, purchasedAmount);

        payable($._fundAddress).sendValue(msg.value / 2);
        payable($._treasuryAddress).sendValue(msg.value / 2);
    }

    function claim(uint32 presaleAllocation, bytes32[] calldata presaleProof, address receiver) external returns(uint32 claimedAmount) {
        require(_getState() == State.Claim, DockMarketNFTSale__IncorrectState());

        DockMarketNFTSaleStorage storage $ = _getDockMarketNFTSaleStorage();
        UserData storage userData = $._userData[msg.sender];

        uint32 _presaleAmount;

        if (presaleProof.length > 0) {
            _merkleProofVerify(presaleProof, $._presaleRoot, abi.encode(msg.sender, presaleAllocation));

            _presaleAmount = presaleAllocation - userData.presaleClaimed;

            require($._presaleDeposited >= $._presaleClaimed + _presaleAmount, DockMarketNFTSale__TotalSupplyExceeded());

            claimedAmount += _presaleAmount;
            $._presaleClaimed += _presaleAmount;
            userData.presaleClaimed += _presaleAmount;
        }

        uint32 _whitelistAmount = userData.whitelistDeposited - userData.whitelistClaimed;

        claimedAmount += _whitelistAmount;
        $._whitelistClaimed += _whitelistAmount;
        userData.whitelistClaimed += _whitelistAmount;

        uint32 _publicAmount = userData.publicDeposited - userData.publicClaimed; 

        claimedAmount += _publicAmount;
        $._publicClaimed += _publicAmount;
        userData.publicClaimed += _publicAmount;

        require(claimedAmount > 0, DockMarketNFTSale__NothingToClaim());

        IDockMarketNFT(DOCK_MARKET_NFT).mint(receiver, claimedAmount);

        emit Claimed(msg.sender, receiver, _presaleAmount, _whitelistAmount, _publicAmount);
    }

    function setReceivers(address newFundAddress, address newTreasuryAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setReceivers(newFundAddress, newTreasuryAddress);
    }

    function setTimestamps(
        uint32 newWhitelistStart,
        uint32 newWhitelistEnd,
        uint32 newPublicStart
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        DockMarketNFTSaleStorage storage $ = _getDockMarketNFTSaleStorage();

        if ($._whitelistStart == 0) require(newWhitelistStart > block.timestamp, DockMarketNFTSale__InvalidTimestamp());
        require(newWhitelistEnd > newWhitelistStart, DockMarketNFTSale__InvalidTimestamp());
        require(newPublicStart > newWhitelistEnd, DockMarketNFTSale__InvalidTimestamp());

        $._whitelistStart = newWhitelistStart;
        $._whitelistEnd = newWhitelistEnd;
        $._publicStart = newPublicStart;

        emit TimestampsSet(newWhitelistStart, newWhitelistEnd, newPublicStart, msg.sender);
    }

    function setRoots(
        uint32 newPresaleDeposited,
        bytes32 newPresaleRoot,
        bytes32 newWhitelistRoot
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        DockMarketNFTSaleStorage storage $ = _getDockMarketNFTSaleStorage();

        $._presaleDeposited = newPresaleDeposited;
        $._presaleRoot = newPresaleRoot;
        $._whitelistRoot = newWhitelistRoot;

        require(
            IDockMarketNFT(DOCK_MARKET_NFT).MAX_TOTAL_SUPPLY() >= _getPurchasedAmount(), 
            DockMarketNFTSale__TotalSupplyExceeded()
        );
        
        emit RootsSet(newPresaleDeposited, newPresaleRoot, newWhitelistRoot, msg.sender);
    }

    function getUserData(address user) external view returns(UserData memory userData) {
        DockMarketNFTSaleStorage storage $ = _getDockMarketNFTSaleStorage();
        return $._userData[user];
    }

    function getSaleData() external view returns(SaleData memory saleData) {
        DockMarketNFTSaleStorage storage $ = _getDockMarketNFTSaleStorage();

        return SaleData({
            currentState: _getState(),
            publicAllocation: PUBLIC_ALLOCATION,
            whitelistPrice: WHITELIST_PRICE,
            publicPrice: PUBLIC_PRICE,
            whitelistStart: $._whitelistStart,  
            whitelistEnd: $._whitelistEnd,
            publicStart: $._publicStart,  
            presaleDeposited: $._presaleDeposited,
            whitelistDeposited: $._whitelistDeposited,
            publicDeposited: $._publicDeposited,
            presaleClaimed: $._presaleClaimed,
            whitelistClaimed: $._whitelistClaimed,
            publicClaimed: $._publicClaimed,
            presaleRoot: $._presaleRoot,
            whitelistRoot: $._whitelistRoot,
            fundAddress: $._fundAddress,
            treasuryAddress: $._treasuryAddress,
            dockMarketNFTAddress: DOCK_MARKET_NFT,
            maxTotalSupply: IDockMarketNFT(DOCK_MARKET_NFT).MAX_TOTAL_SUPPLY(),
            currentTotalSupply: IDockMarketNFT(DOCK_MARKET_NFT).totalSupply()
        });
    }

    function supportsInterface(bytes4 interfaceId) public view override returns(bool supported) {
        return interfaceId == type(IDockMarketNFTSale).interfaceId || super.supportsInterface(interfaceId);
    }

    function contractName() public view override returns(string memory thisContractName) {
        return "DockMarketNFTSale";
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {
        _checkContractType(newImplementation);
    }

    function _getState() internal view returns(State currentState) {
        DockMarketNFTSaleStorage storage $ = _getDockMarketNFTSaleStorage();

        if ($._whitelistStart == 0) return State.Preparation;
        if (_getPurchasedAmount() == IDockMarketNFT(DOCK_MARKET_NFT).MAX_TOTAL_SUPPLY()) return State.Claim;
        if ($._whitelistStart <= block.timestamp && block.timestamp <= $._whitelistEnd) return State.Whitelist;
        if ($._publicStart <= block.timestamp) return State.Public;
        return State.Preparation;
    }

    function _getPurchasedAmount() internal view returns(uint32 purchasedAmount) {
        DockMarketNFTSaleStorage storage $ = _getDockMarketNFTSaleStorage();
        return $._presaleDeposited + $._publicDeposited + $._whitelistDeposited;
    }
    
    function _merkleProofVerify(bytes32[] calldata proof, bytes32 root, bytes memory leaf) internal pure {
        require(MerkleProof.verify(proof, root, keccak256(bytes.concat(keccak256(leaf)))), DockMarketNFTSale__MerkleProofFailed());
    }

    function _setReceivers(address newFundAddress, address newTreasuryAddress) internal {
        DockMarketNFTSaleStorage storage $ = _getDockMarketNFTSaleStorage();

        require(newFundAddress != address(0), DockMarketNFTSale__ZeroAddress());
        require(newTreasuryAddress != address(0), DockMarketNFTSale__ZeroAddress());

        $._fundAddress = newFundAddress;
        $._treasuryAddress = newTreasuryAddress;

        emit ReceiverSet(newFundAddress, newTreasuryAddress, msg.sender);
    }

    function _getDockMarketNFTSaleStorage() private pure returns(DockMarketNFTSaleStorage storage $) {
        assembly {
            $.slot := DOCKMARKET_NFT_SALE_STORAGE_LOCATION
        }
    }

}