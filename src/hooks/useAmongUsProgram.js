import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
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

// ─── Constants ───────────────────────────────────────────────────────────────
export const ER_VALIDATOR = new PublicKey("FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA");
export const TEE_HTTP     = "https://tee.magicblock.app";
export const TEE_WSS      = "wss://tee.magicblock.app";
export const PROGRAM_ID   = new PublicKey("F3jhJFLdcyzN9ssRuzHVuqgaMcUMyZF1PmvVfu8Hk2C6");

// ─── PDA helpers ─────────────────────────────────────────────────────────────
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
export function useAmongUsProgram(gameIdStr) {
  const { publicKey, sendTransaction, signTransaction, signMessage } = useWallet();
  const { connection } = useConnection();

  const [gameState,       setGameState]       = useState(null);
  const [playerState,     setPlayerState]     = useState(null);
  const [allPlayerStates, setAllPlayerStates] = useState({});
  const [voteState,       setVoteState]       = useState(null);
  const [teeToken,        setTeeToken]        = useState(null);
  const [serverTimeOffset, setServerTimeOffset] = useState(0);
  const [isLoading,       setIsLoading]       = useState(false);
  const [error,           setError]           = useState(null);
  const [voteSession,     setVoteSession]     = useState(1);
  const [isFinalized,     setIsFinalized]     = useState(false);

  const programRef     = useRef(null);
  const programERRef   = useRef(null);
  const providerERRef  = useRef(null);
  const subIds         = useRef([]);
  const prevStatesRef  = useRef({});

  const gid     = useMemo(() => new BN(gameIdStr || "0"), [gameIdStr]);
  const gamePda = useMemo(() => getGamePda(gid), [gid]);
  const myPda   = useMemo(() => publicKey ? getPlayerPda(gid, publicKey) : null, [gid, publicKey]);

  // Base program
  useEffect(() => {
    if (!publicKey || !signTransaction) return;
    const wallet = { publicKey, signTransaction, signAllTransactions: async (txs) => txs };
    const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
    programRef.current = new anchor.Program(IDL, provider);
  }, [publicKey, connection, signTransaction]);

  // ER program (after TEE auth)
  useEffect(() => {
    if (!publicKey || !signTransaction || !teeToken) return;
    const wallet = { publicKey, signTransaction, signAllTransactions: async (txs) => txs };
    const erConn = new anchor.web3.Connection(
      `${TEE_HTTP}?token=${teeToken}`,
      { wsEndpoint: `${TEE_WSS}?token=${teeToken}`, commitment: "confirmed" }
    );
    const erProvider = new anchor.AnchorProvider(erConn, wallet, { commitment: "confirmed" });
    providerERRef.current = erProvider;
    programERRef.current  = new anchor.Program(IDL, erProvider);
  }, [publicKey, signTransaction, teeToken]);

  // Kill detection
  useEffect(() => {
    Object.entries(allPlayerStates).forEach(([pk, ps]) => {
      const prev = prevStatesRef.current[pk];
      if (prev?.isAlive && !ps.isAlive) {
        console.warn(`[AmongUs] Player ${pk.slice(0, 8)} was killed`);
      }
    });
    prevStatesRef.current = allPlayerStates;
  }, [allPlayerStates]);

  // ─── Send helpers ────────────────────────────────────────────────────────
  const sendBase = useCallback(async (ix) => {
    if (!publicKey) throw new Error("Wallet not connected");
    const tx = new Transaction().add(ix);
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.feePayer = publicKey;
    const sig = await sendTransaction(tx, connection);
    await connection.confirmTransaction(sig, "confirmed");
    return sig;
  }, [publicKey, connection, sendTransaction]);

  const sendER = useCallback(async (ix) => {
    if (!publicKey || !signTransaction || !providerERRef.current) throw new Error("ER not ready");
    const er  = providerERRef.current;
    const tx  = new Transaction().add(ix);
    tx.recentBlockhash = (await er.connection.getLatestBlockhash()).blockhash;
    tx.feePayer = publicKey;
    const signed = await signTransaction(tx);
    const sig    = await er.connection.sendRawTransaction(signed.serialize(), { skipPreflight: true });
    await er.connection.confirmTransaction(sig, "confirmed");
    return sig;
  }, [publicKey, signTransaction]);

  // ─── State sync ──────────────────────────────────────────────────────────
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

    // Sync clock offset
    try {
      const conn = pER ? providerERRef.current.connection : connection;
      const info = await conn.getAccountInfo(anchor.web3.SYSVAR_CLOCK_PUBKEY);
      if (info) {
        const chainTime = Number(info.data.readBigInt64LE(32));
        setServerTimeOffset(chainTime - (Date.now() / 1000));
      }
    } catch {}

    // Sync vote
    if (gs.phase?.meeting !== undefined) {
      setVoteSession(gs.voteSession);
      try {
        const vs = await (pER || pBase).account.voteState.fetch(getVotePda(gs.gameId, gs.voteSession));
        setVoteState(vs);
      } catch {}
    } else { setVoteState(null); }
  }, [gameIdStr, gamePda, publicKey, connection]);

  // ─── ER WebSocket subscriptions ─────────────────────────────────────────
  const subscribe = useCallback(() => {
    const er = providerERRef.current;
    if (!er || !publicKey || !myPda) return;
    subIds.current.forEach(id => er.connection.removeAccountChangeListener(id));
    subIds.current = [];

    const id1 = er.connection.onAccountChange(gamePda, (info) => {
      if (!info) return;
      try {
        const d = programRef.current.coder.accounts.decode("gameState", info.data);
        setGameState(d);
        if (d.voteSession) setVoteSession(d.voteSession);
        syncAllState();
      } catch {}
    });

    const id2 = er.connection.onAccountChange(myPda, (info) => {
      if (!info) return;
      try {
        const d = programRef.current.coder.accounts.decode("playerState", info.data);
        setPlayerState(d);
      } catch {}
    });

    subIds.current = [id1, id2];
  }, [gamePda, myPda, publicKey, syncAllState]);

  const getOrCreateGroupIx = useCallback(async (groupPda, groupId) => {
    const info = await connection.getAccountInfo(groupPda);
    if (info) return null;
    return createCreateGroupInstruction(
      { group: groupPda, payer: publicKey },
      { id: groupId, members: [] }
    );
  }, [connection, publicKey]);

  // ─── Commands ────────────────────────────────────────────────────────────
  const commands = {
    async authTee() {
      if (!publicKey || !signMessage) return;
      setIsLoading(true);
      try {
        const auth = await getAuthToken(TEE_HTTP, publicKey, signMessage);
        setTeeToken(auth.token);
      } catch (e) { setError(e.message); }
      finally { setIsLoading(false); }
    },

    async createGame() {
      if (!programRef.current || !publicKey || !myPda) return;
      setIsLoading(true);
      try {
        const ix = await programRef.current.methods.createGame(gid)
          .accounts({ game: gamePda, playerState: myPda, host: publicKey, systemProgram: SystemProgram.programId })
          .instruction();
        await sendBase(ix);
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
        await sendBase(ix);
      } catch (e) { setError(e.message); throw e; }
      finally { setIsLoading(false); }
    },

    async createPermGame() {
      if (!programRef.current || !publicKey) return;
      setIsLoading(true);
      try {
        const gameGroup = groupPdaFromId(gamePda);
        const tx = new Transaction();
        const groupIx = await getOrCreateGroupIx(gameGroup, gamePda);
        if (groupIx) tx.add(groupIx);
        const ix = await programRef.current.methods.createPermission({ game: { gameId: gid } })
          .accountsPartial({ payer: publicKey, permissionedAccount: gamePda, permission: permissionPdaFromAccount(gamePda), group: gameGroup, systemProgram: SystemProgram.programId })
          .instruction();
        tx.add(ix);
        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        tx.feePayer = publicKey;
        const sig = await sendTransaction(tx, connection);
        await connection.confirmTransaction(sig, "confirmed");
      } catch (e) { setError(e.message); throw e; }
      finally { setIsLoading(false); }
    },

    async delegateGame() {
      if (!programRef.current || !publicKey) return;
      setIsLoading(true);
      try {
        const ix = await programRef.current.methods.delegatePda({ game: { gameId: gid } })
          .accounts({ pda: gamePda, payer: publicKey, validator: ER_VALIDATOR })
          .instruction();
        await sendBase(ix);
      } catch (e) { setError(e.message); throw e; }
      finally { setIsLoading(false); }
    },

    async createPermPlayer() {
      if (!programRef.current || !publicKey || !myPda) return;
      setIsLoading(true);
      try {
        const playerGroup = groupPdaFromId(publicKey);
        const tx = new Transaction();
        const groupIx = await getOrCreateGroupIx(playerGroup, publicKey);
        if (groupIx) tx.add(groupIx);
        const ix = await programRef.current.methods.createPermission({ player: { gameId: gid, player: publicKey } })
          .accountsPartial({ payer: publicKey, permissionedAccount: myPda, permission: permissionPdaFromAccount(myPda), group: playerGroup, systemProgram: SystemProgram.programId })
          .instruction();
        tx.add(ix);
        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        tx.feePayer = publicKey;
        const sig = await sendTransaction(tx, connection);
        await connection.confirmTransaction(sig, "confirmed");
      } catch (e) { setError(e.message); throw e; }
      finally { setIsLoading(false); }
    },

    async delegatePlayer() {
      if (!programRef.current || !publicKey || !myPda) return;
      setIsLoading(true);
      try {
        const ix = await programRef.current.methods.delegatePda({ player: { gameId: gid, player: publicKey } })
          .accounts({ pda: myPda, payer: publicKey, validator: ER_VALIDATOR })
          .instruction();
        await sendBase(ix);
      } catch (e) { setError(e.message); throw e; }
      finally { setIsLoading(false); }
    },

    async startGame() {
      if (!programRef.current || !programERRef.current || !publicKey) return;
      setIsLoading(true);
      try {
        const gameAcc = await connection.getAccountInfo(gamePda);
        if (!gameAcc) throw new Error("Game not found");
        const decoded = programRef.current.coder.accounts.decode("gameState", gameAcc.data);
        const playerPks = decoded.players.slice(0, decoded.playerCount);
        const remainingAccounts = playerPks.map(pk => ({
          pubkey: getPlayerPda(gid, pk), isWritable: true, isSigner: false,
        }));
        const ix = await programERRef.current.methods.startGame()
          .accounts({ game: gamePda, host: publicKey })
          .remainingAccounts(remainingAccounts)
          .instruction();
        await sendER(ix);
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
        await sendER(ix);
      } catch (e) { setError(e.message); throw e; }
      finally { setIsLoading(false); }
    },

    async killPlayer(targetPk) {
      if (!programERRef.current || !publicKey || !myPda) return;
      setIsLoading(true);
      try {
        const targetPubkey = targetPk instanceof PublicKey ? targetPk : new PublicKey(targetPk);
        const ix = await programERRef.current.methods.killPlayer()
          .accounts({ game: gamePda, killerState: myPda, victimState: getPlayerPda(gid, targetPubkey), killer: publicKey })
          .instruction();
        await sendER(ix);
      } catch (e) { setError(e.message); throw e; }
      finally { setIsLoading(false); }
    },

    async callMeeting() {
      if (!programERRef.current || !publicKey || !myPda) return;
      setIsLoading(true);
      try {
        const gameAcc = await providerERRef.current.connection.getAccountInfo(gamePda);
        if (!gameAcc) throw new Error("Game not on ER");
        const decoded = programRef.current.coder.accounts.decode("gameState", gameAcc.data);
        const nextSession = (decoded.voteSession) + 1;
        const newVotePda = getVotePda(gid, nextSession);
        const ix = await programERRef.current.methods.callMeeting(gid)
          .accounts({ game: gamePda, callerState: myPda, voteState: newVotePda, caller: publicKey, systemProgram: SystemProgram.programId })
          .instruction();
        await sendER(ix);
        setVoteSession(nextSession);
      } catch (e) { setError(e.message); throw e; }
      finally { setIsLoading(false); }
    },

    async submitVote(targetPk) {
      if (!programERRef.current || !publicKey || !myPda) return;
      setIsLoading(true);
      try {
        const target = targetPk ? (targetPk instanceof PublicKey ? targetPk : new PublicKey(targetPk)) : null;
        const currentVotePda = getVotePda(gid, gameState?.voteSession || voteSession);
        const ix = await programERRef.current.methods.submitVote(target)
          .accounts({ game: gamePda, voteState: currentVotePda, voterState: myPda, voter: publicKey })
          .instruction();
        await sendER(ix);
      } catch (e) { setError(e.message); throw e; }
      finally { setIsLoading(false); }
    },

    async resolveVote(ejectedPk) {
      if (!programERRef.current || !publicKey) return;
      setIsLoading(true);
      try {
        const currentVotePda = getVotePda(gid, gameState?.voteSession || voteSession);
        const ejectedPubkey = ejectedPk ? (ejectedPk instanceof PublicKey ? ejectedPk : new PublicKey(ejectedPk)) : null;
        const ix = await programERRef.current.methods.resolveVote()
          .accounts({
            game: gamePda, voteState: currentVotePda, payer: publicKey,
            ejectedState: ejectedPubkey ? getPlayerPda(gid, ejectedPubkey) : null,
          })
          .instruction();
        await sendER(ix);
      } catch (e) { setError(e.message); throw e; }
      finally { setIsLoading(false); }
    },

    async finalizeGame() {
      if (!programERRef.current || !publicKey) return;
      setIsLoading(true);
      try {
        const ix = await programERRef.current.methods.finalizeGame()
          .accountsPartial({
            game: gamePda,
            permissionGame: permissionPdaFromAccount(gamePda),
            group: groupPdaFromId(gamePda),
            payer: publicKey,
          })
          .instruction();
        await sendER(ix);
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
    publicKey, // expose for identity bridge
  };
}
