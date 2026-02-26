const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("DockMarketNFTSaleProxyModule", (m) => {

    const initializeCalldataNFTSale = m.getParameter("initializeCalldataNFTSale");
    const dockMarketNFTAddress = m.getParameter("dockMarketNFTAddress");
    const publicAllocation = m.getParameter("publicAllocation");
    const whitelistPrice = m.getParameter("whitelistPrice");
    const publicPrice = m.getParameter("publicPrice");

    const DockMarketNFTSaleImplementation = m.contract("DockMarketNFTSale", [dockMarketNFTAddress, publicAllocation, whitelistPrice, publicPrice]);

    const DockMarketNFTSaleProxy = m.contract('ERC1967Proxy', [DockMarketNFTSaleImplementation, initializeCalldataNFTSale]);

    return { DockMarketNFTSaleImplementation, DockMarketNFTSaleProxy };
});