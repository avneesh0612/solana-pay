import {
  bundlrStorage,
  keypairIdentity,
  Metaplex,
} from "@metaplex-foundation/js";
import { createCreateMetadataAccountV2Instruction } from "@metaplex-foundation/mpl-token-metadata";
import {
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createMintToInstruction,
  getAssociatedTokenAddress,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import base58 from "bs58";
import "dotenv/config";

const endpoint = "https://api.devnet.solana.com";
const solanaConnection = new Connection(endpoint);

const MINT_CONFIG = {
  numDecimals: 6,
  numberTokens: 10000,
};

const MY_TOKEN_METADATA = {
  name: "Solana Pay Demo",
  symbol: "SPD",
  description: "A demo token for Solana Pay",
  image: "https://cryptologos.cc/logos/solana-sol-logo.png",
};

const ON_CHAIN_METADATA = {
  name: MY_TOKEN_METADATA.name,
  symbol: MY_TOKEN_METADATA.symbol,
  uri: "",
  sellerFeeBasisPoints: 0,
  creators: null,
  collection: null,
  uses: null,
};

const uploadMetadata = async (wallet, tokenMetadata) => {
  const metaplex = Metaplex.make(solanaConnection)
    .use(keypairIdentity(wallet))
    .use(
      bundlrStorage({
        address: "https://devnet.bundlr.network",
        providerUrl: endpoint,
        timeout: 60000,
      })
    );

  const { uri } = await metaplex.nfts().uploadMetadata(tokenMetadata);
  console.log(`Arweave URL: `, uri);
  return uri;
};

const createNewMintTransaction = async (
  connection,
  payer,
  mintKeypair,
  destinationWallet,
  mintAuthority,
  freezeAuthority
) => {
  const metaplex = Metaplex.make(solanaConnection)
    .use(keypairIdentity(payer))
    .use(
      bundlrStorage({
        address: "https://devnet.bundlr.network",
        providerUrl: endpoint,
        timeout: 60000,
      })
    );

  const requiredBalance = await getMinimumBalanceForRentExemptMint(connection);
  const metadataPDA = metaplex
    .nfts()
    .pdas()
    .metadata({ mint: mintKeypair.publicKey });
  const tokenATA = await getAssociatedTokenAddress(
    mintKeypair.publicKey,
    destinationWallet
  );

  const txInstructions = [];

  txInstructions.push(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mintKeypair.publicKey,
      space: MINT_SIZE,
      lamports: requiredBalance,
      programId: TOKEN_PROGRAM_ID,
    }),
    createInitializeMintInstruction(
      mintKeypair.publicKey,
      MINT_CONFIG.numDecimals,
      mintAuthority,
      freezeAuthority,
      TOKEN_PROGRAM_ID
    ),
    createAssociatedTokenAccountInstruction(
      payer.publicKey,
      tokenATA,
      payer.publicKey,
      mintKeypair.publicKey
    ),
    createMintToInstruction(
      mintKeypair.publicKey,
      tokenATA,
      mintAuthority,
      MINT_CONFIG.numberTokens * Math.pow(10, MINT_CONFIG.numDecimals)
    ),
    createCreateMetadataAccountV2Instruction(
      {
        metadata: metadataPDA,
        mint: mintKeypair.publicKey,
        mintAuthority: mintAuthority,
        payer: payer.publicKey,
        updateAuthority: mintAuthority,
      },
      {
        createMetadataAccountArgsV2: {
          data: ON_CHAIN_METADATA,
          isMutable: true,
        },
      }
    )
  );
  const latestBlockhash = await connection.getLatestBlockhash();
  const messageV0 = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: latestBlockhash.blockhash,
    instructions: txInstructions,
  }).compileToV0Message();

  const transaction = new VersionedTransaction(messageV0);
  transaction.sign([payer, mintKeypair]);
  return transaction;
};

const main = async () => {
  const userWallet = Keypair.fromSecretKey(
    base58.decode(process.env.WALLET_PRIVATE_KEY)
  );
  let metadataUri = await uploadMetadata(userWallet, MY_TOKEN_METADATA);
  ON_CHAIN_METADATA.uri = metadataUri;

  let mintKeypair = Keypair.generate();

  const newMintTransaction = await createNewMintTransaction(
    solanaConnection,
    userWallet,
    mintKeypair,
    userWallet.publicKey,
    userWallet.publicKey,
    userWallet.publicKey
  );

  const transactionId = await solanaConnection.sendTransaction(
    newMintTransaction
  );
  console.log(
    `Succesfully minted ${MINT_CONFIG.numberTokens} ${
      ON_CHAIN_METADATA.symbol
    } to ${userWallet.publicKey.toString()}.`
  );
  console.log(
    `View Transaction: https://explorer.solana.com/tx/${transactionId}?cluster=devnet`
  );
};

main();
