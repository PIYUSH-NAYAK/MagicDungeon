#!/usr/bin/env python3
"""
replay_commits.py
-----------------
Removes the current .git directory, re-initializes the repository,
then replays every original commit (in chronological order) preserving
the original commit message and timestamp — but using PIYUSH-NAYAK as
the sole author/committer for every commit.

Finally it sets the remote to the new GitHub repo and pushes.

Usage:
    python3 replay_commits.py
"""

import subprocess
import sys
import os
import shutil

# ── Configuration ────────────────────────────────────────────────────────────
AUTHOR_NAME  = "PIYUSH-NAYAK"
AUTHOR_EMAIL = "piyushnayak90020@gmail.com"
REMOTE_URL   = "https://github.com/PIYUSH-NAYAK/MagicDungeon.git"
BRANCH       = "main"
REPO_DIR     = os.path.dirname(os.path.abspath(__file__))
# ─────────────────────────────────────────────────────────────────────────────

# Commits in chronological order: (hash, author_date_iso, commit_message)
COMMITS = [
    ("83dfe3368687ae53513fc2a6386236a47b2d5883", "2026-01-18 21:27:32 +0530", "first commit"),
    ("0a397515ff7ea54f5086c96ce1d24b36a0a2b9d7", "2026-01-18 21:27:39 +0530", "updates"),
    ("38f4f137f7469330c7be9a3ee393b8505d352322", "2026-03-21 03:00:33 +0530", "projectss"),
    ("8856a8e63822d6018d8a9fb558921885e8c39aff", "2026-03-22 04:20:18 +0530", "done"),
    ("0369fc713107e749789f47db016740ab0d1c7454", "2026-03-22 04:51:25 +0530", "feat: multiplayer sync, ring spawn, N-player character visibility fixes"),
    ("38416866cb49405c5488a400b1175f766428e036", "2026-03-22 05:32:37 +0530", "feat(task2): UI redesign — HUD top-left player card, map selector, TPP camera"),
    ("590d4fda8c71aeaf4fa9aba84b9d16cada3d3e49", "2026-03-22 05:52:35 +0530", "feat(task3): Solana/MagicBlock ER contract integration"),
    ("2c4ce62c682ab27d9f3b78b4d5b0770e41fcf294", "2026-03-22 05:56:25 +0530", "fix: add vite-plugin-node-polyfills for Buffer/global/process (Solana SDK browser compat)"),
    ("f9ac3379cc00f49960b659e49da978dd5214c4b3", "2026-03-22 06:03:23 +0530", "feat(task3): complete on-chain action wiring"),
    ("dac5bf4a72a2f9ee9e640f4702708f7687039f44", "2026-03-22 12:22:10 +0530", "feat(task3): full game flow, delegating screen, ChainLog, localStorage, resolveVote"),
    ("c6bd11059cc9f878706945b4e7d96db880b40d3b", "2026-03-22 12:30:58 +0530", "fix: Phantom not triggering — move delegation from useEffect to button click"),
    ("dd94d4100511c4ebc8051523d82405278e677cf2", "2026-03-22 12:46:24 +0530", "fix: correct IDL accounts for create_permission and delegate_pda"),
    ("730f1a6d03cf51425f61a53d9f6ec7d0796ee939", "2026-03-22 13:01:31 +0530", "fix: derive groupPdaFromId manually — add group account to createPermGame/Player"),
    ("8c237555e38cee79d28510fb69c0c883e6c4cdab", "2026-03-22 13:09:23 +0530", "fix: createPermPlayer group = groupPdaFromId(myPda) not publicKey"),
    ("1c1f926c65f1fa13572473b3736b17f11a0c0903", "2026-03-22 13:31:12 +0530", "feat: lobby Start gate + delegation screen spec-accurate"),
    ("7e3b7959fb981fb115c410d4766861e9f3b2514a", "2026-03-22 13:38:46 +0530", "debug: simulate TX before send to expose real program error in console"),
    ("d90c34f0333968f991d17b918475640b1126942d", "2026-03-22 13:41:36 +0530", "fix: correct PERMISSION_PROGRAM_ID to BTWAqWN (confirmed from on-chain error)"),
    ("68855aa16fb583d919e4c64ab8669aa7f58e94d6", "2026-03-22 14:30:32 +0530", "Pregame connection done"),
    ("25fdec7dab6d54027500127065d9da40332fb2f9", "2026-03-22 17:12:43 +0530", "feat: full game flow — roles, kill cooldown, ghost system, reconnect & map tester"),
    ("4b11c65d33b29f4202b5198458239d7acbac4890", "2026-03-22 17:27:47 +0530", "task completion and kill done"),
    ("1286b1b135542785699ae83a72a8c3cf294de051", "2026-03-22 22:23:30 +0530", "feat: full game polish — tasks, roles, maps, ER reliability"),
]


def run(cmd, env=None, check=True, capture=False):
    """Run a shell command, print it, raise on failure."""
    print(f"  $ {' '.join(cmd)}")
    kwargs = dict(cwd=REPO_DIR, env={**os.environ, **(env or {})})
    if capture:
        kwargs["capture_output"] = True
        kwargs["text"] = True
    result = subprocess.run(cmd, **kwargs)
    if check and result.returncode != 0:
        stderr = getattr(result, "stderr", "")
        print(f"\n[ERROR] Command failed (exit {result.returncode}): {stderr}")
        sys.exit(result.returncode)
    return result


def get_files_at_commit(commit_hash):
    """Return sorted list of tracked file paths at a given commit (using git ls-tree)."""
    result = subprocess.run(
        ["git", "ls-tree", "-r", "--name-only", commit_hash],
        cwd=REPO_DIR,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip().splitlines()


def checkout_file_at_commit(commit_hash, file_path):
    """Restore a single file to its state at the given commit into the working tree."""
    subprocess.run(
        ["git", "checkout", commit_hash, "--", file_path],
        cwd=REPO_DIR,
        check=True,
    )


def main():
    print("=" * 60)
    print("  Magic Dungeon — Git History Replay Script")
    print(f"  Author : {AUTHOR_NAME} <{AUTHOR_EMAIL}>")
    print(f"  Remote : {REMOTE_URL}")
    print("=" * 60)

    # ── Step 1: Save the old HEAD for file checkouts ─────────────────────────
    # We need the original repo to still be intact at this point so we can
    # restore files per-commit. We'll work from a TEMP bare clone.
    print("\n[1/6] Cloning current repo to a temp bare backup …")
    tmp_bare = "/tmp/magic_dungeon_backup.git"
    if os.path.exists(tmp_bare):
        shutil.rmtree(tmp_bare)
    subprocess.run(
        ["git", "clone", "--bare", REPO_DIR, tmp_bare],
        check=True,
    )
    print(f"      Bare backup at: {tmp_bare}")

    # ── Step 2: Nuke .git ────────────────────────────────────────────────────
    print("\n[2/6] Removing .git directory …")
    git_dir = os.path.join(REPO_DIR, ".git")
    if os.path.isdir(git_dir):
        shutil.rmtree(git_dir)
        print("      .git removed.")
    else:
        print("      No .git found, skipping.")

    # ── Step 3: git init ─────────────────────────────────────────────────────
    print("\n[3/6] Initializing fresh repository …")
    run(["git", "init"])
    run(["git", "checkout", "-b", BRANCH])

    # Configure local identity
    run(["git", "config", "user.name",  AUTHOR_NAME])
    run(["git", "config", "user.email", AUTHOR_EMAIL])

    # ── Step 4: Replay commits ───────────────────────────────────────────────
    print(f"\n[4/6] Replaying {len(COMMITS)} commits …")

    # We restore files by reading from the bare backup
    def restore_snapshot(commit_hash):
        """Restore the working tree to the state of commit_hash (from bare backup)."""
        # Get files tracked at that commit
        result = subprocess.run(
            ["git", "--git-dir", tmp_bare, "ls-tree", "-r", "--name-only", commit_hash],
            capture_output=True, text=True, check=True,
        )
        tracked_files = result.stdout.strip().splitlines()

        # Clear current working tree (keep .git and the script itself)
        script_name = os.path.basename(__file__)
        for item in os.listdir(REPO_DIR):
            if item in (".git", script_name):
                continue
            full = os.path.join(REPO_DIR, item)
            if os.path.isdir(full):
                shutil.rmtree(full)
            else:
                os.remove(full)

        # Restore every file from the bare backup at the given commit
        for file_path in tracked_files:
            target = os.path.join(REPO_DIR, file_path)
            os.makedirs(os.path.dirname(target), exist_ok=True) if os.path.dirname(target) else None
            content = subprocess.run(
                ["git", "--git-dir", tmp_bare, "show", f"{commit_hash}:{file_path}"],
                capture_output=True, check=True,
            ).stdout
            with open(target, "wb") as f:
                f.write(content)

    for i, (commit_hash, date_iso, message) in enumerate(COMMITS, 1):
        print(f"\n  [{i:02d}/{len(COMMITS)}] {message[:60]!r}  ({date_iso})")

        restore_snapshot(commit_hash)

        # Stage everything
        run(["git", "add", "-A"])

        # Commit with original timestamp and our author identity
        env_vars = {
            "GIT_AUTHOR_NAME":     AUTHOR_NAME,
            "GIT_AUTHOR_EMAIL":    AUTHOR_EMAIL,
            "GIT_AUTHOR_DATE":     date_iso,
            "GIT_COMMITTER_NAME":  AUTHOR_NAME,
            "GIT_COMMITTER_EMAIL": AUTHOR_EMAIL,
            "GIT_COMMITTER_DATE":  date_iso,
        }
        run(["git", "commit", "--allow-empty", "-m", message], env=env_vars)

    # ── Step 5: Set remote ───────────────────────────────────────────────────
    print("\n[5/6] Setting remote origin …")
    # Remove existing origin if present
    subprocess.run(["git", "remote", "remove", "origin"],
                   cwd=REPO_DIR, capture_output=True)
    run(["git", "remote", "add", "origin", REMOTE_URL])

    # ── Step 6: Push ─────────────────────────────────────────────────────────
    print("\n[6/6] Pushing to GitHub …")
    run(["git", "push", "-u", "origin", BRANCH, "--force"])

    print("\n" + "=" * 60)
    print("  ✅  All done! History replayed and pushed successfully.")
    print(f"  🔗  {REMOTE_URL}")
    print("=" * 60)


if __name__ == "__main__":
    main()
