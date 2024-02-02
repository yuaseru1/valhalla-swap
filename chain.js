import {
  JsonRpcProvider,
  Wallet,
  Contract,
  toUtf8Bytes,
  parseUnits,
  formatUnits,
  MaxUint256,
} from "ethers";
import * as ecc from "tiny-secp256k1";
import BIP32Factory from "bip32";
import stringify from "json-stable-stringify";
import createHash from "create-hash";
import createHmac from "create-hmac";
import { getSeed } from "@xchainjs/xchain-crypto";
import { bech32 } from "bech32";
import * as btc from "@scure/btc-signer";

const ethRpcUrl = "https://eth.llamarpc.com";
const mayanodeEndpoint = "https://mayanode.mayachain.info";

const bip32 = BIP32Factory(ecc);

function hash160(buffer) {
  const sha256Hash = createHash("sha256").update(buffer).digest();
  try {
    return createHash("rmd160").update(sha256Hash).digest();
  } catch (err) {
    return createHash("ripemd160").update(sha256Hash).digest();
  }
}

export const TOKENS_DECIMALS = {
  "0xdac17f958d2ee523a2206206994597c13d831ec7": 6,
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": 6,
};

export const CHAINS = ["MAYA", "THOR", "ETH", "BTC"];
export const CHAINS_NAMES = {
  MAYA: "Maya Chain",
  THOR: "THORChain",
  ETH: "Ethereum",
  BTC: "Bitcoin",
};
export const CHAINS_NATIVE_ASSET = {
  MAYA: "CACAO",
  THOR: "RUNE",
  ETH: "ETH",
  BTC: "BTC",
};

export class ThorchainClient {
  constructor(midgardUrl, asset) {
    this.midgardUrl = midgardUrl;
    this.asset = asset;
  }

  async balance(address) {
    const coins = (await this.request("/balance/" + address)).coins;
    const coin = coins.find((c) => c.asset === this.asset);
    if (!coin) return 0;
    return parseFloat(coin.amount) / (coin.asset === "CACAO" ? 1e10 : 1e8);
  }

  async balances(address, pools = []) {
    if (this.asset !== "CACAO") {
      return [{ asset: this.asset, balance: await this.balance(address) }];
    }
    const coins = (await this.request("/balance/" + address)).coins;
    return coins.map((c) => ({
      asset: c.asset.includes("/") ? c.asset : "MAYA." + c.asset,
      balance:
        parseFloat(c.amount) /
        (c.asset === "MAYA" ? 1e4 : c.asset === "CACAO" ? 1e10 : 1e8),
    }));
  }

  async request(path) {
    return await (await fetch(this.midgardUrl + "/v2" + path)).json();
  }
}

export class EthereumClient {
  constructor(rpcUrl) {
    this.provider = new JsonRpcProvider(rpcUrl);
  }

  async balance(address) {
    const b = await this.provider.getBalance(address);
    return parseFloat(formatUnits(b));
  }

  async balances(address, pools = []) {
    const balances = [
      { asset: "ETH.ETH", balance: await this.balance(address) },
    ];
    for (let pool of pools.filter(
      (p) => p.asset.startsWith("ETH.") && p.asset !== "ETH.ETH"
    )) {
      const token = "0x" + pool.asset.split("-")[1].slice(2).toLowerCase();
      const c = new Contract(
        token,
        [
          "function decimals() view returns (uint8)",
          "function balanceOf(address) view returns (uint)",
        ],
        this.provider
      );
      const d = await c.decimals();
      const b = await c.balanceOf(address);
      balances.push({
        asset: pool.asset,
        balance: parseFloat(formatUnits(b, d)),
      });
    }
    return balances;
  }
}

export class BitcoinClient {
  async balance(address) {
    const url = "https://blockchain.info";
    const b = await (await fetch(url + "/q/addressbalance/" + address)).text();
    return parseFloat(b) / 1e8;
  }

  async balances(address) {
    return [{ asset: "BTC.BTC", balance: await this.balance(address) }];
  }
}

export const CLIENTS = {
  MAYA: new ThorchainClient("https://midgard.mayachain.info", "CACAO"),
  THOR: new ThorchainClient("https://midgard.ninerealms.com", "THOR.RUNE"),
  ETH: new EthereumClient(ethRpcUrl),
  BTC: new BitcoinClient(),
};

export class KeystoreWallet {
  constructor(chain, mnemonic) {
    this.chain = chain;
    this.mnemonic = mnemonic;
    this.config = {
      MAYA: {
        networkId: 931,
        prefix: "maya",
        chainId: "mayachain-mainnet-v1",
        endpoint: mayanodeEndpoint,
      },
      THOR: {
        networkId: 931,
        prefix: "thor",
        chainId: "thorchain-mainnet-v1",
        endpoint: "https://thornode.ninerealms.com",
      },
    }[chain];
    if (chain === "ETH") {
      this.provider = new JsonRpcProvider(ethRpcUrl);
      this.signer = Wallet.fromPhrase(mnemonic, this.provider);
    }
    this.address = this.getAddress();
  }

  getAddress() {
    switch (this.chain) {
      case "THOR":
      case "MAYA":
        this.key = this.key || this.getKey(this.mnemonic);
        return bech32.encode(
          this.config.prefix,
          bech32.toWords(this.key.identifier)
        );
      case "ETH":
        return this.signer.address;
      case "BTC":
        this.key = this.key || this.getKey(this.mnemonic);
        return btc.getAddress("wpkh", this.key.privateKey);
    }
  }

  getKey(mnemonic) {
    const kp = bip32
      .fromSeed(getSeed(mnemonic))
      .derivePath(
        this.chain === "BTC"
          ? `84'/0'/0'/0/0`
          : `44'/${this.config.networkId}'/0'/0/0`
      );
    return {
      identifier: kp.identifier,
      publicKey: kp.publicKey,
      privateKey: kp.privateKey,
      keyPair: kp,
    };
  }

  async deposit({ amount, memo, asset }) {
    const inbounds = await (
      await fetch(mayanodeEndpoint + "/mayachain/inbound_addresses")
    ).json();
    switch (this.chain) {
      case "MAYA":
        return this.depositMayachain({ inbounds, amount, memo, asset });
      case "THOR":
        return this.depositThorchain({ inbounds, amount, memo, asset });
      case "ETH":
        return this.depositEthereum({ inbounds, amount, memo, asset });
      case "BTC":
        return this.depositBitcoin({ inbounds, amount, memo, asset });
    }
  }

  async depositMayachain({ amount, memo, asset }) {
    let assetName = asset || CHAINS_NATIVE_ASSET[this.chain];
    const amountStr = (
      parseFloat(amount) * (assetName === "MAYA.CACAO" ? 1e10 : 1e8)
    ).toFixed(0);
    return await this.signAndBroadcastMessages([
      {
        type: "mayachain/MsgDeposit",
        value: {
          coins: [{ asset: assetName, amount: amountStr }],
          memo: memo,
          signer: this.address,
        },
      },
    ]);
  }

  async depositThorchain({ inbounds, amount, memo, asset }) {
    const inbound = inbounds.find((i) => i.chain === this.chain);
    return this.transferCosmos({ to: inbound.address, amount, memo, asset });
  }

  async signAndBroadcastMessages(messages, memo = "") {
    const result = await fetch(
      this.config.endpoint + "/auth/accounts/" + this.address
    ).then((r) => r.json());
    const account = result.result.value;
    const tx = {
      msgs: messages,
      memo: memo,
      chain_id: this.config.chainId,
      sequence: account.sequence || "0",
      account_number: account.account_number,
      fee: { gas: "10000000", amount: [] },
    };
    const hash = createHash("sha256").update(stringify(tx)).digest();
    const signature = this.key.keyPair.sign(hash);
    const typedArrayToBase64 = (a) => btoa(String.fromCharCode.apply(null, a));
    const res = await fetch(this.config.endpoint + "/txs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "block",
        tx: {
          msg: messages,
          memo: memo,
          fee: { amount: [], gas: "10000000" },
          signatures: [
            {
              pub_key: {
                type: "tendermint/PubKeySecp256k1",
                value: typedArrayToBase64(this.key.publicKey),
              },
              signature: typedArrayToBase64(signature),
              sequence: account.sequence || "0",
              account_number: account.account_number,
            },
          ],
        },
      }),
    });
    if (!res.ok) {
      throw new Error(
        `Error got non 2xx response code ${res.statusCode}: ${await res.text()}`
      );
    }
    const body = await res.json();
    if (!body.logs) {
      throw new Error(
        "Error submiting transaction: " + (body.error || body.raw_log)
      );
    }
    return body.txhash;
  }

  async depositEthereum({ inbounds, amount, memo, asset = "" }) {
    const inbound = inbounds.find((i) => i.chain === "ETH");
    let tokenAddress = (asset.split("-")[1] || "").toLowerCase();
    if (!tokenAddress) {
      tokenAddress = "0x0000000000000000000000000000000000000000";
    }
    const contractToken = new Contract(
      tokenAddress,
      [
        "function decimals() view returns (uint8)",
        "function allowance(address owner, address spender) view returns (uint)",
        "function approve(address spender, uint value)",
      ],
      this.signer
    );
    const contract = new Contract(
      inbound.router,
      ["function deposit(address,address,uint,string)"],
      this.signer
    );
    let decimals = 18;
    if (asset !== "ETH.ETH") decimals = await contractToken.decimals();
    const n = parseUnits(amount, decimals);
    if (asset !== "ETH.ETH") {
      const allowance = await contractToken.allowance(
        this.address,
        inbound.router
      );
      if (allowance < n) {
        await (await contractToken.approve(inbound.router, MaxUint256)).wait();
      }
    }
    const tx = await contract.deposit(inbound.address, tokenAddress, n, memo, {
      value: asset === "ETH.ETH" ? n : 0,
    });
    return tx.hash;
  }

  async depositBitcoin({ inbounds, amount, memo, asset }) {
    const inbound = inbounds.find((i) => i.chain === "BTC");
    this.transferBitcoin({ to: inbound.address, amount, memo });
  }

  async transfer({ to, amount, asset }) {
    switch (this.chain) {
      case "MAYA":
        return this.transferCosmos({ to, amount, asset });
      case "THOR":
        return this.transferCosmos({ to, amount, asset });
      case "ETH":
        return this.transferEthereum({ to, amount, asset });
      case "BTC":
        return this.transferBitcoin({ to, amount, asset });
    }
  }

  async transferCosmos({ to, amount, asset, memo = "" }) {
    let assetName = (asset || CHAINS_NATIVE_ASSET[this.chain]).toLowerCase();
    if (assetName.startsWith("thor.") || assetName.startsWith("maya.")) {
      assetName = assetName.slice(5);
    }
    let decimals = 1e8;
    if (assetName === "maya") decimals = 1e4;
    if (assetName === "cacao") decimals = 1e10;
    const amountStr = (parseFloat(amount) * decimals).toFixed(0);
    const message = {
      type: `${this.chain === "MAYA" ? "mayachain" : "thorchain"}/MsgSend`,
      value: {
        amount: [
          {
            denom: assetName,
            amount: amountStr,
          },
        ],
        from_address: this.address,
        to_address: to,
      },
    };
    return await this.signAndBroadcastMessages([message], memo);
  }

  async transferEthereum({ to, amount, asset }) {
    if (asset === "ETH.ETH") {
      const value = parseUnits(amount, 18);
      const tx = await this.signer.sendTransaction({ to, value });
      return tx.hash;
    }
    const tokenContract = (asset.split("-")[1] || "").toLowerCase();
    const contract = new Contract(
      tokenContract,
      [
        "function decimals() view returns (uint8)",
        "function transfer(address,uint)",
      ],
      this.signer
    );
    const decimals = await contract.decimals();
    const n = parseUnits(amount, decimals);
    const tx = await contract.transfer(to, n);
    return tx.hash;
  }

  async transferBitcoin({ to, amount, memo }) {
    async function fetchUserUtxos(address) {
      const url = `https://mempool.space/api/address/${address}/utxo`;
      return (await fetch(url)).json();
    }
    async function fetchFeeRate() {
      const res = await fetch(`https://mempool.space/api/v1/fees/recommended`);
      return (await res.json()).fastestFee;
    }
    function calculateFee(vins, vouts, feeRate) {
      const txSize = 10 + vins * 180 + vouts * 34;
      return txSize * feeRate;
    }

    if (memo && memo.length > 80) {
      throw new Error("memo too long, must not be longer than 80 chars.");
    }
    this.key = this.key || this.getKey(this.mnemonic);
    const tx = new btc.Transaction({ allowUnknowOutput: true });
    const memoBytes = toUtf8Bytes(memo);
    const utxos = await fetchUserUtxos(this.address);
    const feeRate = await fetchFeeRate();
    utxos.sort((a, b) => b.value - a.value);
    amount = parseInt(parseFloat(amount) * 1e8);
    let value = 0;
    let fee = 0;
    while (value < amount + fee) {
      const utxo = utxos.pop();
      if (!utxo) throw new Error("Not enough funds in wallet for transaction");
      tx.addInput({
        txid: utxo.txid,
        index: utxo.vout,
        witnessUtxo: {
          amount: BigInt(utxo.value),
          script: btc.p2wpkh(this.key.publicKey).script,
        },
      });
      value += utxo.value;
      fee = calculateFee(tx.inputsLength, memo ? 3 : 2, feeRate);
    }
    tx.addOutputAddress(to, BigInt(amount));
    if (memo) {
      tx.addOutput({
        amount: BigInt(0),
        script: new Uint8Array([106, 76, memoBytes.length, ...memoBytes]),
      });
    }
    tx.addOutputAddress(this.address, BigInt(value - amount - fee));

    tx.sign(this.key.privateKey);
    tx.finalize();
    const res = await fetch(`https://mempool.space/api/tx`, {
      method: "post",
      body: tx.hex,
    });
    if (res.status != 200) {
      throw new Error(
        `Error submitting Bitcoin transaction: API returned ${res.status} ${
          res.statusText
        }\n\n${await res.text()}`
      );
    }
    return await res.text();
  }
}

export const WALLETS = {
  keystore: KeystoreWallet,
};
