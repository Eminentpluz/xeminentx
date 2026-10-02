require("@nomicfoundation/hardhat-toolbox");
const { subtask } = require("hardhat/config");
const { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } = require("hardhat/builtin-tasks/task-names");

// Use the solc-js build from npm so compiling works where binaries.soliditylang.org is unreachable.
subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD, async ({ solcVersion }, hre, runSuper) => {
  if (solcVersion !== "0.8.24") return runSuper();
  return {
    compilerPath: require.resolve("solc/soljson.js"),
    isSolcJs: true,
    version: solcVersion,
    longVersion: require("solc/package.json").version,
  };
});

const accounts = process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [];

module.exports = {
  solidity: { version: "0.8.24", settings: { optimizer: { enabled: true, runs: 200 } } },
  networks: {
    arc: { url: process.env.ARC_RPC_URL || "https://rpc.mainnet.arc.io", chainId: 5042, accounts },
    arcTestnet: { url: process.env.ARC_TESTNET_RPC_URL || "https://rpc.testnet.arc.network", chainId: 5042002, accounts },
  },
};
