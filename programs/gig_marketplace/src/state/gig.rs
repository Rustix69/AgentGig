use anchor_lang::prelude::*;

#[account]
pub struct Gig {
    pub id: String,
    pub poster: Pubkey,
    pub description: String,
    pub stake_amount: u64,
    pub deadline: i64,
    pub status: GigStatus,
    pub bump: u8,
}

impl Gig {
    pub const MAX_SIZE: usize = 
        4 + 64 + // id
        32 +     // poster
        4 + 512 + // description
        8 +      // stake_amount
        8 +      // deadline
        1 +      // status
        1;       // bump
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum GigStatus {
    Open,
    InProgress,
    Completed,
    Failed,
}
