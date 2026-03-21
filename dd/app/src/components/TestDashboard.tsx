import React, { useState, useEffect, useRef } from "react";
import { Toaster, toast } from "sonner";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import {
    permissionPdaFromAccount,
    groupPdaFromId,
    createCreateGroupInstruction,
    getAuthToken,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import BN from "bn.js";
import IDL from "../idl/among_us.json";
import type { AmongUs } from "../idl/among_us";

// ─── Constants ────────────────────────────────────────────────────────────────
const ER_VALIDATOR = new PublicKey("FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA");
const TEE_HTTP = "https://tee.magicblock.app";
const TEE_WSS = "wss://tee.magicblock.app";
const PROGRAM_ID = new PublicKey("F3jhJFLdcyzN9ssRuzHVuqgaMcUMyZF1PmvVfu8Hk2C6");

// ─── PDA helpers ──────────────────────────────────────────────────────────────
function gamePdaFn(gid: BN) {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("among_us_game"), gid.toArrayLike(Buffer, "le", 8)],
        PROGRAM_ID
    )[0];
}
function playerPdaFn(gid: BN, wallet: PublicKey) {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("among_us_player"), gid.toArrayLike(Buffer, "le", 8), wallet.toBuffer()],
        PROGRAM_ID
    )[0];
}
function votePdaFn(gid: BN, session: number) {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("among_us_vote"), gid.toArrayLike(Buffer, "le", 8), Buffer.from([session])],
        PROGRAM_ID
    )[0];
}

// ─── Small UI helpers ─────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">{title}</h3>
            <div className="flex flex-wrap gap-2">{children}</div>
        </div>
    );
}

function Btn({ label, onClick, disabled, color = "bg-gray-900" }: {
    label: string; onClick: () => void; disabled?: boolean; color?: string;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`px-3 py-1.5 rounded text-white text-sm font-medium ${color} disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-80 transition`}
        >
            {label}
        </button>
    );
}

function renderRoleBadge(roleObj: any) {
    if (!roleObj) return <span className="text-gray-500">Unknown Role</span>;
    if (roleObj.impostor !== undefined) return <span className="text-red-500 font-black text-xl tracking-widest uppercase">🔪 YOU ARE THE IMPOSTOR</span>;
    if (roleObj.crewmate !== undefined) return <span className="text-emerald-400 font-black text-xl tracking-widest uppercase">🛠️ YOU ARE A CREWMATE</span>;
    if (roleObj.unassigned !== undefined) return <span className="text-gray-400 font-bold typing">⏳ Role Unassigned (Wait for start)</span>;
    return <span className="text-gray-500">{JSON.stringify(roleObj)}</span>;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function TestDashboard() {
    const { publicKey, sendTransaction, signTransaction, signMessage } = useWallet();
    const { connection } = useConnection();

    const [gameIdStr, setGameIdStr] = useState("");
    const [targetWallet, setTargetWallet] = useState("");
    const [voteSession, setVoteSession] = useState(1);
    const [logs, setLogs] = useState<string[]>([]);
    const [gameState, setGameState] = useState<any>(null);
    const [playerState, setPlayerState] = useState<any>(null);
    const [allPlayerStates, setAllPlayerStates] = useState<Record<string, any>>({});
    const [voteState, setVoteState] = useState<any>(null);
    const [teeToken, setTeeToken] = useState<string | null>(null);
    const [now, setNow] = useState(Date.now() / 1000);
    const [serverTimeOffset, setServerTimeOffset] = useState(0);
    const logsEndRef = useRef<HTMLDivElement>(null);
    const prevPlayerStatesRef = useRef<Record<string, any>>({});

    const programRef = useRef<anchor.Program<AmongUs> | null>(null);
    const programERRef = useRef<anchor.Program<AmongUs> | null>(null);
    const providerERRef = useRef<anchor.AnchorProvider | null>(null);
    const subIds = useRef<number[]>([]);

    const log = (msg: string) => setLogs(p => [...p, `${new Date().toLocaleTimeString()} › ${msg}`]);

    // Scroll to bottom of log on update
    useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

    // Tick for cooldown timers
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now() / 1000), 1000);
        return () => clearInterval(timer);
    }, []);

    // Initialize base provider
    useEffect(() => {
        if (!publicKey || !signTransaction) return;
        const wallet = {
            publicKey,
            signTransaction,
            signAllTransactions: async (txs: any) => txs,
        } as unknown as anchor.Wallet;
        const baseProvider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
        programRef.current = new anchor.Program<AmongUs>(IDL as any, baseProvider);
        log(`✅ Wallet connected: ${publicKey.toBase58().slice(0, 8)}…`);
    }, [publicKey, connection, signTransaction]);

    // Initialize ER provider (requires token)
    useEffect(() => {
        if (!publicKey || !signTransaction || !teeToken) return;
        const wallet = {
            publicKey,
            signTransaction,
            signAllTransactions: async (txs: any) => txs,
        } as unknown as anchor.Wallet;
        const erConn = new anchor.web3.Connection(`${TEE_HTTP}?token=${teeToken}`, { wsEndpoint: `${TEE_WSS}?token=${teeToken}`, commitment: "confirmed" });
        const erProvider = new anchor.AnchorProvider(erConn, wallet, { commitment: "confirmed" });
        providerERRef.current = erProvider;
        programERRef.current = new anchor.Program<AmongUs>(IDL as any, erProvider);
    }, [publicKey, signTransaction, teeToken]);

    // ── PDA shortcuts ───────────────────────────────────────────────────────
    const gid = () => new BN(gameIdStr || "0");
    const gamePda = () => gamePdaFn(gid());
    const myPda = () => playerPdaFn(gid(), publicKey!);
    const votePda = () => votePdaFn(gid(), gameState?.voteSession || voteSession);
    const targetPk = () => new PublicKey(targetWallet);

    // ── Toast Helper ────────────────────────────────────────────────────────
    function notifyTx(sig: string, isER = false) {
        const url = isER
            ? `https://solscan.io/tx/${sig}?cluster=custom&customUrl=${encodeURIComponent("https://tee.magicblock.app")}`
            : `https://solscan.io/tx/${sig}?cluster=devnet`;
        toast.success(isER ? "ER Transaction Confirmed" : "Base TX Confirmed", {
            description: `${sig.slice(0, 8)}...${sig.slice(-8)}`,
            action: {
                label: "View Explorer",
                onClick: () => window.open(url, "_blank")
            },
            duration: 8000,
        });
    }

    // Detect Kills for Broadcast
    useEffect(() => {
        Object.entries(allPlayerStates).forEach(([pk, ps]) => {
            const prev = prevPlayerStatesRef.current[pk];
            if (prev && prev.isAlive && !ps.isAlive) {
                const msg = `🩸 PLAYER ${pk.slice(0, 8)}... WAS KILLED!`;
                log(msg);
                toast.error(msg, { duration: 5000, icon: "🔪" });
            }
        });
        prevPlayerStatesRef.current = allPlayerStates;
    }, [allPlayerStates]);

    // ── Send to Base Layer ──────────────────────────────────────────────────
    async function sendBase(ix: anchor.web3.TransactionInstruction) {
        try {
            const tx = new Transaction().add(ix);
            tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
            tx.feePayer = publicKey!;

            log("simulating tx...");
            const sim = await connection.simulateTransaction(tx);
            if (sim.value.err) {
                console.error("Simulation error details:", sim.value.err, sim.value.logs);
                throw new Error(`Simulation failed: ${JSON.stringify(sim.value.err)} | Logs: ${sim.value.logs?.join("\\n")}`);
            }

            const sig = await sendTransaction(tx, connection);
            await connection.confirmTransaction(sig, "confirmed");
            notifyTx(sig, false);
            return sig;
        } catch (err: any) {
            console.error("Base TX Error:", err);
            let msg = err.message;
            if (err.logs) {
                msg += " | Logs: " + JSON.stringify(err.logs);
            }
            throw new Error(msg);
        }
    }

    // ── Send to ER ──────────────────────────────────────────────────────────
    async function sendER(ix: anchor.web3.TransactionInstruction) {
        const er = providerERRef.current!;
        const tx = new Transaction().add(ix);
        tx.recentBlockhash = (await er.connection.getLatestBlockhash()).blockhash;
        tx.feePayer = publicKey!;
        const signed = await signTransaction!(tx);
        const sig = await er.connection.sendRawTransaction(signed.serialize(), { skipPreflight: true });
        await er.connection.confirmTransaction(sig, "confirmed");
        notifyTx(sig, true);
        return sig;
    }

    // ── Sync All State ──────────────────────────────────────────────────────
    async function syncAllState() {
        if (!gameIdStr) return;
        const pBase = programRef.current;
        const pER = programERRef.current;
        if (!pBase) return;

        log("🔄 Syncing all state...");
        let gs: any = null;

        // Try ER first
        if (pER) {
            try {
                gs = await pER.account.gameState.fetch(gamePda());
                log("📍 GameState found on ER");
            } catch { }
        }

        // Fallback to Base
        if (!gs) {
            try {
                gs = await pBase.account.gameState.fetch(gamePda());
                log("📍 GameState found on Base");
            } catch (e) {
                log("❌ GameState not found on either layer");
                return;
            }
        }

        setGameState(gs);

        // Sync all players found in GameState
        const playerMap: Record<string, any> = {};
        for (const playerPk of gs.players) {
            if (playerPk.equals(PublicKey.default)) continue;

            let ps: any = null;
            const pda = playerPdaFn(gs.gameId, playerPk);

            // Try ER
            if (pER) {
                try {
                    ps = await pER.account.playerState.fetch(pda);
                } catch { }
            }
            // Fallback to Base
            if (!ps) {
                try {
                    ps = await pBase.account.playerState.fetch(pda);
                } catch { }
            }

            if (ps) {
                playerMap[playerPk.toBase58()] = ps;
                if (publicKey && playerPk.equals(publicKey)) {
                    setPlayerState(ps);
                }
            }
        }
        setAllPlayerStates(playerMap);

        // Sync Clock Offset (Prioritize ER over Base to fix 860s drift)
        try {
            const timeProvider = pER || pBase;
            const clockInfo = await (timeProvider.provider as anchor.AnchorProvider).connection.getAccountInfo(anchor.web3.SYSVAR_CLOCK_PUBKEY);
            if (clockInfo) {
                // unix_timestamp is at offset 32 (8 bytes)
                const blockchainTime = Number(clockInfo.data.readBigInt64LE(32));
                const offset = blockchainTime - (Date.now() / 1000);
                setServerTimeOffset(offset);
                log(`🕒 Clock Synced (${pER ? "ER" : "Base"}): Drift of ${Math.round(offset)}s corrected`);
            }
        } catch (e) {
            console.error("Failed to sync clock:", e);
        }

        // Sync VoteState if in Meeting phase
        if (gs.phase?.meeting !== undefined) {
            setVoteSession(gs.voteSession);
            try {
                const vs = await (pER || pBase).account.voteState.fetch(votePdaFn(gs.gameId, gs.voteSession));
                setVoteState(vs);
            } catch { }
        } else {
            setVoteState(null);
        }

        log(`✅ Synced ${Object.keys(playerMap).length} players`);
    }

    // ── Reset UI to Start Screen ────────────────────────────────────────────
    function resetGameUI() {
        log("🔄 Resetting UI for new game...");
        setGameState(null);
        setPlayerState(null);
        setAllPlayerStates({});
        setVoteState(null);
        setTeeToken(null);
        setGameIdStr("");
        setTargetWallet("");
        toast.info("Room cleared. You can now create/join a new game.");
    }

    // ── Subscribe to GameState & PlayerState via ER WS ──────────────────────
    function subscribe() {
        const er = providerERRef.current;
        if (!er || !publicKey) { log("❌ ER Provider not ready (missing tee token?)"); return; }
        // Unsubscribe old
        subIds.current.forEach(id => er.connection.removeAccountChangeListener(id));
        subIds.current = [];

        const id1 = er.connection.onAccountChange(gamePda(), (info) => {
            if (!info) {
                // Account removed from ER -> Finalized back to base
                log("🚨 [ER WS] Game account undelegated (Finalized)!");
                setTimeout(resetGameUI, 5000); // 5s delay so players see final result
                return;
            }
            try {
                const d = programRef.current!.coder.accounts.decode("gameState", info.data);
                setGameState(d);
                if (d.voteSession) setVoteSession(d.voteSession);
                log(`🔥 [ER WS] GameState: phase=${JSON.stringify(d.phase)} impostors=${d.aliveImpostors} tasks=${d.tasksCompleted}/${d.totalTasks} result=${JSON.stringify(d.result)}`);
                syncAllState(); // Keep everyone's state fresh
            } catch { }
        });

        const id2 = er.connection.onAccountChange(myPda(), (info) => {
            try {
                const d = programRef.current!.coder.accounts.decode("playerState", info.data);
                setPlayerState(d);
                log(`👤 [ER WS] Your PlayerState: role=${JSON.stringify(d.role)} alive=${d.isAlive} tasks=${d.tasksDone}`);
            } catch { }
        });

        subIds.current = [id1, id2];
        log(`📡 Subscribed to ER WS for game ${gameIdStr}`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // INSTRUCTION HANDLERS — one per smart-contract function
    // ─────────────────────────────────────────────────────────────────────────

    // Helper to initialize MagicBlock Group PDA if it doesn't exist
    async function getOrCreateGroupIx(groupPda: PublicKey, groupId: PublicKey): Promise<anchor.web3.TransactionInstruction | null> {
        const info = await connection.getAccountInfo(groupPda);
        if (info) return null; // already exists
        return createCreateGroupInstruction(
            { group: groupPda, payer: publicKey! },
            // @ts-ignore
            { id: groupId, members: [] }
        );
    }

    const h = {
        // Auth with TEE
        async authTee() {
            try {
                if (!publicKey || !signMessage) return log("❌ Wallet doesn't support signMessage");
                log("▶ Authenticating with TEE Validator (requires signature)...");
                const auth = await getAuthToken(TEE_HTTP, publicKey, signMessage);
                setTeeToken(auth.token);
                toast.success("TEE Authenticated!");
                log(`✅ TEE Authenticated! Token lifetime: ${Math.round((auth.expiresAt - Date.now()) / 60000)}m`);
            } catch (e: any) { log(`❌ auth: ${e.message}`); }
        },

        // 1. create_game
        async createGame() {
            try {
                log("▶ create_game …");
                const ix = await programRef.current!.methods.createGame(gid())
                    // @ts-ignore
                    .accounts({ game: gamePda(), playerState: myPda(), host: publicKey!, systemProgram: SystemProgram.programId })
                    .instruction();
                const sig = await sendBase(ix);
                log(`✅ create_game: ${sig.slice(0, 20)}…`);
            } catch (e: any) { log(`❌ create_game: ${e.message}`); }
        },

        // 2. create_permission (GameState – public)
        async createPermGame() {
            try {
                log("▶ create_permission [Game] …");
                const gameGroup = groupPdaFromId(gamePda());
                const tx = new Transaction();

                // Initialize group if needed
                const groupIx = await getOrCreateGroupIx(gameGroup, gamePda());
                if (groupIx) tx.add(groupIx);

                const ix = await programRef.current!.methods.createPermission({ game: { gameId: gid() } })
                    .accountsPartial({ payer: publicKey!, permissionedAccount: gamePda(), permission: permissionPdaFromAccount(gamePda()), group: gameGroup, systemProgram: SystemProgram.programId })
                    .instruction();
                tx.add(ix);

                const sig = await sendTransaction(tx, connection);
                await connection.confirmTransaction(sig, "confirmed");
                notifyTx(sig, false);
                log(`✅ create_permission [Game]: ${sig.slice(0, 20)}…`);
            } catch (e: any) { log(`❌ create_permission [Game]: ${e.message}`); }
        },

        // 3. delegate_pda (GameState)
        async delegateGame() {
            try {
                log("▶ delegate_pda [Game] …");
                const ix = await programRef.current!.methods.delegatePda({ game: { gameId: gid() } })
                    .accounts({ pda: gamePda(), payer: publicKey!, validator: ER_VALIDATOR })
                    .instruction();
                const sig = await sendBase(ix);
                log(`✅ delegate_pda [Game]: ${sig.slice(0, 20)}…`);
            } catch (e: any) { log(`❌ delegate_pda [Game]: ${e.message}`); }
        },

        // 4. join_game
        async joinGame() {
            try {
                log("▶ join_game …");
                const ix = await programRef.current!.methods.joinGame(gid())
                    // @ts-ignore
                    .accounts({ game: gamePda(), playerState: myPda(), player: publicKey!, systemProgram: SystemProgram.programId })
                    .instruction();
                const sig = await sendBase(ix);
                log(`✅ join_game: ${sig.slice(0, 20)}…`);
            } catch (e: any) { log(`❌ join_game: ${e.message}`); }
        },

        // 5. create_permission (PlayerState – private)
        async createPermPlayer() {
            try {
                log("▶ create_permission [Player] …");
                const player1Group = groupPdaFromId(publicKey!);
                const tx = new Transaction();

                // Initialize group if needed
                const groupIx = await getOrCreateGroupIx(player1Group, publicKey!);
                if (groupIx) tx.add(groupIx);

                const ix = await programRef.current!.methods.createPermission({ player: { gameId: gid(), player: publicKey! } })
                    .accountsPartial({ payer: publicKey!, permissionedAccount: myPda(), permission: permissionPdaFromAccount(myPda()), group: player1Group, systemProgram: SystemProgram.programId })
                    .instruction();
                tx.add(ix);

                const sig = await sendTransaction(tx, connection);
                await connection.confirmTransaction(sig, "confirmed");
                notifyTx(sig, false);
                log(`✅ create_permission [Player]: ${sig.slice(0, 20)}…`);
            } catch (e: any) { log(`❌ create_permission [Player]: ${e.message}`); }
        },

        // 6. delegate_pda (PlayerState)
        async delegatePlayer() {
            try {
                log("▶ delegate_pda [Player] …");
                const ix = await programRef.current!.methods.delegatePda({ player: { gameId: gid(), player: publicKey! } })
                    .accounts({ pda: myPda(), payer: publicKey!, validator: ER_VALIDATOR })
                    .instruction();
                const sig = await sendBase(ix);
                log(`✅ delegate_pda [Player]: ${sig.slice(0, 20)}…`);
            } catch (e: any) { log(`❌ delegate_pda [Player]: ${e.message}`); }
        },

        // 7. start_game (ER) — needs all player PDAs in remaining accounts
        async startGame() {
            try {
                log("▶ start_game (ER) …");
                const gameAcc = await connection.getAccountInfo(gamePda());
                if (!gameAcc) { log("❌ game account not found"); return; }
                const decoded = programRef.current!.coder.accounts.decode("gameState", gameAcc.data);
                const count: number = decoded.playerCount as number;
                const playerPubkeys: PublicKey[] = (decoded.players as PublicKey[]).slice(0, count);
                const remainingAccounts = playerPubkeys.map(pk => ({
                    pubkey: playerPdaFn(gid(), pk),
                    isWritable: true,
                    isSigner: false,
                }));

                const ix = await programERRef.current!.methods.startGame()
                    // @ts-ignore
                    .accounts({ game: gamePda(), host: publicKey! })
                    .remainingAccounts(remainingAccounts)
                    .instruction();
                const sig = await sendER(ix);
                log(`✅ start_game: ${sig.slice(0, 20)}…`);
            } catch (e: any) { log(`❌ start_game: ${e.message}`); }
        },

        // 8. complete_task (ER)
        async completeTask() {
            try {
                log("▶ complete_task (ER) …");
                const ix = await programERRef.current!.methods.completeTask()
                    // @ts-ignore
                    .accounts({ game: gamePda(), playerState: myPda(), player: publicKey! })
                    .instruction();
                const sig = await sendER(ix);
                log(`✅ complete_task: ${sig.slice(0, 20)}…`);
            } catch (e: any) { log(`❌ complete_task: ${e.message}`); }
        },

        // 9. kill_player (ER) — uses targetWallet as victim
        async killPlayer() {
            try {
                if (!targetWallet) { log("❌ Set target wallet first"); return; }
                log(`▶ kill_player → ${targetWallet.slice(0, 8)}… (ER) …`);
                const ix = await programERRef.current!.methods.killPlayer()
                    // @ts-ignore
                    .accounts({ game: gamePda(), killerState: myPda(), victimState: playerPdaFn(gid(), targetPk()), killer: publicKey! })
                    .instruction();
                const sig = await sendER(ix);
                log(`✅ kill_player: ${sig.slice(0, 20)}…`);
            } catch (e: any) { log(`❌ kill_player: ${e.message}`); }
        },

        // 10. call_meeting (ER)
        async callMeeting() {
            try {
                log("▶ call_meeting (ER) …");
                const gameAcc = await providerERRef.current!.connection.getAccountInfo(gamePda());
                if (!gameAcc) { log("❌ game not found on ER"); return; }
                const decoded = programRef.current!.coder.accounts.decode("gameState", gameAcc.data);
                const nextSession = (decoded.voteSession as number) + 1;
                const newVotePda = votePdaFn(gid(), nextSession);
                const ix = await programERRef.current!.methods.callMeeting(gid())
                    // @ts-ignore
                    .accounts({ game: gamePda(), callerState: myPda(), voteState: newVotePda, caller: publicKey!, systemProgram: SystemProgram.programId })
                    .instruction();
                const sig = await sendER(ix);
                setVoteSession(nextSession);
                log(`✅ call_meeting (session ${nextSession}): ${sig.slice(0, 20)}…`);
            } catch (e: any) { log(`❌ call_meeting: ${e.message}`); }
        },

        // 11. submit_vote (ER) — targetWallet or null to skip
        async submitVote(skip: boolean) {
            try {
                const t = skip ? null : targetPk();
                log(`▶ submit_vote → ${skip ? "SKIP" : targetWallet.slice(0, 8) + "…"} (ER) …`);
                const ix = await programERRef.current!.methods.submitVote(t)
                    // @ts-ignore
                    .accounts({ game: gamePda(), voteState: votePda(), voterState: myPda(), voter: publicKey! })
                    .instruction();
                const sig = await sendER(ix);
                log(`✅ submit_vote: ${sig.slice(0, 20)}…`);
            } catch (e: any) { log(`❌ submit_vote: ${e.message}`); }
        },

        // 12. resolve_vote (ER) — ejected = targetWallet or null (tie/skip)
        async resolveVote(hasEjected: boolean) {
            try {
                const currentSession = gameState?.voteSession || voteSession;
                log(`▶ resolve_vote (session #${currentSession}, ejected=${hasEjected ? targetWallet.slice(0, 8) + "…" : "none"}) (ER) …`);

                let accounts: any = {
                    game: gamePda(),
                    voteState: votePda(),
                    payer: publicKey!,
                    ejectedState: null // Explicitly handle Option account
                };

                if (hasEjected && targetWallet) {
                    accounts.ejectedState = playerPdaFn(gid(), targetPk());
                }

                // @ts-ignore
                const ix = await programERRef.current!.methods.resolveVote().accounts(accounts).instruction();
                const sig = await sendER(ix);
                log(`✅ resolve_vote: ${sig.slice(0, 20)}…`);
            } catch (e: any) {
                console.error("resolveVote error:", e);
                log(`❌ resolve_vote: ${e.message}`);
            }
        },

        // 13. finalize_game (ER)
        async finalizeGame() {
            try {
                log("▶ finalize_game (ER) …");
                const ix = await programERRef.current!.methods.finalizeGame()
                    .accountsPartial({
                        game: gamePda(),
                        permissionGame: permissionPdaFromAccount(gamePda()),
                        group: groupPdaFromId(gamePda()),
                        payer: publicKey!
                    })
                    .instruction();
                const sig = await sendER(ix);
                log(`✅ finalize_game: ${sig.slice(0, 20)}…`);
                toast.success("Game Finalized! Returning to lobby in 5s...");
                setTimeout(resetGameUI, 5000);
            } catch (e: any) { log(`❌ finalize_game: ${e.message}`); }
        },
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────────────
    const connected = !!publicKey;

    return (
        <div className="min-h-screen bg-gray-950 text-gray-100 p-6 font-mono">
            <Toaster position="bottom-right" theme="dark" richColors />
            <div className="max-w-4xl mx-auto space-y-4">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-white">Among Us — Dev Test Panel</h1>
                        <p className="text-xs text-gray-500 mt-0.5">Open 2 tabs with different wallets to test multiplayer</p>
                    </div>
                    <WalletMultiButton />
                </div>

                {/* Config row */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs text-gray-400 block mb-1">Game ID (u64 — share across tabs)</label>
                        <input
                            value={gameIdStr}
                            onChange={e => setGameIdStr(e.target.value)}
                            placeholder="e.g. 1710000000"
                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 block mb-1">Target Wallet (for kill / vote)</label>
                        <input
                            value={targetWallet}
                            onChange={e => setTargetWallet(e.target.value)}
                            placeholder="Base58 public key…"
                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                        />
                    </div>
                </div>

                {/* PDA preview */}
                {connected && gameIdStr && (
                    <div className="bg-gray-900 rounded p-3 text-xs text-gray-500 space-y-0.5">
                        <div><span className="text-gray-600">Game PDA  </span> {gamePda().toBase58()}</div>
                        <div><span className="text-gray-600">My PDA    </span> {myPda().toBase58()}</div>
                        <div><span className="text-gray-600">Vote PDA  </span> {votePda().toBase58()} (session {voteSession})</div>
                    </div>
                )}

                {/* ─── Game Over Broadcast ─── */}
                {gameState?.result && !(gameState?.result?.none) && (
                    <div className={`mb-4 p-4 rounded-lg border-2 text-center animate-bounce shadow-[0_0_20px_rgba(0,0,0,0.5)] ${gameState.result.impostorsWin ? "bg-red-950 border-red-500 text-red-100" : "bg-emerald-950 border-emerald-500 text-emerald-100"
                        }`}>
                        <div className="text-2xl font-black uppercase tracking-tighter mb-1">
                            🎮 GAME OVER: {Object.keys(gameState.result)[0]?.toUpperCase()}!
                        </div>
                        <div className="text-xs font-bold opacity-80 decoration-indigo-400 underline underline-offset-4">
                            Proceed to finalize the game below to settle rewards.
                        </div>
                    </div>
                )}

                {/* ─── Phase 1: Base Layer ─── */}
                <Section title="Phase 1 — Base Layer: Lobby Setup">
                    <div className="flex gap-2 mb-2">
                        <Btn label="🔄 Sync All State" onClick={syncAllState} disabled={!connected || !gameIdStr} color="bg-indigo-900" />
                    </div>
                    <Btn label="1. Host: create_game" onClick={h.createGame} disabled={!connected || !gameIdStr} color="bg-indigo-700" />
                    <Btn label="2. Everyone: join_game" onClick={h.joinGame} disabled={!connected || !gameIdStr} color="bg-blue-700" />
                    <Btn label="3. Host: create_permission [Game]" onClick={h.createPermGame} disabled={!connected || !gameIdStr} color="bg-indigo-600" />
                    <Btn label="4. Host: delegate_pda [Game]" onClick={h.delegateGame} disabled={!connected || !gameIdStr} color="bg-indigo-600" />
                    <Btn label="5. Everyone: create_permission [Player]" onClick={h.createPermPlayer} disabled={!connected || !gameIdStr} color="bg-blue-600" />
                    <Btn label="6. Everyone: delegate_pda [Player]" onClick={h.delegatePlayer} disabled={!connected || !gameIdStr} color="bg-blue-600" />
                </Section>

                {/* ─── Global Targeting Control ─── */}
                <div className="bg-indigo-950/20 border border-indigo-500/30 rounded-lg p-3 shadow-lg">
                    <div className="flex items-center gap-2 mb-2 text-indigo-400">
                        <span className="text-lg">🎯</span>
                        <h3 className="text-xs font-black uppercase tracking-widest">Global Targeting Control</h3>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-gray-500 uppercase font-bold">Select Player (for Kill or Vote):</label>
                        <select
                            value={targetWallet}
                            onChange={(e) => setTargetWallet(e.target.value)}
                            className="bg-gray-950 text-white text-xs rounded border border-indigo-500/50 px-3 py-2 focus:outline-none focus:border-indigo-400 transition-colors cursor-pointer"
                        >
                            <option value="">-- Choose a Target --</option>
                            {Object.entries(allPlayerStates)
                                .filter(([pk]) => pk !== publicKey?.toBase58())
                                .map(([pk, ps]) => (
                                    <option key={pk} value={pk}>
                                        {ps.isAlive ? "🟢 ALIVE" : "💀 DEAD"} | {pk.slice(0, 8)}... ({ps.role?.impostor ? "Impostor" : "Crewmate"})
                                    </option>
                                ))
                            }
                        </select>
                        <p className="text-[9px] text-indigo-400/60 mt-1 italic">
                            💡 Tip: You can also set a target by clicking the status dot in the Player Registry.
                        </p>
                    </div>
                </div>

                {/* ─── Phase 2: ER ─── */}
                <div className="relative">
                    {playerState && !playerState.isAlive && gameState?.phase?.playing !== undefined && (
                        <div className="absolute inset-0 bg-red-950/80 z-10 flex items-center justify-center backdrop-blur-[2px] rounded-lg border border-red-500/50 shadow-[inset_0_0_40px_rgba(220,38,38,0.2)]">
                            <div className="text-center rotate-[-5deg]">
                                <p className="text-4xl font-black text-red-500 italic tracking-tighter drop-shadow-md">YOU ARE DEAD</p>
                                <p className="text-[10px] text-red-300/70 font-bold uppercase tracking-widest mt-1">Spectating...</p>
                            </div>
                        </div>
                    )}
                    <Section title="Phase 2 — Ephemeral Rollup: Gameplay Actions">
                        <Btn label="7. 🔒 Authenticate TEE (login)" onClick={h.authTee} disabled={!connected || !!teeToken} color={teeToken ? "bg-emerald-900" : "bg-emerald-700"} />
                        <Btn label="8. 📡 Subscribe ER WS" onClick={subscribe} disabled={!connected || !gameIdStr || !teeToken} color="bg-emerald-600" />
                        <Btn label="9. start_game (host)" onClick={h.startGame} disabled={!connected || !gameIdStr || !teeToken} color="bg-orange-700" />

                        <Btn
                            label={playerState?.tasksDone >= 3 ? "10. Task: COMPLETED ✅" : "10. complete_task"}
                            onClick={h.completeTask}
                            disabled={!connected || !gameIdStr || !teeToken || !playerState?.isAlive || playerState?.role?.impostor !== undefined || playerState?.tasksDone >= 3}
                            color="bg-green-700"
                        />
                        <Btn
                            label="11. kill_player [Target Selected]"
                            onClick={h.killPlayer}
                            disabled={!connected || !gameIdStr || !targetWallet || !teeToken || !playerState?.isAlive || playerState?.role?.crewmate !== undefined}
                            color="bg-red-700"
                        />
                    </Section>
                </div>

                {/* ─── Phase 3: Voting ─── */}
                <div className="relative">
                    {playerState && !playerState.isAlive && gameState?.phase?.meeting !== undefined && (
                        <div className="absolute inset-0 bg-red-950/80 z-10 flex items-center justify-center backdrop-blur-[2px] rounded-lg border border-red-500/50 shadow-[inset_0_0_40px_rgba(220,38,38,0.2)]">
                            <div className="text-center">
                                <p className="text-3xl font-black text-red-500 italic tracking-tighter drop-shadow-md underline decoration-red-800">ELIMINATED</p>
                                <p className="text-[10px] text-red-300/70 font-bold uppercase tracking-widest mt-1">Ghosts cannot vote</p>
                            </div>
                        </div>
                    )}
                    <Section title="Phase 3 — Emergency Meeting & Voting (ER)">
                        {/* ─── Focused Voting Overlay ─── */}
                        {gameState?.phase?.meeting !== undefined && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
                                <div className="max-w-2xl w-full bg-gray-900 border-2 border-yellow-500 rounded-xl shadow-[0_0_50px_rgba(234,179,8,0.3)] overflow-hidden animate-in zoom-in duration-300">
                                    {/* Header */}
                                    <div className="bg-yellow-600 p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <span className="text-3xl animate-pulse">🚨</span>
                                            <div>
                                                <h2 className="text-xl font-black text-black uppercase tracking-tighter">Emergency Meeting</h2>
                                                <p className="text-[10px] text-black/70 font-bold uppercase">Session #{voteSession} • Cast your ballot below</p>
                                            </div>
                                        </div>
                                        {gameState.meetingCaller && (
                                            <div className="bg-black/20 px-3 py-1 rounded text-right">
                                                <p className="text-[9px] text-black/60 uppercase font-bold">Called By</p>
                                                <p className="text-xs font-mono text-black">{gameState.meetingCaller.toBase58().slice(0, 8)}...</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="p-6 space-y-6">
                                        {/* Voting Options */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {Object.entries(allPlayerStates)
                                                .filter(([, ps]) => ps.isAlive)
                                                .map(([pk, ps]) => {
                                                    const votesForThisPlayer = voteState?.votes?.slice(0, voteState.vote_count).filter((v: any) => v.target?.toBase58() === pk).length || 0;
                                                    const hasVotedForThisPlayer = targetWallet === pk;

                                                    return (
                                                        <button
                                                            key={pk}
                                                            onClick={() => setTargetWallet(pk)}
                                                            disabled={!playerState?.isAlive || voteState?.resolved}
                                                            className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all ${hasVotedForThisPlayer ? "border-yellow-500 bg-yellow-500/10 scale-[1.02]" : "border-gray-800 bg-black hover:border-gray-600"
                                                                } ${(!playerState?.isAlive || voteState?.resolved) ? "opacity-50 cursor-not-allowed" : ""}`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-3 h-3 rounded-full ${ps.role?.impostor !== undefined && (gameState?.phase?.ended !== undefined || pk === publicKey?.toBase58()) ? "bg-red-500" : "bg-emerald-500"}`}></div>
                                                                <span className="font-mono text-sm">{pk === publicKey?.toBase58() ? "👉 ME" : pk.slice(0, 8) + "..."}</span>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                {votesForThisPlayer > 0 && (
                                                                    <div className="flex gap-0.5">
                                                                        {[...Array(votesForThisPlayer)].map((_, i) => (
                                                                            <span key={i} className="text-xs">🗳️</span>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                                <span className="text-xs font-bold text-yellow-500">{votesForThisPlayer}</span>
                                                            </div>
                                                        </button>
                                                    );
                                                })}

                                            {/* Skip Option */}
                                            <button
                                                onClick={() => setTargetWallet("SKIP")}
                                                disabled={!playerState?.isAlive || voteState?.resolved}
                                                className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all ${targetWallet === "SKIP" ? "border-blue-500 bg-blue-500/10 scale-[1.02]" : "border-gray-800 bg-black hover:border-gray-600"
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3 text-blue-400">
                                                    <span>⏩</span>
                                                    <span className="font-bold uppercase tracking-widest text-sm">Skip Vote</span>
                                                </div>
                                                <span className="text-xs font-bold text-blue-500">
                                                    {voteState?.votes?.slice(0, voteState.vote_count).filter((v: any) => !v.target).length || 0}
                                                </span>
                                            </button>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex flex-col gap-2 pt-4 border-t border-gray-800">
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => h.submitVote(targetWallet === "SKIP")}
                                                    disabled={!connected || !targetWallet || !teeToken || !playerState?.isAlive || voteState?.resolved}
                                                    className="flex-1 bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-800 text-black font-black uppercase py-3 rounded-lg transition-all shadow-[0_4px_0_rgb(161,98,7)] active:translate-y-1 active:shadow-none"
                                                >
                                                    Confirm Vote
                                                </button>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => h.resolveVote(targetWallet !== "SKIP" && !!targetWallet)}
                                                    disabled={!connected || !teeToken || voteState?.resolved}
                                                    className="flex-1 bg-purple-700 hover:bg-purple-600 disabled:bg-gray-800 text-white font-bold uppercase py-2 rounded-lg text-xs"
                                                >
                                                    Resolve Meeting (Host)
                                                </button>
                                                <button
                                                    onClick={() => { setTargetWallet(""); }}
                                                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-lg text-xs font-bold uppercase"
                                                >
                                                    Close UI
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <Btn
                            label={playerState?.meetingsCalled >= 1 ? "12. Meetings: USED ❌" : "12. call_meeting"}
                            onClick={h.callMeeting}
                            disabled={!connected || !gameIdStr || !teeToken || !playerState?.isAlive || playerState?.meetingsCalled >= 1}
                            color="bg-yellow-700"
                        />
                        <Btn label="13. submit_vote [Target Selected]" onClick={() => h.submitVote(false)} disabled={!connected || !gameIdStr || !targetWallet || !teeToken || !playerState?.isAlive} color="bg-yellow-600" />
                        <Btn label="13. submit_vote (skip)" onClick={() => h.submitVote(true)} disabled={!connected || !gameIdStr || !teeToken || !playerState?.isAlive} color="bg-yellow-600" />
                        <Btn label="14. resolve_vote (eject target)" onClick={() => h.resolveVote(true)} disabled={!connected || !gameIdStr || !teeToken} color="bg-purple-700" />
                        <Btn label="14. resolve_vote (no eject)" onClick={() => h.resolveVote(false)} disabled={!connected || !gameIdStr || !teeToken} color="bg-purple-600" />
                    </Section>
                </div>

                {/* ─── Phase 4: Settlement ─── */}
                <Section title="Phase 4 — Settlement: Finalize">
                    <Btn label="15. finalize_game" onClick={h.finalizeGame} disabled={!connected || !gameIdStr || !teeToken} color="bg-rose-700" />
                </Section>

                {/* ─── Players Registry ─── */}
                {Object.keys(allPlayerStates).length > 0 && (
                    <div className="bg-gray-900 rounded p-4 border border-gray-800">
                        <p className="text-gray-400 font-bold mb-3 uppercase tracking-widest text-sm border-b border-gray-800 pb-1">Players Registry</p>
                        <div className="grid grid-cols-1 gap-2">
                            {Object.entries(allPlayerStates).map(([pk, ps]) => (
                                <div key={pk} className={`flex items-center justify-between bg-black p-2 rounded border transition-all ${targetWallet === pk ? "border-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.2)]" : "border-gray-800 grayscale-[0.3]"}`}>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => setTargetWallet(pk === targetWallet ? "" : pk)}
                                            className={`w-2 h-2 rounded-full cursor-pointer hover:scale-125 transition-transform ${ps.isAlive ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"}`}
                                            title="Click to set as target"
                                        ></button>
                                        <span className="text-gray-300 font-mono">{pk === publicKey?.toBase58() ? "👉 ME" : pk.slice(0, 8) + "..."}</span>
                                    </div>
                                    <div className="flex gap-4 items-center">
                                        <div className="flex flex-col items-end min-w-[60px]">
                                            <span className="text-[10px] text-gray-500 uppercase">Meetings</span>
                                            <span className="text-xs text-amber-500 font-bold">{ps.meetingsCalled}/1</span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-[10px] text-gray-500 uppercase">Tasks</span>
                                            <div className="flex gap-0.5 mt-0.5">
                                                {[1, 2, 3].map(i => (
                                                    <div key={i} className={`w-3 h-1.5 rounded-sm ${ps.tasksDone >= i ? "bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.4)]" : "bg-gray-800"}`}></div>
                                                ))}
                                            </div>
                                        </div>
                                        {gameState?.phase?.meeting !== undefined && (
                                            <div className="flex flex-col items-center ml-2 min-w-[40px]">
                                                <span className="text-[10px] text-gray-500 uppercase">Voted?</span>
                                                <span className="text-sm">{voteState?.votes?.slice(0, voteState.vote_count).some((v: any) => v.voter.toBase58() === pk) ? "🗳️" : "⏳"}</span>
                                            </div>
                                        )}
                                        <span className={`text-xs font-bold ${ps.tasksDone >= 3 ? "text-green-400" : "text-yellow-500"}`}>{ps.tasksDone}/3 {ps.tasksDone >= 3 ? "✅" : ""}</span>
                                        {/* Role visibility: only show if game ended or if it's us */}
                                        {((gameState?.phase?.ended !== undefined) || pk === publicKey?.toBase58()) && (
                                            <span className={ps.role?.impostor !== undefined ? "text-red-500 font-bold animate-pulse" : "text-emerald-400 font-bold"}>
                                                {ps.role?.impostor !== undefined ? "🔪 IMPOSTOR" : "🛠️ CREWMATE"}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ─── Live State ─── */}
                {(gameState || playerState) && (
                    <div className="grid grid-cols-2 gap-3">
                        {gameState && (
                            <div className="bg-gray-900 rounded p-3 text-xs border border-gray-800">
                                <p className="text-gray-400 font-bold mb-2 uppercase tracking-widest border-b border-gray-800 pb-1">Session Overview</p>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500 uppercase">Phase:</span>
                                        <span className="text-indigo-400 font-bold">{gameState.phase ? (Object.keys(gameState.phase)[0]?.toUpperCase() ?? "---") : "---"}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500 uppercase">Tasks:</span>
                                        <span className="text-green-400 font-mono">{gameState.tasksCompleted} / {gameState.totalTasks}</span>
                                    </div>
                                    <div className="w-full bg-black h-1.5 rounded-full overflow-hidden">
                                        <div
                                            className="bg-green-500 h-full transition-all duration-500"
                                            style={{ width: `${(gameState.tasksCompleted / (gameState.totalTasks || 1)) * 100}%` }}
                                        ></div>
                                    </div>
                                    <div className="flex justify-between items-center bg-black/50 p-2 rounded border border-gray-800 mb-2">
                                        <span className="text-gray-500 uppercase font-bold text-[10px]">Current Phase</span>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black tracking-widest ${gameState.phase?.playing ? "bg-emerald-900/50 text-emerald-400 border border-emerald-500/30" :
                                            gameState.phase?.meeting ? "bg-amber-900/50 text-amber-400 border border-amber-500/30" :
                                                "bg-indigo-900/50 text-indigo-400 border border-indigo-500/30"
                                            }`}>
                                            {gameState.phase ? (Object.keys(gameState.phase)[0]?.toUpperCase() ?? "---") : "---"}
                                        </span>
                                    </div>

                                    {gameState.meetingCaller && (
                                        <div className="flex flex-col gap-1 p-2 bg-amber-900/20 border border-amber-700/30 rounded mb-2 animate-pulse">
                                            <span className="text-[9px] text-amber-500/70 font-bold uppercase">🚨 Emergency Meeting Called By:</span>
                                            <span className="text-[10px] text-amber-200 font-mono truncate">{gameState.meetingCaller.toBase58()}</span>
                                        </div>
                                    )}

                                    <div className="flex justify-between">
                                        <span className="text-gray-500 uppercase">Tasks:</span>
                                        <span className="text-green-400 font-mono">{gameState.tasksCompleted} / {gameState.totalTasks}</span>
                                    </div>
                                    <div className="mt-2 p-1.5 bg-black/40 rounded border border-gray-800 text-[10px] text-gray-400 italic">
                                        💡 Crewmates win when ALL crewmates complete 3 tasks each ({gameState.totalTasks} total).
                                    </div>
                                </div>
                                {gameState.result && !(gameState.result.none) && (
                                    <div className="mt-3 p-2 bg-indigo-900/30 rounded border border-indigo-500/50 text-center animate-pulse">
                                        <p className="text-indigo-300 font-bold uppercase tracking-tighter">
                                            🏆 {gameState.result ? (Object.keys(gameState.result)[0]?.toUpperCase() ?? "---") : "---"}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                        {playerState && (
                            <div className="bg-gray-900 rounded p-3 text-xs border border-gray-800 relative overflow-hidden">
                                <p className="text-gray-400 font-bold mb-2 uppercase tracking-widest border-b border-gray-800 pb-1">Your ID Card</p>

                                {/* Death Overlay */}
                                {!playerState.isAlive && (
                                    <div className="absolute inset-0 bg-black/80 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center p-4 text-center border-2 border-red-900/50 rounded animate-in fade-in duration-500">
                                        <div className="text-4xl mb-2 grayscale">💀</div>
                                        <div className="text-red-500 font-black uppercase tracking-tighter text-lg leading-tight">YOU ARE DEAD</div>
                                        <div className="text-[10px] text-gray-400 mt-1 italic">
                                            Wait for game resolution... Your teammates are still fighting.
                                        </div>
                                    </div>
                                )}

                                <div className="mb-3 mt-2">{renderRoleBadge(playerState.role)}</div>
                                <pre className="text-blue-400 whitespace-pre-wrap">{JSON.stringify({
                                    alive: playerState.isAlive,
                                    tasksDone: playerState.tasksDone,
                                    meetingsCalled: playerState.meetingsCalled,
                                }, null, 2)}</pre>
                            </div>
                        )}
                    </div>
                )}

                {/* ─── Log Console ─── */}
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-500 uppercase tracking-widest">Console</span>
                        <button onClick={() => setLogs([])} className="text-xs text-gray-600 hover:text-gray-400">Clear</button>
                    </div>
                    <div className="bg-black rounded p-3 h-56 overflow-y-auto text-xs text-green-400 space-y-0.5">
                        {logs.length === 0 && <span className="text-gray-600">Waiting for actions…</span>}
                        {logs.map((l, i) => <div key={i}>{l}</div>)}
                        <div ref={logsEndRef} />
                    </div>
                </div>
            </div>
        </div >
    );
}
