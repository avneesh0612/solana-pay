import {
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import base58 from "bs58";
import { NextApiRequest, NextApiResponse } from "next";

export type MakeTransactionOutputData = {
  transaction: string;
  message: string;
};

const post = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const { reference, amount } = req.query as {
      reference: string;
      amount: string;
    };

    const { account } = req.body as {
      account: string;
    };

    if (parseInt(amount) === 0) {
      return res.status(400).json({ error: "Can't checkout with charge of 0" });
    }

    if (!reference) {
      return res.status(400).json({ error: "No reference provided" });
    }

    if (!account) {
      return res.status(400).json({ error: "No account provided" });
    }

    const connection = new Connection(
      "https://api.devnet.solana.com",
      "confirmed"
    );

    const walletPrivateKey = process.env.WALLET_PRIVATE_KEY as string;

    if (!walletPrivateKey) {
      res.status(500).json({ error: "Wallet private key not available" });
    }

    const walletKeyPair = Keypair.fromSecretKey(
      base58.decode(walletPrivateKey)
    );

    const buyerPublicKey = new PublicKey(account);
    const walletPublicKey = new PublicKey(
      "FW79xRL1yks1Y9bD8NSB888YGRmyEq4SCMYhFodHLWh9"
    );
    const tokenAddress = new PublicKey(
      "FtQBZ2jsDLvXLdeo12LkMndjvLm6kAUWmdntiaxsWQqu"
    );

    const buyerTokenAddress = await getOrCreateAssociatedTokenAccount(
      connection,
      walletKeyPair,
      tokenAddress,
      buyerPublicKey
    ).then((account) => account.address);

    const shopTokenAddress = await getAssociatedTokenAddress(
      tokenAddress,
      walletPublicKey
    );

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("finalized");

    const transaction = new Transaction({
      blockhash,
      feePayer: buyerPublicKey,
      lastValidBlockHeight,
    });

    const transferInstruction = SystemProgram.transfer({
      fromPubkey: buyerPublicKey,
      toPubkey: walletPublicKey,
      lamports: parseInt(amount) * LAMPORTS_PER_SOL,
    });

    transferInstruction.keys.push({
      pubkey: new PublicKey(reference),
      isSigner: false,
      isWritable: false,
    });

    const tokenInstruction = createTransferCheckedInstruction(
      shopTokenAddress,
      tokenAddress,
      buyerTokenAddress,
      walletPublicKey,
      parseInt(amount) * 10 ** 6,
      6
    );

    tokenInstruction.keys.push({
      pubkey: walletPublicKey,
      isSigner: true,
      isWritable: false,
    });

    transaction.add(transferInstruction, tokenInstruction);
    transaction.partialSign(walletKeyPair);

    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false,
    });

    const base64 = serializedTransaction.toString("base64");

    return res.status(200).json({
      transaction: base64,
      message: `Buying ${amount} ${amount === "1" ? "token" : "tokens"}`,
    });
  } catch (err) {
    console.error("error:", err);
    return res.status(500).json({ error: "error creating transaction" });
  }
};

const get = (res: NextApiResponse) => {
  const label = "Buy some tokens";
  const icon = "https://cryptologos.cc/logos/solana-sol-logo.png";

  return res.status(200).json({
    label,
    icon,
  });
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method === "GET") {
    return get(res);
  } else if (req.method === "POST") {
    return await post(req, res);
  } else {
    return res.status(405).json({ error: "Method not allowed" });
  }
};

export default handler;
