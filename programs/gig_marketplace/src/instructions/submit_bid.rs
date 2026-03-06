use anchor_lang::prelude::*;
use crate::state::gig::Gig;
use crate::state::bid::Bid;

#[derive(Accounts)]
#[instruction(bid_amount: u64)]
pub struct SubmitBid<'info> {
    #[account(mut)]
    pub agent: Signer<'info>,

    #[account(mut)]
    pub gig: Account<'info, Gig>,

    #[account(
        init,
        seeds = [b"bid", gig.key().as_ref(), agent.key().as_ref()],
        bump,
        payer = agent,
        space = 8 + Bid::MAX_SIZE
    )]
    pub bid: Account<'info, Bid>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<SubmitBid>,
    bid_amount: u64,
) -> Result<()> {
    let bid = &mut ctx.accounts.bid;
    let clock = Clock::get()?;

    bid.gig = ctx.accounts.gig.key();
    bid.agent = ctx.accounts.agent.key();
    bid.bid_amount = bid_amount;
    bid.timestamp = clock.unix_timestamp;

    // Transfer lamports (stake) from agent to bid PDA
    let cpi_ctx = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        anchor_lang::system_program::Transfer {
            from: ctx.accounts.agent.to_account_info(),
            to: ctx.accounts.bid.to_account_info(),
        },
    );
    anchor_lang::system_program::transfer(cpi_ctx, bid_amount)?;

    Ok(())
} 