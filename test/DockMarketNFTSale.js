
const { maxTotalSupply, publicAllocation, whitelistPrice, publicPrice } = require("./Constants.js");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const { DockMarketNFTSaleFixture } = require("./DockMarketNFTSaleFixture.js");
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");
const { expect } = require("chai");

describe("DockMarketNFTSale", function () {
    describe("Deploy", function () {
        it("Init settings", async function () {
            const { admin, nft, nftSale, adminRole } = await loadFixture(DockMarketNFTSaleFixture);

            expect(await nftSale.hasRole(adminRole, admin.address)).to.equal(true);
            expect(await nftSale.getUserData(admin.address)).to.eql([0n, 0n, 0n, 0n, 0n]);
            expect(await nftSale.getSaleData()).to.eql([
                0n,
                publicAllocation,
                whitelistPrice,
                publicPrice,
                0n,
                0n,
                0n,
                0n,
                0n,
                0n,
                0n,
                0n,
                0n,
                ethers.ZeroHash,
                ethers.ZeroHash,
                admin.address,
                admin.address,
                nft.target,
                maxTotalSupply,
                0n,
            ]);
            expect(await nftSale.contractName()).to.equal("DockMarketNFTSale");
            expect(await nftSale.supportsInterface("0x2241bf85")).to.equal(true);
            expect(await nftSale.supportsInterface("0x01ffc9a7")).to.equal(true);
            expect(await nftSale.supportsInterface("0x7965db0b")).to.equal(true);
        });

        it("Proxy", async function () {
            const { admin, user, nft, nftSale, DockMarketNFTSaleImplementation } = await loadFixture(DockMarketNFTSaleFixture);

            await expect(nftSale.connect(user).upgradeToAndCall(
                user.address,
                "0x"
            )).to.be.revertedWithCustomError(nftSale, "AccessControlUnauthorizedAccount");

            await expect(nftSale.connect(user).initialize(
                user.address
            )).to.be.revertedWithCustomError(nftSale, "InvalidInitialization");

            await expect(DockMarketNFTSaleImplementation.connect(user).initialize(
                user.address
            )).to.be.revertedWithCustomError(DockMarketNFTSaleImplementation, "InvalidInitialization");

            const nftImplMock = await ethers.getContractFactory("DockMarketNFT", admin);
            const nftImplementation = await nftImplMock.deploy(1n);
            await nftImplementation.waitForDeployment();

            await expect(nftSale.connect(admin).upgradeToAndCall(
                nft.target, "0x"
            )).to.be.revertedWithCustomError(nftSale, "ProxyUpgradeChecker__InvalidImplementation()");

            await expect(nftSale.connect(admin).upgradeToAndCall(
                nftImplementation.target, "0x"
            )).to.be.revertedWithCustomError(nftSale, "ProxyUpgradeChecker__InvalidImplementation()");

            await expect(nftSale.connect(admin).upgradeToAndCall(
                admin.address, "0x"
            )).to.be.revertedWithoutReason();
        });
    });

    describe("setReceivers()", function () {
        it("AccessControl", async function () {
            const { user, nftSale } = await loadFixture(DockMarketNFTSaleFixture);

            await expect(nftSale.connect(user).setReceivers(
                user.address,
                user.address
            )).to.be.revertedWithCustomError(nftSale, "AccessControlUnauthorizedAccount");
        });

        it("DockMarketNFTSale__ZeroAddress", async function () {
            const { admin, nftSale } = await loadFixture(DockMarketNFTSaleFixture);

            await expect(nftSale.connect(admin).setReceivers(
                ethers.ZeroAddress,
                admin.address
            )).to.be.revertedWithCustomError(nftSale, "DockMarketNFTSale__ZeroAddress");

            await expect(nftSale.connect(admin).setReceivers(
                admin.address,
                ethers.ZeroAddress
            )).to.be.revertedWithCustomError(nftSale, "DockMarketNFTSale__ZeroAddress");

            await expect(nftSale.connect(admin).setReceivers(
                ethers.ZeroAddress,
                ethers.ZeroAddress
            )).to.be.revertedWithCustomError(nftSale, "DockMarketNFTSale__ZeroAddress");
        });

        it("Success", async function () {
            const { admin, collector, nftSale, collectorTwo } = await loadFixture(DockMarketNFTSaleFixture);

            await expect(nftSale.connect(admin).setReceivers(
                collector.address,
                collectorTwo.address
            )).to.emit(nftSale, "ReceiverSet").withArgs(
                collector.address,
                collectorTwo.address,
                admin.address
            );

            const saleData = await nftSale.getSaleData();

            expect(saleData[15]).to.equal(collector.address);
            expect(saleData[16]).to.equal(collectorTwo.address);
        });
    });

    describe("setTimestamps()", function () {
        it("AccessControl", async function () {
            const { user, nftSale } = await loadFixture(DockMarketNFTSaleFixture);

            await expect(nftSale.connect(user).setTimestamps(
                0n,
                0n,
                0n
            )).to.be.revertedWithCustomError(nftSale, "AccessControlUnauthorizedAccount");
        });

        it("DockMarketNFTSale__InvalidTimestamp", async function () {
            const { admin, nftSale } = await loadFixture(DockMarketNFTSaleFixture);

            await expect(nftSale.connect(admin).setTimestamps(
                0n,
                0n,
                0n
            )).to.be.revertedWithCustomError(nftSale, "DockMarketNFTSale__InvalidTimestamp");

            const latest = await time.latest();

            await expect(nftSale.connect(admin).setTimestamps(
                latest - 100,
                0n,
                0n
            )).to.be.revertedWithCustomError(nftSale, "DockMarketNFTSale__InvalidTimestamp");

            await expect(nftSale.connect(admin).setTimestamps(
                latest + 1000,
                latest,
                0n
            )).to.be.revertedWithCustomError(nftSale, "DockMarketNFTSale__InvalidTimestamp");

            await expect(nftSale.connect(admin).setTimestamps(
                latest + 1000,
                latest + 2000,
                0n
            )).to.be.revertedWithCustomError(nftSale, "DockMarketNFTSale__InvalidTimestamp");
        });

        it("Success", async function () {
            const { admin, nftSale } = await loadFixture(DockMarketNFTSaleFixture);

            const latest = await time.latest();

            await expect(nftSale.connect(admin).setTimestamps(
                latest + 1000,
                latest + 2000,
                latest + 3000
            )).to.emit(nftSale, "TimestampsSet").withArgs(
                latest + 1000,
                latest + 2000,
                latest + 3000,
                admin.address
            );

            let saleData = await nftSale.getSaleData();

            expect(saleData[4]).to.equal(latest + 1000);
            expect(saleData[5]).to.equal(latest + 2000);
            expect(saleData[6]).to.equal(latest + 3000);

            await expect(nftSale.connect(admin).setTimestamps(
                latest + 500,
                latest + 550,
                latest + 600
            )).to.emit(nftSale, "TimestampsSet").withArgs(
                latest + 500,
                latest + 550,
                latest + 600,
                admin.address
            );

            saleData = await nftSale.getSaleData();

            expect(saleData[4]).to.equal(latest + 500);
            expect(saleData[5]).to.equal(latest + 550);
            expect(saleData[6]).to.equal(latest + 600);
        });
    });

    describe("setRoots()", function () {
        it("AccessControl", async function () {
            const { user, nftSale } = await loadFixture(DockMarketNFTSaleFixture);

            await expect(nftSale.connect(user).setRoots(
                0n,
                ethers.ZeroHash,
                ethers.ZeroHash
            )).to.be.revertedWithCustomError(nftSale, "AccessControlUnauthorizedAccount");
        });

        it("DockMarketNFTSale__TotalSupplyExceeded", async function () {
            const { admin, nftSale } = await loadFixture(DockMarketNFTSaleFixture);

            await expect(nftSale.connect(admin).setRoots(
                maxTotalSupply + 1n,
                ethers.ZeroHash,
                ethers.ZeroHash
            )).to.be.revertedWithCustomError(nftSale, "DockMarketNFTSale__TotalSupplyExceeded");
        });

        it("Success", async function () {
            const { admin, nftSale } = await loadFixture(DockMarketNFTSaleFixture);

            await expect(nftSale.connect(admin).setRoots(
                maxTotalSupply,
                "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
                "0xfffffffffffffffffffffffffffffffff0000000000000000000000000000000"
            )).to.emit(nftSale, "RootsSet").withArgs(
                maxTotalSupply,
                "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
                "0xfffffffffffffffffffffffffffffffff0000000000000000000000000000000",
                admin.address
            );

            let saleData = await nftSale.getSaleData();

            expect(saleData[7]).to.equal(maxTotalSupply);
            expect(saleData[13]).to.equal("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
            expect(saleData[14]).to.equal("0xfffffffffffffffffffffffffffffffff0000000000000000000000000000000");

            await expect(nftSale.connect(admin).setRoots(
                150n,
                "0x000000000000000000000000000000000fffffffffffffffffffffffffffffff",
                "0xfffffffffffffffffffffffffffffffff0000000000000000000000000000000"
            )).to.emit(nftSale, "RootsSet").withArgs(
                150n,
                "0x000000000000000000000000000000000fffffffffffffffffffffffffffffff",
                "0xfffffffffffffffffffffffffffffffff0000000000000000000000000000000",
                admin.address
            );

            saleData = await nftSale.getSaleData();

            expect(saleData[7]).to.equal(150n);
            expect(saleData[13]).to.equal("0x000000000000000000000000000000000fffffffffffffffffffffffffffffff");
            expect(saleData[14]).to.equal("0xfffffffffffffffffffffffffffffffff0000000000000000000000000000000");
        });
    });

    describe("_getState()", function () {
        it("Preparation before set", async function () {
            const { user, nftSale } = await loadFixture(DockMarketNFTSaleFixture);

            let saleData = await nftSale.getSaleData();

            expect(saleData[0]).to.equal(0n);

            await expect(nftSale.connect(user).deposit(
                0n,
                [],
                { value: 1n }
            )).to.be.revertedWithCustomError(nftSale, "DockMarketNFTSale__IncorrectState");

            await expect(nftSale.connect(user).claim(
                0n,
                [],
                user.address
            )).to.be.revertedWithCustomError(nftSale, "DockMarketNFTSale__IncorrectState");
        });

        it("Preparation after set", async function () {
            const { user, admin, nftSale } = await loadFixture(DockMarketNFTSaleFixture);

            const latest = await time.latest();

            await nftSale.connect(admin).setTimestamps(latest + 1000, latest + 2000, latest + 3000);

            let saleData = await nftSale.getSaleData();

            expect(saleData[0]).to.equal(0n);
            expect(saleData[4]).to.equal(latest + 1000);

            await expect(nftSale.connect(user).deposit(
                0n,
                [],
                { value: 1n }
            )).to.be.revertedWithCustomError(nftSale, "DockMarketNFTSale__IncorrectState");

            await expect(nftSale.connect(user).claim(
                0n,
                [],
                user.address
            )).to.be.revertedWithCustomError(nftSale, "DockMarketNFTSale__IncorrectState");
        });

        it("Whitelist", async function () {
            const { user, nftSale, admin } = await loadFixture(DockMarketNFTSaleFixture);

            const latest = await time.latest();

            await nftSale.connect(admin).setTimestamps(latest + 10, latest + 2000, latest + 3000);

            await time.increase(100);

            let saleData = await nftSale.getSaleData();

            expect(saleData[0]).to.equal(1n);
            expect(saleData[4]).to.equal(latest + 10);

            await expect(nftSale.connect(user).claim(
                0n,
                [],
                user.address
            )).to.be.revertedWithCustomError(nftSale, "DockMarketNFTSale__IncorrectState");
        });

        it("Public", async function () {
            const { user, nftSale, admin } = await loadFixture(DockMarketNFTSaleFixture);

            const latest = await time.latest();

            await nftSale.connect(admin).setTimestamps(latest + 10, latest + 2000, latest + 3000);

            await time.increase(100);

            let saleData = await nftSale.getSaleData();

            expect(saleData[0]).to.equal(1n);
            expect(saleData[4]).to.equal(latest + 10);

            await expect(nftSale.connect(user).claim(
                0n,
                [],
                user.address
            )).to.be.revertedWithCustomError(nftSale, "DockMarketNFTSale__IncorrectState");

            await time.increase(3000);

            saleData = await nftSale.getSaleData();

            expect(saleData[0]).to.equal(2n);

            await expect(nftSale.connect(user).claim(
                0n,
                [],
                user.address
            )).to.be.revertedWithCustomError(nftSale, "DockMarketNFTSale__IncorrectState");
        });

        it("Claim", async function () {
            const { user, nftSale, admin } = await loadFixture(DockMarketNFTSaleFixture);

            const latest = await time.latest();

            await nftSale.connect(admin).setTimestamps(latest + 10, latest + 2000, latest + 3000);

            await time.increase(100);

            let saleData = await nftSale.getSaleData();

            expect(saleData[0]).to.equal(1n);
            expect(saleData[4]).to.equal(latest + 10);

            await expect(nftSale.connect(user).claim(
                0n,
                [],
                user.address
            )).to.be.revertedWithCustomError(nftSale, "DockMarketNFTSale__IncorrectState");

            const treeValues = [[admin.address, maxTotalSupply]];
            const tree = StandardMerkleTree.of(treeValues, ["address", "uint256"]);
            const whitelistRoot = tree.root;
            const adminProof = tree.getProof(0);

            await nftSale.connect(admin).setRoots(0n, ethers.ZeroHash, whitelistRoot);

            await nftSale.connect(admin).deposit(maxTotalSupply, adminProof, { value: maxTotalSupply * whitelistPrice });

            saleData = await nftSale.getSaleData();

            expect(saleData[0]).to.equal(3n);

            await expect(nftSale.connect(user).deposit(
                0n,
                [],
                { value: 1n }
            )).to.be.revertedWithCustomError(nftSale, "DockMarketNFTSale__IncorrectState");
        });
    });

    describe("deposit()", function () {
        it("DockMarketNFTSale__InvalidValue", async function () {
            const { user, nftSale, admin } = await loadFixture(DockMarketNFTSaleFixture);

            const latest = await time.latest();

            await nftSale.connect(admin).setTimestamps(latest + 10, latest + 2000, latest + 3000);

            await time.increase(100);

            let saleData = await nftSale.getSaleData();

            expect(saleData[0]).to.equal(1n);
            expect(saleData[4]).to.equal(latest + 10);

            await expect(nftSale.connect(user).deposit(
                0n,
                []
            )).to.be.revertedWithCustomError(nftSale, "DockMarketNFTSale__InvalidValue");

            await time.increase(2500);

            await expect(nftSale.connect(user).deposit(
                0n,
                []
            )).to.be.revertedWithCustomError(nftSale, "DockMarketNFTSale__InvalidValue");
        });

        it("DockMarketNFTSale__InvalidValue: Whitelist 1", async function () {
            const { user, nftSale, admin } = await loadFixture(DockMarketNFTSaleFixture);

            const latest = await time.latest();

            await nftSale.connect(admin).setTimestamps(latest + 10, latest + 2000, latest + 3000);

            await time.increase(100);

            let saleData = await nftSale.getSaleData();

            expect(saleData[0]).to.equal(1n);
            expect(saleData[4]).to.equal(latest + 10);

            await expect(nftSale.connect(user).deposit(
                0n,
                [],
                { value: whitelistPrice - 1n }
            )).to.be.revertedWithCustomError(nftSale, "DockMarketNFTSale__InvalidValue");
        });

        it("DockMarketNFTSale__InvalidValue: Whitelist 2", async function () {
            const { user, nftSale, admin } = await loadFixture(DockMarketNFTSaleFixture);

            const latest = await time.latest();

            await nftSale.connect(admin).setTimestamps(latest + 10, latest + 2000, latest + 3000);

            await time.increase(100);

            let saleData = await nftSale.getSaleData();

            expect(saleData[0]).to.equal(1n);
            expect(saleData[4]).to.equal(latest + 10);

            await expect(nftSale.connect(user).deposit(
                0n,
                [],
                { value: whitelistPrice + 1n }
            )).to.be.revertedWithCustomError(nftSale, "DockMarketNFTSale__InvalidValue");
        });

        it("DockMarketNFTSale__MerkleProofFailed: Whitelist", async function () {
            const { user, nftSale, admin } = await loadFixture(DockMarketNFTSaleFixture);

            const latest = await time.latest();

            await nftSale.connect(admin).setTimestamps(latest + 10, latest + 2000, latest + 3000);

            await time.increase(100);

            let saleData = await nftSale.getSaleData();

            expect(saleData[0]).to.equal(1n);
            expect(saleData[4]).to.equal(latest + 10);

            await expect(nftSale.connect(user).deposit(
                0n,
                [],
                { value: whitelistPrice }
            )).to.be.revertedWithCustomError(nftSale, "DockMarketNFTSale__MerkleProofFailed");

            const treeValues = [[user.address, maxTotalSupply]];
            const tree = StandardMerkleTree.of(treeValues, ["address", "uint256"]);
            const whitelistRoot = tree.root;
            const proof = tree.getProof(0);

            await nftSale.connect(admin).setRoots(0n, ethers.ZeroHash, whitelistRoot);

            await expect(nftSale.connect(admin).deposit(
                maxTotalSupply,
                proof,
                { value: whitelistPrice }
            )).to.be.revertedWithCustomError(nftSale, "DockMarketNFTSale__MerkleProofFailed");

            await expect(nftSale.connect(user).deposit(
                maxTotalSupply - 1n,
                proof,
                { value: whitelistPrice }
            )).to.be.revertedWithCustomError(nftSale, "DockMarketNFTSale__MerkleProofFailed");
        });

        it("DockMarketNFTSale__NoAllocation: Whitelist", async function () {
            const { user, nftSale, admin } = await loadFixture(DockMarketNFTSaleFixture);

            const latest = await time.latest();

            await nftSale.connect(admin).setTimestamps(latest + 10, latest + 2000, latest + 3000);

            await time.increase(100);

            let saleData = await nftSale.getSaleData();

            expect(saleData[0]).to.equal(1n);
            expect(saleData[4]).to.equal(latest + 10);

            const treeValues = [[user.address, 10n]];
            const tree = StandardMerkleTree.of(treeValues, ["address", "uint256"]);
            const whitelistRoot = tree.root;
            const proof = tree.getProof(0);

            await nftSale.connect(admin).setRoots(0n, ethers.ZeroHash, whitelistRoot);

            await nftSale.connect(user).deposit(
                10n,
                proof,
                { value: whitelistPrice * 9n }
            );

            await expect(nftSale.connect(user).deposit(
                10n,
                proof,
                { value: whitelistPrice * 2n }
            )).to.be.revertedWithCustomError(nftSale, "DockMarketNFTSale__NoAllocation");

            await nftSale.connect(user).deposit(
                10n,
                proof,
                { value: whitelistPrice * 1n }
            );
        });

        it("DockMarketNFTSale__InvalidValue: Public 1", async function () {
            const { user, nftSale, admin } = await loadFixture(DockMarketNFTSaleFixture);

            const latest = await time.latest();

            await nftSale.connect(admin).setTimestamps(latest + 10, latest + 2000, latest + 3000);

            await time.increase(3500);

            let saleData = await nftSale.getSaleData();

            expect(saleData[0]).to.equal(2n);

            await expect(nftSale.connect(user).deposit(
                0n,
                [],
                { value: publicPrice - 1n }
            )).to.be.revertedWithCustomError(nftSale, "DockMarketNFTSale__InvalidValue");
        });

        it("DockMarketNFTSale__InvalidValue: Public 2", async function () {
            const { user, nftSale, admin } = await loadFixture(DockMarketNFTSaleFixture);

            const latest = await time.latest();

            await nftSale.connect(admin).setTimestamps(latest + 10, latest + 2000, latest + 3000);

            await time.increase(3500);

            let saleData = await nftSale.getSaleData();

            expect(saleData[0]).to.equal(2n);

            await expect(nftSale.connect(user).deposit(
                0n,
                [],
                { value: publicPrice + 1n }
            )).to.be.revertedWithCustomError(nftSale, "DockMarketNFTSale__InvalidValue");
        });

        it("DockMarketNFTSale__NoAllocation: Public", async function () {
            const { user, nftSale, admin } = await loadFixture(DockMarketNFTSaleFixture);

            const latest = await time.latest();

            await nftSale.connect(admin).setTimestamps(latest + 10, latest + 2000, latest + 3000);

            await time.increase(3500);

            let saleData = await nftSale.getSaleData();

            expect(saleData[0]).to.equal(2n);

            await nftSale.connect(user).deposit(
                0n,
                [],
                { value: publicPrice * publicAllocation }
            );

            await expect(nftSale.connect(user).deposit(
                0n,
                [],
                { value: publicPrice }
            )).to.be.revertedWithCustomError(nftSale, "DockMarketNFTSale__NoAllocation");
        });

        it("DockMarketNFTSale__TotalSupplyExceeded", async function () {
            const { user, nftSale, admin } = await loadFixture(DockMarketNFTSaleFixture);

            const latest = await time.latest();

            await nftSale.connect(admin).setTimestamps(latest + 10, latest + 2000, latest + 3000);

            await time.increase(100);

            let saleData = await nftSale.getSaleData();

            expect(saleData[0]).to.equal(1n);
            expect(saleData[4]).to.equal(latest + 10);

            await expect(nftSale.connect(user).claim(
                0n,
                [],
                user.address
            )).to.be.revertedWithCustomError(nftSale, "DockMarketNFTSale__IncorrectState");

            const treeValues = [[admin.address, maxTotalSupply + 10n]];
            const tree = StandardMerkleTree.of(treeValues, ["address", "uint256"]);
            const whitelistRoot = tree.root;
            const adminProof = tree.getProof(0);

            await nftSale.connect(admin).setRoots(0n, ethers.ZeroHash, whitelistRoot);

            await expect(nftSale.connect(admin).deposit(
                maxTotalSupply + 10n,
                adminProof,
                { value: (maxTotalSupply + 1n) * whitelistPrice }
            )).to.be.revertedWithCustomError(nftSale, "DockMarketNFTSale__TotalSupplyExceeded");

            await nftSale.connect(admin).deposit(maxTotalSupply + 10n, adminProof, { value: (maxTotalSupply - 1n) * whitelistPrice });

            await expect(nftSale.connect(admin).deposit(
                maxTotalSupply + 10n,
                adminProof,
                { value: whitelistPrice * 2n }
            )).to.be.revertedWithCustomError(nftSale, "DockMarketNFTSale__TotalSupplyExceeded");

            await time.increase(3000);

            await nftSale.connect(admin).deposit(0n, [], { value: publicPrice });

            await expect(nftSale.connect(user).deposit(
                0n,
                [],
                { value: publicPrice }
            )).to.be.revertedWithCustomError(nftSale, "DockMarketNFTSale__IncorrectState");
        });

        it("Success: Whitelist", async function () {
            const { user, nftSale, admin, collector, collectorTwo } = await loadFixture(DockMarketNFTSaleFixture);

            await expect(nftSale.connect(admin).setReceivers(
                collector.address,
                collectorTwo.address
            )).to.emit(nftSale, "ReceiverSet").withArgs(
                collector.address,
                collectorTwo.address,
                admin.address
            );

            const latest = await time.latest();

            await nftSale.connect(admin).setTimestamps(latest + 10, latest + 2000, latest + 3000);

            await time.increase(100);

            const saleData = await nftSale.getSaleData();

            expect(saleData[0]).to.equal(1n);
            expect(saleData[4]).to.equal(latest + 10);

            const treeValues = [[user.address, 10n], [user.address, 15n]];
            const tree = StandardMerkleTree.of(treeValues, ["address", "uint256"]);
            const whitelistRoot = tree.root;
            const proof = tree.getProof(0);

            await nftSale.connect(admin).setRoots(0n, ethers.ZeroHash, whitelistRoot);

            const saleDataBefore = await nftSale.getSaleData();
            const userDataBefore = await nftSale.getUserData(user.address);
            const ethFundReceiverBalanceBefore = await ethers.provider.getBalance(saleDataBefore[15]);
            const ethTreasuryReceiverBalanceBefore = await ethers.provider.getBalance(saleDataBefore[16]);

            await expect(nftSale.connect(user).deposit(
                10n,
                proof,
                { value: whitelistPrice * 9n }
            )).to.emit(nftSale, "Deposited").withArgs(
                user.address,
                whitelistPrice * 9n,
                true,
                9n
            );

            const saleDataAfter = await nftSale.getSaleData();
            const userDataAfter = await nftSale.getUserData(user.address);
            const ethFundReceiverBalanceAfter = await ethers.provider.getBalance(saleDataBefore[15]);
            const ethTreasuryReceiverBalanceAfter = await ethers.provider.getBalance(saleDataBefore[16]);

            expect(saleDataBefore[0]).to.equal(saleDataAfter[0]);
            expect(saleDataBefore[1]).to.equal(saleDataAfter[1]);
            expect(saleDataBefore[2]).to.equal(saleDataAfter[2]);
            expect(saleDataBefore[3]).to.equal(saleDataAfter[3]);
            expect(saleDataBefore[4]).to.equal(saleDataAfter[4]);
            expect(saleDataBefore[5]).to.equal(saleDataAfter[5]);
            expect(saleDataBefore[6]).to.equal(saleDataAfter[6]);
            expect(saleDataBefore[7]).to.equal(saleDataAfter[7]);
            expect(saleDataBefore[8] + 9n).to.equal(saleDataAfter[8]);
            expect(saleDataBefore[9]).to.equal(saleDataAfter[9]);
            expect(saleDataBefore[10]).to.equal(saleDataAfter[10]);
            expect(saleDataBefore[11]).to.equal(saleDataAfter[11]);
            expect(saleDataBefore[12]).to.equal(saleDataAfter[12]);
            expect(saleDataBefore[13]).to.equal(saleDataAfter[13]);
            expect(saleDataBefore[14]).to.equal(saleDataAfter[14]);
            expect(saleDataBefore[15]).to.equal(saleDataAfter[15]);
            expect(saleDataBefore[16]).to.equal(saleDataAfter[16]);
            expect(saleDataBefore[17]).to.equal(saleDataAfter[17]);
            expect(saleDataBefore[18]).to.equal(saleDataAfter[18]);
            expect(saleDataBefore[19]).to.equal(saleDataAfter[19]);

            expect(userDataBefore[0] + 9n).to.equal(userDataAfter[0]);
            expect(userDataBefore[1]).to.equal(userDataAfter[1]);
            expect(userDataBefore[2]).to.equal(userDataAfter[2]);
            expect(userDataBefore[3]).to.equal(userDataAfter[3]);
            expect(userDataBefore[4]).to.equal(userDataAfter[4]);

            expect(await ethers.provider.getBalance(nftSale.target)).to.equal(0n);
            expect(ethFundReceiverBalanceBefore + whitelistPrice * 9n / 2n).to.equal(ethFundReceiverBalanceAfter);
            expect(ethTreasuryReceiverBalanceBefore + whitelistPrice * 9n / 2n).to.equal(ethTreasuryReceiverBalanceAfter);
        });

        it("Success: Public", async function () {
            const { user, nftSale, admin, collector } = await loadFixture(DockMarketNFTSaleFixture);

            await expect(nftSale.connect(admin).setReceivers(
                collector.address,
                collector.address
            )).to.emit(nftSale, "ReceiverSet").withArgs(
                collector.address,
                collector.address,
                admin.address
            );

            const latest = await time.latest();

            await nftSale.connect(admin).setTimestamps(latest + 10, latest + 2000, latest + 3000);

            await time.increase(3500);

            const saleData = await nftSale.getSaleData();

            expect(saleData[0]).to.equal(2n);

            const treeValues = [[user.address, 10n]];
            const tree = StandardMerkleTree.of(treeValues, ["address", "uint256"]);
            const whitelistRoot = tree.root;
            const proof = tree.getProof(0);

            await nftSale.connect(admin).setRoots(0n, ethers.ZeroHash, whitelistRoot);

            const saleDataBefore = await nftSale.getSaleData();
            const userDataBefore = await nftSale.getUserData(user.address);
            const ethFundReceiverBalanceBefore = await ethers.provider.getBalance(saleDataBefore[15]);
            const ethTreasuryReceiverBalanceBefore = await ethers.provider.getBalance(saleDataBefore[16]);

            await expect(nftSale.connect(user).deposit(
                10n,
                proof,
                { value: publicPrice }
            )).to.emit(nftSale, "Deposited").withArgs(
                user.address,
                publicPrice,
                false,
                1n
            );

            const saleDataAfter = await nftSale.getSaleData();
            const userDataAfter = await nftSale.getUserData(user.address);
            const ethFundReceiverBalanceAfter = await ethers.provider.getBalance(saleDataBefore[15]);
            const ethTreasuryReceiverBalanceAfter = await ethers.provider.getBalance(saleDataBefore[16]);

            expect(saleDataBefore[0]).to.equal(saleDataAfter[0]);
            expect(saleDataBefore[1]).to.equal(saleDataAfter[1]);
            expect(saleDataBefore[2]).to.equal(saleDataAfter[2]);
            expect(saleDataBefore[3]).to.equal(saleDataAfter[3]);
            expect(saleDataBefore[4]).to.equal(saleDataAfter[4]);
            expect(saleDataBefore[5]).to.equal(saleDataAfter[5]);
            expect(saleDataBefore[6]).to.equal(saleDataAfter[6]);
            expect(saleDataBefore[7]).to.equal(saleDataAfter[7]);
            expect(saleDataBefore[8]).to.equal(saleDataAfter[8]);
            expect(saleDataBefore[9] + 1n).to.equal(saleDataAfter[9]);
            expect(saleDataBefore[10]).to.equal(saleDataAfter[10]);
            expect(saleDataBefore[11]).to.equal(saleDataAfter[11]);
            expect(saleDataBefore[12]).to.equal(saleDataAfter[12]);
            expect(saleDataBefore[13]).to.equal(saleDataAfter[13]);
            expect(saleDataBefore[14]).to.equal(saleDataAfter[14]);
            expect(saleDataBefore[15]).to.equal(saleDataAfter[15]);
            expect(saleDataBefore[16]).to.equal(saleDataAfter[16]);
            expect(saleDataBefore[17]).to.equal(saleDataAfter[17]);
            expect(saleDataBefore[18]).to.equal(saleDataAfter[18]);
            expect(saleDataBefore[19]).to.equal(saleDataAfter[19]);

            expect(userDataBefore[0]).to.equal(userDataAfter[0]);
            expect(userDataBefore[1] + 1n).to.equal(userDataAfter[1]);
            expect(userDataBefore[2]).to.equal(userDataAfter[2]);
            expect(userDataBefore[3]).to.equal(userDataAfter[3]);
            expect(userDataBefore[4]).to.equal(userDataAfter[4]);

            expect(await ethers.provider.getBalance(nftSale.target)).to.equal(0n);
            expect(ethFundReceiverBalanceBefore + publicPrice).to.equal(ethFundReceiverBalanceAfter);
            expect(ethTreasuryReceiverBalanceBefore + publicPrice).to.equal(ethTreasuryReceiverBalanceAfter);
        });
    });

    describe("claim()", function () {
        it("DockMarketNFTSale__MerkleProofFailed", async function () {
            const { user, nftSale, admin } = await loadFixture(DockMarketNFTSaleFixture);

            const latest = await time.latest();

            await nftSale.connect(admin).setTimestamps(latest + 10, latest + 2000, latest + 3000);

            await time.increase(100);

            const amount = maxTotalSupply / 2n;
            const whitelistTree = StandardMerkleTree.of([[admin.address, amount], [user.address, 1n]], ["address", "uint256"]);
            const whitelistRoot = whitelistTree.root;
            const adminWhitelistProof = whitelistTree.getProof(0);

            const presaleTree = StandardMerkleTree.of([[user.address, amount], [admin.address, 1n]], ["address", "uint256"]);
            const presaleRoot = presaleTree.root;
            const userPresaleProof = presaleTree.getProof(0);

            await nftSale.connect(admin).setRoots(amount, presaleRoot, whitelistRoot);

            await nftSale.connect(admin).deposit(amount, adminWhitelistProof, { value: amount * whitelistPrice });

            await expect(nftSale.connect(admin).setRoots(
                amount + 1n,
                ethers.ZeroHash,
                ethers.ZeroHash
            )).to.be.revertedWithCustomError(nftSale, "DockMarketNFTSale__TotalSupplyExceeded");

            let saleData = await nftSale.getSaleData();

            expect(saleData[0]).to.equal(3n);

            await expect(nftSale.connect(user).claim(
                amount + 1n,
                userPresaleProof,
                user.address
            )).to.be.revertedWithCustomError(nftSale, "DockMarketNFTSale__MerkleProofFailed");

            await expect(nftSale.connect(user).claim(
                0n,
                userPresaleProof,
                user.address
            )).to.be.revertedWithCustomError(nftSale, "DockMarketNFTSale__MerkleProofFailed");

            await expect(nftSale.connect(user).claim(
                amount,
                adminWhitelistProof,
                user.address
            )).to.be.revertedWithCustomError(nftSale, "DockMarketNFTSale__MerkleProofFailed");

            await expect(nftSale.connect(admin).claim(
                amount,
                adminWhitelistProof,
                user.address
            )).to.be.revertedWithCustomError(nftSale, "DockMarketNFTSale__MerkleProofFailed");
        });

        it("DockMarketNFTSale__TotalSupplyExceeded: Presale", async function () {
            const { user, nftSale, admin } = await loadFixture(DockMarketNFTSaleFixture);

            const latest = await time.latest();

            await nftSale.connect(admin).setTimestamps(latest + 10, latest + 2000, latest + 3000);

            await time.increase(100);

            const amount = maxTotalSupply / 2n;
            const whitelistTree = StandardMerkleTree.of([[admin.address, amount], [user.address, 1n]], ["address", "uint256"]);
            const whitelistRoot = whitelistTree.root;
            const adminWhitelistProof = whitelistTree.getProof(0);

            const presaleTree = StandardMerkleTree.of([[user.address, maxTotalSupply], [admin.address, 1n]], ["address", "uint256"]);
            const presaleRoot = presaleTree.root;
            const userPresaleProof = presaleTree.getProof(0);

            await nftSale.connect(admin).setRoots(amount, presaleRoot, whitelistRoot);

            await nftSale.connect(admin).deposit(amount, adminWhitelistProof, { value: amount * whitelistPrice });

            let saleData = await nftSale.getSaleData();

            expect(saleData[0]).to.equal(3n);

            await expect(nftSale.connect(user).claim(
                maxTotalSupply,
                userPresaleProof,
                user.address
            )).to.be.revertedWithCustomError(nftSale, "DockMarketNFTSale__TotalSupplyExceeded");
        });

        it("DockMarketNFTSale__NothingToClaim", async function () {
            const { user, nftSale, admin, collector, collectorTwo } = await loadFixture(DockMarketNFTSaleFixture);

            const latest = await time.latest();

            await nftSale.connect(admin).setTimestamps(latest + 10, latest + 2000, latest + 3000);

            await time.increase(100);

            const amount = maxTotalSupply / 2n - 1n;
            const whitelistTree = StandardMerkleTree.of([[admin.address, amount], [user.address, 1n]], ["address", "uint256"]);
            const whitelistRoot = whitelistTree.root;
            const adminWhitelistProof = whitelistTree.getProof(0);

            const presaleTree = StandardMerkleTree.of([[user.address, amount], [admin.address, 1n]], ["address", "uint256"]);
            const presaleRoot = presaleTree.root;
            const userPresaleProof = presaleTree.getProof(0);

            await nftSale.connect(admin).setRoots(amount, presaleRoot, whitelistRoot);

            await nftSale.connect(admin).deposit(amount, adminWhitelistProof, { value: amount * whitelistPrice });

            await time.increase(3500);

            await nftSale.connect(collectorTwo).deposit(0n, [], { value: publicPrice });
            await nftSale.connect(user).deposit(0n, [], { value: publicPrice });

            let saleData = await nftSale.getSaleData();

            expect(saleData[0]).to.equal(3n);

            await nftSale.connect(user).claim(amount, userPresaleProof, user.address);

            await nftSale.connect(admin).claim(0n, [], user.address);

            await nftSale.connect(collectorTwo).claim(0n, [], user.address);

            await expect(nftSale.connect(user).claim(
                amount,
                userPresaleProof,
                user.address
            )).to.be.revertedWithCustomError(nftSale, "DockMarketNFTSale__NothingToClaim");

            await expect(nftSale.connect(admin).claim(
                0n,
                [],
                user.address
            )).to.be.revertedWithCustomError(nftSale, "DockMarketNFTSale__NothingToClaim");

            await expect(nftSale.connect(collector).claim(
                0n,
                [],
                user.address
            )).to.be.revertedWithCustomError(nftSale, "DockMarketNFTSale__NothingToClaim");

            await expect(nftSale.connect(collectorTwo).claim(
                0n,
                [],
                user.address
            )).to.be.revertedWithCustomError(nftSale, "DockMarketNFTSale__NothingToClaim");
        });

        it("Success", async function () {
            const { nft, user, nftSale, admin, collector } = await loadFixture(DockMarketNFTSaleFixture);

            const latest = await time.latest();

            await nftSale.connect(admin).setTimestamps(latest + 10, latest + 2000, latest + 3000);

            await time.increase(100);

            const amount = maxTotalSupply / 2n - 1n;
            const whitelistTree = StandardMerkleTree.of([[admin.address, amount - 1n], [user.address, 1n]], ["address", "uint256"]);
            const whitelistRoot = whitelistTree.root;
            const adminWhitelistProof = whitelistTree.getProof(0);
            const userWhitelistProof = whitelistTree.getProof(1);

            const presaleTree = StandardMerkleTree.of([[user.address, amount - 1n], [admin.address, 1n]], ["address", "uint256"]);
            const presaleRoot = presaleTree.root;
            const userPresaleProof = presaleTree.getProof(0);
            const adminPresaleProof = presaleTree.getProof(1);

            await nftSale.connect(admin).setRoots(amount, presaleRoot, whitelistRoot);

            await nftSale.connect(admin).deposit(amount - 1n, adminWhitelistProof, { value: (amount - 1n) * whitelistPrice });

            await nftSale.connect(user).deposit(1n, userWhitelistProof, { value: whitelistPrice });

            await time.increase(3500);

            await nftSale.connect(collector).deposit(0n, [], { value: publicPrice });
            await nftSale.connect(user).deposit(0n, [], { value: publicPrice });

            const saleDataBefore = await nftSale.getSaleData();
            const userDataBefore = await nftSale.getUserData(user.address);

            expect(saleDataBefore[0]).to.equal(3n);

            await expect(nftSale.connect(user).claim(
                amount - 1n,
                userPresaleProof,
                user.address
            )).to.emit(nftSale, "Claimed").withArgs(
                user.address,
                user.address,
                amount - 1n,
                1n,
                1n
            ).to.emit(nft, "Transfer").withArgs(
                ethers.ZeroAddress,
                user.address,
                0n
            ).to.emit(nft, "Transfer").withArgs(
                ethers.ZeroAddress,
                user.address,
                amount
            );

            const saleDataAfter = await nftSale.getSaleData();
            const userDataAfter = await nftSale.getUserData(user.address);

            expect(saleDataBefore[0]).to.equal(saleDataAfter[0]);
            expect(saleDataBefore[1]).to.equal(saleDataAfter[1]);
            expect(saleDataBefore[2]).to.equal(saleDataAfter[2]);
            expect(saleDataBefore[3]).to.equal(saleDataAfter[3]);
            expect(saleDataBefore[4]).to.equal(saleDataAfter[4]);
            expect(saleDataBefore[5]).to.equal(saleDataAfter[5]);
            expect(saleDataBefore[6]).to.equal(saleDataAfter[6]);
            expect(saleDataBefore[7]).to.equal(saleDataAfter[7]);
            expect(saleDataBefore[8]).to.equal(saleDataAfter[8]);
            expect(saleDataBefore[9]).to.equal(saleDataAfter[9]);
            expect(saleDataBefore[10] + amount - 1n).to.equal(saleDataAfter[10]);
            expect(saleDataBefore[11] + 1n).to.equal(saleDataAfter[11]);
            expect(saleDataBefore[12] + 1n).to.equal(saleDataAfter[12]);
            expect(saleDataBefore[13]).to.equal(saleDataAfter[13]);
            expect(saleDataBefore[14]).to.equal(saleDataAfter[14]);
            expect(saleDataBefore[15]).to.equal(saleDataAfter[15]);
            expect(saleDataBefore[16]).to.equal(saleDataAfter[16]);
            expect(saleDataBefore[17]).to.equal(saleDataAfter[17]);
            expect(saleDataBefore[18]).to.equal(saleDataAfter[18]);
            expect(saleDataBefore[19] + amount + 1n).to.equal(saleDataAfter[19]);

            expect(userDataBefore[0]).to.equal(userDataAfter[0]);
            expect(userDataBefore[1]).to.equal(userDataAfter[1]);
            expect(userDataBefore[2] + amount - 1n).to.equal(userDataAfter[2]);
            expect(userDataBefore[3] + 1n).to.equal(userDataAfter[3]);
            expect(userDataBefore[4] + 1n).to.equal(userDataAfter[4]);

            const saleDataBefore1 = await nftSale.getSaleData();
            const adminDataBefore = await nftSale.getUserData(admin.address);

            await expect(nftSale.connect(admin).claim(
                1n,
                adminPresaleProof,
                user.address
            )).to.emit(nftSale, "Claimed").withArgs(
                admin.address,
                user.address,
                1n,
                amount - 1n,
                0n
            ).to.emit(nft, "Transfer").withArgs(
                ethers.ZeroAddress,
                user.address,
                amount + 3n
            ).to.emit(nft, "Transfer").withArgs(
                ethers.ZeroAddress,
                user.address,
                amount * 2n
            );

            const saleDataAfter1 = await nftSale.getSaleData();
            const adminDataAfter = await nftSale.getUserData(admin.address);

            expect(saleDataBefore1[0]).to.equal(saleDataAfter1[0]);
            expect(saleDataBefore1[1]).to.equal(saleDataAfter1[1]);
            expect(saleDataBefore1[2]).to.equal(saleDataAfter1[2]);
            expect(saleDataBefore1[3]).to.equal(saleDataAfter1[3]);
            expect(saleDataBefore1[4]).to.equal(saleDataAfter1[4]);
            expect(saleDataBefore1[5]).to.equal(saleDataAfter1[5]);
            expect(saleDataBefore1[6]).to.equal(saleDataAfter1[6]);
            expect(saleDataBefore1[7]).to.equal(saleDataAfter1[7]);
            expect(saleDataBefore1[8]).to.equal(saleDataAfter1[8]);
            expect(saleDataBefore1[9]).to.equal(saleDataAfter1[9]);
            expect(saleDataBefore1[10] + 1n).to.equal(saleDataAfter1[10]);
            expect(saleDataBefore1[11] + amount - 1n).to.equal(saleDataAfter1[11]);
            expect(saleDataBefore1[12]).to.equal(saleDataAfter1[12]);
            expect(saleDataBefore1[13]).to.equal(saleDataAfter1[13]);
            expect(saleDataBefore1[14]).to.equal(saleDataAfter1[14]);
            expect(saleDataBefore1[15]).to.equal(saleDataAfter1[15]);
            expect(saleDataBefore1[16]).to.equal(saleDataAfter1[16]);
            expect(saleDataBefore1[17]).to.equal(saleDataAfter1[17]);
            expect(saleDataBefore1[18]).to.equal(saleDataAfter1[18]);
            expect(saleDataBefore1[19] + amount).to.equal(saleDataAfter1[19]);

            expect(adminDataBefore[0]).to.equal(adminDataAfter[0]);
            expect(adminDataBefore[1]).to.equal(adminDataAfter[1]);
            expect(adminDataBefore[2] + 1n).to.equal(adminDataAfter[2]);
            expect(adminDataBefore[3] + amount - 1n).to.equal(adminDataAfter[3]);
            expect(adminDataBefore[4]).to.equal(adminDataAfter[4]);

            const saleDataBefore2 = await nftSale.getSaleData();
            const collectorDataBefore = await nftSale.getUserData(collector.address);

            await expect(nftSale.connect(collector).claim(
                0n,
                [],
                admin.address
            )).to.emit(nftSale, "Claimed").withArgs(
                collector.address,
                admin.address,
                0n,
                0n,
                1n
            ).to.emit(nft, "Transfer").withArgs(
                ethers.ZeroAddress,
                admin.address,
                maxTotalSupply - 1n
            );

            const saleDataAfter2 = await nftSale.getSaleData();
            const collectorDataAfter = await nftSale.getUserData(collector.address);

            expect(saleDataBefore2[0]).to.equal(saleDataAfter2[0]);
            expect(saleDataBefore2[1]).to.equal(saleDataAfter2[1]);
            expect(saleDataBefore2[2]).to.equal(saleDataAfter2[2]);
            expect(saleDataBefore2[3]).to.equal(saleDataAfter2[3]);
            expect(saleDataBefore2[4]).to.equal(saleDataAfter2[4]);
            expect(saleDataBefore2[5]).to.equal(saleDataAfter2[5]);
            expect(saleDataBefore2[6]).to.equal(saleDataAfter2[6]);
            expect(saleDataBefore2[7]).to.equal(saleDataAfter2[7]);
            expect(saleDataBefore2[8]).to.equal(saleDataAfter2[8]);
            expect(saleDataBefore2[9]).to.equal(saleDataAfter2[9]);
            expect(saleDataBefore2[10]).to.equal(saleDataAfter2[10]);
            expect(saleDataBefore2[11]).to.equal(saleDataAfter2[11]);
            expect(saleDataBefore2[12] + 1n).to.equal(saleDataAfter2[12]);
            expect(saleDataBefore2[13]).to.equal(saleDataAfter2[13]);
            expect(saleDataBefore2[14]).to.equal(saleDataAfter2[14]);
            expect(saleDataBefore2[15]).to.equal(saleDataAfter2[15]);
            expect(saleDataBefore2[16]).to.equal(saleDataAfter2[16]);
            expect(saleDataBefore2[17]).to.equal(saleDataAfter2[17]);
            expect(saleDataBefore2[18]).to.equal(saleDataAfter2[18]);
            expect(saleDataBefore2[19] + 1n).to.equal(saleDataAfter2[19]);

            expect(collectorDataBefore[0]).to.equal(collectorDataAfter[0]);
            expect(collectorDataBefore[1]).to.equal(collectorDataAfter[1]);
            expect(collectorDataBefore[2]).to.equal(collectorDataAfter[2]);
            expect(collectorDataBefore[3]).to.equal(collectorDataAfter[3]);
            expect(collectorDataBefore[4] + 1n).to.equal(collectorDataAfter[4]);
        });
    });
});