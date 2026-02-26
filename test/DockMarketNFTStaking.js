const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const { DockMarketNFTSaleFixture } = require("./DockMarketNFTSaleFixture.js");
const { expect } = require("chai");

async function captureStakeState(nftStaking, addresses = []) {
    return {
        stakers: await nftStaking.stakers(),
        stakedTokenIds: addresses.length > 0 ? await Promise.all(addresses.map(addr => nftStaking.stakedTokenIds(addr))) : [],
        stakeDataByStaker: addresses.length > 0 ? await Promise.all(addresses.map(addr => nftStaking.stakeDataByStaker(addr))) : []
    };
}

describe("DockMarketNFTStaking", function () {
    describe("Deploy", function () {
        it("Init settings", async function () {
            const { admin, nft, nftStaking, adminRole } = await loadFixture(DockMarketNFTSaleFixture);

            expect(await nftStaking.hasRole(adminRole, admin.address)).to.equal(true);
            expect(await nftStaking.DOCK_MARKET_NFT()).to.equal(nft.target);
            expect(await nftStaking.stakers()).to.eql([]);
            expect(await nftStaking.stakedTokenIds(admin.address)).to.eql([]);
            expect(await nftStaking.stakeData([0n])).to.eql([[ethers.ZeroAddress, 0n, 0n]]);
            expect(await nftStaking.stakeDataByStaker(admin.address)).to.eql([]);
            expect(await nftStaking.contractName()).to.equal("DockMarketNFTStaking");
            expect(await nftStaking.supportsInterface("0x157ddfc1")).to.equal(true);
            expect(await nftStaking.supportsInterface("0x01ffc9a7")).to.equal(true);
            expect(await nftStaking.supportsInterface("0x7965db0b")).to.equal(true);
        });

        it("Proxy", async function () {
            const { admin, user, nft, nftStaking, DockMarketNFTStakingImplementation } = await loadFixture(DockMarketNFTSaleFixture);

            await expect(nftStaking.connect(user).upgradeToAndCall(
                user.address,
                "0x"
            )).to.be.revertedWithCustomError(nftStaking, "AccessControlUnauthorizedAccount");

            await expect(nftStaking.connect(user).initialize(
                user.address
            )).to.be.revertedWithCustomError(nftStaking, "InvalidInitialization");

            await expect(DockMarketNFTStakingImplementation.connect(user).initialize(
                user.address
            )).to.be.revertedWithCustomError(DockMarketNFTStakingImplementation, "InvalidInitialization");

            const nftSaleImplMock = await ethers.getContractFactory("DockMarketNFTSale", admin);
            const nftSaleImplementation = await nftSaleImplMock.deploy(admin.address, 0n, 0n, 0n);
            await nftSaleImplementation.waitForDeployment();

            await expect(nftStaking.connect(admin).upgradeToAndCall(
                nftSaleImplementation.target, "0x"
            )).to.be.revertedWithCustomError(nftStaking, "ProxyUpgradeChecker__InvalidImplementation()");

            await expect(nftStaking.connect(admin).upgradeToAndCall(
                nft.target, "0x"
            )).to.be.revertedWithCustomError(nftStaking, "ProxyUpgradeChecker__InvalidImplementation()");

            await expect(nftStaking.connect(admin).upgradeToAndCall(
                admin.address, "0x"
            )).to.be.revertedWithoutReason();
        });
    });

    describe("stake()", function () {
        it("DockMarketNFTStaking__InvalidLength", async function () {
            const { user, nftStaking } = await loadFixture(DockMarketNFTSaleFixture);

            await expect(nftStaking.connect(user).stake(
                []
            )).to.be.revertedWithCustomError(nftStaking, "DockMarketNFTStaking__InvalidLength");
        });

        it("DockMarketNFTStaking__NotAnOwner", async function () {
            const { admin, user, nft, nftStaking, minterRole } = await loadFixture(DockMarketNFTSaleFixture);

            await nft.connect(admin).grantRole(minterRole, admin.address);
            await nft.connect(admin).mint(admin.address, 5n);

            await expect(nftStaking.connect(user).stake(
                [0n]
            )).to.be.revertedWithCustomError(nftStaking, "DockMarketNFTStaking__NotAnOwner");
        });

        it("Success: Single token", async function () {
            const { admin, nft, nftStaking, minterRole } = await loadFixture(DockMarketNFTSaleFixture);

            await nft.connect(admin).grantRole(minterRole, admin.address);
            await nft.connect(admin).mint(admin.address, 1n);

            await nft.connect(admin).setApprovalForAll(nftStaking.target, true);

            const blockTimestamp = BigInt(await time.latest());

            const stateBefore = await captureStakeState(nftStaking, [admin.address]);
            expect(stateBefore.stakers).to.eql([]);
            expect(stateBefore.stakedTokenIds[0]).to.eql([]);

            await expect(nftStaking.connect(admin).stake(
                [0n]
            )).to.emit(nftStaking, "Staked").withArgs(
                admin.address,
                admin.address,
                0n,
                blockTimestamp + 1n,
                blockTimestamp + 1n
            );

            const stateAfter = await captureStakeState(nftStaking, [admin.address]);
            expect(stateAfter.stakers).to.eql([admin.address]);
            expect(stateAfter.stakedTokenIds[0]).to.eql([0n]);
            expect(stateAfter.stakeDataByStaker[0][0].tokenId).to.equal(0n);

            expect(await nftStaking.stakers()).to.eql([admin.address]);
            expect(await nftStaking.stakedTokenIds(admin.address)).to.eql([0n]);

            const stakeDataArray = await nftStaking.stakeData([0n]);
            expect(stakeDataArray[0].staker).to.equal(admin.address);
            expect(stakeDataArray[0].stakedAt).to.equal(blockTimestamp + 1n);
            expect(stakeDataArray[0].lockedUntil).to.equal(blockTimestamp + 1n);
        });

        it("Success: Multiple tokens", async function () {
            const { admin, nft, nftStaking, minterRole } = await loadFixture(DockMarketNFTSaleFixture);

            await nft.connect(admin).grantRole(minterRole, admin.address);
            await nft.connect(admin).mint(admin.address, 5n);

            await nft.connect(admin).setApprovalForAll(nftStaking.target, true);

            const stateBefore = await captureStakeState(nftStaking, [admin.address]);
            expect(stateBefore.stakers).to.eql([]);

            const blockTimestamp = BigInt(await time.latest());

            await expect(nftStaking.connect(admin).stake(
                [0n, 1n, 2n, 3n, 4n]
            )).to.emit(nftStaking, "Staked").withArgs(
                admin.address,
                admin.address,
                0n,
                blockTimestamp + 1n,
                blockTimestamp + 1n
            ).to.emit(nftStaking, "Staked").withArgs(
                admin.address,
                admin.address,
                1n,
                blockTimestamp + 1n,
                blockTimestamp + 1n
            ).to.emit(nftStaking, "Staked").withArgs(
                admin.address,
                admin.address,
                2n,
                blockTimestamp + 1n,
                blockTimestamp + 1n
            ).to.emit(nftStaking, "Staked").withArgs(
                admin.address,
                admin.address,
                3n,
                blockTimestamp + 1n,
                blockTimestamp + 1n
            ).to.emit(nftStaking, "Staked").withArgs(
                admin.address,
                admin.address,
                4n,
                blockTimestamp + 1n,
                blockTimestamp + 1n
            );

            const stateAfter = await captureStakeState(nftStaking, [admin.address]);
            expect(stateAfter.stakers).to.eql([admin.address]);
            expect(stateAfter.stakedTokenIds[0]).to.eql([0n, 1n, 2n, 3n, 4n]);
            expect(stateAfter.stakeDataByStaker[0]).to.have.lengthOf(5);

            expect(await nftStaking.stakedTokenIds(admin.address)).to.eql([0n, 1n, 2n, 3n, 4n]);
            expect(await nftStaking.stakers()).to.eql([admin.address]);

            const stakeDataArray = await nftStaking.stakeData([0n, 1n, 2n, 3n, 4n]);
            expect(stakeDataArray.length).to.equal(5);
            stakeDataArray.forEach((data) => {
                expect(data.staker).to.equal(admin.address);
            });
        });

        it("Success: NFT transferred to staking contract", async function () {
            const { admin, nft, nftStaking, minterRole } = await loadFixture(DockMarketNFTSaleFixture);

            await nft.connect(admin).grantRole(minterRole, admin.address);
            await nft.connect(admin).mint(admin.address, 1n);

            await nft.connect(admin).setApprovalForAll(nftStaking.target, true);

            await nftStaking.connect(admin).stake([0n]);

            expect(await nft.ownerOf(0n)).to.equal(nftStaking.target);
            expect(await nft.balanceOf(admin.address)).to.equal(0n);
            expect(await nft.balanceOf(nftStaking.target)).to.equal(1n);
        });

        it("Success: Multiple stakers", async function () {
            const { admin, user, nft, nftStaking, minterRole } = await loadFixture(DockMarketNFTSaleFixture);

            await nft.connect(admin).grantRole(minterRole, admin.address);
            await nft.connect(admin).mint(admin.address, 3n);
            await nft.connect(admin).mint(user.address, 2n);

            await nft.connect(admin).setApprovalForAll(nftStaking.target, true);
            await nft.connect(user).setApprovalForAll(nftStaking.target, true);

            let stateBefore = await captureStakeState(nftStaking, [admin.address, user.address]);
            expect(stateBefore.stakers).to.eql([]);

            await nftStaking.connect(admin).stake([0n, 1n]);

            let stateAfter = await captureStakeState(nftStaking, [admin.address, user.address]);
            expect(stateAfter.stakers).to.eql([admin.address]);
            expect(stateAfter.stakedTokenIds[0]).to.eql([0n, 1n]);

            stateBefore = await captureStakeState(nftStaking, [admin.address, user.address]);
            await nftStaking.connect(user).stake([3n, 4n]);
            stateAfter = await captureStakeState(nftStaking, [admin.address, user.address]);
            expect(stateAfter.stakers).to.eql([admin.address, user.address]);
            expect(stateAfter.stakedTokenIds[0]).to.eql([0n, 1n]);
            expect(stateAfter.stakedTokenIds[1]).to.eql([3n, 4n]);

            expect(await nftStaking.stakers()).to.eql([admin.address, user.address]);
            expect(await nftStaking.stakedTokenIds(admin.address)).to.eql([0n, 1n]);
            expect(await nftStaking.stakedTokenIds(user.address)).to.eql([3n, 4n]);
        });
    });

    describe("stakeWithLockOnBehalfOf()", function () {
        it("DockMarketNFTStaking__InvalidLength: empty arrays", async function () {
            const { user, nftStaking } = await loadFixture(DockMarketNFTSaleFixture);

            await expect(nftStaking.connect(user).stakeWithLockOnBehalfOf(
                [],
                [],
                []
            )).to.be.revertedWithCustomError(nftStaking, "DockMarketNFTStaking__InvalidLength");
        });

        it("DockMarketNFTStaking__InvalidLength: mismatched receivers length", async function () {
            const { admin, user, nft, nftStaking, minterRole } = await loadFixture(DockMarketNFTSaleFixture);

            await nft.connect(admin).grantRole(minterRole, admin.address);
            await nft.connect(admin).mint(admin.address, 2n);
            await nft.connect(admin).setApprovalForAll(nftStaking.target, true);

            await expect(nftStaking.connect(admin).stakeWithLockOnBehalfOf(
                [0n, 1n],
                [user.address],
                [1000n, 2000n]
            )).to.be.revertedWithCustomError(nftStaking, "DockMarketNFTStaking__InvalidLength");
        });

        it("DockMarketNFTStaking__InvalidLength: mismatched lockDurations length", async function () {
            const { admin, user, nft, nftStaking, minterRole } = await loadFixture(DockMarketNFTSaleFixture);

            await nft.connect(admin).grantRole(minterRole, admin.address);
            await nft.connect(admin).mint(admin.address, 2n);
            await nft.connect(admin).setApprovalForAll(nftStaking.target, true);

            await expect(nftStaking.connect(admin).stakeWithLockOnBehalfOf(
                [0n, 1n],
                [user.address, user.address],
                [1000n]
            )).to.be.revertedWithCustomError(nftStaking, "DockMarketNFTStaking__InvalidLength");
        });

        it("DockMarketNFTStaking__NotAnOwner", async function () {
            const { admin, user, nft, nftStaking, minterRole } = await loadFixture(DockMarketNFTSaleFixture);

            await nft.connect(admin).grantRole(minterRole, admin.address);
            await nft.connect(admin).mint(admin.address, 1n);

            await nft.connect(admin).setApprovalForAll(nftStaking.target, true);

            await expect(nftStaking.connect(user).stakeWithLockOnBehalfOf(
                [0n],
                [user.address],
                [1000n]
            )).to.be.revertedWithCustomError(nftStaking, "DockMarketNFTStaking__NotAnOwner");
        });

        it("DockMarketNFTStaking__ZeroAddress", async function () {
            const { admin, nft, nftStaking, minterRole } = await loadFixture(DockMarketNFTSaleFixture);

            await nft.connect(admin).grantRole(minterRole, admin.address);
            await nft.connect(admin).mint(admin.address, 1n);
            await nft.connect(admin).setApprovalForAll(nftStaking.target, true);

            await expect(nftStaking.connect(admin).stakeWithLockOnBehalfOf(
                [0n],
                [ethers.ZeroAddress],
                [1000n]
            )).to.be.revertedWithCustomError(nftStaking, "DockMarketNFTStaking__ZeroAddress");
        });

        it("Success: Single token with lock", async function () {
            const { admin, user, nft, nftStaking, minterRole } = await loadFixture(DockMarketNFTSaleFixture);

            await nft.connect(admin).grantRole(minterRole, admin.address);
            await nft.connect(admin).mint(admin.address, 1n);

            await nft.connect(admin).setApprovalForAll(nftStaking.target, true);

            const blockTimestamp = BigInt(await time.latest());
            const lockDuration = 7776000n;

            const stateBefore = await captureStakeState(nftStaking, [user.address]);
            expect(stateBefore.stakers).to.eql([]);
            expect(stateBefore.stakedTokenIds[0]).to.eql([]);

            await expect(nftStaking.connect(admin).stakeWithLockOnBehalfOf(
                [0n],
                [user.address],
                [lockDuration]
            )).to.emit(nftStaking, "Staked").withArgs(
                admin.address,
                user.address,
                0n,
                blockTimestamp + 1n,
                blockTimestamp + 1n + lockDuration
            );

            const stateAfter = await captureStakeState(nftStaking, [user.address]);
            expect(stateAfter.stakers).to.eql([user.address]);
            expect(stateAfter.stakedTokenIds[0]).to.eql([0n]);
            expect(stateAfter.stakeDataByStaker[0][0].tokenId).to.equal(0n);
            expect(stateAfter.stakeDataByStaker[0][0].staker).to.equal(user.address);

            expect(await nftStaking.stakers()).to.eql([user.address]);
            expect(await nftStaking.stakedTokenIds(user.address)).to.eql([0n]);

            const stakeDataArray = await nftStaking.stakeData([0n]);
            expect(stakeDataArray[0].staker).to.equal(user.address);
            expect(stakeDataArray[0].stakedAt).to.equal(blockTimestamp + 1n);
            expect(stakeDataArray[0].lockedUntil).to.equal(blockTimestamp + 1n + lockDuration);
        });

        it("Success: Multiple tokens with different locks", async function () {
            const { admin, user, userTwo, nft, nftStaking, minterRole } = await loadFixture(DockMarketNFTSaleFixture);

            await nft.connect(admin).grantRole(minterRole, admin.address);
            await nft.connect(admin).mint(admin.address, 3n);

            await nft.connect(admin).setApprovalForAll(nftStaking.target, true);

            const blockTimestamp = BigInt(await time.latest());

            let stateBefore = await captureStakeState(nftStaking, [user.address, userTwo.address]);
            expect(stateBefore.stakers).to.eql([]);

            await expect(nftStaking.connect(admin).stakeWithLockOnBehalfOf(
                [0n, 1n, 2n],
                [user.address, userTwo.address, user.address],
                [1000n, 2000n, 3000n]
            )).to.emit(nftStaking, "Staked");

            const stateAfter = await captureStakeState(nftStaking, [user.address, userTwo.address]);
            expect(stateAfter.stakers).to.include.members([user.address, userTwo.address]);
            expect(stateAfter.stakedTokenIds[0]).to.eql([0n, 2n]);
            expect(stateAfter.stakedTokenIds[1]).to.eql([1n]);
            expect(stateAfter.stakeDataByStaker[0]).to.have.lengthOf(2);
            expect(stateAfter.stakeDataByStaker[1]).to.have.lengthOf(1);

            expect(await nftStaking.stakers()).to.include.members([user.address, userTwo.address]);

            const userStakes = await nftStaking.stakedTokenIds(user.address);
            expect(userStakes).to.include.members([0n, 2n]);

            const userTwoStakes = await nftStaking.stakedTokenIds(userTwo.address);
            expect(userTwoStakes).to.eql([1n]);

            const stakeDataArray = await nftStaking.stakeData([0n, 1n, 2n]);
            expect(stakeDataArray[0].lockedUntil).to.equal(blockTimestamp + 1n + 1000n);
            expect(stakeDataArray[1].lockedUntil).to.equal(blockTimestamp + 1n + 2000n);
            expect(stakeDataArray[2].lockedUntil).to.equal(blockTimestamp + 1n + 3000n);
        });

        it("Success: Stake with zero lock duration", async function () {
            const { admin, user, nft, nftStaking, minterRole } = await loadFixture(DockMarketNFTSaleFixture);

            await nft.connect(admin).grantRole(minterRole, admin.address);
            await nft.connect(admin).mint(admin.address, 1n);
            await nft.connect(admin).setApprovalForAll(nftStaking.target, true);

            const blockTimestamp = BigInt(await time.latest());

            const stateBefore = await captureStakeState(nftStaking, [user.address]);
            expect(stateBefore.stakers).to.eql([]);

            await nftStaking.connect(admin).stakeWithLockOnBehalfOf(
                [0n],
                [user.address],
                [0n]
            );

            const stateAfter = await captureStakeState(nftStaking, [user.address]);
            expect(stateAfter.stakers).to.eql([user.address]);
            expect(stateAfter.stakedTokenIds[0]).to.eql([0n]);
            expect(stateAfter.stakeDataByStaker[0][0].tokenId).to.equal(0n);
            expect(stateAfter.stakeDataByStaker[0][0].staker).to.equal(user.address);

            const stakeDataArray = await nftStaking.stakeData([0n]);
            expect(stakeDataArray[0].lockedUntil).to.equal(blockTimestamp + 1n);
        });
    });

    describe("unstake()", function () {
        it("DockMarketNFTStaking__InvalidLength", async function () {
            const { admin, nftStaking } = await loadFixture(DockMarketNFTSaleFixture);

            await expect(nftStaking.connect(admin).unstake(
                [],
                admin.address
            )).to.be.revertedWithCustomError(nftStaking, "DockMarketNFTStaking__InvalidLength");
        });

        it("DockMarketNFTStaking__NotAnOwner", async function () {
            const { admin, nftStaking } = await loadFixture(DockMarketNFTSaleFixture);

            await expect(nftStaking.connect(admin).unstake(
                [0n],
                admin.address
            )).to.be.revertedWithCustomError(nftStaking, "DockMarketNFTStaking__NotAnOwner");
        });

        it("DockMarketNFTStaking__NotAnOwner", async function () {
            const { admin, user, nft, nftStaking, minterRole } = await loadFixture(DockMarketNFTSaleFixture);

            await nft.connect(admin).grantRole(minterRole, admin.address);
            await nft.connect(admin).mint(admin.address, 1n);
            await nft.connect(admin).setApprovalForAll(nftStaking.target, true);

            await nftStaking.connect(admin).stake([0n]);

            await expect(nftStaking.connect(user).unstake(
                [0n],
                user.address
            )).to.be.revertedWithCustomError(nftStaking, "DockMarketNFTStaking__NotAnOwner");
        });

        it("DockMarketNFTStaking__LockedToken", async function () {
            const { admin, nft, nftStaking, minterRole } = await loadFixture(DockMarketNFTSaleFixture);

            await nft.connect(admin).grantRole(minterRole, admin.address);
            await nft.connect(admin).mint(admin.address, 1n);
            await nft.connect(admin).setApprovalForAll(nftStaking.target, true);

            const lockDuration = 7776000n;

            await nftStaking.connect(admin).stakeWithLockOnBehalfOf(
                [0n],
                [admin.address],
                [lockDuration]
            );

            await expect(nftStaking.connect(admin).unstake(
                [0n],
                admin.address
            )).to.be.revertedWithCustomError(nftStaking, "DockMarketNFTStaking__LockedToken");
        });

        it("Success: Unstake without lock", async function () {
            const { admin, nft, nftStaking, minterRole } = await loadFixture(DockMarketNFTSaleFixture);

            await nft.connect(admin).grantRole(minterRole, admin.address);
            await nft.connect(admin).mint(admin.address, 1n);
            await nft.connect(admin).setApprovalForAll(nftStaking.target, true);

            await nftStaking.connect(admin).stake([0n]);

            const blockTimestamp = BigInt(await time.latest());

            let stateBefore = await captureStakeState(nftStaking, [admin.address]);
            expect(stateBefore.stakers).to.eql([admin.address]);
            expect(stateBefore.stakedTokenIds[0]).to.eql([0n]);
            expect(stateBefore.stakeDataByStaker[0]).to.have.lengthOf(1);

            await expect(nftStaking.connect(admin).unstake(
                [0n],
                admin.address
            )).to.emit(nftStaking, "Unstaked").withArgs(
                admin.address,
                admin.address,
                0n,
                blockTimestamp + 1n
            );

            const stateAfter = await captureStakeState(nftStaking, [admin.address]);
            expect(stateAfter.stakers).to.eql([]);
            expect(stateAfter.stakedTokenIds[0]).to.eql([]);
            expect(stateAfter.stakeDataByStaker[0]).to.have.lengthOf(0);

            expect(await nftStaking.stakers()).to.eql([]);
            expect(await nftStaking.stakedTokenIds(admin.address)).to.eql([]);
            expect(await nft.ownerOf(0n)).to.equal(admin.address);
        });

        it("Success: Unstake to different receiver", async function () {
            const { admin, user, nft, nftStaking, minterRole } = await loadFixture(DockMarketNFTSaleFixture);

            await nft.connect(admin).grantRole(minterRole, admin.address);
            await nft.connect(admin).mint(admin.address, 1n);
            await nft.connect(admin).setApprovalForAll(nftStaking.target, true);

            await nftStaking.connect(admin).stake([0n]);

            const stateBefore = await captureStakeState(nftStaking, [admin.address]);
            expect(stateBefore.stakers).to.eql([admin.address]);
            expect(stateBefore.stakedTokenIds[0]).to.eql([0n]);

            await nftStaking.connect(admin).unstake([0n], user.address);

            const stateAfter = await captureStakeState(nftStaking, [admin.address]);
            expect(stateAfter.stakers).to.eql([]);
            expect(stateAfter.stakedTokenIds[0]).to.eql([]);
            expect(stateAfter.stakeDataByStaker[0]).to.have.lengthOf(0);

            expect(await nft.ownerOf(0n)).to.equal(user.address);
            expect(await nft.balanceOf(user.address)).to.equal(1n);
        });

        it("Success: Unstake after lock expires", async function () {
            const { admin, nft, nftStaking, minterRole } = await loadFixture(DockMarketNFTSaleFixture);

            await nft.connect(admin).grantRole(minterRole, admin.address);
            await nft.connect(admin).mint(admin.address, 1n);
            await nft.connect(admin).setApprovalForAll(nftStaking.target, true);

            const lockDuration = 7776000n;

            await nftStaking.connect(admin).stakeWithLockOnBehalfOf(
                [0n],
                [admin.address],
                [lockDuration]
            );

            let stateBefore = await captureStakeState(nftStaking, [admin.address]);
            expect(stateBefore.stakers).to.eql([admin.address]);
            expect(stateBefore.stakedTokenIds[0]).to.eql([0n]);

            await expect(nftStaking.connect(admin).unstake(
                [0n],
                admin.address
            )).to.be.revertedWithCustomError(nftStaking, "DockMarketNFTStaking__LockedToken");

            await time.increase(lockDuration + 1n);

            stateBefore = await captureStakeState(nftStaking, [admin.address]);
            expect(stateBefore.stakers).to.eql([admin.address]);
            expect(stateBefore.stakedTokenIds[0]).to.eql([0n]);

            await expect(nftStaking.connect(admin).unstake(
                [0n],
                admin.address
            )).to.emit(nftStaking, "Unstaked");

            const stateAfter = await captureStakeState(nftStaking, [admin.address]);
            expect(stateAfter.stakers).to.eql([]);
            expect(stateAfter.stakedTokenIds[0]).to.eql([]);
            expect(stateAfter.stakeDataByStaker[0]).to.have.lengthOf(0);

            expect(await nft.ownerOf(0n)).to.equal(admin.address);
        });

        it("Success: Multiple unstakes", async function () {
            const { admin, nft, nftStaking, minterRole } = await loadFixture(DockMarketNFTSaleFixture);

            await nft.connect(admin).grantRole(minterRole, admin.address);
            await nft.connect(admin).mint(admin.address, 3n);

            await nft.connect(admin).setApprovalForAll(nftStaking.target, true);

            await nftStaking.connect(admin).stake([0n, 1n, 2n]);

            const stateBefore = await captureStakeState(nftStaking, [admin.address]);
            expect(stateBefore.stakers).to.eql([admin.address]);
            expect(stateBefore.stakedTokenIds[0]).to.eql([0n, 1n, 2n]);
            expect(stateBefore.stakeDataByStaker[0]).to.have.lengthOf(3);

            await nftStaking.connect(admin).unstake([0n, 1n, 2n], admin.address);

            const stateAfter = await captureStakeState(nftStaking, [admin.address]);
            expect(stateAfter.stakers).to.eql([]);
            expect(stateAfter.stakedTokenIds[0]).to.eql([]);
            expect(stateAfter.stakeDataByStaker[0]).to.have.lengthOf(0);

            expect(await nftStaking.stakedTokenIds(admin.address)).to.eql([]);
            expect(await nftStaking.stakers()).to.eql([]);
            expect(await nft.balanceOf(admin.address)).to.equal(3n);
        });

        it("Success: Partial unstake", async function () {
            const { admin, nft, nftStaking, minterRole } = await loadFixture(DockMarketNFTSaleFixture);

            await nft.connect(admin).grantRole(minterRole, admin.address);
            await nft.connect(admin).mint(admin.address, 5n);

            await nft.connect(admin).setApprovalForAll(nftStaking.target, true);

            await nftStaking.connect(admin).stake([0n, 1n, 2n, 3n, 4n]);

            const stateBefore = await captureStakeState(nftStaking, [admin.address]);
            expect(stateBefore.stakers).to.eql([admin.address]);
            expect(stateBefore.stakedTokenIds[0]).to.eql([0n, 1n, 2n, 3n, 4n]);
            expect(stateBefore.stakeDataByStaker[0]).to.have.lengthOf(5);

            await nftStaking.connect(admin).unstake([1n, 3n], admin.address);

            const stateAfter = await captureStakeState(nftStaking, [admin.address]);
            expect(stateAfter.stakers).to.eql([admin.address]);
            expect(stateAfter.stakedTokenIds[0]).to.eql([0n, 4n, 2n]);
            expect(stateAfter.stakeDataByStaker[0]).to.have.lengthOf(3);

            const remainingStakes = await nftStaking.stakedTokenIds(admin.address);
            expect(remainingStakes).to.eql([0n, 4n, 2n]);
            expect(await nftStaking.stakers()).to.eql([admin.address]);
            expect(await nft.ownerOf(1n)).to.equal(admin.address);
            expect(await nft.ownerOf(3n)).to.equal(admin.address);
        });
    });

    describe("setUnlockTimestamps()", function () {
        it("AccessControl", async function () {
            const { user, nftStaking } = await loadFixture(DockMarketNFTSaleFixture);

            await expect(nftStaking.connect(user).setUnlockTimestamps(
                [0n],
                [1000n]
            )).to.be.revertedWithCustomError(nftStaking, "AccessControlUnauthorizedAccount");
        });

        it("DockMarketNFTStaking__InvalidLength: empty arrays", async function () {
            const { admin, nftStaking } = await loadFixture(DockMarketNFTSaleFixture);

            await expect(nftStaking.connect(admin).setUnlockTimestamps(
                [],
                []
            )).to.be.revertedWithCustomError(nftStaking, "DockMarketNFTStaking__InvalidLength");
        });

        it("DockMarketNFTStaking__InvalidLength: mismatched lengths", async function () {
            const { admin, nftStaking } = await loadFixture(DockMarketNFTSaleFixture);

            await expect(nftStaking.connect(admin).setUnlockTimestamps(
                [0n, 1n],
                [1000n]
            )).to.be.revertedWithCustomError(nftStaking, "DockMarketNFTStaking__InvalidLength");
        });

        it("DockMarketNFTStaking__UnstakedToken", async function () {
            const { admin, nftStaking } = await loadFixture(DockMarketNFTSaleFixture);

            await expect(nftStaking.connect(admin).setUnlockTimestamps(
                [0n],
                [1000n]
            )).to.be.revertedWithCustomError(nftStaking, "DockMarketNFTStaking__UnstakedToken");
        });

        it("Success: Extend lock duration", async function () {
            const { admin, nft, nftStaking, minterRole } = await loadFixture(DockMarketNFTSaleFixture);

            await nft.connect(admin).grantRole(minterRole, admin.address);
            await nft.connect(admin).mint(admin.address, 1n);
            await nft.connect(admin).setApprovalForAll(nftStaking.target, true);

            const blockTimestamp = BigInt(await time.latest());
            const initialLock = 1000n;

            await nftStaking.connect(admin).stakeWithLockOnBehalfOf(
                [0n],
                [admin.address],
                [initialLock]
            );

            let stateBefore = await captureStakeState(nftStaking, [admin.address]);
            expect(stateBefore.stakers).to.eql([admin.address]);
            expect(stateBefore.stakedTokenIds[0]).to.eql([0n]);
            expect(stateBefore.stakeDataByStaker[0][0].lockedUntil).to.equal(blockTimestamp + 1n + initialLock);

            let stakeDataArray = await nftStaking.stakeData([0n]);
            expect(stakeDataArray[0].lockedUntil).to.equal(blockTimestamp + 1n + initialLock);

            const newUnlockTimestamp = blockTimestamp + 1n + 5000n;

            await nftStaking.connect(admin).setUnlockTimestamps([0n], [newUnlockTimestamp]);

            const stateAfter = await captureStakeState(nftStaking, [admin.address]);
            expect(stateAfter.stakers).to.eql([admin.address]);
            expect(stateAfter.stakedTokenIds[0]).to.eql([0n]);
            expect(stateAfter.stakeDataByStaker[0][0].lockedUntil).to.equal(newUnlockTimestamp);

            stakeDataArray = await nftStaking.stakeData([0n]);
            expect(stakeDataArray[0].lockedUntil).to.equal(newUnlockTimestamp);
        });

        it("Success: Reduce lock duration", async function () {
            const { admin, nft, nftStaking, minterRole } = await loadFixture(DockMarketNFTSaleFixture);

            await nft.connect(admin).grantRole(minterRole, admin.address);
            await nft.connect(admin).mint(admin.address, 1n);
            await nft.connect(admin).setApprovalForAll(nftStaking.target, true);

            const blockTimestamp = BigInt(await time.latest());
            const initialLock = 5000n;

            await nftStaking.connect(admin).stakeWithLockOnBehalfOf(
                [0n],
                [admin.address],
                [initialLock]
            );

            let stateBefore = await captureStakeState(nftStaking, [admin.address]);
            expect(stateBefore.stakers).to.eql([admin.address]);
            expect(stateBefore.stakedTokenIds[0]).to.eql([0n]);
            expect(stateBefore.stakeDataByStaker[0][0].lockedUntil).to.equal(blockTimestamp + 1n + initialLock);

            let stakeDataArray = await nftStaking.stakeData([0n]);
            expect(stakeDataArray[0].lockedUntil).to.equal(blockTimestamp + 1n + initialLock);

            const newUnlockTimestamp = blockTimestamp + 1n + 1000n;

            await nftStaking.connect(admin).setUnlockTimestamps([0n], [newUnlockTimestamp]);

            const stateAfter = await captureStakeState(nftStaking, [admin.address]);
            expect(stateAfter.stakers).to.eql([admin.address]);
            expect(stateAfter.stakedTokenIds[0]).to.eql([0n]);
            expect(stateAfter.stakeDataByStaker[0][0].lockedUntil).to.equal(newUnlockTimestamp);

            stakeDataArray = await nftStaking.stakeData([0n]);
            expect(stakeDataArray[0].lockedUntil).to.equal(newUnlockTimestamp);
        });

        it("Success: Remove lock (set to current time)", async function () {
            const { admin, nft, nftStaking, minterRole } = await loadFixture(DockMarketNFTSaleFixture);

            await nft.connect(admin).grantRole(minterRole, admin.address);
            await nft.connect(admin).mint(admin.address, 1n);
            await nft.connect(admin).setApprovalForAll(nftStaking.target, true);

            const initialLock = 7776000n;

            await nftStaking.connect(admin).stakeWithLockOnBehalfOf(
                [0n],
                [admin.address],
                [initialLock]
            );

            let stateBefore = await captureStakeState(nftStaking, [admin.address]);
            expect(stateBefore.stakers).to.eql([admin.address]);
            expect(stateBefore.stakedTokenIds[0]).to.eql([0n]);
            expect(stateBefore.stakeDataByStaker[0]).to.have.lengthOf(1);

            const blockTimestamp = BigInt(await time.latest());

            await nftStaking.connect(admin).setUnlockTimestamps([0n], [blockTimestamp + 1n]);

            const stateAfter = await captureStakeState(nftStaking, [admin.address]);
            expect(stateAfter.stakers).to.eql([admin.address]);
            expect(stateAfter.stakedTokenIds[0]).to.eql([0n]);
            expect(stateAfter.stakeDataByStaker[0][0].lockedUntil).to.equal(blockTimestamp + 1n);

            await expect(nftStaking.connect(admin).unstake(
                [0n],
                admin.address
            )).to.emit(nftStaking, "Unstaked");
        });

        it("Success: Multiple tokens", async function () {
            const { admin, nft, nftStaking, minterRole } = await loadFixture(DockMarketNFTSaleFixture);

            await nft.connect(admin).grantRole(minterRole, admin.address);
            await nft.connect(admin).mint(admin.address, 3n);

            await nft.connect(admin).setApprovalForAll(nftStaking.target, true);

            const blockTimestamp = BigInt(await time.latest());
            const initialLock = 1000n;

            await nftStaking.connect(admin).stakeWithLockOnBehalfOf(
                [0n, 1n, 2n],
                [admin.address, admin.address, admin.address],
                [initialLock, initialLock, initialLock]
            );

            let stateBefore = await captureStakeState(nftStaking, [admin.address]);
            expect(stateBefore.stakers).to.eql([admin.address]);
            expect(stateBefore.stakedTokenIds[0]).to.eql([0n, 1n, 2n]);
            expect(stateBefore.stakeDataByStaker[0]).to.have.lengthOf(3);

            const newTimestamps = [
                blockTimestamp + 1n + 2000n,
                blockTimestamp + 1n + 3000n,
                blockTimestamp + 1n + 4000n
            ];

            await nftStaking.connect(admin).setUnlockTimestamps([0n, 1n, 2n], newTimestamps);

            const stateAfter = await captureStakeState(nftStaking, [admin.address]);
            expect(stateAfter.stakers).to.eql([admin.address]);
            expect(stateAfter.stakedTokenIds[0]).to.eql([0n, 1n, 2n]);
            expect(stateAfter.stakeDataByStaker[0]).to.have.lengthOf(3);
            expect(stateAfter.stakeDataByStaker[0][0].lockedUntil).to.equal(newTimestamps[0]);
            expect(stateAfter.stakeDataByStaker[0][1].lockedUntil).to.equal(newTimestamps[1]);
            expect(stateAfter.stakeDataByStaker[0][2].lockedUntil).to.equal(newTimestamps[2]);

            const stakeDataArray = await nftStaking.stakeData([0n, 1n, 2n]);
            expect(stakeDataArray[0].lockedUntil).to.equal(newTimestamps[0]);
            expect(stakeDataArray[1].lockedUntil).to.equal(newTimestamps[1]);
            expect(stakeDataArray[2].lockedUntil).to.equal(newTimestamps[2]);
        });
    });

    describe("stakers()", function () {
        it("Returns empty when no stakers", async function () {
            const { nftStaking } = await loadFixture(DockMarketNFTSaleFixture);

            expect(await nftStaking.stakers()).to.eql([]);
        });

        it("Returns all stakers", async function () {
            const { admin, user, userTwo, nft, nftStaking, minterRole } = await loadFixture(DockMarketNFTSaleFixture);

            await nft.connect(admin).grantRole(minterRole, admin.address);
            await nft.connect(admin).mint(admin.address, 3n);

            await nft.connect(admin).setApprovalForAll(nftStaking.target, true);

            await nftStaking.connect(admin).stakeWithLockOnBehalfOf(
                [0n, 1n, 2n],
                [admin.address, user.address, userTwo.address],
                [0n, 0n, 0n]
            );

            const stakersList = await nftStaking.stakers();
            expect(stakersList).to.include.members([admin.address, user.address, userTwo.address]);
            expect(stakersList.length).to.equal(3);
        });

        it("Returns stakers in order of addition", async function () {
            const { admin, user, nft, nftStaking, minterRole } = await loadFixture(DockMarketNFTSaleFixture);

            await nft.connect(admin).grantRole(minterRole, admin.address);
            await nft.connect(admin).mint(admin.address, 2n);
            await nft.connect(admin).setApprovalForAll(nftStaking.target, true);

            await nftStaking.connect(admin).stakeWithLockOnBehalfOf([0n], [admin.address], [0n]);
            await nftStaking.connect(admin).stakeWithLockOnBehalfOf([1n], [user.address], [0n]);

            expect(await nftStaking.stakers()).to.eql([admin.address, user.address]);
        });

        it("Removes staker when all tokens unstaked", async function () {
            const { admin, user, nft, nftStaking, minterRole } = await loadFixture(DockMarketNFTSaleFixture);

            await nft.connect(admin).grantRole(minterRole, admin.address);
            await nft.connect(admin).mint(admin.address, 2n);
            await nft.connect(admin).setApprovalForAll(nftStaking.target, true);

            await nftStaking.connect(admin).stakeWithLockOnBehalfOf(
                [0n, 1n],
                [admin.address, user.address],
                [0n, 0n]
            );

            expect(await nftStaking.stakers()).to.eql([admin.address, user.address]);

            await nftStaking.connect(admin).unstake([0n], admin.address);

            expect(await nftStaking.stakers()).to.eql([user.address]);

            await nftStaking.connect(user).unstake([1n], user.address);

            expect(await nftStaking.stakers()).to.eql([]);
        });
    });

    describe("stakedTokenIds()", function () {
        it("Returns empty array for non-staker", async function () {
            const { admin, user, nftStaking } = await loadFixture(DockMarketNFTSaleFixture);

            expect(await nftStaking.stakedTokenIds(admin.address)).to.eql([]);
            expect(await nftStaking.stakedTokenIds(user.address)).to.eql([]);
        });

        it("Returns all staked token IDs for staker", async function () {
            const { admin, nft, nftStaking, minterRole } = await loadFixture(DockMarketNFTSaleFixture);

            await nft.connect(admin).grantRole(minterRole, admin.address);
            await nft.connect(admin).mint(admin.address, 5n);

            await nft.connect(admin).setApprovalForAll(nftStaking.target, true);

            await nftStaking.connect(admin).stake([0n, 1n, 2n, 3n, 4n]);

            expect(await nftStaking.stakedTokenIds(admin.address)).to.eql([0n, 1n, 2n, 3n, 4n]);
        });

        it("Returns updated list after unstaking", async function () {
            const { admin, nft, nftStaking, minterRole } = await loadFixture(DockMarketNFTSaleFixture);

            await nft.connect(admin).grantRole(minterRole, admin.address);
            await nft.connect(admin).mint(admin.address, 3n);

            await nft.connect(admin).setApprovalForAll(nftStaking.target, true);

            await nftStaking.connect(admin).stake([0n, 1n, 2n]);

            expect(await nftStaking.stakedTokenIds(admin.address)).to.eql([0n, 1n, 2n]);

            await nftStaking.connect(admin).unstake([1n], admin.address);

            const remainingTokens = await nftStaking.stakedTokenIds(admin.address);
            expect(remainingTokens).to.eql([0n, 2n]);
        });
    });

    describe("stakeData()", function () {
        it("Returns stake data for tokens", async function () {
            const { admin, nft, nftStaking, minterRole } = await loadFixture(DockMarketNFTSaleFixture);

            await nft.connect(admin).grantRole(minterRole, admin.address);
            await nft.connect(admin).mint(admin.address, 3n);

            await nft.connect(admin).setApprovalForAll(nftStaking.target, true);

            const blockTimestamp = BigInt(await time.latest());
            const lockDuration = 7776000n;

            await nftStaking.connect(admin).stakeWithLockOnBehalfOf(
                [0n, 1n, 2n],
                [admin.address, admin.address, admin.address],
                [lockDuration, lockDuration * 2n, lockDuration * 3n]
            );

            const stakeDataArray = await nftStaking.stakeData([0n, 1n, 2n]);

            expect(stakeDataArray.length).to.equal(3);

            expect(stakeDataArray[0].staker).to.equal(admin.address);
            expect(stakeDataArray[0].stakedAt).to.equal(blockTimestamp + 1n);
            expect(stakeDataArray[0].lockedUntil).to.equal(blockTimestamp + 1n + lockDuration);

            expect(stakeDataArray[1].staker).to.equal(admin.address);
            expect(stakeDataArray[1].lockedUntil).to.equal(blockTimestamp + 1n + lockDuration * 2n);

            expect(stakeDataArray[2].staker).to.equal(admin.address);
            expect(stakeDataArray[2].lockedUntil).to.equal(blockTimestamp + 1n + lockDuration * 3n);
        });

        it("Returns zero staker address for unstaked tokens", async function () {
            const { nftStaking } = await loadFixture(DockMarketNFTSaleFixture);

            const stakeDataArray = await nftStaking.stakeData([0n, 1n, 2n]);

            expect(stakeDataArray.length).to.equal(3);
            stakeDataArray.forEach((data) => {
                expect(data.staker).to.equal(ethers.ZeroAddress);
                expect(data.stakedAt).to.equal(0n);
                expect(data.lockedUntil).to.equal(0n);
            });
        });

        it("Returns partial data for mixed staked/unstaked", async function () {
            const { admin, nft, nftStaking, minterRole } = await loadFixture(DockMarketNFTSaleFixture);

            await nft.connect(admin).grantRole(minterRole, admin.address);
            await nft.connect(admin).mint(admin.address, 2n);

            await nft.connect(admin).setApprovalForAll(nftStaking.target, true);

            await nftStaking.connect(admin).stake([0n, 1n]);
            await nftStaking.connect(admin).unstake([0n], admin.address);

            const stakeDataArray = await nftStaking.stakeData([0n, 1n]);

            expect(stakeDataArray[0].staker).to.equal(ethers.ZeroAddress);
            expect(stakeDataArray[1].staker).to.equal(admin.address);
        });
    });

    describe("stakeDataByStaker()", function () {
        it("Returns empty array for non-staker", async function () {
            const { admin, nftStaking } = await loadFixture(DockMarketNFTSaleFixture);

            expect(await nftStaking.stakeDataByStaker(admin.address)).to.eql([]);
        });

        it("Returns all stake info for staker", async function () {
            const { admin, nft, nftStaking, minterRole } = await loadFixture(DockMarketNFTSaleFixture);

            await nft.connect(admin).grantRole(minterRole, admin.address);
            await nft.connect(admin).mint(admin.address, 3n);

            await nft.connect(admin).setApprovalForAll(nftStaking.target, true);

            const blockTimestamp = BigInt(await time.latest());
            const lockDuration = 7776000n;

            await nftStaking.connect(admin).stakeWithLockOnBehalfOf(
                [0n, 1n, 2n],
                [admin.address, admin.address, admin.address],
                [lockDuration, lockDuration * 2n, lockDuration * 3n]
            );

            const stakeInfoArray = await nftStaking.stakeDataByStaker(admin.address);

            expect(stakeInfoArray.length).to.equal(3);

            expect(stakeInfoArray[0].tokenId).to.equal(0n);
            expect(stakeInfoArray[0].staker).to.equal(admin.address);
            expect(stakeInfoArray[0].stakedAt).to.equal(blockTimestamp + 1n);
            expect(stakeInfoArray[0].lockedUntil).to.equal(blockTimestamp + 1n + lockDuration);

            expect(stakeInfoArray[1].tokenId).to.equal(1n);
            expect(stakeInfoArray[1].lockedUntil).to.equal(blockTimestamp + 1n + lockDuration * 2n);

            expect(stakeInfoArray[2].tokenId).to.equal(2n);
            expect(stakeInfoArray[2].lockedUntil).to.equal(blockTimestamp + 1n + lockDuration * 3n);
        });

        it("Updates after unstaking", async function () {
            const { admin, nft, nftStaking, minterRole } = await loadFixture(DockMarketNFTSaleFixture);

            await nft.connect(admin).grantRole(minterRole, admin.address);
            await nft.connect(admin).mint(admin.address, 3n);

            await nft.connect(admin).setApprovalForAll(nftStaking.target, true);

            await nftStaking.connect(admin).stake([0n, 1n, 2n]);

            let stakeInfoArray = await nftStaking.stakeDataByStaker(admin.address);
            expect(stakeInfoArray.length).to.equal(3);

            await nftStaking.connect(admin).unstake([1n], admin.address);

            stakeInfoArray = await nftStaking.stakeDataByStaker(admin.address);
            expect(stakeInfoArray.length).to.equal(2);

            const tokenIds = stakeInfoArray.map(info => info.tokenId);
            expect(tokenIds).to.eql([0n, 2n]);
        });

        it("Multiple stakers maintain separate data", async function () {
            const { admin, user, nft, nftStaking, minterRole } = await loadFixture(DockMarketNFTSaleFixture);

            await nft.connect(admin).grantRole(minterRole, admin.address);
            await nft.connect(admin).mint(admin.address, 4n);

            await nft.connect(admin).setApprovalForAll(nftStaking.target, true);

            await nftStaking.connect(admin).stakeWithLockOnBehalfOf(
                [0n, 1n],
                [admin.address, admin.address],
                [0n, 0n]
            );

            await nftStaking.connect(admin).stakeWithLockOnBehalfOf(
                [2n, 3n],
                [user.address, user.address],
                [0n, 0n]
            );

            const adminStakeInfo = await nftStaking.stakeDataByStaker(admin.address);
            const userStakeInfo = await nftStaking.stakeDataByStaker(user.address);

            expect(adminStakeInfo.length).to.equal(2);
            expect(userStakeInfo.length).to.equal(2);

            expect(adminStakeInfo[0].tokenId).to.equal(0n);
            expect(adminStakeInfo[1].tokenId).to.equal(1n);

            expect(userStakeInfo[0].tokenId).to.equal(2n);
            expect(userStakeInfo[1].tokenId).to.equal(3n);
        });
    });

    describe("Scenarios", function () {
        it("Success", async function () {
            const { admin, nft, nftStaking, minterRole } = await loadFixture(DockMarketNFTSaleFixture);

            await nft.connect(admin).grantRole(minterRole, admin.address);
            await nft.connect(admin).mint(admin.address, 1n);
            await nft.connect(admin).setApprovalForAll(nftStaking.target, true);

            const blockTimestamp = BigInt(await time.latest());
            const initialLock = 1000n;

            await nftStaking.connect(admin).stakeWithLockOnBehalfOf(
                [0n],
                [admin.address],
                [initialLock]
            );

            let stakeData = (await nftStaking.stakeData([0n]))[0];
            expect(stakeData.lockedUntil).to.equal(blockTimestamp + 1n + initialLock);

            await expect(nftStaking.connect(admin).unstake(
                [0n],
                admin.address
            )).to.be.revertedWithCustomError(nftStaking, "DockMarketNFTStaking__LockedToken");

            const extendedLock = blockTimestamp + 1n + 5000n;
            await nftStaking.connect(admin).setUnlockTimestamps([0n], [extendedLock]);

            stakeData = (await nftStaking.stakeData([0n]))[0];
            expect(stakeData.lockedUntil).to.equal(extendedLock);

            await time.increase(5001n);
            await nftStaking.connect(admin).unstake([0n], admin.address);

            expect(await nft.ownerOf(0n)).to.equal(admin.address);
            expect(await nftStaking.stakedTokenIds(admin.address)).to.eql([]);
        });

        it("Multiple users with different lock periods", async function () {
            const { admin, user, userTwo, nft, nftStaking, minterRole } = await loadFixture(DockMarketNFTSaleFixture);

            await nft.connect(admin).grantRole(minterRole, admin.address);
            await nft.connect(admin).mint(admin.address, 3n);

            await nft.connect(admin).setApprovalForAll(nftStaking.target, true);

            await nftStaking.connect(admin).stakeWithLockOnBehalfOf(
                [0n],
                [user.address],
                [1000n]
            );

            await nftStaking.connect(admin).stakeWithLockOnBehalfOf(
                [1n],
                [userTwo.address],
                [10000n]
            );

            await nftStaking.connect(admin).stakeWithLockOnBehalfOf(
                [2n],
                [admin.address],
                [100n]
            );

            await time.increase(101n);

            await nftStaking.connect(admin).unstake([2n], admin.address);
            expect(await nft.ownerOf(2n)).to.equal(admin.address);

            await expect(nftStaking.connect(user).unstake(
                [0n],
                user.address
            )).to.be.revertedWithCustomError(nftStaking, "DockMarketNFTStaking__LockedToken");

            await time.increase(900n);

            await nftStaking.connect(user).unstake([0n], user.address);
            expect(await nft.ownerOf(0n)).to.equal(user.address);

            await expect(nftStaking.connect(userTwo).unstake(
                [1n],
                userTwo.address
            )).to.be.revertedWithCustomError(nftStaking, "DockMarketNFTStaking__LockedToken");
        });

        it("Batch operations with partial locks", async function () {
            const { admin, user, nft, nftStaking, minterRole } = await loadFixture(DockMarketNFTSaleFixture);

            await nft.connect(admin).grantRole(minterRole, admin.address);
            await nft.connect(admin).mint(admin.address, 10n);

            await nft.connect(admin).setApprovalForAll(nftStaking.target, true);

            await nftStaking.connect(admin).stake([0n, 1n, 2n]);

            const lockDuration = 5000n;
            await nftStaking.connect(admin).stakeWithLockOnBehalfOf(
                [3n, 4n, 5n, 6n, 7n],
                [user.address, user.address, user.address, user.address, user.address],
                [lockDuration, lockDuration * 2n, lockDuration, lockDuration * 3n, lockDuration]
            );

            expect(await nftStaking.stakers()).to.include.members([admin.address, user.address]);

            await nftStaking.connect(admin).unstake([0n, 1n, 2n], admin.address);
            expect(await nftStaking.stakedTokenIds(admin.address)).to.eql([]);

            await expect(nftStaking.connect(user).unstake(
                [3n, 4n, 5n, 6n, 7n],
                user.address
            )).to.be.revertedWithCustomError(nftStaking, "DockMarketNFTStaking__LockedToken");

            const blockTimestamp = BigInt(await time.latest());
            await nftStaking.connect(admin).setUnlockTimestamps(
                [3n, 4n],
                [blockTimestamp + 1n, blockTimestamp + 1n]
            );

            await nftStaking.connect(user).unstake([3n, 4n], user.address);
            expect((await nftStaking.stakedTokenIds(user.address)).length).to.equal(3);
        });
    });
});
