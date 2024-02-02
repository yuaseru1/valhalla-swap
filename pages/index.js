import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Image from "next/image";
import Icon from "../components/icon";
import Layout from "../components/layout";
import { assets } from "./api/utils";
import {
  nativeAsset,
  formatNumber,
  tokenIcons,
  apiRequest,
  nodeRequest,
  dummyDestinations,
  getAssetChain,
  getAssetChainName,
  getAssetName,
  useAtom,
  getAtom,
  walletsAtom,
  fetchPools,
  walletSwap,
  DISPLAY_DECIMALS,
  CLIENTS,
  CHAINS_NATIVE_ASSET,
} from "../utils";

// TODO fetch
const prices = {
  "BTC.BTC": 43013,
  "THOR.RUNE": 4.51,
  "ETH.ETH": 2304,
  "ETH.AAVE-0X7FC66500C84A76AD7E9C93437BFC5AC33E2DDAE9": 85.22,
};

export default function Swap() {
  const router = useRouter();
  const [wallets] = useAtom(walletsAtom);
  const [modal, setModal] = useState();
  const [pools, setPools] = useState();
  const [assetIn, setAssetIn] = useState();
  const [assetOut, setAssetOut] = useState();
  const [amount, setAmount] = useState("");
  const [balances, setBalances] = useState({});
  const [quote, setQuote] = useState();
  const [loading, setLoading] = useState(false);
  const assetPrices = {};
  if (pools) pools.forEach((p) => (assetPrices[p.asset] = p.price));

  let valueIn = 0;
  let amountOut = 0;
  let valueOut = 0;
  try {
    valueIn = parseFloat(amount) * prices[assetIn];
    if (Number.isNaN(valueIn)) valueIn = 0;
    if (quote) {
      amountOut = quote.out;
      valueOut = amountOut * prices[assetOut];
    }
  } catch (e) {
    console.error("calc", e);
  }

  useEffect(() => {
    (async () => {
      if (!assetIn || !assetOut) return;
      router.replace(`/?in=${assetIn}&out=${assetOut}&amount=${amount}`);
      if (isNaN(parseFloat(amount))) return setQuote();
      const amountF = parseFloat(amount);
      const amountStr = amountF.toFixed(8);
      const quote = await (
        await fetch(
          `/api/quote?in=${assetIn}&out=${assetOut}&amount=${amountStr}`
        )
      ).json();
      setQuote(quote);
    })();
  }, [assetIn, assetOut, amount]);

  useEffect(() => {
    if (!router.isReady) return;
    if (router.query.amount) setAmount(router.query.amount);
    (async () => {
      let pools = await fetchPools();
      for (let pool of [...pools]) {
        if (pool.asset === nativeAsset) continue;
        pools = pools.concat([
          {
            ...pool,
            asset: pool.asset.replace(".", "/"),
          },
        ]);
      }
      setAssetIn(router.query.in || "BTC.BTC");
      setAssetOut(router.query.out || nativeAsset);
      setPools(pools);
    })();
  }, [router.isReady]);

  useEffect(() => {
    for (let w of wallets) {
      CLIENTS[w.chain].balances(w.address, pools).then((b) =>
        b.forEach((b) => {
          setBalances((bs) => ({ ...bs, [b.asset]: b.balance }));
        })
      );
    }
  }, [wallets]);

  async function onSubmit() {
    try {
      setLoading(true);
      if (!assetIn || !assetOut) {
        throw new Error("Select a from and to asset first");
      }
      if (!quote) {
        throw new Error("Need a valid quote to swap");
      }
      await walletSwap({
        wallets,
        amount,
        assetIn: assetIn,
        assetOut: assetOut,
        minAmountOut: amountOut * 0.99,
      });
    } catch (e) {
      setLoading(false);
      console.error(e);
      alert(e.message);
    }
  }

  function onSelect(p) {
    if (modal.target == "in") {
      setAssetIn(p);
    } else if (modal.target == "out") {
      setAssetOut(p);
    }
    setModal();
  }

  function onSwapDirection() {
    setAssetIn(assetOut);
    setAssetOut(assetIn);
  }

  if (!pools || !assetIn || !assetOut) {
    return (
      <Layout title="Swap">
        <div className="container">
          <div style={{ padding: 60, textAlign: "center" }}>Loading...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Swap">
      <div className="container">
        {quote && quote.error ? (
          <div className="alert mb-4">{quote.error}</div>
        ) : null}

        <div style={{ position: "relative" }}>
          <div className="swap-swap-direction" onClick={onSwapDirection}>
            <Icon name="arrow-down" />
          </div>

          <div className="section swap-side">
            <div className="swap-amount">
              <input
                className="swap-amount-input"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
              />
              <div className="swap-amount-value">$ {formatNumber(valueIn)}</div>
            </div>
            <div className="swap-token">
              <div
                className="swap-token-input"
                onClick={() => setModal({ type: "selectToken", target: "in" })}
              >
                <div className="swap-token-input-icon">
                  {tokenIcons[assetIn.replace("/", ".")] ? (
                    <img src={tokenIcons[assetIn.replace("/", ".")]} />
                  ) : (
                    <div className="swap-token-input-icon-unknown">
                      {getAssetName(assetIn)[0]}
                    </div>
                  )}
                </div>
                <div className="swap-token-input-name">
                  {getAssetName(assetIn)}
                </div>
                <div className="swap-token-input-chevron">
                  <Icon name="chevronDown" />
                </div>
              </div>
              <div className="swap-amount-value text-right">
                Balance:{" "}
                {formatNumber(
                  balances[assetIn] || 0,
                  DISPLAY_DECIMALS[assetIn]
                )}
              </div>
            </div>
          </div>

          <div className="section swap-side">
            <div className="swap-amount">
              <input
                className="swap-amount-input"
                value={
                  amountOut > 0
                    ? formatNumber(amountOut, DISPLAY_DECIMALS[assetOut])
                    : ""
                }
                readOnly
                placeholder="0"
              />
              <div className="swap-amount-value">
                $ {formatNumber(valueOut)}
              </div>
            </div>
            <div className="swap-token">
              <div
                className="swap-token-input"
                onClick={() => setModal({ type: "selectToken", target: "out" })}
              >
                <div className="swap-token-input-icon">
                  {tokenIcons[assetOut.replace("/", ".")] ? (
                    <img src={tokenIcons[assetOut.replace("/", ".")]} />
                  ) : (
                    <div className="swap-token-input-icon-unknown">
                      {getAssetName(assetOut)[0]}
                    </div>
                  )}
                </div>
                <div className="swap-token-input-name">
                  {getAssetName(assetOut)}
                </div>
                <div className="swap-token-input-chevron">
                  <Icon name="chevronDown" />
                </div>
              </div>
              <div className="swap-amount-value text-right">
                Balance:{" "}
                {formatNumber(
                  balances[assetOut] || 0,
                  DISPLAY_DECIMALS[assetOut]
                )}
              </div>
            </div>
          </div>
        </div>

        {quote && !quote.error ? (
          <>
            <div className="flex mb-2">
              <div className="flex-1 text-faded">Slippages + Fees</div>
              <div>
                ${formatNumber(valueIn - valueOut, 2)} (
                {formatNumber(((valueIn - valueOut) / valueIn) * 100, 2)}%)
              </div>
            </div>
            <div className="mb-2">
              <b>Best route</b>
            </div>
            {quote.routes[0].swaps.map((s, i) => (
              <div key={i}>
                <div className="flex mb-2">
                  <div className="flex-1 text-faded">
                    {s.connection.type == "bridge" ? "Bridging" : "Swapping"}{" "}
                    with {s.connection.name}
                  </div>
                  <div>
                    {formatNumber(s.inputAmount)} {getAssetName(s.input)} &rarr;{" "}
                    {formatNumber(s.outputAmount)} {getAssetName(s.output)}
                  </div>
                </div>
              </div>
            ))}
          </>
        ) : null}

        <button
          className="button button-large"
          style={{ width: "100%", opacity: loading ? "0.6" : "1" }}
          disabled={loading}
          onClick={onSubmit}
        >
          {loading ? "Signing & sending..." : "Swap"}
        </button>
      </div>

      {modal && modal.type == "selectToken" ? (
        <div className="modal" onClick={() => setModal()}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h1 className="modal-title">Select a token</h1>
            {assets.map((a) => (
              <div
                className="pool pool-modal"
                key={a}
                onClick={onSelect.bind(null, a)}
              >
                <div
                  className={`pool-icon ${
                    a.includes("/") ? "pool-icon-synth" : ""
                  }`}
                >
                  {tokenIcons[a.replace("/", ".")] ? (
                    <img src={tokenIcons[a.replace("/", ".")]} />
                  ) : (
                    <div className="pool-icon-unknown">
                      {getAssetName(a)[0]}
                    </div>
                  )}
                </div>
                <div className="pool-name">
                  {getAssetName(a)} <br />
                  <small className="text-faded">{getAssetChainName(a)}</small>
                </div>
                <div className="text-right">
                  {formatNumber(balances[a] || 0, DISPLAY_DECIMALS[a])}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </Layout>
  );
}
