import { useEffect, useState } from "react";
import io from "socket.io-client";
import { BASE_URL, clientServer } from "../src/config";

const socket = io(BASE_URL, {
  reconnectionAttempts: 5,
  reconnectionDelay: 2000,
});

export default function QRDisplay({ sessionId }) {
  const [qrCode, setQrCode] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;

    // Show the current code immediately, then live-update via socket.
    clientServer
      .get(`/sessions/${sessionId}/current-qr`)
      .then((res) => {
        if (res.data.qrCode) {
          setQrCode(res.data.qrCode);
          setLoading(false);
        }
      })
      .catch(() => {});

    socket.emit("joinSession", sessionId);

    const onUpdate = (newQRCode) => {
      setQrCode(newQRCode);
      setLoading(false);
    };
    socket.on("qrUpdate", onUpdate);

    return () => {
      socket.off("qrUpdate", onUpdate);
    };
  }, [sessionId]);

  return (
    <div style={{ textAlign: "center", marginTop: "10px" }}>
      {loading ? (
        <p>Loading QR Code...</p>
      ) : (
        <img
          src={qrCode}
          alt="QR Code"
          style={{
            width: "200px",
            height: "200px",
            border: "2px solid black",
            borderRadius: "10px",
            padding: "5px",
          }}
        />
      )}
    </div>
  );
}
