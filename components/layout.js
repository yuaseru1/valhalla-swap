import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import Wallet from "./wallet";
import logo from "../public/logo.png";

export default function Layout({ title, children }) {
  return (
    <div>
      <Head>
        <title>{title ? title + " - " : ""}Valhalla Swap</title>
      </Head>
      <div className="header">
        <div className="header-logo">
          <Image src={logo} alt="Valhalla" height={60} />
        </div>
        <div className="header-wallet">
          <Wallet />
        </div>
      </div>

      {children}

      <div className="footer">
        <a href="" target="_blank" rel="noreferrer">
          Website
        </a>
        <a href="https://twitter.com/" target="_blank" rel="noreferrer">
          Twitter
        </a>
        <a href="https://discord.gg/" target="_blank" rel="noreferrer">
          Discord
        </a>
        <a href="#" target="_blank" rel="noreferrer">
          Documentation
        </a>
      </div>
    </div>
  );
}
