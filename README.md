# 🏰 Magic Dungeon

An **Among Us-style multiplayer game** set in a dark fantasy world, built with a 3D React Three Fiber frontend, a Socket.io real-time server, and **Solana + MagicBlock Ephemeral Rollups** for on-chain game actions.

---

## ✨ Features

- 🎮 **3D Third-Person Gameplay** — Explore maps with a smooth character controller (React Three Fiber + Rapier physics)
- 👥 **Real-time Multiplayer** — Room creation, lobby, player sync via Socket.io
- 🔪 **Impostor & Crewmate Roles** — Secret role assignment, kill cooldowns, ghost system
- 📋 **Task System** — Interactive task stations for crewmates to complete
- 🗳️ **Emergency Meetings & Voting** — Call meetings, discuss, vote out suspects
- 🔗 **On-Chain Actions** — Role resolution and game outcomes written to Solana via MagicBlock Ephemeral Rollups
- 🗺️ **Multiple Maps** — Choose from several 3D environments
- 👻 **Ghost System** — Eliminated players continue as ghosts
- 🔄 **Reconnect Support** — Seamlessly rejoin an in-progress game

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Three Fiber, Three.js |
| Physics | @react-three/rapier |
| On-chain | Anchor (Rust), Solana Devnet |
| Fast state | MagicBlock Ephemeral Rollups SDK |
| Multiplayer | Socket.io (Node.js server) |
| Wallet | Phantom via `@solana/wallet-adapter` |
| Build | Vite |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- A Phantom wallet browser extension

### Install & Run

```bash
# Install dependencies
npm install

# Start the Socket.io game server
node server.js

# In a separate terminal, start the frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and connect your Phantom wallet.

---

## 🗂️ Project Structure

```
magic-dungeon/
├── server.js                # Socket.io game server (room management, game logic)
├── src/
│   ├── App.jsx              # Root app + screen router
│   ├── context/
│   │   └── GameContext.jsx  # Global game state (socket, players, phase)
│   ├── components/
│   │   ├── Character.jsx    # Local player 3D character
│   │   ├── RemoteCharacter.jsx  # Other players
│   │   ├── CharacterController.jsx  # Movement & camera
│   │   ├── HUD.jsx          # In-game heads-up display
│   │   ├── TaskStation.jsx  # Interactive task objects
│   │   └── Map.jsx          # 3D map loader
│   └── screens/
│       ├── SplashScreen.jsx
│       ├── MainMenu.jsx
│       ├── CreateRoom.jsx
│       ├── JoinRoom.jsx
│       ├── LobbyScreen.jsx
│       ├── CharacterSelect.jsx
│       ├── GameMode.jsx
│       ├── Countdown.jsx
│       ├── RoleReveal.jsx
│       ├── MeetingScreen.jsx
│       ├── ResultsScreen.jsx
│       └── MapTestScreen.jsx
└── dd/                      # Anchor smart contract (Solana program)
    └── programs/among_us/
        └── src/lib.rs
```

---

## 🎮 Game Flow

```
Splash → Main Menu → Create/Join Room → Lobby
→ Character Select → Countdown → Role Reveal
→ Gameplay (Tasks / Kill / Report)
→ Emergency Meeting → Vote → Results
```

---

## 🔗 On-Chain Integration

Game outcomes (role assignments, vote resolutions) are committed to Solana Devnet via **MagicBlock Ephemeral Rollups**, enabling fast, low-cost on-chain state updates with finality on mainnet.

---

## 📄 License

MIT
