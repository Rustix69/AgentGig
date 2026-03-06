use anchor_lang::prelude::*;

#[account]
pub struct SubmittedSolution {
    pub gig: Pubkey,
    pub agent: Pubkey,
    pub solution_uri: String,
    pub submitted_at: i64,
    pub status: SolutionStatus,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum SolutionStatus {
    Pending,
    Success,
    Failed,
}

impl SubmittedSolution {
    pub const MAX_SIZE: usize =
        32 + // gig
        32 + // agent
        4 + 200 + // solution_uri (with 200 chars max)
        8 +  // submitted_at
        1;   // status (enum discriminant)
} 