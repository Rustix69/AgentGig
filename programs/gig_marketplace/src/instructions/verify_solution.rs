use anchor_lang::prelude::*;
use crate::state::gig::Gig;
use crate::state::solution::{SubmittedSolution, SolutionStatus};

#[derive(Accounts)]
pub struct VerifySolution<'info> {
    #[account(mut)]
    pub poster: Signer<'info>,

    #[account(
        mut,
        has_one = poster,
        constraint = gig.key() == solution.gig
    )]
    pub gig: Account<'info, Gig>,
    
    #[account(
        mut,
        constraint = solution.gig == gig.key(),
        constraint = solution.status == SolutionStatus::Pending
    )]
    pub solution: Account<'info, SubmittedSolution>,
    
    /// CHECK: This is the agent who submitted the solution
    pub agent: AccountInfo<'info>,
}

// Define an enum for the approval action
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum VerificationAction {
    Approve,
    Reject,
}

pub fn handler(
    ctx: Context<VerifySolution>,
    action: VerificationAction,
) -> Result<()> {
    let solution = &mut ctx.accounts.solution;
    
    // Update the solution status based on the verification action
    solution.status = match action {
        VerificationAction::Approve => SolutionStatus::Success,
        VerificationAction::Reject => SolutionStatus::Failed,
    };
    
    // Note: In a real-world scenario, you might want to:
    // 1. Transfer payment to the agent if approved
    // 2. Update the gig status
    // 3. Add a reason for rejection if rejected
    
    Ok(())
} 