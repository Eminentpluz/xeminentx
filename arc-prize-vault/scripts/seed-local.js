// Local demo: mock USDC + vault + a few pools in different states. Prints a URL query string.
//   npx hardhat node &   npx hardhat run scripts/seed-local.js --network localhost
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

async function main() {
  const [org, a, b, c] = await ethers.getSigners();
  const usd = (n) => ethers.parseUnits(String(n), 6);
  const usdc = await ethers.deployContract("MockUSDC");
  const vault = await ethers.deployContract("PrizeVault", [usdc.target]);
  await usdc.mint(org.address, usd(100_000));
  await usdc.approve(vault.target, ethers.MaxUint256);
  const now = await time.latest();

  await vault.createPool("Expired Sprint", "https://example.com/expired", [usd(1000), usd(500)], now + 3600);
  await vault.award(0, 0, a.address);
  await time.increase(7200);
  await vault.createPool("October Builder Sprint", "https://example.com/october", [usd(5000), usd(2500), usd(1000), usd(500), usd(500)], now + 30 * 86400);
  await vault.award(1, 0, b.address);
  await vault.award(1, 3, c.address);

  console.log(`?rpc=http://127.0.0.1:8545&chain=31337&vault=${vault.target}&usdc=${usdc.target}`);
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
