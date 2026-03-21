import React, { useState, useEffect, useMemo } from "react";
import { Toaster, toast } from "sonner";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useAmongUsProgram, ER_VALIDATOR, PROGRAM_ID } from "../hooks/use-amongus-program";
import {
    Users,
    Shield,
    Skull,
    CheckCircle2,
    AlertTriangle,
    Zap,
    Activity,
    Terminal,
    Crosshair
} from "lucide-react";
import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

// ─── Custom UI Components ───────────────────────────────────────────────────

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <div className={`bg-gray-900/40 backdrop-blur-md border border-gray-800 rounded-xl overflow-hidden shadow-2xl ${className}`}>
        {children}
    </div>
);

const Badge = ({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "danger" | "success" | "warning" | "info" }) => {
    const variants = {
        default: "bg-gray-800 text-gray-300",
        danger: "bg-red-500/20 text-red-400 border border-red-500/30",
        success: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
        warning: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
        info: "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30",
    };
    return (
        <span className={`px-2 py-0.5 rounded text-[10px] font-black tracking-widest uppercase ${variants[variant]}`}>
            {children}
        </span>
    );
};

// ─── Main Demo Component ───────────────────────────────────────────────────

export function Demo() {
    const { publicKey, connected } = useWallet();
    const [gameIdInput, setGameIdInput] = useState("1710000000");
    const {
        gameState,
        playerState,
        allPlayerStates,
        voteState,
        isLoading,
        error,
        commands,
        syncAllState,
        subscribe,
        gamePda,
        myPda
    } = useAmongUsProgram(gameIdInput);

    const [logs, setLogs] = useState<string[]>([]);
    const pushLog = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 5));

    // Auto-subscribe when ready
    useEffect(() => {
        if (connected && gameIdInput && gameState) {
            subscribe();
        }
    }, [connected, gameIdInput, !!gameState]);

    // Role display helper
    const RoleDisplay = ({ role }: { role: any }) => {
        if (!role) return <Badge>Initializing...</Badge>;
        if (role.impostor) return <span className="text-red-500 font-black tracking-tighter">IMPOSTOR</span>;
        if (role.crewmate) return <span className="text-emerald-400 font-black tracking-tighter">CREWMATE</span>;
        return <Badge variant="warning">Lobby</Badge>;
    };

    const playersList = useMemo(() => {
        const list = Object.entries(allPlayerStates).map(([pk, state]) => ({ pk, ...state }));
        // Ensure we show at least the connected player even if not in allPlayerStates yet
        if (publicKey && !allPlayerStates[publicKey.toBase58()]) {
            list.push({ pk: publicKey.toBase58(), isAlive: true, role: { unassigned: {} }, tasksDone: 0 });
        }
        return list;
    }, [allPlayerStates, publicKey]);

    return (
        <div className="min-h-screen bg-black text-gray-100 p-4 md:p-8 font-sans selection:bg-indigo-500/30">
            <Toaster position="top-center" theme="dark" richColors />

            {/* Background VFX */}
            <div className="fixed inset-0 pointer-events-none opacity-20">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_120%,#1e1b4b,transparent_50%)]"></div>
                <div className="absolute top-0 left-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100"></div>
            </div>

            <div className="max-w-6xl mx-auto space-y-8 relative z-10">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(79,70,229,0.4)]">
                                <Zap className="text-white fill-current" size={24} />
                            </div>
                            <h1 className="text-4xl font-black italic tracking-tighter text-white uppercase drop-shadow-sm">
                                Among <span className="text-indigo-500">Us</span> ER
                            </h1>
                        </div>
                        <p className="text-gray-400 text-sm font-medium flex items-center gap-2">
                            <Activity size={14} className="text-emerald-500" />
                            Private Ephemeral Rollups Demo • Powered by MagicBlock
                        </p>
                    </div>

                    <div className="flex items-center gap-3 bg-gray-900/50 p-2 rounded-xl border border-gray-800 backdrop-blur-sm transition-all hover:border-gray-700">
                        <div className="px-4 py-2">
                            <label className="block text-[10px] uppercase font-black text-gray-500 tracking-widest mb-1">Game ID</label>
                            <input
                                value={gameIdInput}
                                onChange={(e) => setGameIdInput(e.target.value)}
                                className="bg-transparent border-none text-white font-mono text-sm focus:ring-0 w-24 p-0"
                            />
                        </div>
                        <div className="h-10 w-px bg-gray-800"></div>
                        <WalletMultiButton className="!bg-indigo-600 hover:!bg-indigo-500 transition-colors !rounded-lg !h-10 !text-sm !font-black !uppercase !tracking-widest" />
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                    {/* Left Column: Player Grid & Status */}
                    <div className="lg:col-span-8 space-y-6">

                        {/* Game Phase HUD */}
                        <Card className="p-1 border-indigo-500/20 shadow-[0_10px_40px_rgba(0,0,0,0.4)]">
                            <div className="bg-gray-950/60 p-6 rounded-lg flex items-center justify-between">
                                <div className="space-y-1">
                                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Global Game State</span>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-3 h-3 rounded-full animate-pulse ${gameState ? "bg-emerald-500 shadow-[0_0_10px_#10b981]" : "bg-gray-700"}`}></div>
                                        <h2 className="text-2xl font-black text-white uppercase tracking-tight">
                                            {gameState ? (Object.keys(gameState.phase)[0] ?? "LOBBY") : "OFFLINE"}
                                        </h2>
                                    </div>
                                </div>

                                <div className="flex gap-8">
                                    <div className="text-right">
                                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">Players</span>
                                        <span className="text-lg font-black text-white">{gameState?.playerCount ?? 0}/10</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">Tasks</span>
                                        <span className="text-lg font-black text-indigo-400">{gameState?.tasksCompleted ?? 0}/{gameState?.totalTasks ?? 0}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Task Progress Bar */}
                            <div className="h-1.5 bg-gray-900 rounded-full mx-6 mb-6 overflow-hidden">
                                <div
                                    className="h-full bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.6)] transition-all duration-1000 ease-out"
                                    style={{ width: `${gameState?.totalTasks ? (gameState.tasksCompleted / gameState.totalTasks) * 100 : 0}%` }}
                                ></div>
                            </div>
                        </Card>

                        {/* Player Slots (4 Slots) */}
                        <div className="grid grid-cols-2 gap-4">
                            {[0, 1, 2, 3].map(idx => {
                                const p = playersList[idx];
                                const isMe = p?.pk === publicKey?.toBase58();

                                return (
                                    <Card key={idx} className={`p-4 transition-all hover:translate-y-[-2px] ${isMe ? "bg-indigo-950/20 border-indigo-500/30 ring-1 ring-indigo-500/20" : ""}`}>
                                        {!p ? (
                                            <div className="flex flex-col items-center justify-center py-8 opacity-40">
                                                <Users size={32} className="text-gray-700 mb-2" />
                                                <span className="text-xs font-black uppercase text-gray-600 tracking-widest">Empty Slot</span>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${p.isAlive ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
                                                            {p.isAlive ? <Shield size={20} /> : <Skull size={20} />}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-black text-white">{p.pk.slice(0, 6)}...</span>
                                                                {isMe && <Badge variant="info">YOU</Badge>}
                                                            </div>
                                                            <p className={`text-[10px] font-bold uppercase tracking-widest ${p.isAlive ? "text-emerald-500/60" : "text-red-500/60"}`}>
                                                                {p.isAlive ? "Alive" : "Eliminated"}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <RoleDisplay role={p.role} />
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-[9px] uppercase font-black text-gray-500">
                                                        <span>Tasks Done</span>
                                                        <span className="text-indigo-400">{p.tasksDone}/3</span>
                                                    </div>
                                                    <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-emerald-500 transition-all duration-500"
                                                            style={{ width: `${(p.tasksDone / 3) * 100}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </Card>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right Column: Actions & Logs */}
                    <div className="lg:col-span-4 space-y-6">

                        {/* Control Center */}
                        <Card className="p-6 space-y-6 bg-gradient-to-b from-gray-900/60 to-gray-950/60">
                            <div className="flex items-center gap-2 text-indigo-400 mb-2">
                                <Terminal size={16} />
                                <h3 className="text-xs font-black uppercase tracking-widest underline decoration-indigo-500/50 underline-offset-4">Command Center</h3>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                {!gameState ? (
                                    <div className="space-y-4">
                                        <p className="text-xs text-gray-400 leading-relaxed">
                                            Game initialized on devnet. Launch a new session or join an existing one to begin play.
                                        </p>
                                        <button
                                            onClick={() => {
                                                commands.createGame().then(() => pushLog("Game created on-chain"));
                                            }}
                                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest rounded-lg shadow-lg shadow-indigo-600/20 active:scale-[0.98] transition-all"
                                        >
                                            🚀 Initialize Game
                                        </button>
                                        <button
                                            onClick={() => {
                                                commands.joinGame().then(() => pushLog("Joining lobby..."));
                                            }}
                                            className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-white font-black uppercase tracking-widest rounded-lg transition-all"
                                        >
                                            🤝 Join Lobby
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => { commands.authTee(); pushLog("TEE Auth requested"); }}
                                                className="py-2 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded font-black text-[10px] uppercase hover:bg-emerald-600/30"
                                            >
                                                TEE Auth
                                            </button>
                                            <button
                                                onClick={() => { subscribe(); pushLog("WS Subscription active"); }}
                                                className="py-2 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded font-black text-[10px] uppercase hover:bg-indigo-600/30"
                                            >
                                                Live Sync
                                            </button>
                                        </div>

                                        {gameState.phase.lobby && (
                                            <button
                                                onClick={() => { commands.startGame(); pushLog("Starting game..."); }}
                                                className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white font-black uppercase tracking-widest rounded-lg shadow-lg shadow-orange-600/20 active:scale-[0.98] transition-all"
                                            >
                                                ▶ Start Matches
                                            </button>
                                        )}

                                        {gameState.phase.playing && (
                                            <div className="space-y-2">
                                                <button
                                                    onClick={() => { commands.completeTask(); pushLog("Task completed"); }}
                                                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest rounded-lg"
                                                >
                                                    🛠️ Complete Task
                                                </button>
                                                <button
                                                    onClick={() => { commands.callMeeting(); pushLog("Emergency meeting!"); }}
                                                    className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-black font-black uppercase tracking-widest rounded-lg"
                                                >
                                                    🚨 Call Meeting
                                                </button>
                                            </div>
                                        )}

                                        {gameState.phase.ended && (
                                            <button
                                                onClick={() => { commands.finalizeGame(); pushLog("Finalizing on base layer..."); }}
                                                className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-black uppercase tracking-widest rounded-lg"
                                            >
                                                🧹 Settle & Close
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </Card>

                        {/* Recent Activity Feed */}
                        <Card className="p-5 flex-1 min-h-[200px] flex flex-col bg-gray-950/40">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2 text-emerald-500">
                                    <Activity size={14} />
                                    <h3 className="text-xs font-black uppercase tracking-widest">Live Feed</h3>
                                </div>
                                <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest animate-pulse">Streaming...</span>
                            </div>

                            <div className="flex-1 space-y-3 font-mono text-[11px]">
                                {logs.length === 0 ? (
                                    <p className="text-gray-700 italic">No activity detected yet...</p>
                                ) : (
                                    logs.map((L, i) => (
                                        <div key={i} className="flex gap-2 border-l border-gray-800 pl-3 py-0.5">
                                            <span className="text-gray-400 transition-opacity" style={{ opacity: 1 - i * 0.2 }}>{L}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
