const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("DockMarketNFTProxyModule", (m) => {

    const initializeCalldataNFT = m.getParameter("initializeCalldataNFT");
    const maxTotalSupply = m.getParameter("maxTotalSupply");

    const DockMarketNFTImplementation = m.contract("DockMarketNFT", [maxTotalSupply]);

    const DockMarketNFTProxy = m.contract('ERC1967Proxy', [DockMarketNFTImplementation, initializeCalldataNFT]);

    return { DockMarketNFTImplementation, DockMarketNFTProxy };
});