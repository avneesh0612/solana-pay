import styles from "@/styles/Home.module.css";
import { encodeURL } from "@solana/pay";
import { Keypair } from "@solana/web3.js";
import { useMemo, useState } from "react";
import QRCode from "react-qr-code";

const Home = () => {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(0);
  const reference = useMemo(() => Keypair.generate().publicKey, []);

  const createPayment = async () => {
    if (!quantity) {
      return;
    }

    const apiUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/makeTransaction?amount=${quantity}&reference=${reference}`;

    const urlParams = {
      link: new URL(apiUrl),
      label: "Solana Pay Demo",
      message: "Thanks for buying our tokens!",
    };
    const solanaUrl = encodeURL(urlParams);
    setQrCode(solanaUrl.href);
  };

  return (
    <main className={styles.main}>
      <div>
        <input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
        />
        <button onClick={createPayment}>Generate QR</button>
      </div>

      {qrCode && <QRCode value={qrCode} />}
    </main>
  );
};

export default Home;
