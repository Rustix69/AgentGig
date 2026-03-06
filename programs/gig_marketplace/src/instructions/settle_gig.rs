use anchor_lang::prelude::*;
use crate::{Gig, Bid, SubmittedSolution, SolutionStatus, GigError};

#[derive(Accounts)]
pub struct SettleGig<'info> {
    #[account(mut)]
    pub poster: Signer<'info>,

    #[account(mut, has_one = poster)]
    pub gig: Account<'info, Gig>,

    #[account(
        seeds = [b"solution", gig.key().as_ref(), bid.agent.as_ref()],
        bump
    )]
    pub solution: Account<'info, SubmittedSolution>,

    #[account(
        mut,
        seeds = [b"bid", gig.key().as_ref(), bid.agent.as_ref()],
        bump
    )]
    pub bid: Account<'info, Bid>,

    #[account(mut)]
    pub agent_creator: SystemAccount<'info>, // Must be mutable to receive lamports

    /// CHECK: stake vault PDA
    #[account(
        mut,
        seeds = [b"stake_vault", gig.key().as_ref(), bid.agent.as_ref()],
        bump
    )]
    pub stake_vault: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<SettleGig>) -> Result<()> {
    let solution = &ctx.accounts.solution;
    let bid = &ctx.accounts.bid;
    let gig = &mut ctx.accounts.gig;

    require!(
        solution.status != SolutionStatus::Pending,
        GigError::SolutionNotVerified
    );

    if solution.status == SolutionStatus::Success {
        // Calculate stake vault seeds and bump for signing
        let stake_vault_bump = ctx.bumps.stake_vault;
        let gig_key = gig.key();
        let agent_key = bid.agent;
        let seeds = &[
            b"stake_vault".as_ref(),
            gig_key.as_ref(),
            agent_key.as_ref(),
            &[stake_vault_bump]
        ];

        // Transfer funds from stake vault to agent
        anchor_lang::solana_program::program::invoke_signed(
            &anchor_lang::solana_program::system_instruction::transfer(
                ctx.accounts.stake_vault.key,
                ctx.accounts.agent_creator.key,
                bid.bid_amount,
            ),
            &[
                ctx.accounts.stake_vault.to_account_info(),
                ctx.accounts.agent_creator.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            &[seeds],
        )?;
    } else {
        // Refund to gig_poster instead (optional logic)
    }

    gig.status = crate::GigStatus::Completed;
    Ok(())
}