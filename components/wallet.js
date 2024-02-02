import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import {
  generatePhrase,
  validatePhrase,
  encryptToKeyStore,
  decryptFromKeystore,
} from "@xchainjs/xchain-crypto";
import {
  useAtom,
  phraseAtom,
  walletsAtom,
  formatAddress,
  WALLETS,
} from "../utils";
import Icon from "./icon";

function downloadKeystore(keystore, address) {
  const url = window.URL.createObjectURL(
    new Blob([JSON.stringify(keystore, null, 2)], {
      type: "application/json",
    })
  );
  const a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  a.download = `keystore-${address.slice(-4)}.json`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
}

export default function Wallet() {
  const router = useRouter();
  const [modal, setModal] = useState();
  const [wallets, setWallets] = useAtom(walletsAtom);
  const [phrase, setPhrase] = useAtom(phraseAtom);

  function setKeystoreWallets(mnemonic) {
    setWallets([
      new WALLETS.keystore("THOR", mnemonic),
      new WALLETS.keystore("MAYA", mnemonic),
      new WALLETS.keystore("ETH", mnemonic),
      new WALLETS.keystore("BTC", mnemonic),
    ]);
  }

  function onConnect() {
    //if (wallets.length) {
    //router.push("/wallet");
    //} else {
    setModal({ type: "connect" });
    //}
  }

  function onConnectSelect() {
    setModal();
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = (e) => {
      const file = e.target.files[0];
      var reader = new FileReader();
      reader.readAsText(file, "UTF-8");
      reader.onload = (readerEvent) => {
        const content = readerEvent.target.result;
        setModal({ type: "select", keystore: content, password: "" });
      };
    };
    input.click();
  }

  async function onConnectSelectSubmit(e) {
    try {
      e.preventDefault();
      const mnemonic = await decryptFromKeystore(
        JSON.parse(modal.keystore),
        modal.password
      );
      setPhrase(mnemonic);
      setKeystoreWallets(mnemonic);
      setModal();
      localStorage.setItem("keystore", modal.keystore);
    } catch (e) {
      console.error(e);
      alert("Invalid password or keystore provided");
    }
  }

  function onConnectCreate() {
    setModal({ type: "create", password: "" });
  }

  async function onConnectCreateSubmit(e) {
    e.preventDefault();
    const mnemonic = generatePhrase();
    const keystore = await encryptToKeyStore(mnemonic, modal.password);
    setPhrase(mnemonic);
    setKeystoreWallets(mnemonic);
    setModal({ type: "createSuccess" });
    const address = new WALLETS.keystore("MAYA", mnemonic).address;
    downloadKeystore(keystore, address);
  }

  function onConnectRecover() {
    setModal({ type: "recover", phrase: "", password: "" });
  }

  async function onConnectRecoverSubmit(e) {
    e.preventDefault();
    const mnemonic = modal.phrase.replace(/\s+/g, " ");
    if (!validatePhrase(mnemonic)) {
      alert("Invalid phrase entered");
      return;
    }
    const keystore = await encryptToKeyStore(mnemonic, modal.password);
    setPhrase(mnemonic);
    setKeystoreWallets(mnemonic);
    const address = new WALLETS.keystore("MAYA", mnemonic).address;
    downloadKeystore(keystore, address);
    setModal();
  }

  function onClearStorageKeystore() {
    localStorage.setItem("keystore", "");
    setModal();
  }

  useEffect(() => {
    const keystore = localStorage.getItem("keystore");
    if (keystore && !global.promptedKeystoreDecrypt) {
      global.promptedKeystoreDecrypt = true;
      setModal({ type: "select", keystore, password: "", isFromStorage: true });
    }
  }, []);

  return (
    <div>
      <button className="button" onClick={onConnect}>
        {wallets.length ? formatAddress(wallets[0].address) : "Connect"}
      </button>

      {modal && modal.type == "connect" ? (
        <div className="modal" onClick={() => setModal()}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <a className="modal-connect-option" onClick={onConnectSelect}>
              <Icon name="file" /> Connect existing keystore
            </a>
            <a className="modal-connect-option" onClick={onConnectCreate}>
              <Icon name="plus-circle" /> Create new keystore
            </a>
            <a className="modal-connect-option" onClick={onConnectRecover}>
              <Icon name="key" /> Create keystore from phrase
            </a>
          </div>
        </div>
      ) : null}

      {modal && modal.type == "select" ? (
        <div className="modal" onClick={() => setModal()}>
          <form
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            onSubmit={onConnectSelectSubmit}
          >
            <h1 className="modal-title">Connect existing keystore</h1>
            <p>
              Enter the password for the{" "}
              {modal.isFromStorage ? "previously used" : "selected"} keystore
            </p>
            <input
              autoFocus
              className="input w-full mb-4"
              placeholder="Password"
              type="password"
              value={modal.password}
              onChange={(e) => setModal({ ...modal, password: e.target.value })}
            />
            <button type="submit" className="button w-full">
              Decrypt
            </button>

            {modal.isFromStorage ? (
              <button
                className="button button-secondary w-full mt-4"
                onClick={onClearStorageKeystore}
              >
                Forget this keystore
              </button>
            ) : null}
          </form>
        </div>
      ) : null}

      {modal && modal.type == "create" ? (
        <div className="modal" onClick={() => setModal()}>
          <form
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            onSubmit={onConnectCreateSubmit}
          >
            <h1 className="modal-title">Create new keystore</h1>
            <p>Enter a password to encrypt and protect your new seed phrase</p>
            <input
              autoFocus
              className="input mb-4"
              placeholder="Password"
              type="password"
              value={modal.password}
              onChange={(e) => setModal({ ...modal, password: e.target.value })}
            />
            <button type="submit" className="button w-full">
              Create
            </button>
          </form>
        </div>
      ) : null}

      {modal && modal.type == "createSuccess" ? (
        <div className="modal" onClick={() => setModal()}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h1 className="modal-title">Create new keystore</h1>
            <p>
              You keystore was just created and downloaded. Write down the
              following seed phrase on a piece of paper and store it securely.
              It&apos;s your backup in case you loose the keystore file.
            </p>
            <pre>
              {phrase
                .split(" ")
                .map((w, i) => `${i + 1}) ${w}`)
                .join("\n")}
            </pre>
            <button
              className="button button-secondary w-full"
              onClick={() => setModal()}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      {modal && modal.type == "recover" ? (
        <div className="modal" onClick={() => setModal()}>
          <form
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            onSubmit={onConnectRecoverSubmit}
          >
            <h1 className="modal-title">Recover keystore from phrase</h1>
            <p>Enter your seed phrase and new password</p>
            <textarea
              rows="6"
              autoFocus
              className="input mb-4"
              placeholder="Seed phrase 12 words"
              value={modal.phrase}
              onChange={(e) => setModal({ ...modal, phrase: e.target.value })}
            />
            <input
              className="input mb-4"
              placeholder="Password"
              type="password"
              value={modal.password}
              onChange={(e) => setModal({ ...modal, password: e.target.value })}
            />
            <button type="submit" className="button w-full">
              Recover
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
