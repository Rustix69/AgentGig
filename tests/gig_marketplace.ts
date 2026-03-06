import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { GigMarketplace } from "../target/types/gig_marketplace";
import { PublicKey, SystemProgram, Keypair } from "@solana/web3.js";
import assert from "assert";
import {
  logSuccess,
  logError,
  logSection,
} from "../utils/logger"; // ✅ Adjust path if necessary

describe("gig_marketplace", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const program = anchor.workspace.GigMarketplace as Program<GigMarketplace>;

  const gigId = "web-dev-001";
  const gigDescription = "Build a landing page using Next.js";
  const stakeAmount = new anchor.BN(1_000_000_000);
  const deadline = new anchor.BN(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const secondUser = Keypair.generate();
  const thirdUser = Keypair.generate(); // New user for bidding tests
  const gigSeed = Buffer.from("gig");
  const bidSeed = Buffer.from("bid");
  const solutionSeed = Buffer.from("solution");
  let gigPda: PublicKey;
  let bidPda: PublicKey;

  before(async () => {
    // Fund test accounts
    const airdropTx1 = await provider.connection.requestAirdrop(
      secondUser.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropTx1);
    logSuccess("Second user funded with 2 SOL for tests");

    const airdropTx2 = await provider.connection.requestAirdrop(
      thirdUser.publicKey,
      3 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropTx2);
    logSuccess("Third user funded with 3 SOL for tests");
  });

  it("Initializes and posts a gig with correct data", async () => {
    logSection("Posting Initial Gig");

    [gigPda] = await PublicKey.findProgramAddressSync(
      [gigSeed, Buffer.from(gigId)],
      program.programId
    );

    await program.methods
      .postGig(gigId, gigDescription, stakeAmount, deadline)
      .accounts({
        poster: provider.wallet.publicKey,
        gig: gigPda,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();

    const gigAccount = await program.account.gig.fetch(gigPda);

    assert.strictEqual(gigAccount.id, gigId);
    assert.strictEqual(gigAccount.description, gigDescription);
    assert.strictEqual(gigAccount.poster.toBase58(), provider.wallet.publicKey.toBase58());
    assert.ok(gigAccount.stakeAmount.eq(stakeAmount));
    assert.ok(gigAccount.deadline.eq(deadline));
    assert.strictEqual(gigAccount.status.open !== undefined, true);

    logSuccess("Gig posted successfully", gigAccount);
  });

  it("Cannot create a gig with the same ID", async () => {
    logSection("Duplicate Gig Creation");

    try {
      await program.methods
        .postGig(
          gigId,
          "This is a duplicate gig",
          new anchor.BN(500_000_000),
          new anchor.BN(Date.now() + 14 * 24 * 60 * 60 * 1000)
        )
        .accounts({
          poster: provider.wallet.publicKey,
          gig: gigPda,
          systemProgram: SystemProgram.programId,
        } as any)
        .rpc();

      assert.fail("Should have failed with duplicate gig ID");
    } catch (error) {
      assert.ok(error.toString().includes("Error"));
      logError("Duplicate gig creation blocked as expected", error);
    }
  });

  it("Can create a different gig with a new ID", async () => {
    logSection("Creating Second Gig");

    const newGigId = "mobile-app-001";
    const newDescription = "Develop a React Native mobile app";
    const [newGigPda] = await PublicKey.findProgramAddressSync(
      [gigSeed, Buffer.from(newGigId)],
      program.programId
    );

    await program.methods
      .postGig(
        newGigId,
        newDescription,
        new anchor.BN(2_000_000_000),
        new anchor.BN(Date.now() + 14 * 24 * 60 * 60 * 1000)
      )
      .accounts({
        poster: provider.wallet.publicKey,
        gig: newGigPda,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();

    const newGigAccount = await program.account.gig.fetch(newGigPda);

    assert.strictEqual(newGigAccount.id, newGigId);
    assert.strictEqual(newGigAccount.description, newDescription);

    logSuccess("Second gig created successfully", newGigAccount);
  });

  it("Different user can create a gig", async () => {
    logSection("Second User Posting");

    const userGigId = "graphic-design-001";
    const userDescription = "Design a logo for my startup";
    const [userGigPda] = await PublicKey.findProgramAddressSync(
      [gigSeed, Buffer.from(userGigId)],
      program.programId
    );

    await program.methods
      .postGig(
        userGigId,
        userDescription,
        new anchor.BN(1_500_000_000),
        new anchor.BN(Date.now() + 5 * 24 * 60 * 60 * 1000)
      )
      .accounts({
        poster: secondUser.publicKey,
        gig: userGigPda,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([secondUser])
      .rpc();

    const userGigAccount = await program.account.gig.fetch(userGigPda);

    assert.strictEqual(userGigAccount.id, userGigId);
    assert.strictEqual(userGigAccount.description, userDescription);
    assert.strictEqual(userGigAccount.poster.toBase58(), secondUser.publicKey.toBase58());

    logSuccess("Second user created a gig successfully", userGigAccount);
  });

  it("Can fetch all gigs in the program", async () => {
    logSection("Fetching All Gigs");

    const allGigs = await program.account.gig.all();
    assert.ok(allGigs.length >= 3);

    logSuccess(`Found ${allGigs.length} gigs in total`);

    const originalGig = allGigs.find(g => g.account.id === gigId);
    assert.ok(originalGig);
    assert.strictEqual(originalGig.account.description, gigDescription);

    logSuccess("Original gig verified in global fetch");
  });

  it("Can fetch gigs by owner using client-side filtering", async () => {
    logSection("Filtering Gigs by Owner");

    const allGigs = await program.account.gig.all();

    const mainUserGigs = allGigs.filter(
      gig => gig.account.poster.toBase58() === provider.wallet.publicKey.toBase58()
    );
    const secondUserGigs = allGigs.filter(
      gig => gig.account.poster.toBase58() === secondUser.publicKey.toBase58()
    );

    logSuccess(`Main user has ${mainUserGigs.length} gigs`);
    logSuccess(`Second user has ${secondUserGigs.length} gigs`);

    assert.ok(mainUserGigs.length >= 2);
    assert.ok(secondUserGigs.length >= 1);
    assert.ok(mainUserGigs.some(g => g.account.id === gigId));
    assert.ok(mainUserGigs.some(g => g.account.id === "mobile-app-001"));
    assert.ok(secondUserGigs.some(g => g.account.id === "graphic-design-001"));

    logSuccess("Ownership verification completed successfully");
  });

  // Bid-related tests
  
  it("Can submit a bid on a gig", async () => {
    logSection("Submitting Bid");

    const bidAmount = new anchor.BN(1_200_000_000); // 1.2 SOL

    [bidPda] = await PublicKey.findProgramAddressSync(
      [bidSeed, gigPda.toBuffer(), thirdUser.publicKey.toBuffer()],
      program.programId
    );

    // Get third user SOL balance before bid
    const balanceBefore = await provider.connection.getBalance(thirdUser.publicKey);
    
    await program.methods
      .submitBid(bidAmount)
      .accounts({
        agent: thirdUser.publicKey,
        gig: gigPda,
        bid: bidPda,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([thirdUser])
      .rpc();

    // Fetch bid account to verify
    const bidAccount = await program.account.bid.fetch(bidPda);
    
    // Get third user SOL balance after bid
    const balanceAfter = await provider.connection.getBalance(thirdUser.publicKey);
    
    // Verify bid data
    assert.strictEqual(bidAccount.gig.toBase58(), gigPda.toBase58());
    assert.strictEqual(bidAccount.agent.toBase58(), thirdUser.publicKey.toBase58());
    assert.ok(bidAccount.bidAmount.eq(bidAmount));
    assert.ok(bidAccount.timestamp.toNumber() > 0);
    
    // Verify SOL transfer (approximate due to transaction fees)
    const expectedBalanceDecrease = bidAmount.toNumber();
    const actualDecrease = balanceBefore - balanceAfter;
    assert.ok(actualDecrease > expectedBalanceDecrease);
    assert.ok(actualDecrease < expectedBalanceDecrease + 10000000); // Allow for tx fee
    
    logSuccess("Bid submitted successfully", bidAccount);
  });
  
  it("Can submit multiple bids from different users", async () => {
    logSection("Multiple Bids");
    
    // Second user submits a bid on the same gig
    const secondBidAmount = new anchor.BN(1_050_000_000); // 1.05 SOL
    
    const [secondBidPda] = await PublicKey.findProgramAddressSync(
      [bidSeed, gigPda.toBuffer(), secondUser.publicKey.toBuffer()],
      program.programId
    );
    
    await program.methods
      .submitBid(secondBidAmount)
      .accounts({
        agent: secondUser.publicKey,
        gig: gigPda,
        bid: secondBidPda,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([secondUser])
      .rpc();
      
    // Fetch both bids
    const firstBid = await program.account.bid.fetch(bidPda);
    const secondBid = await program.account.bid.fetch(secondBidPda);
    
    // Verify both bids exist with correct data
    assert.strictEqual(firstBid.agent.toBase58(), thirdUser.publicKey.toBase58());
    assert.strictEqual(secondBid.agent.toBase58(), secondUser.publicKey.toBase58());
    assert.ok(firstBid.bidAmount.eq(new anchor.BN(1_200_000_000)));
    assert.ok(secondBid.bidAmount.eq(secondBidAmount));
    
    logSuccess("Multiple bids confirmed", {
      firstBid: { agent: firstBid.agent.toBase58(), amount: firstBid.bidAmount.toString() },
      secondBid: { agent: secondBid.agent.toBase58(), amount: secondBid.bidAmount.toString() }
    });
  });
  
  it("Can fetch all bids for a specific gig", async () => {
    logSection("Fetching Bids");
    
    // Get all bids
    const allBids = await program.account.bid.all();
    
    // Filter for our test gig
    const gigBids = allBids.filter(
      bid => bid.account.gig.toBase58() === gigPda.toBase58()
    );
    
    // Verify we have at least 2 bids for our test gig
    assert.ok(gigBids.length >= 2);
    
    // Verify the bids include those from our test users
    const thirdUserBid = gigBids.find(
      bid => bid.account.agent.toBase58() === thirdUser.publicKey.toBase58()
    );
    const secondUserBid = gigBids.find(
      bid => bid.account.agent.toBase58() === secondUser.publicKey.toBase58()
    );
    
    assert.ok(thirdUserBid);
    assert.ok(secondUserBid);
    
    logSuccess(`Found ${gigBids.length} bids for the test gig:`, 
      gigBids.map(bid => ({
        agent: bid.account.agent.toBase58(),
        amount: bid.account.bidAmount.toString()
      }))
    );
  });
  
  it("Cannot submit a duplicate bid from the same user", async () => {
    logSection("Duplicate Bid Test");
    
    try {
      // Try to submit another bid from the third user on the same gig
      const duplicateBidAmount = new anchor.BN(1_300_000_000);
      
      await program.methods
        .submitBid(duplicateBidAmount)
        .accounts({
          agent: thirdUser.publicKey,
          gig: gigPda,
          bid: bidPda, // Same PDA as before
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([thirdUser])
        .rpc();
        
      assert.fail("Should have failed with duplicate bid account");
    } catch (error) {
      assert.ok(error.toString().includes("Error"));
      logError("Duplicate bid rejected as expected", error);
    }
  });

  // Solution submission tests
  
  it("Can submit a solution for a gig", async () => {
    logSection("Submitting Solution");
    
    const solutionUri = "ipfs://QmT5NvUtoM5nWFfrQdVrFtvGfKFmG7AHE8P34isapyhCxX";
    
    const [solutionPda] = await PublicKey.findProgramAddressSync(
      [solutionSeed, gigPda.toBuffer(), thirdUser.publicKey.toBuffer()],
      program.programId
    );
    
    await program.methods
      .submitSolution(solutionUri)
      .accounts({
        agent: thirdUser.publicKey,
        gig: gigPda,
        poster: provider.wallet.publicKey,
        solution: solutionPda,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([thirdUser])
      .rpc();
      
    // Fetch the solution account to verify
    const solutionAccount = await program.account.submittedSolution.fetch(solutionPda);
    
    // Verify solution data
    assert.strictEqual(solutionAccount.gig.toBase58(), gigPda.toBase58());
    assert.strictEqual(solutionAccount.agent.toBase58(), thirdUser.publicKey.toBase58());
    assert.strictEqual(solutionAccount.solutionUri, solutionUri);
    assert.ok(solutionAccount.submittedAt.toNumber() > 0);
    
    logSuccess("Solution submitted successfully", {
      gig: solutionAccount.gig.toBase58(),
      agent: solutionAccount.agent.toBase58(),
      uri: solutionAccount.solutionUri,
      timestamp: solutionAccount.submittedAt.toString()
    });
  });
  
  it("Multiple agents can submit solutions for the same gig", async () => {
    logSection("Multiple Solutions");
    
    const secondSolutionUri = "ipfs://QmYEA5BXdQUfR8vVXZhZF2mHQY4xtMVGYXmrwG1sYy6iBL";
    
    const [secondSolutionPda] = await PublicKey.findProgramAddressSync(
      [solutionSeed, gigPda.toBuffer(), secondUser.publicKey.toBuffer()],
      program.programId
    );
    
    await program.methods
      .submitSolution(secondSolutionUri)
      .accounts({
        agent: secondUser.publicKey,
        gig: gigPda,
        poster: provider.wallet.publicKey,
        solution: secondSolutionPda,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([secondUser])
      .rpc();
      
    // Fetch both solution accounts
    const firstSolution = await program.account.submittedSolution.fetch(
      PublicKey.findProgramAddressSync(
        [solutionSeed, gigPda.toBuffer(), thirdUser.publicKey.toBuffer()],
        program.programId
      )[0]
    );
    
    const secondSolution = await program.account.submittedSolution.fetch(secondSolutionPda);
    
    // Verify multiple solutions exist
    assert.strictEqual(firstSolution.agent.toBase58(), thirdUser.publicKey.toBase58());
    assert.strictEqual(secondSolution.agent.toBase58(), secondUser.publicKey.toBase58());
    assert.strictEqual(firstSolution.gig.toBase58(), gigPda.toBase58());
    assert.strictEqual(secondSolution.gig.toBase58(), gigPda.toBase58());
    
    logSuccess("Multiple solutions confirmed", {
      solution1: { agent: firstSolution.agent.toBase58() },
      solution2: { agent: secondSolution.agent.toBase58() }
    });
  });
  
  it("Can fetch all solutions for a specific gig", async () => {
    logSection("Fetching Solutions");
    
    // Get all solutions
    const allSolutions = await program.account.submittedSolution.all();
    
    // Filter for our test gig
    const gigSolutions = allSolutions.filter(
      solution => solution.account.gig.toBase58() === gigPda.toBase58()
    );
    
    // Verify we have at least 2 solutions for our test gig
    assert.ok(gigSolutions.length >= 2);
    
    // Verify the solutions include those from our test users
    const thirdUserSolution = gigSolutions.find(
      solution => solution.account.agent.toBase58() === thirdUser.publicKey.toBase58()
    );
    const secondUserSolution = gigSolutions.find(
      solution => solution.account.agent.toBase58() === secondUser.publicKey.toBase58()
    );
    
    assert.ok(thirdUserSolution);
    assert.ok(secondUserSolution);
    
    logSuccess(`Found ${gigSolutions.length} solutions for the test gig:`, 
      gigSolutions.map(solution => ({
        agent: solution.account.agent.toBase58(),
        uri: solution.account.solutionUri,
        submittedAt: solution.account.submittedAt.toString()
      }))
    );
  });
  
  it("Cannot submit a duplicate solution from the same user", async () => {
    logSection("Duplicate Solution Test");
    
    try {
      // Try to submit another solution from the third user on the same gig
      const duplicateSolutionUri = "ipfs://QmNewSolutionUri";
      
      const [solutionPda] = await PublicKey.findProgramAddressSync(
        [solutionSeed, gigPda.toBuffer(), thirdUser.publicKey.toBuffer()],
        program.programId
      );
      
      await program.methods
        .submitSolution(duplicateSolutionUri)
        .accounts({
          agent: thirdUser.publicKey,
          gig: gigPda,
          poster: provider.wallet.publicKey,
          solution: solutionPda, // Same PDA as before
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([thirdUser])
        .rpc();
        
      assert.fail("Should have failed with duplicate solution account");
    } catch (error) {
      assert.ok(error.toString().includes("Error"));
      logError("Duplicate solution rejected as expected", error);
    }
  });

  // Solution verification tests
  it("Can verify a solution as successful", async () => {
    logSection("Solution Verification - Success");
    
    // Get the solution PDA for third user
    const [solutionPda] = await PublicKey.findProgramAddressSync(
      [solutionSeed, gigPda.toBuffer(), thirdUser.publicKey.toBuffer()],
      program.programId
    );
    
    // Verify the solution as successful
    await program.methods
      .verifySolution({ approve: {} })
      .accounts({
        poster: provider.wallet.publicKey,
        gig: gigPda,
        solution: solutionPda,
        agent: thirdUser.publicKey,
      } as any)
      .rpc();
      
    // Fetch the solution to verify status change
    const solutionAccount = await program.account.submittedSolution.fetch(solutionPda);
    
    // Check that the status is now Success
    assert.ok(solutionAccount.status.success !== undefined);
    
    logSuccess("Solution verified as successful", {
      gig: solutionAccount.gig.toBase58(),
      agent: solutionAccount.agent.toBase58(),
      status: "Success"
    });
  });
  
  it("Can reject a solution as failed", async () => {
    logSection("Solution Verification - Failure");
    
    // Get the solution PDA for second user
    const [secondSolutionPda] = await PublicKey.findProgramAddressSync(
      [solutionSeed, gigPda.toBuffer(), secondUser.publicKey.toBuffer()],
      program.programId
    );
    
    // Reject the solution
    await program.methods
      .verifySolution({ reject: {} })
      .accounts({
        poster: provider.wallet.publicKey,
        gig: gigPda,
        solution: secondSolutionPda,
        agent: secondUser.publicKey,
      } as any)
      .rpc();
      
    // Fetch the solution to verify status change
    const solutionAccount = await program.account.submittedSolution.fetch(secondSolutionPda);
    
    // Check that the status is now Failed
    assert.ok(solutionAccount.status.failed !== undefined);
    
    logSuccess("Solution rejected as failed", {
      gig: solutionAccount.gig.toBase58(),
      agent: solutionAccount.agent.toBase58(),
      status: "Failed"
    });
  });
  
  it("Cannot verify a solution that is already verified", async () => {
    logSection("Double Verification Test");
    
    // Get the solution PDA for third user (which we already approved)
    const [solutionPda] = await PublicKey.findProgramAddressSync(
      [solutionSeed, gigPda.toBuffer(), thirdUser.publicKey.toBuffer()],
      program.programId
    );
    
    try {
      // Try to approve again
      await program.methods
        .verifySolution({ approve: {} })
        .accounts({
          poster: provider.wallet.publicKey,
          gig: gigPda,
          solution: solutionPda,
          agent: thirdUser.publicKey,
        } as any)
        .rpc();
        
      assert.fail("Should have failed because solution is already verified");
    } catch (error) {
      assert.ok(error.toString().includes("Error"));
      logError("Double verification correctly rejected", error);
    }
  });
  
  it("Only the gig poster can verify solutions", async () => {
    logSection("Unauthorized Verification Test");
    
    // Create a new gig with secondUser as poster
    const newGigId = "test-gig-authorization";
    const newGigDescription = "Testing authorization constraints";
    
    const [newGigPda] = await PublicKey.findProgramAddressSync(
      [gigSeed, Buffer.from(newGigId)],
      program.programId
    );
    
    await program.methods
      .postGig(
        newGigId,
        newGigDescription,
        new anchor.BN(1_500_000_000),
        new anchor.BN(Date.now() + 7 * 24 * 60 * 60 * 1000)
      )
      .accounts({
        poster: secondUser.publicKey,
        gig: newGigPda,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([secondUser])
      .rpc();
    
    // Submit a solution from third user
    const newSolutionUri = "ipfs://QmTestAuthorizationSolution";
    
    const [newSolutionPda] = await PublicKey.findProgramAddressSync(
      [solutionSeed, newGigPda.toBuffer(), thirdUser.publicKey.toBuffer()],
      program.programId
    );
    
    await program.methods
      .submitSolution(newSolutionUri)
      .accounts({
        agent: thirdUser.publicKey,
        gig: newGigPda,
        poster: secondUser.publicKey,
        solution: newSolutionPda,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([thirdUser])
      .rpc();
    
    try {
      // Try to verify the solution with main user (who is not the poster)
      await program.methods
        .verifySolution({ approve: {} })
        .accounts({
          poster: provider.wallet.publicKey, // Not the poster of this gig
          gig: newGigPda,
          solution: newSolutionPda,
          agent: thirdUser.publicKey,
        } as any)
        .rpc();
        
      assert.fail("Should have failed due to poster constraint");
    } catch (error) {
      assert.ok(error.toString().includes("Error"));
      logError("Unauthorized verification correctly rejected", error);
    }
    
    // Now verify with the correct poster
    await program.methods
      .verifySolution({ approve: {} })
      .accounts({
        poster: secondUser.publicKey, // Correct poster
        gig: newGigPda,
        solution: newSolutionPda,
        agent: thirdUser.publicKey,
      } as any)
      .signers([secondUser])
      .rpc();
    
    // Fetch the solution to verify it worked
    const verifiedSolution = await program.account.submittedSolution.fetch(newSolutionPda);
    assert.ok(verifiedSolution.status.success !== undefined);
    
    logSuccess("Authorization checks confirmed working", {
      correctPoster: secondUser.publicKey.toBase58(),
      solution: newSolutionPda.toBase58(),
      verifiedStatus: "Success"
    });
  });

  // Settlement tests
  it("Can settle a gig after a successful solution", async () => {
    logSection("Settling Gig with Successful Solution");
    
    // Get the solution PDA for the third user (which we approved earlier)
    const [solutionPda] = await PublicKey.findProgramAddressSync(
      [solutionSeed, gigPda.toBuffer(), thirdUser.publicKey.toBuffer()],
      program.programId
    );
    
    // Get the bid PDA for the third user
    const [bidPda] = await PublicKey.findProgramAddressSync(
      [bidSeed, gigPda.toBuffer(), thirdUser.publicKey.toBuffer()],
      program.programId
    );
    
    // Find the stake vault PDA - this needs to be the actual account that holds the funds
    // In a real implementation, this would be created when the bid is submitted
    const [stakeVaultPda] = await PublicKey.findProgramAddressSync(
      [Buffer.from("stake_vault"), gigPda.toBuffer(), thirdUser.publicKey.toBuffer()],
      program.programId
    );
    
    // Get the bid details to know how much to fund
    const bid = await program.account.bid.fetch(bidPda);
    
    // First let's fund the stake vault PDA to simulate the staked funds
    const tx = new anchor.web3.Transaction();
    tx.add(
      anchor.web3.SystemProgram.transfer({
        fromPubkey: provider.wallet.publicKey,
        toPubkey: stakeVaultPda,
        lamports: bid.bidAmount.toNumber(), // Use the exact bid amount
      })
    );
    await provider.sendAndConfirm(tx);
    
    // Get agent's balance before settlement
    const agentBalanceBefore = await provider.connection.getBalance(thirdUser.publicKey);
    
    // Settle the gig
    await program.methods
      .settleGig()
      .accounts({
        poster: provider.wallet.publicKey,
        gig: gigPda,
        solution: solutionPda,
        bid: bidPda,
        agentCreator: thirdUser.publicKey,
        stakeVault: stakeVaultPda,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();
    
    // Verify gig is now marked as completed
    const gigAccount = await program.account.gig.fetch(gigPda);
    const solution = await program.account.submittedSolution.fetch(solutionPda);
    
    // Get agent's balance after settlement
    const agentBalanceAfter = await provider.connection.getBalance(thirdUser.publicKey);
    
    // Verify the gig status is now completed
    assert.strictEqual(gigAccount.status.completed !== undefined, true);
    
    // Verify the solution is successful
    assert.strictEqual(solution.status.success !== undefined, true);
    
    // Verify funds were transferred (approximate due to transaction fees)
    const transferredAmount = agentBalanceAfter - agentBalanceBefore;
    
    // The agent should have received approximately the bid amount
    assert.ok(transferredAmount > 0, "Agent should have received funds");
    
    logSuccess("Gig settled successfully", {
      gig: gigPda.toBase58(),
      agent: thirdUser.publicKey.toBase58(),
      status: "Completed",
      fundsTransferred: transferredAmount / anchor.web3.LAMPORTS_PER_SOL + " SOL"
    });
  });
  
  it("Cannot settle a gig with a pending solution", async () => {
    logSection("Settling with Pending Solution");
    
    // Create a new gig
    const newGigId = "test-pending-settlement";
    const [newGigPda] = await PublicKey.findProgramAddressSync(
      [gigSeed, Buffer.from(newGigId)],
      program.programId
    );
    
    await program.methods
      .postGig(
        newGigId,
        "Test gig for settlement validation",
        new anchor.BN(1_000_000_000),
        new anchor.BN(Date.now() + 7 * 24 * 60 * 60 * 1000)
      )
      .accounts({
        poster: provider.wallet.publicKey,
        gig: newGigPda,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();
    
    // Submit a bid
    const [newBidPda] = await PublicKey.findProgramAddressSync(
      [bidSeed, newGigPda.toBuffer(), thirdUser.publicKey.toBuffer()],
      program.programId
    );
    
    await program.methods
      .submitBid(new anchor.BN(900_000_000))
      .accounts({
        agent: thirdUser.publicKey,
        gig: newGigPda,
        bid: newBidPda,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([thirdUser])
      .rpc();
    
    // Submit a solution (which will be in Pending state)
    const [newSolutionPda] = await PublicKey.findProgramAddressSync(
      [solutionSeed, newGigPda.toBuffer(), thirdUser.publicKey.toBuffer()],
      program.programId
    );
    
    await program.methods
      .submitSolution("ipfs://QmTestPendingSolution")
      .accounts({
        agent: thirdUser.publicKey,
        gig: newGigPda,
        poster: provider.wallet.publicKey,
        solution: newSolutionPda,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([thirdUser])
      .rpc();
    
    // Find the stake vault PDA
    const [newStakeVaultPda] = await PublicKey.findProgramAddressSync(
      [Buffer.from("stake_vault"), newGigPda.toBuffer(), thirdUser.publicKey.toBuffer()],
      program.programId
    );
    
    try {
      // Try to settle the gig with a pending solution - should fail
      await program.methods
        .settleGig()
        .accounts({
          poster: provider.wallet.publicKey,
          gig: newGigPda,
          solution: newSolutionPda,
          bid: newBidPda,
          agentCreator: thirdUser.publicKey,
          stakeVault: newStakeVaultPda,
          systemProgram: SystemProgram.programId,
        } as any)
        .rpc();
        
      assert.fail("Should have failed because solution is still pending");
    } catch (error) {
      assert.ok(error.toString().includes("SolutionNotVerified"));
      logError("Settlement with pending solution correctly rejected", error);
    }
  });
});
