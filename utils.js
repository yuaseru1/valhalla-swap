import { useState, useEffect } from "react";
import Router from "next/router";
export * from "./chain";

export const nativeAsset = "THOR.RUNE";
const stablePoolAsset = "ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48";

export function newAtom(v) {
  return { v, l: [] };
}
export function getAtom(a) {
  return a.v;
}
export function setAtom(a, v) {
  a.v = v;
  a.l.forEach((l) => l());
}
export function useAtom(a) {
  const [v, setV] = useState(getAtom(a));
  useEffect(() => {
    const l = () => setV(getAtom(a));
    a.l.push(l);
    return () => a.l.splice(a.l.indexOf(l), 1);
  }, [a]);
  return [v, (nv) => setAtom(a, nv)];
}

export const walletsAtom = newAtom([]);
export const phraseAtom = newAtom("");
if (global.window) {
  window.walletsAtom = walletsAtom;
}

export const tokenIcons = {
  "MAYA.CACAO": "/tokens/cacao.png",
  "THOR.RUNE": "/tokens/rune.png",
  "BTC.BTC": "/tokens/btc.png",
  "ETH.ETH": "/tokens/eth.png",
  "LTC.LTC": "/tokens/ltc.png",
  "BCH.BCH": "/tokens/bch.png",
  "BNB.BNB": "/tokens/bnb.svg",
  "DOGE.DOGE": "/tokens/doge.png",
  "GAIA.ATOM": "/tokens/atom.svg",
  "AVAX.AVAX": "/tokens/avax.svg",
  "ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48": "/tokens/usdc.png",
  "ETH.USDT-0XDAC17F958D2EE523A2206206994597C13D831EC7": "/tokens/usdt.png",
};

export const dummyDestinations = {
  BTC: "bc1qdvxpt06ulfk5gm5p52wa4mrt6e887wkmvc4xxw",
  ETH: "0x4E71F9debEC9117F1FACc7eeB490758AF45806A7",
  THOR: "thor1505gp5h48zd24uexrfgka70fg8ccedafsnj0e3",
  MAYA: "maya1fn9vhzyl3e63ewgwqk806k9hqezrcflznlq8u9",
};

export const DISPLAY_DECIMALS = {
  "ETH.ETH": 3,
  "BTC.BTC": 4,
  "ETH/ETH": 3,
  "BTC/BTC": 4,
};

export function getAssetChain(asset) {
  if (!asset) return "";
  if (asset.includes("/")) {
    return "THOR";
  }
  return asset.split(".")[0];
}

export function getAssetChainName(asset) {
  const chainNames = { BTC: "Bitcoin", ETH: "Ethereum", THOR: "Thorchain" };
  return chainNames[getAssetChain(asset)] || "?";
}

export function getAssetName(asset) {
  if (!asset) return "";
  if (asset.includes("/")) {
    return "s" + asset.split("/")[1].split("-")[0];
  }
  return asset.split(".")[1].split("-")[0];
}

export function formatDatetime(d) {
  d = new Date(d);
  if (d.getTime() === 0) return "-";
  const pad = (s) => ("0" + s).slice(-2);
  return [
    d.getFullYear() + "-",
    pad(d.getMonth() + 1) + "-",
    pad(d.getDate()) + " ",
    pad(d.getHours()) + ":",
    pad(d.getMinutes()),
  ].join("");
}

export function formatAddress(a) {
  if (!a) return "-";
  return a.slice(0, 6) + "…" + a.slice(-5);
}

export function formatNumber(n, decimals = 2, size = 8) {
  if (typeof n === "string") {
    n = parseInt(n) / 1e8;
  }
  if (typeof n === "bigint") {
    n = parseInt(n.toString()) / 10 ** size;
  }
  n = parseFloat(n);
  let suffix = "";
  if (n > 1000000) {
    n = n / 1000000;
    suffix = "M";
  } else if (n > 100000) {
    n = n / 1000;
    suffix = "K";
  }
  return (
    new Intl.NumberFormat("en-US", {
      useGrouping: "always",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(n) + suffix
  );
}

export function formatAddressLink(address, asset = "") {
  const chain = getAssetChain(asset);
  switch (chain) {
    case "MAYA":
      return "https://www.explorer.mayachain.info/address/" + address;
    case "THOR":
      return "https://thorchain.net/address/" + address;
    case "ETH":
      return "https://etherscan.io/address/" + address;
    case "BTC":
      return "https://mempool.space/address/" + address;
    default:
      return "#" + address;
  }
}

export function formatExplorerLink(hash, asset = "") {
  const chain = getAssetChain(asset);
  switch (chain) {
    case "MAYA":
      return "https://www.explorer.mayachain.info/tx/" + hash;
    case "THOR":
      return "https://thorchain.net/tx/" + hash;
    case "ETH":
      return "https://etherscan.io/tx/" + hash;
    case "BTC":
      return "https://mempool.space/tx/" + hash;
    default:
      return "#" + hash;
  }
}

export async function apiRequest(path) {
  return await (await fetch("https://midgard.thorswap.net/v2" + path)).json();
}
export async function nodeRequest(path) {
  return await (
    await fetch("https://thornode.ninerealms.com/thorchain" + path)
  ).json();
}

export function getSwapOutput(a, pool, toRune) {
  const X = parseFloat(toRune ? pool.assetDepth : pool.runeDepth) / 1e8;
  const Y = parseFloat(toRune ? pool.runeDepth : pool.assetDepth) / 1e8;
  return (a * X * Y) / (a + X) ** 2;
}

export function getDoubleSwapOutput(a, pool1, pool2) {
  return getSwapOutput(getSwapOutput(a, pool1, true), pool2, false);
}

export function getAnySwapOutput(a, pool1, pool2) {
  if (pool1.asset == nativeAsset) {
    return getSwapOutput(a, pool2, false);
  } else if (pool2.asset == nativeAsset) {
    return getSwapOutput(a, pool1, true);
  } else {
    return getDoubleSwapOutput(a, pool1, pool2);
  }
}

export async function fetchPools() {
  const apiPools = await apiRequest("/pools");
  let pools = await nodeRequest("/pools");
  pools = pools.filter((p) => p.status === "Available");
  pools = pools.map((p) => ({
    asset: p.asset,
    balanceAsset: parseInt(p.balance_asset) / 1e8,
    balanceNative: parseInt(p.balance_rune) / 1e8,
    units: parseInt(p.pool_units),
  }));
  pools.sort((a, b) => b.balanceNative - a.balanceNative);
  const usd = pools.find((p) => p.asset === stablePoolAsset);
  const nativePrice = usd.balanceAsset / usd.balanceNative;
  pools = pools.map((p) => {
    const apiPool = apiPools.find((p2) => p2.asset === p.asset);
    return {
      ...p,
      tvl: p.balanceNative * 2 * nativePrice,
      price: (p.balanceNative * nativePrice) / p.balanceAsset,
      volume: (parseInt(apiPool.volume24h) / 1e10) * nativePrice,
      apr: parseFloat(apiPool.poolAPY),
    };
  });
  pools = pools.concat({ asset: nativeAsset, price: nativePrice });
  console.log("pools", pools);
  return pools;
}

export async function walletSwap({
  wallets,
  amount,
  assetIn,
  assetOut,
  minAmountOut,
}) {
  const start = Date.now();
  const chainIn = getAssetChain(assetIn);
  const chainOut = getAssetChain(assetOut);
  const walletIn = wallets.find((w) => w.chain === chainIn);
  const walletOut = wallets.find((w) => w.chain === chainOut);
  if (!walletIn) throw new Error("No wallet connected for the from asset");
  if (!walletOut) throw new Error("No wallet connected for the to asset");
  const inAmount = (parseFloat(amount) * 1e8).toFixed(0);
  const outAmount = (minAmountOut * 1e8).toFixed(0);
  const txHash = await walletIn.deposit({
    amount: amount,
    memo: `=:${assetOut}:${walletOut.address}`, // TODO include min amount out once it accounts for fees
    asset: assetIn, // On ETH, other tokens can be sent than the native currency
  });
  console.log("swap", txHash);
  Router.push(
    `/progress?hash=${txHash}&from=${walletIn.address}&in=${assetIn}&out=${assetOut}&ina=${inAmount}&outa=${outAmount}&start=${start}`
  );
}
