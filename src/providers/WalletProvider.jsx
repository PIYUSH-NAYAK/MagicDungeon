import { useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";

const DEVNET_ENDPOINT = "https://api.devnet.solana.com";

export function WalletProvider({ children }) {
  const config = useMemo(() => ({
    wsEndpoint: DEVNET_ENDPOINT.replace("https://", "wss://"),
    commitment: "confirmed",
  }), []);

  return (
    <ConnectionProvider endpoint={DEVNET_ENDPOINT} config={config}>
      <SolanaWalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}
