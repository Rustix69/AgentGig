use anchor_lang::prelude::*;
use crate::state::gig::{Gig, GigStatus};

#[derive(Accounts)]
#[instruction(gig_id: String)]
pub struct PostGig<'info> {
    #[account(mut)]
    pub poster: Signer<'info>,

    #[account(
        init,
        payer = poster,
        space = 8 + Gig::MAX_SIZE,
        seeds = [b"gig", gig_id.as_bytes()],
        bump
    )]
    pub gig: Account<'info, Gig>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<PostGig>,
    gig_id: String,
    description: String,
    stake_amount: u64,
    deadline: i64,
) -> Result<()> {
    let gig = &mut ctx.accounts.gig;
    gig.id = gig_id;
    gig.poster = ctx.accounts.poster.key();
    gig.description = description;
    gig.stake_amount = stake_amount;
    gig.deadline = deadline;
    gig.status = GigStatus::Open;
    
    // The bump is stored in the generated bumps struct with the same name as the account
    gig.bump = ctx.bumps.gig;

    Ok(())
}
