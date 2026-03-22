/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/among_us.json`.
 */
export type AmongUs = {
  "address": "F3jhJFLdcyzN9ssRuzHVuqgaMcUMyZF1PmvVfu8Hk2C6",
  "metadata": {
    "name": "amongUs",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Among Us on-chain game with private ephemeral rollups (TEE)"
  },
  "instructions": [
    {
      "name": "callMeeting",
      "docs": [
        "Any alive player calls an emergency meeting. Runs in TEE.",
        "Creates a fresh VoteState for this voting round."
      ],
      "discriminator": [
        227,
        239,
        168,
        73,
        177,
        220,
        20,
        83
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  109,
                  111,
                  110,
                  103,
                  95,
                  117,
                  115,
                  95,
                  103,
                  97,
                  109,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "gameId"
              }
            ]
          }
        },
        {
          "name": "callerState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  109,
                  111,
                  110,
                  103,
                  95,
                  117,
                  115,
                  95,
                  112,
                  108,
                  97,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "arg",
                "path": "gameId"
              },
              {
                "kind": "account",
                "path": "caller"
              }
            ]
          }
        },
        {
          "name": "voteState",
          "writable": true
        },
        {
          "name": "caller",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "gameId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "completeTask",
      "docs": [
        "Crewmate completes a task. Runs in private TEE.",
        "TEE validates the player's hidden role."
      ],
      "discriminator": [
        109,
        167,
        192,
        41,
        129,
        108,
        220,
        196
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  109,
                  111,
                  110,
                  103,
                  95,
                  117,
                  115,
                  95,
                  103,
                  97,
                  109,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "game.game_id",
                "account": "gameState"
              }
            ]
          }
        },
        {
          "name": "playerState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  109,
                  111,
                  110,
                  103,
                  95,
                  117,
                  115,
                  95,
                  112,
                  108,
                  97,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "game.game_id",
                "account": "gameState"
              },
              {
                "kind": "account",
                "path": "player"
              }
            ]
          }
        },
        {
          "name": "player",
          "writable": true,
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "createGame",
      "docs": [
        "Host creates the lobby and joins as the first player.",
        "Called on the base layer before any delegation."
      ],
      "discriminator": [
        124,
        69,
        75,
        66,
        184,
        220,
        72,
        206
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  109,
                  111,
                  110,
                  103,
                  95,
                  117,
                  115,
                  95,
                  103,
                  97,
                  109,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "gameId"
              }
            ]
          }
        },
        {
          "name": "playerState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  109,
                  111,
                  110,
                  103,
                  95,
                  117,
                  115,
                  95,
                  112,
                  108,
                  97,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "arg",
                "path": "gameId"
              },
              {
                "kind": "account",
                "path": "host"
              }
            ]
          }
        },
        {
          "name": "host",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "gameId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "createPermission",
      "docs": [
        "Creates a TEE read-permission for a PDA.",
        "",
        "Key privacy rule: for PlayerState PDAs, only grant the",
        "`AUTHORITY_FLAG` to the owning player — not to others.",
        "This makes each player's role invisible to opponents in the",
        "private ER, even though the TEE validator can see everything."
      ],
      "discriminator": [
        190,
        182,
        26,
        164,
        156,
        221,
        8,
        0
      ],
      "accounts": [
        {
          "name": "permissionedAccount"
        },
        {
          "name": "permission",
          "writable": true
        },
        {
          "name": "group"
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "permissionProgram",
          "address": "BTWAqWNBmF2TboMh3fxMJfgR16xGHYD7Kgr2dPwbRPBi"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "accountType",
          "type": {
            "defined": {
              "name": "accountType"
            }
          }
        }
      ]
    },
    {
      "name": "delegatePda",
      "docs": [
        "Delegates any PDA to the private TEE ER validator.",
        "Call once per PDA (game, each player, each vote round)."
      ],
      "discriminator": [
        248,
        217,
        193,
        46,
        124,
        191,
        64,
        135
      ],
      "accounts": [
        {
          "name": "bufferPda",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "pda"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                208,
                183,
                13,
                193,
                83,
                178,
                105,
                158,
                50,
                53,
                128,
                69,
                66,
                225,
                17,
                23,
                230,
                233,
                16,
                130,
                66,
                167,
                119,
                17,
                136,
                221,
                234,
                230,
                75,
                103,
                174,
                191
              ]
            }
          }
        },
        {
          "name": "delegationRecordPda",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "pda"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "delegationMetadataPda",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "pda"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "pda",
          "writable": true
        },
        {
          "name": "payer",
          "signer": true
        },
        {
          "name": "validator",
          "optional": true
        },
        {
          "name": "ownerProgram",
          "address": "F3jhJFLdcyzN9ssRuzHVuqgaMcUMyZF1PmvVfu8Hk2C6"
        },
        {
          "name": "delegationProgram",
          "address": "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "accountType",
          "type": {
            "defined": {
              "name": "accountType"
            }
          }
        }
      ]
    },
    {
      "name": "finalizeGame",
      "docs": [
        "Commits the final GameState to Solana base layer.",
        "Removes permissions and undelegates GameState.",
        "Called in TEE once game.phase == Ended."
      ],
      "discriminator": [
        203,
        227,
        3,
        167,
        186,
        102,
        76,
        10
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  109,
                  111,
                  110,
                  103,
                  95,
                  117,
                  115,
                  95,
                  103,
                  97,
                  109,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "game.game_id",
                "account": "gameState"
              }
            ]
          }
        },
        {
          "name": "permissionGame",
          "writable": true
        },
        {
          "name": "group"
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "permissionProgram",
          "address": "BTWAqWNBmF2TboMh3fxMJfgR16xGHYD7Kgr2dPwbRPBi"
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        },
        {
          "name": "magicContext",
          "writable": true,
          "address": "MagicContext1111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "joinGame",
      "docs": [
        "Any player joins the lobby before the game starts.",
        "Called on the base layer."
      ],
      "discriminator": [
        107,
        112,
        18,
        38,
        56,
        173,
        60,
        128
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  109,
                  111,
                  110,
                  103,
                  95,
                  117,
                  115,
                  95,
                  103,
                  97,
                  109,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "gameId"
              }
            ]
          }
        },
        {
          "name": "playerState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  109,
                  111,
                  110,
                  103,
                  95,
                  117,
                  115,
                  95,
                  112,
                  108,
                  97,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "arg",
                "path": "gameId"
              },
              {
                "kind": "account",
                "path": "player"
              }
            ]
          }
        },
        {
          "name": "player",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "gameId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "killPlayer",
      "docs": [
        "Impostor kills a crewmate. Runs in the private TEE.",
        "TEE validates the killer's hidden role + enforces cooldown.",
        "Victims are always crewmates (impostors cannot kill each other)."
      ],
      "discriminator": [
        217,
        66,
        204,
        33,
        32,
        249,
        117,
        52
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  109,
                  111,
                  110,
                  103,
                  95,
                  117,
                  115,
                  95,
                  103,
                  97,
                  109,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "game.game_id",
                "account": "gameState"
              }
            ]
          }
        },
        {
          "name": "killerState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  109,
                  111,
                  110,
                  103,
                  95,
                  117,
                  115,
                  95,
                  112,
                  108,
                  97,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "game.game_id",
                "account": "gameState"
              },
              {
                "kind": "account",
                "path": "killer"
              }
            ]
          }
        },
        {
          "name": "victimState",
          "docs": [
            "The victim's PlayerState is needed to validate role + update liveness.",
            "Only the TEE can see this account in full — the victim's role is hidden",
            "from all other players via the permission system."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  109,
                  111,
                  110,
                  103,
                  95,
                  117,
                  115,
                  95,
                  112,
                  108,
                  97,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "game.game_id",
                "account": "gameState"
              },
              {
                "kind": "account",
                "path": "victim_state.player",
                "account": "playerState"
              }
            ]
          }
        },
        {
          "name": "killer",
          "writable": true,
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "processUndelegation",
      "discriminator": [
        196,
        28,
        41,
        206,
        48,
        37,
        51,
        167
      ],
      "accounts": [
        {
          "name": "baseAccount",
          "writable": true
        },
        {
          "name": "buffer"
        },
        {
          "name": "payer",
          "writable": true
        },
        {
          "name": "systemProgram"
        }
      ],
      "args": [
        {
          "name": "accountSeeds",
          "type": {
            "vec": "bytes"
          }
        }
      ]
    },
    {
      "name": "resolveVote",
      "docs": [
        "TEE tallies votes and eliminates the most-voted player.",
        "`ejected_state` MUST be the eliminated player's PlayerState.",
        "The TEE pre-simulates the tally and supplies this account.",
        "If it's a tie or all-skip, pass ejected_state = None."
      ],
      "discriminator": [
        190,
        135,
        168,
        149,
        112,
        96,
        20,
        138
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  109,
                  111,
                  110,
                  103,
                  95,
                  117,
                  115,
                  95,
                  103,
                  97,
                  109,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "game.game_id",
                "account": "gameState"
              }
            ]
          }
        },
        {
          "name": "voteState",
          "writable": true
        },
        {
          "name": "ejectedState",
          "docs": [
            "The ejected player's private state. TEE pre-simulates the tally,",
            "then supplies the correct account here so the contract can update",
            "alive_impostors / alive_crewmates. Pass None when no one is ejected."
          ],
          "optional": true
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "startGame",
      "docs": [
        "Host starts the game. Runs inside the private TEE.",
        "Transitions phase to Playing, sets task totals, and assigns roles automatically."
      ],
      "discriminator": [
        249,
        47,
        252,
        172,
        184,
        162,
        245,
        14
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  109,
                  111,
                  110,
                  103,
                  95,
                  117,
                  115,
                  95,
                  103,
                  97,
                  109,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "game.game_id",
                "account": "gameState"
              }
            ]
          }
        },
        {
          "name": "host",
          "writable": true,
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "submitVote",
      "docs": [
        "Alive player casts their vote. Runs in private TEE.",
        "Pass `target = None` to skip."
      ],
      "discriminator": [
        115,
        242,
        100,
        0,
        49,
        178,
        242,
        133
      ],
      "accounts": [
        {
          "name": "game",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  109,
                  111,
                  110,
                  103,
                  95,
                  117,
                  115,
                  95,
                  103,
                  97,
                  109,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "game.game_id",
                "account": "gameState"
              }
            ]
          }
        },
        {
          "name": "voteState",
          "writable": true
        },
        {
          "name": "voterState",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  109,
                  111,
                  110,
                  103,
                  95,
                  117,
                  115,
                  95,
                  112,
                  108,
                  97,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "game.game_id",
                "account": "gameState"
              },
              {
                "kind": "account",
                "path": "voter"
              }
            ]
          }
        },
        {
          "name": "voter",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "target",
          "type": {
            "option": "pubkey"
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "gameState",
      "discriminator": [
        144,
        94,
        208,
        172,
        248,
        99,
        134,
        120
      ]
    },
    {
      "name": "playerState",
      "discriminator": [
        56,
        3,
        60,
        86,
        174,
        16,
        244,
        195
      ]
    },
    {
      "name": "voteState",
      "discriminator": [
        100,
        177,
        100,
        106,
        158,
        188,
        195,
        137
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "gameAlreadyStarted",
      "msg": "Game has already started."
    },
    {
      "code": 6001,
      "name": "lobbyFull",
      "msg": "Lobby is full (max 10 players)."
    },
    {
      "code": 6002,
      "name": "alreadyInGame",
      "msg": "You are already in this game."
    },
    {
      "code": 6003,
      "name": "notEnoughPlayers",
      "msg": "Not enough players to start (min 4)."
    },
    {
      "code": 6004,
      "name": "notHost",
      "msg": "Only the host can perform this action."
    },
    {
      "code": 6005,
      "name": "invalidPhase",
      "msg": "Invalid game phase for this action."
    },
    {
      "code": 6006,
      "name": "playerDead",
      "msg": "This player is dead."
    },
    {
      "code": 6007,
      "name": "invalidRole",
      "msg": "Invalid role for this action."
    },
    {
      "code": 6008,
      "name": "killOnCooldown",
      "msg": "Kill is on cooldown."
    },
    {
      "code": 6009,
      "name": "unauthorized",
      "msg": "Unauthorized signer."
    },
    {
      "code": 6010,
      "name": "roleAlreadyAssigned",
      "msg": "Role has already been assigned."
    },
    {
      "code": 6011,
      "name": "voteAlreadyResolved",
      "msg": "Vote has already been resolved."
    },
    {
      "code": 6012,
      "name": "alreadyVoted",
      "msg": "You have already voted this session."
    },
    {
      "code": 6013,
      "name": "invalidTarget",
      "msg": "Invalid vote target or ejected player account mismatch."
    },
    {
      "code": 6014,
      "name": "missingPlayerAccounts",
      "msg": "Missing or incorrect number of player accounts provided."
    },
    {
      "code": 6015,
      "name": "missingEjectedState",
      "msg": "Missing ejected state account data."
    },
    {
      "code": 6016,
      "name": "deadPlayerCannotAct",
      "msg": "Dead players cannot perform this action."
    },
    {
      "code": 6017,
      "name": "tooManyTasks",
      "msg": "You have completed all your tasks."
    },
    {
      "code": 6018,
      "name": "tooManyMeetings",
      "msg": "You have reached the maximum number of emergency meetings."
    },
    {
      "code": 6019,
      "name": "gameNotOver",
      "msg": "The game is not over yet."
    }
  ],
  "types": [
    {
      "name": "accountType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "game",
            "fields": [
              {
                "name": "gameId",
                "type": "u64"
              }
            ]
          },
          {
            "name": "player",
            "fields": [
              {
                "name": "gameId",
                "type": "u64"
              },
              {
                "name": "player",
                "type": "pubkey"
              }
            ]
          },
          {
            "name": "vote",
            "fields": [
              {
                "name": "gameId",
                "type": "u64"
              },
              {
                "name": "session",
                "type": "u8"
              }
            ]
          }
        ]
      }
    },
    {
      "name": "gamePhase",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "lobby"
          },
          {
            "name": "playing"
          },
          {
            "name": "meeting"
          },
          {
            "name": "ended"
          }
        ]
      }
    },
    {
      "name": "gameResult",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "none"
          },
          {
            "name": "crewmatesWin"
          },
          {
            "name": "impostorsWin"
          }
        ]
      }
    },
    {
      "name": "gameState",
      "docs": [
        "Public game state — visible to everyone on Solana.",
        "Tracks player list, phase, and aggregate counters.",
        "Individual roles are NOT stored here."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "gameId",
            "type": "u64"
          },
          {
            "name": "host",
            "type": "pubkey"
          },
          {
            "name": "playerCount",
            "type": "u8"
          },
          {
            "name": "players",
            "type": {
              "array": [
                "pubkey",
                10
              ]
            }
          },
          {
            "name": "alive",
            "type": {
              "array": [
                "bool",
                10
              ]
            }
          },
          {
            "name": "phase",
            "type": {
              "defined": {
                "name": "gamePhase"
              }
            }
          },
          {
            "name": "impostorCount",
            "type": "u8"
          },
          {
            "name": "aliveImpostors",
            "type": "u8"
          },
          {
            "name": "aliveCrewmates",
            "type": "u8"
          },
          {
            "name": "tasksCompleted",
            "type": "u8"
          },
          {
            "name": "totalTasks",
            "type": "u8"
          },
          {
            "name": "result",
            "type": {
              "defined": {
                "name": "gameResult"
              }
            }
          },
          {
            "name": "voteSession",
            "type": "u8"
          },
          {
            "name": "meetingCaller",
            "type": {
              "option": "pubkey"
            }
          }
        ]
      }
    },
    {
      "name": "playerState",
      "docs": [
        "Private player state — delegated to the TEE.",
        "Each PDA is permissioned so ONLY the owning player can read it.",
        "The TEE validator sees all; no other player sees another's role."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "gameId",
            "type": "u64"
          },
          {
            "name": "player",
            "type": "pubkey"
          },
          {
            "name": "role",
            "type": {
              "defined": {
                "name": "role"
              }
            }
          },
          {
            "name": "isAlive",
            "type": "bool"
          },
          {
            "name": "tasksDone",
            "type": "u8"
          },
          {
            "name": "killCooldown",
            "type": "i64"
          },
          {
            "name": "meetingsCalled",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "role",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "unassigned"
          },
          {
            "name": "crewmate"
          },
          {
            "name": "impostor"
          }
        ]
      }
    },
    {
      "name": "voteEntry",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "voter",
            "type": "pubkey"
          },
          {
            "name": "target",
            "type": {
              "option": "pubkey"
            }
          }
        ]
      }
    },
    {
      "name": "voteState",
      "docs": [
        "Vote state for one meeting round."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "gameId",
            "type": "u64"
          },
          {
            "name": "session",
            "type": "u8"
          },
          {
            "name": "votes",
            "type": {
              "array": [
                {
                  "defined": {
                    "name": "voteEntry"
                  }
                },
                10
              ]
            }
          },
          {
            "name": "voteCount",
            "type": "u8"
          },
          {
            "name": "eliminated",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "resolved",
            "type": "bool"
          }
        ]
      }
    }
  ]
};
