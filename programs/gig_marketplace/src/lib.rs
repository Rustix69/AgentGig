// This is a program with all code in lib.rs for simplicity.
use anchor_lang::prelude::*;

mod instructions;
mod state;

pub use state::gig::*;
pub use state::bid::*;
pub use state::solution::*;
pub use instructions::post_gig::*;
pub use instructions::submit_bid::*;
pub use instructions::submit_solution::*;
pub use instructions::verify_solution::*;
pub use instructions::settle_gig::*;

declare_id!("DQ3aDohXemexeam97AYbq18AzNADGqTR4kTeZgcwmmH1");

#[error_code]
pub enum GigError {
    #[msg("Bump not found.")]
    BumpNotFound,
    
    #[msg("Solution must be verified before settlement.")]
    SolutionNotVerified,
}

#[program]
pub mod gig_marketplace {
    use super::*;

    pub fn post_gig(
        ctx: Context<PostGig>,
        gig_id: String,
        description: String,
        stake_amount: u64,
        deadline: i64,
    ) -> Result<()> {
        instructions::post_gig::handler(ctx, gig_id, description, stake_amount, deadline)
    }
    
    pub fn submit_bid(
        ctx: Context<SubmitBid>,
        bid_amount: u64,
    ) -> Result<()> {
        instructions::submit_bid::handler(ctx, bid_amount)
    }
    
    pub fn submit_solution(
        ctx: Context<SubmitSolution>,
        solution_uri: String,
    ) -> Result<()> {
        instructions::submit_solution::handler(ctx, solution_uri)
    }
    
    pub fn verify_solution(
        ctx: Context<VerifySolution>,
        action: VerificationAction,
    ) -> Result<()> {
        instructions::verify_solution::handler(ctx, action)
    }
    
    pub fn settle_gig(ctx: Context<SettleGig>) -> Result<()> {
        instructions::settle_gig::handler(ctx)
    }
} 