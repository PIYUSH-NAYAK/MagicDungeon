import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import {
  delegationRecordPdaFromDelegatedAccount,
  delegationMetadataPdaFromDelegatedAccount,
  delegateBufferPdaFromDelegatedAccountAndOwnerProgram,
  DELEGATION_PROGRAM_ID,
  getAuthToken,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import BN from "bn.js";
import IDL from "../idl/among_us.json";

// ─── Constants ────────────────────────────────────────────────────────────────
export const ER_VALIDATOR = new PublicKey("FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA");
export const TEE_HTTP     = "https://tee.magicblock.app";
export const TEE_WSS      = "wss://tee.magicblock.app";
export const PROGRAM_ID   = new PublicKey("F3jhJFLdcyzN9ssRuzHVuqgaMcUMyZF1PmvVfu8Hk2C6");

// Correct permission program — confirmed from on-chain ConstraintAddress error
// (SDK 0.10.0 changed to ACLseo… but the among_us program was compiled against BTWAqW…)
export const PERMISSION_PROGRAM_ID = new PublicKey("BTWAqWNBmF2TboMh3fxMJfgR16xGHYD7Kgr2dPwbRPBi");

// ─── Permission PDA helpers (ported from SDK 0.6.5 — use correct program) ────
const PERMISSION_SEED = Buffer.from("permission:");
const GROUP_SEED      = Buffer.from("group:");

function permissionPdaFromAccount(account) {
  return PublicKey.findProgramAddressSync(
    [PERMISSION_SEED, account.toBuffer()],
    PERMISSION_PROGRAM_ID,
  )[0];
}

function groupPdaFromId(id) {
  return PublicKey.findProgramAddressSync(
    [GROUP_SEED, id.toBuffer()],
    PERMISSION_PROGRAM_ID,
  )[0];
}

// Ported from SDK 0.6.5 createGroup.js — discriminator = 0 (raw byte, NOT Anchor discriminator)
function createCreateGroupInstruction(accounts, args) {
  const keys = [
    { pubkey: accounts.group, isWritable: true,  isSigner: false },
    { pubkey: accounts.payer, isWritable: true,  isSigner: true  },
    { pubkey: SystemProgram.programId, isWritable: false, isSigner: false },
  ];
  // Serialize: 1 byte discriminator (0) + 32 bytes id + 4 bytes member count
  const buf = Buffer.alloc(37 + args.members.length * 32);
  let off = 0;
  buf[off++] = 0;                          // discriminator
  buf.set(args.id.toBuffer(), off); off += 32;
  buf.writeUInt32LE(args.members.length, off); off += 4;
  for (const m of args.members) { buf.set(m.toBuffer(), off); off += 32; }
  return new TransactionInstruction({
    programId: PERMISSION_PROGRAM_ID,
    keys,
    data: buf.subarray(0, off),
  });
}

// ─── Game PDA helpers ─────────────────────────────────────────────────────────
export function getGamePda(gid) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("among_us_game"), gid.toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  )[0];
}
export function getPlayerPda(gid, wallet) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("among_us_player"), gid.toArrayLike(Buffer, "le", 8), wallet.toBuffer()],
    PROGRAM_ID
  )[0];
}
export function getVotePda(gid, session) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("among_us_vote"), gid.toArrayLike(Buffer, "le", 8), Buffer.from([session])],
    PROGRAM_ID
  )[0];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAmongUsProgram(gameIdStr, { onTxLog } = {}) {
  const { publicKey, sendTransaction, signTransaction, signMessage } = useWallet();
  const { connection } = useConnection();

  const [gameState,       setGameState]       = useState(null);
  const [playerState,     setPlayerState]     = useState(null);
  const [allPlayerStates, setAllPlayerStates] = useState({});
  const [voteState,       setVoteState]       = useState(null);
  const [teeToken,        setTeeToken]        = useState(null);
  const [serverTimeOffset,setServerTimeOffset]= useState(0);
  const [isLoading,       setIsLoading]       = useState(false);
  const [error,           setError]           = useState(null);
  const [voteSession,     setVoteSession]     = useState(1);
  const [isFinalized,     setIsFinalized]     = useState(false);

  const programRef    = useRef(null);
  const programERRef  = useRef(null);
  const providerERRef = useRef(null);
  const subIds        = useRef([]);
  const prevStatesRef = useRef({});

  const gid     = useMemo(() => new BN(gameIdStr || "0"), [gameIdStr]);
  const gamePda = useMemo(() => getGamePda(gid), [gid]);
  const myPda   = useMemo(() => publicKey ? getPlayerPda(gid, publicKey) : null, [gid, publicKey]);

  // ── Base program ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!publicKey || !signTransaction) return;
    const wallet = { publicKey, signTransaction, signAllTransactions: async txs => txs };
    const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
    programRef.current = new anchor.Program(IDL, provider);
  }, [publicKey, connection, signTransaction]);

  // ── ER program (after TEE auth) ───────────────────────────────────────────
  useEffect(() => {
    if (!publicKey || !signTransaction || !teeToken) return;
    const wallet = { publicKey, signTransaction, signAllTransactions: async txs => txs };
    const erConn = new anchor.web3.Connection(
      `${TEE_HTTP}?token=${teeToken}`,
      { wsEndpoint: `${TEE_WSS}?token=${teeToken}`, commitment: "confirmed" }
    );
    const erProvider = new anchor.AnchorProvider(erConn, wallet, { commitment: "confirmed" });
    providerERRef.current = erProvider;
    programERRef.current  = new anchor.Program(IDL, erProvider);
  }, [publicKey, signTransaction, teeToken]);

  // ── Kill detection ────────────────────────────────────────────────────────
  useEffect(() => {
    Object.entries(allPlayerStates).forEach(([pk, ps]) => {
      const prev = prevStatesRef.current[pk];
      if (prev?.isAlive && !ps.isAlive)
        console.warn(`[AmongUs] ${pk.slice(0,8)} was killed`);
    });
    prevStatesRef.current = allPlayerStates;
  }, [allPlayerStates]);

  // ── TX helpers ────────────────────────────────────────────────────────────
  const sendBase = useCallback(async (tx, label = "Base TX") => {
    if (!publicKey) throw new Error("Wallet not connected");
    const id = `${label}-${Date.now()}`;
    onTxLog?.({ id, label, status: "pending", isER: false });
    try {
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer        = publicKey;

      // Simulate first to surface real program errors
      const sim = await connection.simulateTransaction(tx);
      if (sim.value.err) {
        const detail = sim.value.logs?.slice(-3).join(" | ") || JSON.stringify(sim.value.err);
        console.error(`[sim] ${label}:`, detail, "\nAll logs:", sim.value.logs);
        throw new Error(detail);
      }

      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");
      onTxLog?.({ id, label, status: "confirmed", sig, isER: false });
      return sig;
    } catch (e) {
      onTxLog?.({ id, label, status: "failed", isER: false });
      throw e;
    }
  }, [publicKey, connection, sendTransaction, onTxLog]);

  const sendER = useCallback(async (tx, label = "ER TX") => {
    if (!publicKey || !signTransaction || !providerERRef.current) throw new Error("ER not ready");
    const id = `${label}-${Date.now()}`;
    onTxLog?.({ id, label, status: "pending", isER: true });
    try {
      const er = providerERRef.current;
      tx.recentBlockhash = (await er.connection.getLatestBlockhash()).blockhash;
      tx.feePayer        = publicKey;
      const signed = await signTransaction(tx);
      const sig    = await er.connection.sendRawTransaction(signed.serialize(), { skipPreflight: true });
      await er.connection.confirmTransaction(sig, "confirmed");
      onTxLog?.({ id, label, status: "confirmed", sig, isER: true });
      return sig;
    } catch (e) {
      onTxLog?.({ id, label, status: "failed", isER: true });
      throw e;
    }
  }, [publicKey, signTransaction, onTxLog]);

  // ── Group helper: create group if it doesn't exist yet ────────────────────
  const getOrCreateGroupIx = useCallback(async (groupPda, groupId) => {
    const info = await connection.getAccountInfo(groupPda);
    if (info) return null;                              // already exists
    return createCreateGroupInstruction(
      { group: groupPda, payer: publicKey },
      { id: groupId, members: [] }
    );
  }, [connection, publicKey]);

  // ── State sync ────────────────────────────────────────────────────────────
  const syncAllState = useCallback(async () => {
    if (!gameIdStr || !programRef.current) return;
    const pBase = programRef.current;
    const pER   = programERRef.current;

    let gs = null;
    if (pER) { try { gs = await pER.account.gameState.fetch(gamePda); } catch {} }
    if (!gs) {
      try {
        gs = await pBase.account.gameState.fetch(gamePda);
        if (gs?.phase?.ended !== undefined) setIsFinalized(true);
      } catch { return; }
    } else { setIsFinalized(false); }
    setGameState(gs);

    const playerMap = {};
    for (const playerPk of gs.players) {
      if (playerPk.equals(PublicKey.default)) continue;
      const pda = getPlayerPda(gs.gameId, playerPk);
      let ps = null;
      if (pER) { try { ps = await pER.account.playerState.fetch(pda); } catch {} }
      if (!ps)  { try { ps = await pBase.account.playerState.fetch(pda); } catch {} }
      if (ps) {
        playerMap[playerPk.toBase58()] = ps;
        if (publicKey && playerPk.equals(publicKey)) setPlayerState(ps);
      }
    }
    setAllPlayerStates(playerMap);

    try {
      const conn = pER ? providerERRef.current.connection : connection;
      const info = await conn.getAccountInfo(anchor.web3.SYSVAR_CLOCK_PUBKEY);
      if (info) {
        setServerTimeOffset(Number(info.data.readBigInt64LE(32)) - (Date.now() / 1000));
      }
    } catch {}

    if (gs.phase?.meeting !== undefined) {
      setVoteSession(gs.voteSession);
      try {
        const vs = await (pER || pBase).account.voteState.fetch(getVotePda(gs.gameId, gs.voteSession));
        setVoteState(vs);
      } catch {}
    } else { setVoteState(null); }
  }, [gameIdStr, gamePda, publicKey, connection]);

  // ── ER subscriptions ──────────────────────────────────────────────────────
  const subscribe = useCallback(() => {
    const er = providerERRef.current;
    if (!er || !publicKey || !myPda) return;
    subIds.current.forEach(id => er.connection.removeAccountChangeListener(id));
    subIds.current = [];
    const id1 = er.connection.onAccountChange(gamePda, info => {
      if (!info) return;
      try {
        const d = programRef.current.coder.accounts.decode("gameState", info.data);
        setGameState(d);
        if (d.voteSession) setVoteSession(d.voteSession);
        syncAllState();
      } catch {}
    });
    const id2 = er.connection.onAccountChange(myPda, info => {
      if (!info) return;
      try {
        const d = programRef.current.coder.accounts.decode("playerState", info.data);
        setPlayerState(d);
      } catch {}
    });
    subIds.current = [id1, id2];
  }, [gamePda, myPda, publicKey, syncAllState]);

  // ─── Commands ─────────────────────────────────────────────────────────────
  const commands = {

    async authTee() {
      if (!publicKey || !signMessage) return;
      setIsLoading(true);
      try {
        const auth = await getAuthToken(TEE_HTTP, publicKey, signMessage);
        setTeeToken(auth.token);
      } catch (e) { setError(e.message); throw e; }
      finally { setIsLoading(false); }
    },

    // ── Lobby (Base Layer) ──────────────────────────────────────────────────────

    async createGame() {
      if (!programRef.current || !publicKey || !myPda) return;
      setIsLoading(true);
      try {
        const ix = await programRef.current.methods.createGame(gid)
          .accounts({ game: gamePda, playerState: myPda, host: publicKey, systemProgram: SystemProgram.programId })
          .instruction();
        await sendBase(new Transaction().add(ix), "Create game");
      } catch (e) { setError(e.message); throw e; }
      finally { setIsLoading(false); }
    },

    async joinGame() {
      if (!programRef.current || !publicKey || !myPda) return;
      setIsLoading(true);
      try {
        const ix = await programRef.current.methods.joinGame(gid)
          .accounts({ game: gamePda, playerState: myPda, player: publicKey, systemProgram: SystemProgram.programId })
          .instruction();
        await sendBase(new Transaction().add(ix), "Join game");
      } catch (e) { setError(e.message); throw e; }
      finally { setIsLoading(false); }
    },

    // ── Delegation — HOST only (steps 1 & 2) ───────────────────────────────────

    async createPermGame() {
      if (!programRef.current || !publicKey) return;
      setIsLoading(true);
      try {
        const gameGroup = groupPdaFromId(gamePda);
        const tx = new Transaction();
        const groupIx = await getOrCreateGroupIx(gameGroup, gamePda);
        if (groupIx) tx.add(groupIx);
        const ix = await programRef.current.methods
          .createPermission({ game: { gameId: gid } })
          .accountsPartial({
            payer:               publicKey,
            permissionedAccount: gamePda,
            permission:          permissionPdaFromAccount(gamePda),
            group:               gameGroup,
            systemProgram:       SystemProgram.programId,
          })
          .instruction();
        tx.add(ix);
        await sendBase(tx, "Create game permission");
      } catch (e) { setError(e.message); throw e; }
      finally { setIsLoading(false); }
    },

    async delegateGame() {
      if (!programRef.current || !publicKey) return;
      setIsLoading(true);
      try {
        const bufferPda = delegateBufferPdaFromDelegatedAccountAndOwnerProgram(gamePda, PROGRAM_ID);
        const recordPda = delegationRecordPdaFromDelegatedAccount(gamePda);
        const metaPda   = delegationMetadataPdaFromDelegatedAccount(gamePda);
        const ix = await programRef.current.methods
          .delegatePda({ game: { gameId: gid } })
          .accounts({
            bufferPda,
            delegationRecordPda:   recordPda,
            delegationMetadataPda: metaPda,
            pda:                   gamePda,
            payer:                 publicKey,
            validator:             ER_VALIDATOR,
            ownerProgram:          PROGRAM_ID,
            delegationProgram:     DELEGATION_PROGRAM_ID,
            systemProgram:         SystemProgram.programId,
          })
          .instruction();
        await sendBase(new Transaction().add(ix), "Delegate game to ER");
      } catch (e) { setError(e.message); throw e; }
      finally { setIsLoading(false); }
    },

    // ── Delegation — ALL PLAYERS incl. host (steps 3 & 4) ─────────────────────

    async createPermPlayer() {
      if (!programRef.current || !publicKey || !myPda) return;
      setIsLoading(true);
      try {
        const playerGroup = groupPdaFromId(publicKey);
        const tx = new Transaction();
        const groupIx = await getOrCreateGroupIx(playerGroup, publicKey);
        if (groupIx) tx.add(groupIx);
        const ix = await programRef.current.methods
          .createPermission({ player: { gameId: gid, player: publicKey } })
          .accountsPartial({
            payer:               publicKey,
            permissionedAccount: myPda,
            permission:          permissionPdaFromAccount(myPda),
            group:               playerGroup,
            systemProgram:       SystemProgram.programId,
          })
          .instruction();
        tx.add(ix);
        await sendBase(tx, "Create player permission");
      } catch (e) { setError(e.message); throw e; }
      finally { setIsLoading(false); }
    },

    async delegatePlayer() {
      if (!programRef.current || !publicKey || !myPda) return;
      setIsLoading(true);
      try {
        const bufferPda = delegateBufferPdaFromDelegatedAccountAndOwnerProgram(myPda, PROGRAM_ID);
        const recordPda = delegationRecordPdaFromDelegatedAccount(myPda);
        const metaPda   = delegationMetadataPdaFromDelegatedAccount(myPda);
        const ix = await programRef.current.methods
          .delegatePda({ player: { gameId: gid, player: publicKey } })
          .accounts({
            bufferPda,
            delegationRecordPda:   recordPda,
            delegationMetadataPda: metaPda,
            pda:                   myPda,
            payer:                 publicKey,
            validator:             ER_VALIDATOR,
            ownerProgram:          PROGRAM_ID,
            delegationProgram:     DELEGATION_PROGRAM_ID,
            systemProgram:         SystemProgram.programId,
          })
          .instruction();
        await sendBase(new Transaction().add(ix), "Delegate player to ER");
      } catch (e) { setError(e.message); throw e; }
      finally { setIsLoading(false); }
    },

    // ── ER gameplay (gasless) ─────────────────────────────────────────────────

    async startGame() {
      if (!programERRef.current || !publicKey) return;
      setIsLoading(true);
      try {
        const gameAcc = await connection.getAccountInfo(gamePda);
        if (!gameAcc) throw new Error("Game not found on-chain");
        const decoded = programRef.current.coder.accounts.decode("gameState", gameAcc.data);
        const remainingAccounts = (decoded.players || [])
          .slice(0, decoded.playerCount)
          .map(pk => ({ pubkey: getPlayerPda(gid, pk), isWritable: true, isSigner: false }));
        const ix = await programERRef.current.methods.startGame()
          .accounts({ game: gamePda, host: publicKey })
          .remainingAccounts(remainingAccounts)
          .instruction();
        await sendER(new Transaction().add(ix), "Start game (ER)");
      } catch (e) { setError(e.message); throw e; }
      finally { setIsLoading(false); }
    },

    async completeTask() {
      if (!programERRef.current || !publicKey || !myPda) return;
      setIsLoading(true);
      try {
        const ix = await programERRef.current.methods.completeTask()
          .accounts({ game: gamePda, playerState: myPda, player: publicKey })
          .instruction();
        await sendER(new Transaction().add(ix), "Complete task");
      } catch (e) { setError(e.message); throw e; }
      finally { setIsLoading(false); }
    },

    async killPlayer(targetPk) {
      if (!programERRef.current || !publicKey || !myPda) return;
      setIsLoading(true);
      try {
        const tgt = targetPk instanceof PublicKey ? targetPk : new PublicKey(targetPk);
        const ix  = await programERRef.current.methods.killPlayer()
          .accounts({ game: gamePda, killerState: myPda, victimState: getPlayerPda(gid, tgt), killer: publicKey })
          .instruction();
        await sendER(new Transaction().add(ix), "Kill player");
      } catch (e) { setError(e.message); throw e; }
      finally { setIsLoading(false); }
    },

    async callMeeting() {
      if (!programERRef.current || !publicKey || !myPda) return;
      setIsLoading(true);
      try {
        const gameAcc = await providerERRef.current.connection.getAccountInfo(gamePda);
        if (!gameAcc) throw new Error("Game not on ER");
        const decoded    = programRef.current.coder.accounts.decode("gameState", gameAcc.data);
        const nextSess   = (decoded.voteSession || 0) + 1;
        const newVotePda = getVotePda(gid, nextSess);
        const ix = await programERRef.current.methods.callMeeting(gid)
          .accounts({ game: gamePda, callerState: myPda, voteState: newVotePda, caller: publicKey, systemProgram: SystemProgram.programId })
          .instruction();
        await sendER(new Transaction().add(ix), "Call meeting");
        setVoteSession(nextSess);
      } catch (e) { setError(e.message); throw e; }
      finally { setIsLoading(false); }
    },

    async submitVote(targetPk) {
      if (!programERRef.current || !publicKey || !myPda) return;
      setIsLoading(true);
      try {
        const target      = targetPk ? (targetPk instanceof PublicKey ? targetPk : new PublicKey(targetPk)) : null;
        const currentVote = getVotePda(gid, gameState?.voteSession || voteSession);
        const ix = await programERRef.current.methods.submitVote(target)
          .accounts({ game: gamePda, voteState: currentVote, voterState: myPda, voter: publicKey })
          .instruction();
        await sendER(new Transaction().add(ix), "Submit vote");
      } catch (e) { setError(e.message); throw e; }
      finally { setIsLoading(false); }
    },

    async resolveVote(ejectedPk) {
      if (!programERRef.current || !publicKey) return;
      setIsLoading(true);
      try {
        const ejected     = ejectedPk ? (ejectedPk instanceof PublicKey ? ejectedPk : new PublicKey(ejectedPk)) : null;
        const currentVote = getVotePda(gid, gameState?.voteSession || voteSession);
        const ix = await programERRef.current.methods.resolveVote()
          .accounts({ game: gamePda, voteState: currentVote, payer: publicKey, ejectedState: ejected ? getPlayerPda(gid, ejected) : null })
          .instruction();
        await sendER(new Transaction().add(ix), "Resolve vote");
      } catch (e) { setError(e.message); throw e; }
      finally { setIsLoading(false); }
    },

    async finalizeGame() {
      if (!programERRef.current || !publicKey) return;
      setIsLoading(true);
      try {
        const ix = await programERRef.current.methods.finalizeGame()
          .accountsPartial({
            game:           gamePda,
            permissionGame: permissionPdaFromAccount(gamePda),
            group:          groupPdaFromId(gamePda),
            payer:          publicKey,
          })
          .instruction();
        await sendER(new Transaction().add(ix), "Finalize game");
        setIsFinalized(true);
      } catch (e) { setError(e.message); throw e; }
      finally { setIsLoading(false); }
    },
  };

  return {
    gameState, playerState, allPlayerStates, voteState,
    teeToken, serverTimeOffset, isLoading, error,
    voteSession, isFinalized,
    commands, syncAllState, subscribe,
    gamePda, myPda, gid,
    publicKey,
  };
}
