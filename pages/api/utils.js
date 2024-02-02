export const assets = [
  "BTC.BTC",
  "THOR.RUNE",
  "ETH.ETH",
  "ETH.AAVE-0X7FC66500C84A76AD7E9C93437BFC5AC33E2DDAE9",
];

export const bridges = [
  {
    type: "bridge",
    id: "thorchain",
    name: "Thorchain",
    assets: [
      "BTC.BTC",
      "THOR.RUNE",
      "ETH.ETH",
      "ETH.AAVE-0X7FC66500C84A76AD7E9C93437BFC5AC33E2DDAE9",
    ],
  },
];

export const dexes = [
  {
    type: "dex",
    id: "uniswapv2",
    name: "Uniswap V2",
    assets: ["ETH.ETH", "ETH.AAVE-0X7FC66500C84A76AD7E9C93437BFC5AC33E2DDAE9"],
  },
];

export function getSwapOutput(a, pool, toRune) {
  const X = parseFloat(toRune ? pool.balance_asset : pool.balance_rune) / 1e8;
  const Y = parseFloat(toRune ? pool.balance_rune : pool.balance_asset) / 1e8;
  return (a * X * Y) / (a + X) ** 2;
}

export function getDoubleSwapOutput(a, pool1, pool2) {
  return getSwapOutput(getSwapOutput(a, pool1, true), pool2, false);
}

export function getAnySwapOutput(nativeAsset, a, pool1, pool2) {
  if (pool1.asset == nativeAsset) {
    return getSwapOutput(a, pool2, false);
  } else if (pool2.asset == nativeAsset) {
    return getSwapOutput(a, pool1, true);
  } else {
    return getDoubleSwapOutput(a, pool1, pool2);
  }
}

let thorchainPoolsCache;
async function thorchainPools() {
  if (thorchainPoolsCache) return thorchainPoolsCache;
  thorchainPoolsCache = (
    await (
      await fetch("https://thornode.ninerealms.com/thorchain/pools")
    ).json()
  ).reduce((a, p) => {
    a[p.asset] = p;
    return a;
  }, {});
  thorchainPoolsCache["THOR.RUNE"] = { asset: "THOR.RUNE" };
  return thorchainPoolsCache;
}

export async function quote(connection, inputAsset, outputAsset, amount) {
  switch (connection.toLowerCase()) {
    case "thorchain":
      const pools = await thorchainPools();
      return getAnySwapOutput(
        "THOR.RUNE",
        amount,
        pools[inputAsset],
        pools[outputAsset]
      );
    case "uniswapv2":
      if (inputAsset == "ETH.ETH")
        inputAsset = "-0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
      if (outputAsset == "ETH.ETH")
        outputAsset = "-0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
      let token0 = inputAsset.split("-")[1].toLowerCase();
      let token1 = outputAsset.split("-")[1].toLowerCase();
      let inverse = false;
      if (token0 > token1) {
        inverse = true;
        const tmp = token0;
        token0 = token1;
        token1 = tmp;
      }
      const {
        data: {
          pairs: [pair],
        },
      } = await (
        await fetch(
          "https://api.thegraph.com/subgraphs/name/ianlapham/uniswap-v2-dev",
          {
            body: JSON.stringify({
              query: `{pairs(where:{token0:"${token0}",token1:"${token1}"}){\nid\nreserve0\nreserve1\n}}`,
            }),
            method: "POST",
            mode: "cors",
          }
        )
      ).json();
      if (!pair) return 0;
      if (!inverse) {
        return (amount * pair.reserve1) / pair.reserve0;
      } else {
        return (amount * pair.reserve0) / pair.reserve1;
      }
    default:
      throw new Error("Unknown connection: " + connection);
  }
}
