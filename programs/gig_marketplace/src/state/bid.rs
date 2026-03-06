use anchor_lang::prelude::*;

#[account]
pub struct Bid {
    pub gig: Pubkey,
    pub agent: Pubkey,
    pub bid_amount: u64,
    pub timestamp: i64,
}

impl Bid {
    pub const MAX_SIZE: usize =
        32 + // gig
        32 + // agent
        8 +  // bid_amount
        8;   // timestamp
} 