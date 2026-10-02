import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseAbi,
  parseUnits,
  formatUnits,
  isAddress,
  getAddress,
} from "./vendor/viem.js";
import { VAULT_ADDRESS, USDC_ADDRESS, ARC } from "./config.js";

// ?rpc=&chain=&vault=&usdc= let you point the page at a local node for testing.
const q = new URLSearchParams(location.search);
const chain = q.get("rpc")
  ? { ...ARC, id: Number(q.get("chain") || 31337), name: "Local", rpcUrls: { default: { http: [q.get("rpc")] } }, blockExplorers: undefined }
  : ARC;
const vaultAddress = q.get("vault") || VAULT_ADDRESS;
const usdcAddress = q.get("usdc") || USDC_ADDRESS;

const vaultAbi = parseAbi([
  "struct Pool { address organizer; uint64 awardDeadline; bool refunded; uint256 total; uint256 paid; string name; string url; }",
  "function poolCount() view returns (uint256)",
  "function getPool(uint256) view returns (Pool pool, uint256[] slotAmounts, address[] slotWinners)",
  "function createPool(string name, string url, uint256[] slotAmounts, uint64 awardDeadline) returns (uint256)",
  "function award(uint256 poolId, uint256 slot, address winner)",
  "function refundUnawarded(uint256 poolId)",
]);
const usdcAbi = parseAbi([
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
]);

const ZERO = "0x0000000000000000000000000000000000000000";
const pub = createPublicClient({ chain, transport: http() });
let wallet;
let account;

const $ = (sel) => document.querySelector(sel);
const usd = (v) => "$" + Number(formatUnits(v, 6)).toLocaleString(undefined, { maximumFractionDigits: 2 });
const short = (a) => a.slice(0, 6) + "…" + a.slice(-4);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const addrLink = (a) => {
  const base = chain.blockExplorers?.default.url;
  return base ? `<a href="${base}/address/${a}" target="_blank" rel="noopener">${short(a)}</a>` : `<code>${short(a)}</code>`;
};

function toast(msg, kind = "") {
  const el = $("#toast");
  el.textContent = msg;
  el.className = "toast show " + kind;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (el.className = "toast"), 6000);
}

async function connect() {
  if (!window.ethereum) return toast("No wallet found. Install MetaMask or Rabby.", "err");
  wallet = createWalletClient({ chain, transport: custom(window.ethereum) });
  [account] = await wallet.requestAddresses();
  try {
    await wallet.switchChain({ id: chain.id });
  } catch {
    await wallet.addChain({ chain });
  }
  $("#connect").textContent = short(account);
  render();
}

async function send(label, request) {
  toast(`${label}: confirm in your wallet…`);
  const hash = await wallet.writeContract({ ...request, account, chain });
  toast(`${label}: waiting for confirmation…`);
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`${label} reverted`);
  toast(`${label}: done`, "ok");
}

async function createPool(e) {
  e.preventDefault();
  if (!account) return toast("Connect a wallet first.", "err");
  const f = new FormData(e.target);
  try {
    const slots = String(f.get("slots"))
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((s) => parseUnits(s.replace(/[$_]/g, ""), 6));
    if (!slots.length) throw new Error("Add at least one slot amount");
    const total = slots.reduce((a, b) => a + b, 0n);
    const deadline = BigInt(Math.floor(new Date(String(f.get("deadline"))).getTime() / 1000));

    const allowance = await pub.readContract({ address: usdcAddress, abi: usdcAbi, functionName: "allowance", args: [account, vaultAddress] });
    if (allowance < total) {
      await send("Approve USDC", { address: usdcAddress, abi: usdcAbi, functionName: "approve", args: [vaultAddress, total] });
    }
    await send("Lock prize pool", {
      address: vaultAddress,
      abi: vaultAbi,
      functionName: "createPool",
      args: [String(f.get("name")), String(f.get("url")), slots, deadline],
    });
    e.target.reset();
    defaultDeadline();
    render();
  } catch (err) {
    toast(err.shortMessage || err.message, "err");
  }
}

async function onPoolAction(e) {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const id = BigInt(btn.dataset.pool);
  try {
    if (btn.dataset.action === "award") {
      const input = btn.parentElement.querySelector("input");
      if (!isAddress(input.value.trim())) throw new Error("Enter a valid winner address");
      await send("Award slot", {
        address: vaultAddress,
        abi: vaultAbi,
        functionName: "award",
        args: [id, BigInt(btn.dataset.slot), getAddress(input.value.trim())],
      });
    } else if (btn.dataset.action === "refund") {
      await send("Refund", { address: vaultAddress, abi: vaultAbi, functionName: "refundUnawarded", args: [id] });
    }
    render();
  } catch (err) {
    toast(err.shortMessage || err.message, "err");
  }
}

function poolCard(id, pool, amounts, winners, now) {
  const open = now <= Number(pool.awardDeadline);
  const mine = account && pool.organizer.toLowerCase() === account.toLowerCase();
  const left = pool.total - pool.paid;
  const awarded = winners.filter((w) => w !== ZERO).length;
  const status = pool.refunded ? ["Closed", "muted"] : open ? ["Escrowed", "ok"] : ["Awaiting refund", "warn"];
  const deadline = new Date(Number(pool.awardDeadline) * 1000).toLocaleString();
  const safeUrl = /^https?:\/\//i.test(pool.url) ? pool.url : "";

  const rows = amounts
    .map((amt, i) => {
      const w = winners[i];
      const cell =
        w !== ZERO
          ? `<span class="paid">Paid → ${addrLink(w)}</span>`
          : mine && open
            ? `<span class="award"><input placeholder="0x winner" aria-label="Winner for slot ${i + 1}"><button data-action="award" data-pool="${id}" data-slot="${i}">Pay</button></span>`
            : `<span class="muted">${pool.refunded ? "Refunded" : "Unawarded"}</span>`;
      return `<li><span class="slot">#${i + 1}</span><span class="amt">${usd(amt)}</span>${cell}</li>`;
    })
    .join("");

  return `<article class="pool">
    <header>
      <div>
        <h3>${esc(pool.name || "Untitled pool")}</h3>
        ${safeUrl ? `<a class="link" href="${esc(safeUrl)}" target="_blank" rel="noopener">${esc(safeUrl)}</a>` : ""}
      </div>
      <span class="badge ${status[1]}">${status[0]}</span>
    </header>
    <dl class="stats">
      <div><dt>Locked</dt><dd>${usd(pool.total)}</dd></div>
      <div><dt>Paid out</dt><dd>${usd(pool.paid)}</dd></div>
      <div><dt>Still in escrow</dt><dd>${usd(pool.refunded ? 0n : left)}</dd></div>
      <div><dt>Slots awarded</dt><dd>${awarded} / ${amounts.length}</dd></div>
    </dl>
    <p class="meta">Organizer ${addrLink(pool.organizer)} · award deadline ${deadline}</p>
    <ol class="slots">${rows}</ol>
    ${mine && !open && !pool.refunded ? `<button class="ghost" data-action="refund" data-pool="${id}">Refund ${usd(left)} unawarded</button>` : ""}
  </article>`;
}

async function render() {
  const list = $("#pools");
  if (!vaultAddress) {
    list.innerHTML = `<p class="empty">Vault not deployed yet. Run <code>scripts/deploy.js</code>.</p>`;
    return;
  }
  try {
    // Judge deadlines by chain time, like the contract does, not the viewer's clock.
    const [count, block] = await Promise.all([
      pub.readContract({ address: vaultAddress, abi: vaultAbi, functionName: "poolCount" }),
      pub.getBlock(),
    ]);
    const now = Number(block.timestamp);
    const ids = [...Array(Number(count)).keys()].reverse();
    const pools = await Promise.all(
      ids.map((i) => pub.readContract({ address: vaultAddress, abi: vaultAbi, functionName: "getPool", args: [BigInt(i)] })),
    );
    const locked = pools.reduce((s, [p]) => s + (p.refunded ? 0n : p.total - p.paid), 0n);
    const paid = pools.reduce((s, [p]) => s + p.paid, 0n);
    $("#tvl").textContent = usd(locked);
    $("#paid").textContent = usd(paid);
    $("#count").textContent = String(count);
    list.innerHTML = pools.length
      ? pools.map(([p, a, w], k) => poolCard(ids[k], p, a, w, now)).join("")
      : `<p class="empty">No prize pools yet. Be the first organizer to prove the money is real.</p>`;
  } catch (err) {
    list.innerHTML = `<p class="empty">Couldn't reach the chain: ${esc(err.shortMessage || err.message)}</p>`;
  }
}

$("#connect").addEventListener("click", connect);
$("#create").addEventListener("submit", createPool);
$("#pools").addEventListener("click", onPoolAction);
$("#vault").innerHTML = vaultAddress ? addrLink(vaultAddress) : "not deployed";
function defaultDeadline() {
  const d = new Date(Date.now() + 14 * 864e5);
  $("#create [name=deadline]").value = new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
}
defaultDeadline();
render();
