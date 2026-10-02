// Filled in by scripts/deploy.js.
export const VAULT_ADDRESS = "";

export const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";

export const ARC = {
  id: 5042,
  name: "Arc",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.arc.io"] } },
  blockExplorers: { default: { name: "Arc Explorer", url: "https://explorer.arc.io" } },
};
