const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("DockMarketNFTStakingProxyModule", (m) => {

    const initializeCalldataNFTSale = m.getParameter("initializeCalldataNFTSale");
    const dockMarketNFTAddress = m.getParameter("dockMarketNFTAddress");

    const DockMarketNFTStakingImplementation = m.contract("DockMarketNFTStaking", [dockMarketNFTAddress]);

    const DockMarketNFTStakingProxy = m.contract('ERC1967Proxy', [DockMarketNFTStakingImplementation, initializeCalldataNFTSale]);

    return { DockMarketNFTStakingImplementation, DockMarketNFTStakingProxy };
});