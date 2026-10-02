// Deploys PrizeVault against Arc's USDC ERC-20 interface.
//   PRIVATE_KEY=0x... npx hardhat run scripts/deploy.js --network arc
const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");

const ARC_USDC = "0x3600000000000000000000000000000000000000";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying from ${deployer.address} on ${network.name}`);

  const vault = await ethers.deployContract("PrizeVault", [ARC_USDC]);
  await vault.waitForDeployment();
  const address = await vault.getAddress();
  console.log(`PrizeVault: ${address}`);

  const configPath = path.join(__dirname, "..", "web", "config.js");
  const config = fs.readFileSync(configPath, "utf8").replace(/VAULT_ADDRESS = "[^"]*"/, `VAULT_ADDRESS = "${address}"`);
  fs.writeFileSync(configPath, config);
  console.log("Wrote address to web/config.js");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
