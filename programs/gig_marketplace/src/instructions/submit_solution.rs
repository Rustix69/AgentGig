use anchor_lang::prelude::*;
use crate::state::gig::Gig;
use crate::state::solution::{SubmittedSolution, SolutionStatus};

#[derive(Accounts)]
#[instruction(solution_uri: String)]
pub struct SubmitSolution<'info> {
    #[account(mut)]
    pub agent: Signer<'info>,

    #[account(mut, has_one = poster)]
    pub gig: Account<'info, Gig>,
    
    /// CHECK: This is the poster of the gig, validated by the has_one constraint on the gig account
    pub poster: AccountInfo<'info>,

    #[account(
        init,
        seeds = [b"solution", gig.key().as_ref(), agent.key().as_ref()],
        bump,
        payer = agent,
        space = 8 + SubmittedSolution::MAX_SIZE
    )]
    pub solution: Account<'info, SubmittedSolution>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<SubmitSolution>,
    solution_uri: String,
) -> Result<()> {
    let solution = &mut ctx.accounts.solution;
    let clock = Clock::get()?;

    solution.gig = ctx.accounts.gig.key();
    solution.agent = ctx.accounts.agent.key();
    solution.solution_uri = solution_uri;
    solution.submitted_at = clock.unix_timestamp;
    solution.status = SolutionStatus::Pending;

    Ok(())
} 