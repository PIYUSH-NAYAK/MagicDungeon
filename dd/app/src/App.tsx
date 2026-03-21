import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Counter } from "./components/Counter";
import { TestDashboard } from "./components/TestDashboard";
import { Demo } from "./components/Demo";
import "./index.css";

export function App() {
  const path = window.location.pathname;

  return (
    <>
      <div className="absolute top-5 right-5 z-50">
        <WalletMultiButton />
      </div>

      <div className="min-h-screen bg-black">
        {path === "/test" ? (
          <div className="p-8">
            <TestDashboard />
          </div>
        ) : path === "/demo" || path === "/" ? (
          <Demo />
        ) : (
          <div className="bg-gray-50 p-8 rounded-xl border max-w-2xl mx-auto mt-20">
            <header className="text-center mb-8">
              <h1 className="text-3xl font-bold mb-2">Magicblock Anchor Counter</h1>
            </header>
            <main>
              <Counter />
            </main>
          </div>
        )}
      </div>
    </>
  );
}

export default App;
