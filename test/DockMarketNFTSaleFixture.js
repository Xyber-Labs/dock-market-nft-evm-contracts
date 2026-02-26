
const { maxTotalSupply, publicAllocation, whitelistPrice, publicPrice, nftName, nftSymbol } = require("./Constants.js");
const DockMarketNFTStakingProxyModule = require("../ignition/modules/DockMarketNFTStakingProxyModule.js");
const DockMarketNFTSaleProxyModule = require("../ignition/modules/DockMarketNFTSaleProxyModule.js");
const DockMarketNFTProxyModule = require("../ignition/modules/DockMarketNFTProxyModule.js");
const AbiCoder = new ethers.AbiCoder();

async function DockMarketNFTSaleFixture() {
    const [admin, user, userTwo, collector, collectorTwo] = await ethers.getSigners();

    const initializeParamsNFT = AbiCoder.encode([
        "address",
        "string",
        "string"
    ], [
        admin.address,
        nftName,
        nftSymbol
    ]);

    const initializeCalldataNFT = ethers.id('initialize(address,string,string)').substring(0, 10) + initializeParamsNFT.slice(2);

    const { DockMarketNFTImplementation, DockMarketNFTProxy } = await ignition.deploy(DockMarketNFTProxyModule, {
        parameters: {
            DockMarketNFTProxyModule: {
                initializeCalldataNFT: initializeCalldataNFT,
                maxTotalSupply: maxTotalSupply
            },
        },
    });

    const initializeCalldataNFTSale = ethers.id('initialize(address)').substring(0, 10) + ethers.zeroPadValue(admin.address, 32).slice(2);

    const { DockMarketNFTSaleImplementation, DockMarketNFTSaleProxy } = await ignition.deploy(DockMarketNFTSaleProxyModule, {
        parameters: {
            DockMarketNFTSaleProxyModule: {
                initializeCalldataNFTSale: initializeCalldataNFTSale,
                dockMarketNFTAddress: DockMarketNFTProxy.target,
                publicAllocation: publicAllocation,
                whitelistPrice: whitelistPrice,
                publicPrice: publicPrice
            },
        },
    });

    const { DockMarketNFTStakingImplementation, DockMarketNFTStakingProxy } = await ignition.deploy(DockMarketNFTStakingProxyModule, {
        parameters: {
            DockMarketNFTStakingProxyModule: {
                initializeCalldataNFTSale: initializeCalldataNFTSale,
                dockMarketNFTAddress: DockMarketNFTProxy.target
            },
        },
    });

    const nft = await ethers.getContractAt("DockMarketNFT", DockMarketNFTProxy);
    const nftSale = await ethers.getContractAt("DockMarketNFTSale", DockMarketNFTSaleProxy);
    const nftStaking = await ethers.getContractAt("DockMarketNFTStaking", DockMarketNFTStakingProxy);

    const adminRole = await nft.DEFAULT_ADMIN_ROLE();
    const minterRole = await nft.MINTER_ROLE();

    await nft.connect(admin).grantRole(minterRole, nftSale.target);

    return {
        admin, user, userTwo, collector, collectorTwo, nft, nftSale, nftStaking, adminRole, minterRole, DockMarketNFTImplementation, DockMarketNFTSaleImplementation,
        DockMarketNFTStakingImplementation
    };
};

module.exports = { DockMarketNFTSaleFixture };