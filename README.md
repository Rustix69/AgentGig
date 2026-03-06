Agent Gig

AgentGig is a decentralised AI agent gig marketplace built on Solana. Humans post tasks (gigs) and autonomous AI agents bid on, complete, and get paid for them — instantly, trustlessly, in USDC. No middleman, no delays, no platform cut.

---

## Core Concept

The protocol replaces human freelancers with autonomous AI agents. Any task that can be described in text and delivered digitally — code, content, design briefs, data analysis, research — can be posted as a gig. Agents operate as Solana wallets with autonomous signing capability. They scan the on-chain gig registry, submit bids, execute work, deliver via IPFS, and receive USDC payment — all without human intervention on the agent side.

---

## End-to-End Gig Flow

### 1. Post Gig
- Client calls `post_gig` with a description, USDC amount, and deadline
- A Gig PDA is created on-chain using a unique gig ID as the seed
- Client's USDC is transferred into a vault — a SPL Token Account owned by the Gig PDA
- A Gig account stores: gig ID, description, client pubkey, stake amount, deadline, status
- Status set to: Open

### 2. Agents Bid
- AI agents autonomously scan all Gig accounts with status Open
- Any agent can call `submit_bid` to place a bid on an open gig
- Each bid is stored in a Bid PDA with seeds: [gig_id, agent_pubkey]
- Bid account stores: agent pubkey, proposed price, pitch/note, timestamp
- Multiple agents can bid on the same gig simultaneously

### 3. Client Accepts a Bid
- Client calls `accept_gig` and passes the pubkey of the winning agent
- All other bids are marked as rejected
- The accepted agent's stake is locked into a separate Agent Vault PDA
- Gig status updated to: InProgress
- A deadline clock begins from this point

### 4. Agent Delivers Work
- Winning agent completes the task off-chain and uploads deliverables to IPFS
- Agent calls `submit_solution` with the IPFS CID as the solution URI
- The CID is stored on-chain in the Gig account
- Gig status updated to: Submitted

### 5. Verify and Settle
- Client reviews the delivered work and calls `verify_solution`
- If approved, client calls `settle_gig`
- `settle_gig` triggers a CPI to the SPL Token Program: USDC transfers from vault to agent's Associated Token Account
- Protocol fee (1.5%) is deducted and sent to the Treasury PDA before agent receives remainder
- Gig status updated to: Completed

### 6. Reputation Update
- After settlement, `update_reputation` is called for both client and agent
- Each wallet has a Reputation PDA storing: completed gigs, disputes raised, disputes lost, cumulative rating
- Reputation is wallet-bound, on-chain, and readable by any agent scanning gigs
- Agents with higher reputation scores are ranked higher in bid visibility

---

## Edge Cases

### Cancel Flow
- Client can call `cancel_gig` only if no agent has been accepted yet (status is still Open)
- USDC is fully refunded from the vault back to the client's Associated Token Account
- All pending bids on that gig are invalidated
- Gig status updated to: Cancelled

### Auto-Release
- If the client does not call `verify_solution` within 7 days of `submit_solution`, a permissionless crank can call `auto_release`
- `auto_release` checks the on-chain clock, confirms the timeout has passed, and releases USDC to the agent
- Prevents clients from ghosting agents after work is delivered

### Dispute Flow
- Either party can call `raise_dispute` after `submit_solution` and before `settle_gig`
- Gig is frozen — no USDC moves until the dispute is resolved
- A Dispute PDA is created storing: raiser, respondent, evidence IPFS CIDs, arbitrator votes
- Three arbitrators (wallets that have staked a minimum USDC amount) are assigned
- Each arbitrator calls `cast_vote` with a resolution: ClientWins, AgentWins, or Split
- Majority vote wins; `resolve_dispute` executes the corresponding USDC transfer via CPI
- Losing party's stake is partially slashed as a dispute fee split between arbitrators and treasury
- Gig status updated to: Resolved

---

## Account Structure

| Account | Seeds | Stores |
|---|---|---|
| Gig PDA | [gig_id] | All gig data, status, vault reference |
| Bid PDA | [gig_id, agent_pubkey] | Bid details per agent per gig |
| Vault | [gig_id, "vault"] | SPL Token Account holding client USDC |
| Agent Vault | [gig_id, agent_pubkey, "stake"] | Agent's locked stake |
| Reputation PDA | [wallet_pubkey, "reputation"] | On-chain score per wallet |
| Dispute PDA | [gig_id, "dispute"] | Dispute state and votes |
| Treasury PDA | ["treasury"] | Protocol fee accumulator |

---

## State Machine

```
Open → InProgress → Submitted → Completed → Disputed → Resolved → Cancelled
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contracts | Rust, Anchor 0.31.1 |
| Blockchain | Solana (Devnet for now, Mainnet target) |
| Payment Token | USDC, SPL Token, 6 decimals |
| Work Delivery | IPFS CID stored on-chain |
| Agent Automation | TypeScript scripts, no UI |
| Indexing | Helius webhooks, PostgreSQL |

---

## Codebase

- Core program: programs/gig_marketplace/src/lib.rs
- Tests: tests/ — every instruction must have a corresponding passing test
- Repo: github.com/Rustix69/GigAI

---

## Rules for Cursor

- All code must be compatible with Anchor 0.31.1
- Payments are always in USDC SPL Token — never native SOL lamports
- Every new instruction must have a passing test before moving to the next
- No frontend — backend and test files only
- Do not rewrite working instructions — only add or modify what is needed
- All accounts must use canonical PDA bumps stored in the account
- Use checked arithmetic throughout — checked_add, checked_mul, checked_sub
- Keep everything open-source friendly