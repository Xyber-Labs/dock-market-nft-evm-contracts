
const { DockMarketNFTSaleFixture } = require("./DockMarketNFTSaleFixture.js");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { maxTotalSupply, nftName, nftSymbol } = require("./Constants.js");
const { expect } = require("chai");

describe("DockMarketNFT", function () {
    describe("Deploy", function () {
        it("Init settings", async function () {
            const { admin, nft, nftSale, adminRole, minterRole } = await loadFixture(DockMarketNFTSaleFixture);

            expect(await nft.hasRole(adminRole, admin.address)).to.equal(true);
            expect(await nft.hasRole(minterRole, nftSale.target)).to.equal(true);
            expect(await nft.owner()).to.equal(admin.address);
            expect(await nft.name()).to.equal(nftName);
            expect(await nft.symbol()).to.equal(nftSymbol);
            expect(await nft.totalSupply()).to.equal(0n);
            expect(await nft.balanceOf(admin.address)).to.equal(0n);
            expect(await nft.isApprovedForAll(admin.address, admin.address)).to.equal(false);
            expect(await nft.getIdsOfOwner(admin.address)).to.eql([]);
            expect(await nft.tokenURI(0n)).to.equal("");
            expect(await nft.MAX_TOTAL_SUPPLY()).to.equal(maxTotalSupply);
            expect(await nft.contractName()).to.equal("DockMarketNFT");
            expect(await nft.supportsInterface("0xecf76387")).to.equal(true);
            expect(await nft.supportsInterface("0x01ffc9a7")).to.equal(true);
            expect(await nft.supportsInterface("0x7965db0b")).to.equal(true);
            expect(await nft.supportsInterface("0x80ac58cd")).to.equal(true);
            expect(await nft.supportsInterface("0x5b5e139f")).to.equal(true);
            expect(await nft.supportsInterface("0xc21b8f28")).to.equal(true);
        });

        it("Proxy", async function () {
            const { admin, user, nft, nftSale, DockMarketNFTImplementation } = await loadFixture(DockMarketNFTSaleFixture);

            await expect(nft.connect(user).upgradeToAndCall(
                user.address,
                "0x"
            )).to.be.revertedWithCustomError(nft, "AccessControlUnauthorizedAccount");

            await expect(nft.connect(user).initialize(
                user.address, "", ""
            )).to.be.revertedWith("ERC721A__Initializable: contract is already initialized");

            await expect(DockMarketNFTImplementation.connect(user).initialize(
                user.address, "", ""
            )).to.be.revertedWithCustomError(DockMarketNFTImplementation, "InvalidInitialization");

            const nftSaleImplMock = await ethers.getContractFactory("DockMarketNFTSale", admin);
            const nftSaleImplementation = await nftSaleImplMock.deploy(admin.address, 0n, 0n, 0n);
            await nftSaleImplementation.waitForDeployment();

            await expect(nft.connect(admin).upgradeToAndCall(
                nftSale.target, "0x"
            )).to.be.revertedWithCustomError(nft, "ProxyUpgradeChecker__InvalidImplementation()");

            await expect(nft.connect(admin).upgradeToAndCall(
                nftSaleImplementation.target, "0x"
            )).to.be.revertedWithCustomError(nft, "ProxyUpgradeChecker__InvalidImplementation()");

            await expect(nft.connect(admin).upgradeToAndCall(
                admin.address, "0x"
            )).to.be.revertedWithoutReason();
        });
    });

    describe("mint()", function () {
        it("AccessControl", async function () {
            const { admin, nft } = await loadFixture(DockMarketNFTSaleFixture);

            await expect(nft.connect(admin).mint(
                admin.address,
                maxTotalSupply
            )).to.be.revertedWithCustomError(nft, "AccessControlUnauthorizedAccount");
        });

        it("DockMarketNFT__TotalSupplyExceeded", async function () {
            const { admin, nft, minterRole } = await loadFixture(DockMarketNFTSaleFixture);

            await nft.connect(admin).grantRole(minterRole, admin.address);

            await expect(nft.connect(admin).mint(
                admin.address,
                maxTotalSupply + 1n
            )).to.be.revertedWithCustomError(nft, "DockMarketNFT__TotalSupplyExceeded");
        });

        it("Success", async function () {
            const { admin, nft, minterRole } = await loadFixture(DockMarketNFTSaleFixture);

            await nft.connect(admin).grantRole(minterRole, admin.address);

            await expect(nft.connect(admin).mint(
                admin.address,
                maxTotalSupply
            )).to.emit(nft, "Transfer").withArgs(
                ethers.ZeroAddress,
                admin.address,
                0n
            ).to.emit(nft, "Transfer").withArgs(
                ethers.ZeroAddress,
                admin.address,
                maxTotalSupply - 1n
            );

            expect(await nft.totalSupply()).to.equal(maxTotalSupply);
            expect(await nft.balanceOf(admin.address)).to.equal(maxTotalSupply);
        });
    });

    describe("setTokenURI()", function () {
        it("AccessControl", async function () {
            const { user, nft } = await loadFixture(DockMarketNFTSaleFixture);

            await expect(nft.connect(user).setTokenURI(
                "1"
            )).to.be.revertedWithCustomError(nft, "AccessControlUnauthorizedAccount");
        });

        it("Success", async function () {
            const { admin, nft } = await loadFixture(DockMarketNFTSaleFixture);

            await expect(nft.connect(admin).setTokenURI(
                "1"
            )).to.emit(nft, "TokenURISet").withArgs(
                "1",
                admin.address
            ).to.emit(nft, "MetadataUpdate").withArgs(
                ethers.MaxUint256
            );

            expect(await nft.tokenURI(0n)).to.equal("1");
            expect(await nft.tokenURI(500n)).to.equal("1");
        });
    });

    describe("getIdsOfOwner()", function () {
        it("Success", async function () {
            const { user, admin, nft, minterRole } = await loadFixture(DockMarketNFTSaleFixture);

            await nft.connect(admin).grantRole(minterRole, admin.address);

            await expect(nft.connect(admin).mint(
                admin.address,
                5n
            )).to.emit(nft, "Transfer").withArgs(
                ethers.ZeroAddress,
                admin.address,
                0n
            ).to.emit(nft, "Transfer").withArgs(
                ethers.ZeroAddress,
                admin.address,
                4n
            );

            expect(await nft.totalSupply()).to.equal(5n);
            expect(await nft.balanceOf(admin.address)).to.equal(5n);
            expect(await nft.getIdsOfOwner(admin.address)).to.eql([0n, 1n, 2n, 3n, 4n]);

            await nft.connect(admin).mint(user.address, 2n);

            expect(await nft.totalSupply()).to.equal(7n);
            expect(await nft.balanceOf(user.address)).to.equal(2n);
            expect(await nft.balanceOf(admin.address)).to.equal(5n);
            expect(await nft.getIdsOfOwner(user.address)).to.eql([5n, 6n]);
            expect(await nft.getIdsOfOwner(admin.address)).to.eql([0n, 1n, 2n, 3n, 4n]);

            await nft.connect(admin).mint(admin.address, 2n);

            expect(await nft.totalSupply()).to.equal(9n);
            expect(await nft.balanceOf(user.address)).to.equal(2n);
            expect(await nft.balanceOf(admin.address)).to.equal(7n);
            expect(await nft.getIdsOfOwner(user.address)).to.eql([5n, 6n]);
            expect(await nft.getIdsOfOwner(admin.address)).to.eql([0n, 1n, 2n, 3n, 4n, 7n, 8n]);
        });
    });
});