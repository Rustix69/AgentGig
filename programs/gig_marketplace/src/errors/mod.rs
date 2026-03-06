use anchor_lang::prelude::*;

#[error_code]
pub enum GigError {
    #[msg("Bump not found.")]
    BumpNotFound,
}
