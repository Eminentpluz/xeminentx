const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

const usd = (n) => ethers.parseUnits(String(n), 6);

describe("PrizeVault", () => {
  async function deploy() {
    const [organizer, alice, bob, stranger] = await ethers.getSigners();
    const usdc = await ethers.deployContract("MockUSDC");
    const vault = await ethers.deployContract("PrizeVault", [usdc.target]);
    await usdc.mint(organizer.address, usd(10_000));
    await usdc.approve(vault.target, ethers.MaxUint256);
    const deadline = (await time.latest()) + 7 * 24 * 3600;
    return { organizer, alice, bob, stranger, usdc, vault, deadline };
  }

  async function withPool() {
    const ctx = await deploy();
    await ctx.vault.createPool("Demo Hack", "https://example.com", [usd(500), usd(300), usd(200)], ctx.deadline);
    return ctx;
  }

  it("escrows the full pool on creation", async () => {
    const { vault, usdc, organizer, deadline } = await loadFixture(deploy);
    await expect(vault.createPool("Demo Hack", "https://example.com", [usd(500), usd(300), usd(200)], deadline))
      .to.emit(vault, "PoolCreated")
      .withArgs(0, organizer.address, usd(1000), 3, deadline, "Demo Hack", "https://example.com");
    expect(await usdc.balanceOf(vault.target)).to.equal(usd(1000));
    const [pool, amounts, winners] = await vault.getPool(0);
    expect(pool.total).to.equal(usd(1000));
    expect(amounts).to.deep.equal([usd(500), usd(300), usd(200)]);
    expect(winners).to.deep.equal(Array(3).fill(ethers.ZeroAddress));
  });

  it("rejects bad pool parameters", async () => {
    const { vault, deadline } = await loadFixture(deploy);
    await expect(vault.createPool("x", "", [], deadline)).to.be.revertedWithCustomError(vault, "NoSlots");
    await expect(vault.createPool("x", "", [0], deadline)).to.be.revertedWithCustomError(vault, "ZeroAmount");
    await expect(vault.createPool("x", "", [1], await time.latest())).to.be.revertedWithCustomError(vault, "BadDeadline");
    await expect(vault.createPool("x", "", [1], deadline + 400 * 24 * 3600)).to.be.revertedWithCustomError(vault, "BadDeadline");
    await expect(vault.createPool("x", "", Array(101).fill(1), deadline)).to.be.revertedWithCustomError(vault, "TooManySlots");
  });

  it("pays winners directly and only once per slot", async () => {
    const { vault, usdc, alice, bob } = await loadFixture(withPool);
    await expect(vault.award(0, 0, alice.address)).to.emit(vault, "SlotAwarded").withArgs(0, 0, alice.address, usd(500));
    expect(await usdc.balanceOf(alice.address)).to.equal(usd(500));
    await expect(vault.award(0, 0, bob.address)).to.be.revertedWithCustomError(vault, "SlotTaken");
    await vault.award(0, 2, bob.address);
    const [pool, , winners] = await vault.getPool(0);
    expect(pool.paid).to.equal(usd(700));
    expect(winners).to.deep.equal([alice.address, ethers.ZeroAddress, bob.address]);
  });

  it("guards award()", async () => {
    const { vault, organizer, alice, stranger } = await loadFixture(withPool);
    await expect(vault.connect(stranger).award(0, 0, alice.address)).to.be.revertedWithCustomError(vault, "NotOrganizer");
    await expect(vault.award(0, 3, alice.address)).to.be.revertedWithCustomError(vault, "BadSlot");
    await expect(vault.award(0, 0, organizer.address)).to.be.revertedWithCustomError(vault, "BadWinner");
    await expect(vault.award(0, 0, ethers.ZeroAddress)).to.be.revertedWithCustomError(vault, "BadWinner");
  });

  it("refunds only the unawarded remainder, only after the deadline, only once", async () => {
    const { vault, usdc, organizer, alice, deadline } = await loadFixture(withPool);
    await vault.award(0, 0, alice.address);
    await expect(vault.refundUnawarded(0)).to.be.revertedWithCustomError(vault, "DeadlineNotReached");

    await time.increaseTo(deadline + 1);
    await expect(vault.award(0, 1, alice.address)).to.be.revertedWithCustomError(vault, "DeadlinePassed");

    const before = await usdc.balanceOf(organizer.address);
    await expect(vault.refundUnawarded(0)).to.emit(vault, "PoolRefunded").withArgs(0, organizer.address, usd(500));
    expect((await usdc.balanceOf(organizer.address)) - before).to.equal(usd(500));
    expect(await usdc.balanceOf(vault.target)).to.equal(0);
    await expect(vault.refundUnawarded(0)).to.be.revertedWithCustomError(vault, "AlreadyRefunded");
  });

  it("keeps pools isolated", async () => {
    const { vault, usdc, alice, deadline } = await loadFixture(withPool);
    await vault.createPool("Second", "", [usd(50)], deadline);
    await vault.award(1, 0, alice.address);
    expect(await vault.poolCount()).to.equal(2);
    expect(await usdc.balanceOf(vault.target)).to.equal(usd(1000));
  });
});
