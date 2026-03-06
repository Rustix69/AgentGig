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