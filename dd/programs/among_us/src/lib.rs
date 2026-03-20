use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::access_control::{
    CreatePermissionCpiBuilder, UpdatePermissionCpiBuilder, MAGICBLOCK_PERMISSION_PROGRAM_ID,
};
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::commit_and_undelegate_accounts;

declare_id!("F3jhJFLdcyzN9ssRuzHVuqgaMcUMyZF1PmvVfu8Hk2C6");

// ─────────────────────────────────────────────────────────
// Seeds
// ─────────────────────────────────────────────────────────
pub const GAME_SEED: &[u8] = b"among_us_game";
pub const PLAYER_SEED: &[u8] = b"among_us_player";
pub const VOTE_SEED: &[u8] = b"among_us_vote";

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────
pub const MAX_PLAYERS: usize = 10;
pub const MIN_PLAYERS: usize = 2;
pub const KILL_COOLDOWN_SECS: i64 = 30;
pub const TASKS_PER_CREWMATE: u8 = 3;
pub const MAX_MEETINGS_PER_PLAYER: u8 = 1;

// ─────────────────────────────────────────────────────────
#[ephemeral]
#[program]
pub mod among_us {
    use super::*;

    // ── 1. Create Game ──────────────────────────────────────
    /// Host creates the lobby and joins as the first player.
    /// Called on the base layer before any delegation.
    pub fn create_game(ctx: Context<CreateGame>, game_id: u64) -> Result<()> {
        let game = &mut ctx.accounts.game;
        let host = ctx.accounts.host.key();

        game.game_id = game_id;
        game.host = host;
        game.player_count = 1;
        game.players[0] = host;
        game.alive[0] = true;
        game.phase = GamePhase::Lobby;
        game.impostor_count = 0;
        game.alive_impostors = 0;
        game.alive_crewmates = 0;
        game.tasks_completed = 0;
        game.total_tasks = 0;
        game.result = GameResult::None;
        game.vote_session = 0;
        game.meeting_caller = None;

        let ps = &mut ctx.accounts.player_state;
        ps.game_id = game_id;
        ps.player = host;
        ps.role = Role::Unassigned;
        ps.is_alive = true;
        ps.tasks_done = 0;
        ps.kill_cooldown = 0;
        ps.meetings_called = 0;

        msg!("Game {} created by host {}", game_id, host);
        Ok(())
    }

    // ── 2. Join Game ────────────────────────────────────────
    /// Any player joins the lobby before the game starts.
    /// Called on the base layer.
    pub fn join_game(ctx: Context<JoinGame>, game_id: u64) -> Result<()> {
        let game = &mut ctx.accounts.game;
        let player = ctx.accounts.player.key();

        require!(
            game.phase == GamePhase::Lobby,
            GameError::GameAlreadyStarted
        );
        require!(
            (game.player_count as usize) < MAX_PLAYERS,
            GameError::LobbyFull
        );
        require!(
            !game.players[..game.player_count as usize].contains(&player),
            GameError::AlreadyInGame
        );

        let idx = game.player_count as usize;
        game.players[idx] = player;
        game.alive[idx] = true;
        game.player_count += 1;

        let ps = &mut ctx.accounts.player_state;
        ps.game_id = game_id;
        ps.player = player;
        ps.role = Role::Unassigned;
        ps.is_alive = true;
        ps.tasks_done = 0;
        ps.kill_cooldown = 0;
        ps.meetings_called = 0;

        msg!("Player {} joined game {} (slot {})", player, game_id, idx);
        Ok(())
    }

    // ── 3. Start Game ───────────────────────────────────────
    /// Host starts the game. Runs inside the private TEE.
    /// Transitions phase to Playing, sets task totals, and assigns roles automatically.
    pub fn start_game(ctx: Context<StartGame>) -> Result<()> {
        let game = &mut ctx.accounts.game;

        require!(ctx.accounts.host.key() == game.host, GameError::NotHost);
        require!(
            game.phase == GamePhase::Lobby,
            GameError::GameAlreadyStarted
        );

        let player_count = game.player_count as usize;
        require!(player_count >= MIN_PLAYERS, GameError::NotEnoughPlayers);
        require!(
            ctx.remaining_accounts.len() == player_count,
            GameError::MissingPlayerAccounts
        );

        game.phase = GamePhase::Playing;
        // 1 impostor per 5 players, minimum 1
        game.impostor_count = std::cmp::max(1, game.player_count / 5);
        let crewmate_count = game.player_count - game.impostor_count;
        game.total_tasks = crewmate_count * TASKS_PER_CREWMATE;

        // Pseudo-random selection of impostors
        let clock = Clock::get()?;
        let random_seed = clock.unix_timestamp as usize ^ clock.slot as usize;

        let mut impostor_indices = vec![];
        let mut seed = random_seed;
        while impostor_indices.len() < game.impostor_count as usize {
            let idx = seed % player_count;
            if !impostor_indices.contains(&idx) {
                impostor_indices.push(idx);
            }
            seed = seed.wrapping_add(17); // advance seed
        }

        // Process each remaining account as a PlayerState
        for (i, account_info) in ctx.remaining_accounts.iter().enumerate() {
            require!(account_info.is_writable, GameError::Unauthorized);

            let data = account_info.try_borrow_data()?;
            let mut ps = PlayerState::try_deserialize(&mut &data[..])?;
            drop(data);

            require!(ps.game_id == game.game_id, GameError::Unauthorized);
            require!(ps.player == game.players[i], GameError::Unauthorized);
            require!(ps.role == Role::Unassigned, GameError::RoleAlreadyAssigned);

            let role = if impostor_indices.contains(&i) {
                game.alive_impostors += 1;
                Role::Impostor
            } else {
                game.alive_crewmates += 1;
                Role::Crewmate
            };

            ps.role = role;
            // Set initial 10-second cooldown so impostors can't spawn-kill
            ps.kill_cooldown = clock.unix_timestamp + 10;

            let mut out_data = account_info.try_borrow_mut_data()?;
            ps.try_serialize(&mut *out_data)?;
        }

        msg!(
            "Game {} started: {} players, {} impostors, {} total tasks",
            game.game_id,
            game.player_count,
            game.impostor_count,
            game.total_tasks
        );
        Ok(())
    }

    // ── 5. Complete Task ────────────────────────────────────
    /// Crewmate completes a task. Runs in private TEE.
    /// TEE validates the player's hidden role.
    pub fn complete_task(ctx: Context<PlayerAction>) -> Result<()> {
        let game = &mut ctx.accounts.game;
        let ps = &mut ctx.accounts.player_state;

        require!(game.phase == GamePhase::Playing, GameError::InvalidPhase);
        require!(ps.is_alive, GameError::PlayerDead);
        require!(ps.role == Role::Crewmate, GameError::InvalidRole);
        require!(
            ctx.accounts.player.key() == ps.player,
            GameError::Unauthorized
        );
        require!(ps.tasks_done < TASKS_PER_CREWMATE, GameError::TooManyTasks);

        ps.tasks_done += 1;
        game.tasks_completed += 1;

        msg!(
            "Task completed by {} ({}/{})",
            ps.player,
            game.tasks_completed,
            game.total_tasks
        );

        if game.tasks_completed >= game.total_tasks {
            game.phase = GamePhase::Ended;
            game.result = GameResult::CrewmatesWin;
            msg!("Crewmates win by completing all tasks!");
        }

        Ok(())
    }

    // ── 6. Kill Player ──────────────────────────────────────
    /// Impostor kills a crewmate. Runs in the private TEE.
    /// TEE validates the killer's hidden role + enforces cooldown.
    /// Victims are always crewmates (impostors cannot kill each other).
    pub fn kill_player(ctx: Context<KillAction>) -> Result<()> {
        let game = &mut ctx.accounts.game;
        let killer_state = &mut ctx.accounts.killer_state;
        let victim_state = &mut ctx.accounts.victim_state;

        require!(game.phase == GamePhase::Playing, GameError::InvalidPhase);
        require!(
            ctx.accounts.killer.key() == killer_state.player,
            GameError::Unauthorized
        );
        require!(killer_state.is_alive, GameError::PlayerDead);
        require!(killer_state.role == Role::Impostor, GameError::InvalidRole);
        require!(victim_state.is_alive, GameError::PlayerDead);
        // Impostors cannot kill each other
        require!(
            victim_state.role == Role::Crewmate,
            GameError::InvalidTarget
        );

        // Enforce kill cooldown
        let now = Clock::get()?.unix_timestamp;
        require!(now >= killer_state.kill_cooldown, GameError::KillOnCooldown);

        // Kill the victim and update counters
        let victim_key = victim_state.player;
        victim_state.is_alive = false;
        killer_state.kill_cooldown = now + KILL_COOLDOWN_SECS;
        game.alive_crewmates -= 1;

        // Mark dead in game.alive[] for public tracking
        for i in 0..(game.player_count as usize) {
            if game.players[i] == victim_key {
                game.alive[i] = false;
                break;
            }
        }

        msg!(
            "Crewmate {} was killed by impostor {}",
            victim_key,
            killer_state.player
        );

        check_win_condition(game);

        Ok(())
    }

    // ── 7. Call Meeting ─────────────────────────────────────
    /// Any alive player calls an emergency meeting. Runs in TEE.
    /// Creates a fresh VoteState for this voting round.
    pub fn call_meeting(ctx: Context<CallMeeting>, _game_id: u64) -> Result<()> {
        let game = &mut ctx.accounts.game;
        let caller_state = &mut ctx.accounts.caller_state;

        require!(game.phase == GamePhase::Playing, GameError::InvalidPhase);
        require!(
            ctx.accounts.caller.key() == caller_state.player,
            GameError::Unauthorized
        );
        require!(caller_state.is_alive, GameError::PlayerDead);
        require!(
            caller_state.meetings_called < MAX_MEETINGS_PER_PLAYER,
            GameError::TooManyMeetings
        );

        caller_state.meetings_called += 1;
        game.phase = GamePhase::Meeting;
        game.meeting_caller = Some(ctx.accounts.caller.key());
        game.vote_session += 1;

        let vote = &mut ctx.accounts.vote_state;
        vote.game_id = game.game_id;
        vote.session = game.vote_session;
        vote.vote_count = 0;
        vote.votes = [VoteEntry {
            voter: Pubkey::default(),
            target: None,
        }; MAX_PLAYERS];
        vote.eliminated = None;
        vote.resolved = false;

        msg!(
            "Meeting called by {} — vote session {}",
            ctx.accounts.caller.key(),
            game.vote_session
        );
        Ok(())
    }

    // ── 8. Submit Vote ──────────────────────────────────────
    /// Alive player casts their vote. Runs in private TEE.
    /// Pass `target = None` to skip.
    pub fn submit_vote(ctx: Context<SubmitVote>, target: Option<Pubkey>) -> Result<()> {
        let game = &ctx.accounts.game;
        let vote = &mut ctx.accounts.vote_state;
        let voter_state = &ctx.accounts.voter_state;

        require!(game.phase == GamePhase::Meeting, GameError::InvalidPhase);
        require!(
            ctx.accounts.voter.key() == voter_state.player,
            GameError::Unauthorized
        );
        require!(voter_state.is_alive, GameError::PlayerDead);
        require!(!vote.resolved, GameError::VoteAlreadyResolved);

        let voter_key = ctx.accounts.voter.key();

        // Prevent double-voting
        for i in 0..(vote.vote_count as usize) {
            require!(vote.votes[i].voter != voter_key, GameError::AlreadyVoted);
        }

        // Validate target is a registered player
        if let Some(t) = target {
            require!(
                game.players[..game.player_count as usize].contains(&t),
                GameError::InvalidTarget
            );
        }

        let idx = vote.vote_count as usize;
        vote.votes[idx] = VoteEntry {
            voter: voter_key,
            target,
        };
        vote.vote_count += 1;

        msg!("Player {} voted (target: {:?})", voter_key, target);
        Ok(())
    }

    // ── 9. Resolve Vote ─────────────────────────────────────
    /// TEE tallies votes and eliminates the most-voted player.
    /// `ejected_state` MUST be the eliminated player's PlayerState.
    /// The TEE pre-simulates the tally and supplies this account.
    /// If it's a tie or all-skip, pass ejected_state = None.
    pub fn resolve_vote(ctx: Context<ResolveVote>) -> Result<()> {
        let game = &mut ctx.accounts.game;
        let vote = &mut ctx.accounts.vote_state;

        require!(game.phase == GamePhase::Meeting, GameError::InvalidPhase);
        require!(!vote.resolved, GameError::VoteAlreadyResolved);

        // ── Tally ───────────────────────────────────────────
        let mut tally: [(Pubkey, u8); MAX_PLAYERS] = [(Pubkey::default(), 0); MAX_PLAYERS];
        let mut tally_len: usize = 0;

        for i in 0..(vote.vote_count as usize) {
            let Some(target) = vote.votes[i].target else {
                continue;
            };
            let mut found = false;
            for j in 0..tally_len {
                if tally[j].0 == target {
                    tally[j].1 += 1;
                    found = true;
                    break;
                }
            }
            if !found {
                tally[tally_len] = (target, 1);
                tally_len += 1;
            }
        }

        // Find highest vote-getter; detect ties
        let mut max_votes: u8 = 0;
        let mut max_count: usize = 0;
        let mut ejected: Option<Pubkey> = None;

        for i in 0..tally_len {
            if tally[i].1 > max_votes {
                max_votes = tally[i].1;
                max_count = 1;
                ejected = Some(tally[i].0);
            } else if tally[i].1 == max_votes {
                max_count += 1;
            }
        }
        if max_count > 1 {
            ejected = None; // tie → no elimination
        }

        vote.eliminated = ejected;
        vote.resolved = true;

        // ── Process ejection ────────────────────────────────
        if let Some(ejected_key) = ejected {
            // Mark dead in game.alive[]
            for i in 0..(game.player_count as usize) {
                if game.players[i] == ejected_key {
                    game.alive[i] = false;
                    break;
                }
            }

            // Update live counters using the ejected player's private state
            let ejected_state = ctx
                .accounts
                .ejected_state
                .as_mut()
                .ok_or(GameError::MissingEjectedState)?;
            require!(
                ejected_state.player == ejected_key,
                GameError::InvalidTarget
            );
            ejected_state.is_alive = false;
            match ejected_state.role {
                Role::Impostor => {
                    game.alive_impostors -= 1;
                    msg!("Impostor {} was ejected!", ejected_key);
                }
                Role::Crewmate => {
                    game.alive_crewmates -= 1;
                    msg!("Crewmate {} was ejected (oops).", ejected_key);
                }
                Role::Unassigned => {}
            }
        } else {
            msg!("No one ejected (tie or all skipped).");
        }

        // Return to Playing and check win
        game.phase = GamePhase::Playing;
        game.meeting_caller = None;

        check_win_condition(game);

        Ok(())
    }

    // ── 10. Finalize Game ───────────────────────────────────
    /// Commits the final GameState to Solana base layer.
    /// Removes permissions and undelegates GameState.
    /// Called in TEE once game.phase == Ended.
    pub fn finalize_game(ctx: Context<FinalizeGame>) -> Result<()> {
        let game = &mut ctx.accounts.game;

        require!(game.phase == GamePhase::Ended, GameError::GameNotOver);

        let permission_program = &ctx.accounts.permission_program.to_account_info();
        let permission_game = &ctx.accounts.permission_game.to_account_info();
        let magic_program = &ctx.accounts.magic_program.to_account_info();
        let magic_context = &ctx.accounts.magic_context.to_account_info();

        // Strip game account permissions before undelegating
        UpdatePermissionCpiBuilder::new(permission_program)
            .permission(permission_game)
            .delegated_account(&game.to_account_info())
            .group(&ctx.accounts.group.to_account_info())
            .invoke_signed(&[&[GAME_SEED, &game.game_id.to_le_bytes(), &[ctx.bumps.game]]])?;

        msg!(
            "Game {} finalized on Solana. Result: {:?}",
            game.game_id,
            game.result
        );

        game.exit(&crate::ID)?;

        commit_and_undelegate_accounts(
            &ctx.accounts.payer,
            vec![&game.to_account_info()],
            magic_context,
            magic_program,
        )?;

        Ok(())
    }

    // ── 11. Delegate PDA ────────────────────────────────────
    /// Delegates any PDA to the private TEE ER validator.
    /// Call once per PDA (game, each player, each vote round).
    pub fn delegate_pda(ctx: Context<DelegatePda>, account_type: AccountType) -> Result<()> {
        let seed_data = derive_seeds(&account_type);
        let seeds_refs: Vec<&[u8]> = seed_data.iter().map(|s| s.as_slice()).collect();

        let validator = ctx.accounts.validator.as_ref().map(|v| v.key());
        ctx.accounts.delegate_pda(
            &ctx.accounts.payer,
            &seeds_refs,
            DelegateConfig {
                validator,
                ..Default::default()
            },
        )?;
        Ok(())
    }

    // ── 12. Create Permission ───────────────────────────────
    /// Creates a TEE read-permission for a PDA.
    ///
    /// Key privacy rule: for PlayerState PDAs, only grant the
    /// `AUTHORITY_FLAG` to the owning player — not to others.
    /// This makes each player's role invisible to opponents in the
    /// private ER, even though the TEE validator can see everything.
    pub fn create_permission(
        ctx: Context<CreatePermission>,
        account_type: AccountType,
    ) -> Result<()> {
        let CreatePermission {
            permissioned_account,
            permission,
            group,
            payer,
            permission_program,
            system_program,
        } = ctx.accounts;

        let seed_data = derive_seeds(&account_type);
        let (_, bump) = Pubkey::find_program_address(
            &seed_data.iter().map(|s| s.as_slice()).collect::<Vec<_>>(),
            &crate::ID,
        );

        let mut seeds = seed_data.clone();
        seeds.push(vec![bump]);
        let seed_refs: Vec<&[u8]> = seeds.iter().map(|s| s.as_slice()).collect();

        CreatePermissionCpiBuilder::new(&permission_program.to_account_info())
            .permission(&permission.to_account_info())
            .delegated_account(&permissioned_account.to_account_info())
            .group(&group.to_account_info())
            .payer(&payer.to_account_info())
            .system_program(&system_program.to_account_info())
            .invoke_signed(&[seed_refs.as_slice()])?;

        Ok(())
    }
}

// ─────────────────────────────────────────────────────────
// Win condition (non-instruction helper)
// ─────────────────────────────────────────────────────────
fn check_win_condition(game: &mut Account<GameState>) {
    if game.phase == GamePhase::Ended {
        return;
    }
    if game.alive_impostors == 0 {
        game.phase = GamePhase::Ended;
        game.result = GameResult::CrewmatesWin;
        msg!("Crewmates win — all impostors ejected/dead!");
    } else if game.alive_impostors >= game.alive_crewmates {
        game.phase = GamePhase::Ended;
        game.result = GameResult::ImpostorsWin;
        msg!("Impostors win — they outnumber the crew!");
    }
}

// ─────────────────────────────────────────────────────────
// Account Contexts
// ─────────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(game_id: u64)]
pub struct CreateGame<'info> {
    #[account(
        init_if_needed,
        payer = host,
        space = 8 + GameState::LEN,
        seeds = [GAME_SEED, &game_id.to_le_bytes()],
        bump
    )]
    pub game: Account<'info, GameState>,

    #[account(
        init_if_needed,
        payer = host,
        space = 8 + PlayerState::LEN,
        seeds = [PLAYER_SEED, &game_id.to_le_bytes(), host.key().as_ref()],
        bump
    )]
    pub player_state: Account<'info, PlayerState>,

    #[account(mut)]
    pub host: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(game_id: u64)]
pub struct JoinGame<'info> {
    #[account(
        mut,
        seeds = [GAME_SEED, &game_id.to_le_bytes()],
        bump
    )]
    pub game: Account<'info, GameState>,

    #[account(
        init_if_needed,
        payer = player,
        space = 8 + PlayerState::LEN,
        seeds = [PLAYER_SEED, &game_id.to_le_bytes(), player.key().as_ref()],
        bump
    )]
    pub player_state: Account<'info, PlayerState>,

    #[account(mut)]
    pub player: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct StartGame<'info> {
    #[account(
        mut,
        seeds = [GAME_SEED, &game.game_id.to_le_bytes()],
        bump
    )]
    pub game: Account<'info, GameState>,
    #[account(mut)]
    pub host: Signer<'info>,
}

#[derive(Accounts)]
pub struct PlayerAction<'info> {
    #[account(
        mut,
        seeds = [GAME_SEED, &game.game_id.to_le_bytes()],
        bump
    )]
    pub game: Account<'info, GameState>,

    #[account(
        mut,
        seeds = [PLAYER_SEED, &game.game_id.to_le_bytes(), player.key().as_ref()],
        bump
    )]
    pub player_state: Account<'info, PlayerState>,

    #[account(mut)]
    pub player: Signer<'info>,
}

#[derive(Accounts)]
pub struct KillAction<'info> {
    #[account(
        mut,
        seeds = [GAME_SEED, &game.game_id.to_le_bytes()],
        bump
    )]
    pub game: Account<'info, GameState>,

    #[account(
        mut,
        seeds = [PLAYER_SEED, &game.game_id.to_le_bytes(), killer.key().as_ref()],
        bump
    )]
    pub killer_state: Account<'info, PlayerState>,

    /// The victim's PlayerState is needed to validate role + update liveness.
    /// Only the TEE can see this account in full — the victim's role is hidden
    /// from all other players via the permission system.
    #[account(
        mut,
        seeds = [PLAYER_SEED, &game.game_id.to_le_bytes(), victim_state.player.as_ref()],
        bump
    )]
    pub victim_state: Account<'info, PlayerState>,

    #[account(mut)]
    pub killer: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(game_id: u64)]
pub struct CallMeeting<'info> {
    #[account(
        mut,
        seeds = [GAME_SEED, &game_id.to_le_bytes()],
        bump
    )]
    pub game: Account<'info, GameState>,

    #[account(
        mut,
        seeds = [PLAYER_SEED, &game_id.to_le_bytes(), caller.key().as_ref()],
        bump
    )]
    pub caller_state: Account<'info, PlayerState>,

    #[account(
        init,
        payer = caller,
        space = 8 + VoteState::LEN,
        seeds = [VOTE_SEED, &game_id.to_le_bytes(), &[game.vote_session + 1]],
        bump
    )]
    pub vote_state: Account<'info, VoteState>,

    #[account(mut)]
    pub caller: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SubmitVote<'info> {
    #[account(
        seeds = [GAME_SEED, &game.game_id.to_le_bytes()],
        bump
    )]
    pub game: Account<'info, GameState>,

    #[account(
        mut,
        seeds = [VOTE_SEED, &game.game_id.to_le_bytes(), &[game.vote_session]],
        bump
    )]
    pub vote_state: Account<'info, VoteState>,

    #[account(
        seeds = [PLAYER_SEED, &game.game_id.to_le_bytes(), voter.key().as_ref()],
        bump
    )]
    pub voter_state: Account<'info, PlayerState>,

    #[account(mut)]
    pub voter: Signer<'info>,
}

#[derive(Accounts)]
pub struct ResolveVote<'info> {
    #[account(
        mut,
        seeds = [GAME_SEED, &game.game_id.to_le_bytes()],
        bump
    )]
    pub game: Account<'info, GameState>,

    #[account(
        mut,
        seeds = [VOTE_SEED, &game.game_id.to_le_bytes(), &[game.vote_session]],
        bump
    )]
    pub vote_state: Account<'info, VoteState>,

    /// The ejected player's private state. TEE pre-simulates the tally,
    /// then supplies the correct account here so the contract can update
    /// alive_impostors / alive_crewmates. Pass None when no one is ejected.
    pub ejected_state: Option<Account<'info, PlayerState>>,

    #[account(mut)]
    pub payer: Signer<'info>,
}

/// #[commit] adds magic_context and magic_program to this struct automatically.
#[commit]
#[derive(Accounts)]
pub struct FinalizeGame<'info> {
    #[account(
        mut,
        seeds = [GAME_SEED, &game.game_id.to_le_bytes()],
        bump
    )]
    pub game: Account<'info, GameState>,

    /// CHECK: Checked by the permission program
    #[account(mut)]
    pub permission_game: UncheckedAccount<'info>,

    /// CHECK: Target group (e.g. System Program to strip)
    pub group: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: PERMISSION PROGRAM
    #[account(address = MAGICBLOCK_PERMISSION_PROGRAM_ID)]
    pub permission_program: UncheckedAccount<'info>,
}

#[delegate]
#[derive(Accounts)]
pub struct DelegatePda<'info> {
    /// CHECK: The PDA to delegate
    #[account(mut, del)]
    pub pda: AccountInfo<'info>,
    pub payer: Signer<'info>,
    /// CHECK: Checked by the delegate program
    pub validator: Option<AccountInfo<'info>>,
}

#[derive(Accounts)]
pub struct CreatePermission<'info> {
    /// CHECK: Validated via permission program CPI
    pub permissioned_account: UncheckedAccount<'info>,
    /// CHECK: Checked by the permission program
    #[account(mut)]
    pub permission: UncheckedAccount<'info>,
    /// CHECK: The group account
    pub group: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: PERMISSION PROGRAM
    #[account(address = MAGICBLOCK_PERMISSION_PROGRAM_ID)]
    pub permission_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

// ─────────────────────────────────────────────────────────
// Account Data Structures
// ─────────────────────────────────────────────────────────

/// Public game state — visible to everyone on Solana.
/// Tracks player list, phase, and aggregate counters.
/// Individual roles are NOT stored here.
#[account]
pub struct GameState {
    pub game_id: u64,                   // 8
    pub host: Pubkey,                   // 32
    pub player_count: u8,               // 1
    pub players: [Pubkey; MAX_PLAYERS], // 320
    pub alive: [bool; MAX_PLAYERS],     // 10
    pub phase: GamePhase,               // 1
    pub impostor_count: u8,             // 1
    pub alive_impostors: u8,            // 1
    pub alive_crewmates: u8,            // 1
    pub tasks_completed: u8,            // 1
    pub total_tasks: u8,                // 1
    pub result: GameResult,             // 1
    pub vote_session: u8,               // 1
    pub meeting_caller: Option<Pubkey>, // 33
}
impl GameState {
    pub const LEN: usize = 8
        + 32
        + 1
        + 32 * MAX_PLAYERS
        + MAX_PLAYERS
        + 1  // phase
        + 1  // impostor_count
        + 1  // alive_impostors
        + 1  // alive_crewmates
        + 1  // tasks_completed
        + 1  // total_tasks
        + 1  // result
        + 1  // vote_session
        + 33; // meeting_caller
}

/// Private player state — delegated to the TEE.
/// Each PDA is permissioned so ONLY the owning player can read it.
/// The TEE validator sees all; no other player sees another's role.
#[account]
pub struct PlayerState {
    pub game_id: u64,        // 8
    pub player: Pubkey,      // 32
    pub role: Role,          // 1
    pub is_alive: bool,      // 1
    pub tasks_done: u8,      // 1
    pub kill_cooldown: i64,  // 8
    pub meetings_called: u8, // 1
}
impl PlayerState {
    pub const LEN: usize = 8 + 32 + 1 + 1 + 1 + 8 + 1;
}

/// Vote state for one meeting round.
#[account]
pub struct VoteState {
    pub game_id: u64,                    // 8
    pub session: u8,                     // 1
    pub votes: [VoteEntry; MAX_PLAYERS], // 10 * 65 = 650
    pub vote_count: u8,                  // 1
    pub eliminated: Option<Pubkey>,      // 33
    pub resolved: bool,                  // 1
}
impl VoteState {
    // VoteEntry = 32 (voter) + 1 (Option tag) + 32 (target pubkey) = 65
    pub const LEN: usize = 8 + 1 + 65 * MAX_PLAYERS + 1 + 33 + 1;
}

// ─────────────────────────────────────────────────────────
// Compound Types
// ─────────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub struct VoteEntry {
    pub voter: Pubkey,          // 32
    pub target: Option<Pubkey>, // 33
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub enum Role {
    Unassigned,
    Crewmate,
    Impostor,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub enum GamePhase {
    Lobby,
    Playing,
    Meeting,
    Ended,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub enum GameResult {
    None,
    CrewmatesWin,
    ImpostorsWin,
}

// ─────────────────────────────────────────────────────────
// Generic PDA helpers
// ─────────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub enum AccountType {
    Game { game_id: u64 },
    Player { game_id: u64, player: Pubkey },
    Vote { game_id: u64, session: u8 },
}

pub fn derive_seeds(account_type: &AccountType) -> Vec<Vec<u8>> {
    match account_type {
        AccountType::Game { game_id } => {
            vec![GAME_SEED.to_vec(), game_id.to_le_bytes().to_vec()]
        }
        AccountType::Player { game_id, player } => vec![
            PLAYER_SEED.to_vec(),
            game_id.to_le_bytes().to_vec(),
            player.to_bytes().to_vec(),
        ],
        AccountType::Vote { game_id, session } => vec![
            VOTE_SEED.to_vec(),
            game_id.to_le_bytes().to_vec(),
            vec![*session],
        ],
    }
}

// ─────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────

#[error_code]
pub enum GameError {
    #[msg("Game has already started.")]
    GameAlreadyStarted,
    #[msg("Lobby is full (max 10 players).")]
    LobbyFull,
    #[msg("You are already in this game.")]
    AlreadyInGame,
    #[msg("Not enough players to start (min 4).")]
    NotEnoughPlayers,
    #[msg("Only the host can perform this action.")]
    NotHost,
    #[msg("Invalid game phase for this action.")]
    InvalidPhase,
    #[msg("This player is dead.")]
    PlayerDead,
    #[msg("Invalid role for this action.")]
    InvalidRole,
    #[msg("Kill is on cooldown.")]
    KillOnCooldown,
    #[msg("Unauthorized signer.")]
    Unauthorized,
    #[msg("Role has already been assigned.")]
    RoleAlreadyAssigned,
    #[msg("Vote has already been resolved.")]
    VoteAlreadyResolved,
    #[msg("You have already voted this session.")]
    AlreadyVoted,
    #[msg("Invalid vote target or ejected player account mismatch.")]
    InvalidTarget,
    #[msg("Missing or incorrect number of player accounts provided.")]
    MissingPlayerAccounts,
    #[msg("Missing ejected state account data.")]
    MissingEjectedState,
    #[msg("Dead players cannot perform this action.")]
    DeadPlayerCannotAct,
    #[msg("You have completed all your tasks.")]
    TooManyTasks,
    #[msg("You have reached the maximum number of emergency meetings.")]
    TooManyMeetings,
    #[msg("The game is not over yet.")]
    GameNotOver,
}
