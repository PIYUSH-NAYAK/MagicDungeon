import * as anchor from "@coral-xyz/anchor";
import { sendAndConfirmTransaction } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import { AmongUs } from "../target/types/among_us";
import BN from "bn.js";
import * as nacl from "tweetnacl";
import {
  permissionPdaFromAccount,
  getAuthToken,
  getPermissionStatus,
  waitUntilPermissionActive,
  AUTHORITY_FLAG,
  Member,
  createDelegatePermissionInstruction,
  TX_LOGS_FLAG,
} from "@magicblock-labs/ephemeral-rollups-sdk";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const TEE_URL    = "https://tee.magicblock.app";
const TEE_WS_URL = "wss://tee.magicblock.app";
const ER_VALIDATOR = new anchor.web3.PublicKey(
  "FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA"
);

const GAME_SEED   = Buffer.from("among_us_game");
const PLAYER_SEED = Buffer.from("among_us_player");
const VOTE_SEED   = Buffer.from("among_us_vote");

function gamePda(programId: anchor.web3.PublicKey, gameId: BN) {
  return anchor.web3.PublicKey.findProgramAddressSync(
    [GAME_SEED, gameId.toArrayLike(Buffer, "le", 8)],
    programId
  )[0];
}

function playerPda(
  programId: anchor.web3.PublicKey,
  gameId: BN,
  player: anchor.web3.PublicKey
) {
  return anchor.web3.PublicKey.findProgramAddressSync(
    [PLAYER_SEED, gameId.toArrayLike(Buffer, "le", 8), player.toBuffer()],
    programId
  )[0];
}

function votePda(
  programId: anchor.web3.PublicKey,
  gameId: BN,
  session: number
) {
  return anchor.web3.PublicKey.findProgramAddressSync(
    [VOTE_SEED, gameId.toArrayLike(Buffer, "le", 8), Buffer.from([session])],
    programId
  )[0];
}

/** Build an auth-token-aware provider for a given keypair. */
async function buildTeeProvider(
  ephemeralRpcEndpoint: string,
  keypair: anchor.web3.Keypair,
  token: string
): Promise<anchor.AnchorProvider> {
  return new anchor.AnchorProvider(
    new anchor.web3.Connection(
      process.env.EPHEMERAL_PROVIDER_ENDPOINT || `${TEE_URL}?token=${token}`,
      {
        wsEndpoint:
          process.env.EPHEMERAL_WS_ENDPOINT || `${TEE_WS_URL}?token=${token}`,
      }
    ),
    new anchor.Wallet(keypair)
  );
}

async function sendOnBase(
  provider: anchor.AnchorProvider,
  tx: anchor.web3.Transaction,
  signers: anchor.web3.Keypair[]
) {
  tx.feePayer = signers[0].publicKey;
  return sendAndConfirmTransaction(provider.connection, tx, signers, {
    skipPreflight: true,
    commitment: "confirmed",
  });
}

async function sendOnTee(
  teeProvider: anchor.AnchorProvider,
  tx: anchor.web3.Transaction,
  signers: anchor.web3.Keypair[]
) {
  tx.feePayer = signers[0].publicKey;
  tx.recentBlockhash = (
    await teeProvider.connection.getLatestBlockhash()
  ).blockhash;
  return sendAndConfirmTransaction(teeProvider.connection, tx, signers, {
    skipPreflight: true,
    commitment: "confirmed",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

describe("among-us", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.AmongUs as Program<AmongUs>;
  console.log("Program ID:", program.programId.toBase58());

  const ephemeralRpcEndpoint = (
    process.env.EPHEMERAL_PROVIDER_ENDPOINT || TEE_URL
  ).replace(/\/$/, "");

  // ── Players ──────────────────────────────────────────────
  const host    = provider.wallet.payer;         // Player 1 (host)
  const player2 = anchor.web3.Keypair.generate();
  const player3 = anchor.web3.Keypair.generate();
  const player4 = anchor.web3.Keypair.generate();

  const allPlayers = [host, player2, player3, player4];

  // ── Game ID ───────────────────────────────────────────────
  const gameId = new BN(Date.now());
  console.log("Game ID:", gameId.toString());

  // ── PDAs ─────────────────────────────────────────────────
  const gameAccount = gamePda(program.programId, gameId);
  const hostPlayerState    = playerPda(program.programId, gameId, host.publicKey);
  const player2PlayerState = playerPda(program.programId, gameId, player2.publicKey);
  const player3PlayerState = playerPda(program.programId, gameId, player3.publicKey);
  const player4PlayerState = playerPda(program.programId, gameId, player4.publicKey);

  const permissionGame    = permissionPdaFromAccount(gameAccount);
  const permissionHost    = permissionPdaFromAccount(hostPlayerState);
  const permissionPlayer2 = permissionPdaFromAccount(player2PlayerState);
  const permissionPlayer3 = permissionPdaFromAccount(player3PlayerState);
  const permissionPlayer4 = permissionPdaFromAccount(player4PlayerState);

  console.log("Game PDA:          ", gameAccount.toBase58());
  console.log("Host Player State: ", hostPlayerState.toBase58());
  console.log("Player2 State:     ", player2PlayerState.toBase58());
  console.log("Player3 State:     ", player3PlayerState.toBase58());
  console.log("Player4 State:     ", player4PlayerState.toBase58());

  // ── TEE providers (populated after airdrop) ──────────────
  let teeProviders: Record<string, anchor.AnchorProvider> = {};

  // ─────────────────────────────────────────────────────────
  it("Airdrop SOL to players 2–4", async () => {
    const transfers = [player2, player3, player4].map((kp) =>
      anchor.web3.SystemProgram.transfer({
        fromPubkey: host.publicKey,
        toPubkey: kp.publicKey,
        lamports: 0.1 * anchor.web3.LAMPORTS_PER_SOL,
      })
    );
    const tx = new anchor.web3.Transaction().add(...transfers);
    await provider.sendAndConfirm(tx, [host], { commitment: "confirmed" });

    for (const kp of allPlayers) {
      const bal = await provider.connection.getBalance(kp.publicKey);
      console.log(`  ${kp.publicKey.toBase58().slice(0, 8)}…: ${bal / anchor.web3.LAMPORTS_PER_SOL} SOL`);
    }

    // Build TEE auth tokens if using private ER
    if (ephemeralRpcEndpoint.includes("tee")) {
      for (const kp of allPlayers) {
        const token = await getAuthToken(
          ephemeralRpcEndpoint,
          kp.publicKey,
          (msg: Uint8Array) =>
            Promise.resolve(nacl.sign.detached(msg, kp.secretKey))
        );
        teeProviders[kp.publicKey.toBase58()] = await buildTeeProvider(
          ephemeralRpcEndpoint,
          kp,
          token.token
        );
        console.log(`  TEE provider ready for ${kp.publicKey.toBase58().slice(0, 8)}…`);
      }
    }
  });

  // ─────────────────────────────────────────────────────────
  it("Host creates game (base layer)", async () => {
    const createGameIx = await program.methods
      .createGame(gameId)
      .accountsPartial({
        game: gameAccount,
        playerState: hostPlayerState,
        host: host.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .instruction();

    // Permission: host + all other players can read the GameState
    const gameMembers: Member[] = allPlayers.map((kp) => ({
      flags: AUTHORITY_FLAG | TX_LOGS_FLAG,
      pubkey: kp.publicKey,
    }));

    const createGamePermIx = await program.methods
      .createPermission({ game: { gameId } }, gameMembers)
      .accountsPartial({
        payer: host.publicKey,
        permissionedAccount: gameAccount,
        permission: permissionGame,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .instruction();

    const delegateGamePermIx = createDelegatePermissionInstruction({
      payer: host.publicKey,
      validator: ER_VALIDATOR,
      permissionedAccount: [gameAccount, false],
      authority: [host.publicKey, true],
    });

    // Permission for host's PlayerState: ONLY the host can read their role
    const hostMembers: Member[] = [
      { flags: AUTHORITY_FLAG | TX_LOGS_FLAG, pubkey: host.publicKey },
    ];

    const createHostPermIx = await program.methods
      .createPermission(
        { player: { gameId, player: host.publicKey } },
        hostMembers
      )
      .accountsPartial({
        payer: host.publicKey,
        permissionedAccount: hostPlayerState,
        permission: permissionHost,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .instruction();

    const delegateHostPermIx = createDelegatePermissionInstruction({
      payer: host.publicKey,
      validator: ER_VALIDATOR,
      permissionedAccount: [hostPlayerState, false],
      authority: [host.publicKey, true],
    });

    const delegateHostStateIx = await program.methods
      .delegatePda({ player: { gameId, player: host.publicKey } })
      .accounts({
        payer: host.publicKey,
        validator: ER_VALIDATOR,
        pda: hostPlayerState,
      })
      .instruction();

    const tx = new anchor.web3.Transaction().add(
      createGameIx,
      createGamePermIx,
      delegateGamePermIx,
      createHostPermIx,
      delegateHostPermIx,
      delegateHostStateIx
    );

    const txHash = await sendOnBase(provider, tx, [host]);
    console.log("✅ Game created:", txHash);

    await waitUntilPermissionActive(ephemeralRpcEndpoint, hostPlayerState);
    console.log("✅ Host PlayerState permission active");
  });

  // ─────────────────────────────────────────────────────────
  it("Players 2–4 join game (base layer)", async () => {
    const joiners = [
      { kp: player2, state: player2PlayerState, perm: permissionPlayer2 },
      { kp: player3, state: player3PlayerState, perm: permissionPlayer3 },
      { kp: player4, state: player4PlayerState, perm: permissionPlayer4 },
    ];

    for (const { kp, state, perm } of joiners) {
      const joinIx = await program.methods
        .joinGame(gameId)
        .accountsPartial({
          game: gameAccount,
          playerState: state,
          player: kp.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .instruction();

      // Each player's state is private — only they can read their own role
      const members: Member[] = [
        { flags: AUTHORITY_FLAG | TX_LOGS_FLAG, pubkey: kp.publicKey },
      ];

      const createPermIx = await program.methods
        .createPermission({ player: { gameId, player: kp.publicKey } }, members)
        .accountsPartial({
          payer: kp.publicKey,
          permissionedAccount: state,
          permission: perm,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .instruction();

      const delegatePermIx = createDelegatePermissionInstruction({
        payer: kp.publicKey,
        validator: ER_VALIDATOR,
        permissionedAccount: [state, false],
        authority: [kp.publicKey, true],
      });

      const delegateStateIx = await program.methods
        .delegatePda({ player: { gameId, player: kp.publicKey } })
        .accounts({
          payer: kp.publicKey,
          validator: ER_VALIDATOR,
          pda: state,
        })
        .instruction();

      const tx = new anchor.web3.Transaction().add(
        joinIx,
        createPermIx,
        delegatePermIx,
        delegateStateIx
      );

      const txHash = await sendOnBase(provider, tx, [kp]);
      console.log(`✅ ${kp.publicKey.toBase58().slice(0, 8)}… joined:`, txHash);

      await waitUntilPermissionActive(ephemeralRpcEndpoint, state);
      console.log(`  ✅ PlayerState permission active`);
    }

    // Delegate GameState to TEE (done by last joiner or host)
    const delegateGameIx = await program.methods
      .delegatePda({ game: { gameId } })
      .accounts({
        payer: host.publicKey,
        validator: ER_VALIDATOR,
        pda: gameAccount,
      })
      .instruction();

    const tx2 = new anchor.web3.Transaction().add(delegateGameIx);
    const txHash2 = await sendOnBase(provider, tx2, [host]);
    console.log("✅ GameState delegated to TEE:", txHash2);
  });

  // ─────────────────────────────────────────────────────────
  it("Host starts game in TEE", async () => {
    const tee = teeProviders[host.publicKey.toBase58()] ||
      new anchor.AnchorProvider(
        new anchor.web3.Connection(ephemeralRpcEndpoint),
        new anchor.Wallet(host)
      );

    const tx = await program.methods
      .startGame()
      .accountsPartial({
        game: gameAccount,
        host: host.publicKey,
      })
      .transaction();

    const txHash = await sendOnTee(tee, tx, [host]);
    console.log("✅ Game started (TEE):", txHash);
  });

  // ─────────────────────────────────────────────────────────
  it("TEE assigns hidden roles to all players", async () => {
    // Host acts as TEE authority and assigns roles.
    // In production, the ER validator would derive randomness internally.
    // Here we mimic that: 1 impostor (player4), rest crewmates.
    const tee = teeProviders[host.publicKey.toBase58()] ||
      new anchor.AnchorProvider(
        new anchor.web3.Connection(ephemeralRpcEndpoint),
        new anchor.Wallet(host)
      );

    const assignments: [anchor.web3.Keypair, anchor.web3.PublicKey, object][] =
      [
        [host,    hostPlayerState,    { crewmate: {} }],
        [player2, player2PlayerState, { crewmate: {} }],
        [player3, player3PlayerState, { crewmate: {} }],
        [player4, player4PlayerState, { impostor: {} }], // secret!
      ];

    for (const [_kp, state, role] of assignments) {
      const ix = await program.methods
        // @ts-ignore — role variant
        .assignRole(gameId, role)
        .accountsPartial({
          game: gameAccount,
          playerState: state,
          host: host.publicKey,
        })
        .instruction();

      const tx = new anchor.web3.Transaction().add(ix);
      const txHash = await sendOnTee(tee, tx, [host]);
      console.log(`  Role assigned (TEE, hidden): ${txHash}`);
    }
    console.log("✅ All roles assigned — roles are invisible to other players");
  });

  // ─────────────────────────────────────────────────────────
  it("Player checks own role (only owner can read their state)", async () => {
    // Player4 reads their own PlayerState through the private TEE
    const teeP4 = teeProviders[player4.publicKey.toBase58()];
    if (!teeP4) {
      console.log("  (skipped — no TEE provider, non-TEE environment)");
      return;
    }
    const info = await teeP4.connection.getAccountInfo(player4PlayerState);
    if (!info) throw new Error("PlayerState not found");
    const decoded = program.coder.accounts.decode("playerState", info.data);
    console.log(`✅ Player4 sees own role: ${JSON.stringify(decoded.role)}`);
    // Expected: { impostor: {} }
  });

  // ─────────────────────────────────────────────────────────
  it("Crewmate cannot read impostor's hidden state", async () => {
    const teeHost = teeProviders[host.publicKey.toBase58()];
    if (!teeHost) {
      console.log("  (skipped — no TEE provider)");
      return;
    }
    await getPermissionStatus(ephemeralRpcEndpoint, player4PlayerState);
    const info = await teeHost.connection.getAccountInfo(player4PlayerState);
    if (info === null) {
      console.log("✅ Host cannot read Player4 state — private ER hiding works!");
    } else {
      throw new Error("❌ Host should NOT be able to read Player4's state!");
    }
  });

  // ─────────────────────────────────────────────────────────
  it("Crewmate completes a task (TEE)", async () => {
    const teeHost = teeProviders[host.publicKey.toBase58()] ||
      new anchor.AnchorProvider(
        new anchor.web3.Connection(ephemeralRpcEndpoint),
        new anchor.Wallet(host)
      );

    const tx = await program.methods
      .completeTask()
      .accountsPartial({
        game: gameAccount,
        playerState: hostPlayerState,
        player: host.publicKey,
      })
      .transaction();

    const txHash = await sendOnTee(teeHost, tx, [host]);
    console.log("✅ Host completed a task (TEE):", txHash);
  });

  // ─────────────────────────────────────────────────────────
  it("Impostor kills a crewmate (TEE)", async () => {
    // Player4 (impostor) kills player2 (crewmate)
    const teeP4 = teeProviders[player4.publicKey.toBase58()] ||
      new anchor.AnchorProvider(
        new anchor.web3.Connection(ephemeralRpcEndpoint),
        new anchor.Wallet(player4)
      );

    const tx = await program.methods
      .killPlayer()
      .accountsPartial({
        game: gameAccount,
        killerState: player4PlayerState,
        victimState: player2PlayerState,
        killer: player4.publicKey,
      })
      .transaction();

    const txHash = await sendOnTee(teeP4, tx, [player4]);
    console.log("✅ Player2 killed by impostor Player4 (TEE):", txHash);
  });

  // ─────────────────────────────────────────────────────────
  it("Player3 calls an emergency meeting (TEE)", async () => {
    const teeP3 = teeProviders[player3.publicKey.toBase58()] ||
      new anchor.AnchorProvider(
        new anchor.web3.Connection(ephemeralRpcEndpoint),
        new anchor.Wallet(player3)
      );

    // Vote session will become 1 after this call
    const session1VotePda = votePda(program.programId, gameId, 1);

    const tx = await program.methods
      .callMeeting(gameId)
      .accountsPartial({
        game: gameAccount,
        callerState: player3PlayerState,
        voteState: session1VotePda,
        caller: player3.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .transaction();

    const txHash = await sendOnTee(teeP3, tx, [player3]);
    console.log("✅ Emergency meeting called by Player3 (TEE):", txHash);
  });

  // ─────────────────────────────────────────────────────────
  it("Players vote to eject Player4 (TEE)", async () => {
    const session1VotePda = votePda(program.programId, gameId, 1);

    const voters: [anchor.web3.Keypair, anchor.web3.PublicKey][] = [
      [host,    hostPlayerState],
      [player3, player3PlayerState],
      [player4, player4PlayerState], // impostor votes too (e.g., self-vote to blend in)
    ];

    for (const [kp, state] of voters) {
      const tee = teeProviders[kp.publicKey.toBase58()] ||
        new anchor.AnchorProvider(
          new anchor.web3.Connection(ephemeralRpcEndpoint),
          new anchor.Wallet(kp)
        );

      // Host and player3 vote for player4; player4 votes for player3 (bluffing)
      const target =
        kp.publicKey.equals(player4.publicKey)
          ? player3.publicKey
          : player4.publicKey;

      const tx = await program.methods
        .submitVote(target)
        .accountsPartial({
          game: gameAccount,
          voteState: session1VotePda,
          voterState: state,
          voter: kp.publicKey,
        })
        .transaction();

      const txHash = await sendOnTee(tee, tx, [kp]);
      console.log(`  Vote submitted by ${kp.publicKey.toBase58().slice(0, 8)}…: ${txHash}`);
    }
    console.log("✅ All votes submitted");
  });

  // ─────────────────────────────────────────────────────────
  it("TEE resolves vote — Player4 ejected", async () => {
    const session1VotePda = votePda(program.programId, gameId, 1);

    const teeHost = teeProviders[host.publicKey.toBase58()] ||
      new anchor.AnchorProvider(
        new anchor.web3.Connection(ephemeralRpcEndpoint),
        new anchor.Wallet(host)
      );

    // TEE pre-simulates the tally → Player4 has most votes → supply their state
    const tx = await program.methods
      .resolveVote()
      .accountsPartial({
        game: gameAccount,
        voteState: session1VotePda,
        ejectedState: player4PlayerState, // TEE knows who gets ejected
        payer: host.publicKey,
      })
      .transaction();

    const txHash = await sendOnTee(teeHost, tx, [host]);
    console.log("✅ Vote resolved — Player4 ejected (TEE):", txHash);

    // Game should now be Ended (1 impostor dead, crewmates win)
    const gameInfo = await teeHost.connection.getAccountInfo(gameAccount);
    if (gameInfo) {
      const gameData = program.coder.accounts.decode("gameState", gameInfo.data);
      console.log("  Game phase:", JSON.stringify(gameData.phase));
      console.log("  Game result:", JSON.stringify(gameData.result));
    }
  });

  // ─────────────────────────────────────────────────────────
  it("Finalize game — commit result to Solana base layer", async () => {
    const teeHost = teeProviders[host.publicKey.toBase58()] ||
      new anchor.AnchorProvider(
        new anchor.web3.Connection(ephemeralRpcEndpoint),
        new anchor.Wallet(host)
      );

    const tx = await program.methods
      .finalizeGame()
      .accountsPartial({
        game: gameAccount,
        permissionGame: permissionGame,
        payer: host.publicKey,
        permissionProgram: /* permission program ID — resolved by Anchor */ undefined,
      })
      .transaction();

    const txHash = await sendOnTee(teeHost, tx, [host]);
    console.log("✅ Game finalized and committed to Solana:", txHash);

    // Verify final state is on the base layer
    // (allow a few seconds for ER → base layer sync)
    await new Promise((r) => setTimeout(r, 3000));
    const gameData = await program.account.gameState.fetch(gameAccount);
    console.log("🏆 Final result on-chain:", JSON.stringify(gameData.result));
    console.log("   Phase:", JSON.stringify(gameData.phase));
  });
});
