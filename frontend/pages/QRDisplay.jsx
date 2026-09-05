import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { clientServer } from "../src/config";

export default function QRDisplay({ sessionId }) {
  const [tokensData, setTokensData] = useState(null);
  const [currentSlot, setCurrentSlot] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const intervalSeconds = tokensData?.rotationInterval || 5;

  // 1. Fetch the pre-generated token pool once on mount
  useEffect(() => {
    if (!sessionId) return;
    let isMounted = true;

    clientServer
      .get(`/sessions/${sessionId}/tokens`)
      .then((res) => {
        if (!isMounted) return;
        if (res.data && res.data.tokenPool && res.data.tokenPool.length > 0) {
          setTokensData(res.data);
          const interval = res.data.rotationInterval || 5;
          const startTime = new Date(res.data.date).getTime();
          const elapsed = Math.max(0, (Date.now() - startTime) / 1000);
          const initialSlot = Math.floor(elapsed / interval);
          setCurrentSlot(initialSlot);
          setSecondsLeft(interval - (Math.floor(elapsed) % interval));
          setLoading(false);
        } else {
          // Fallback to legacy QR image if token pool not available
          fetchFallbackQR();
        }
      })
      .catch(() => {
        if (isMounted) fetchFallbackQR();
      });

    const fetchFallbackQR = () => {
      clientServer
        .get(`/sessions/${sessionId}/current-qr`)
        .then((res) => {
          if (!isMounted) return;
          if (res.data.qrCode) {
            setTokensData({ fallbackImage: res.data.qrCode });
            setLoading(false);
          }
        })
        .catch((err) => {
          if (!isMounted) return;
          setError("Failed to load QR code.");
          setLoading(false);
        });
    };

    return () => {
      isMounted = false;
    };
  }, [sessionId]);

  // 2. High-performance local timer: rotates QR code every 5 seconds without server requests
  useEffect(() => {
    if (!tokensData || !tokensData.tokenPool) return;

    const interval = tokensData.rotationInterval || 5;
    const startTime = new Date(tokensData.date).getTime();

    const timer = setInterval(() => {
      const elapsedSeconds = Math.max(0, (Date.now() - startTime) / 1000);
      const slot = Math.floor(elapsedSeconds / interval);
      const remainder = interval - (Math.floor(elapsedSeconds) % interval);

      setCurrentSlot(slot);
      setSecondsLeft(remainder === 0 ? interval : remainder);
    }, 1000);

    return () => clearInterval(timer);
  }, [tokensData]);

  if (loading) {
    return (
      <div style={{ padding: "30px", textAlign: "center", color: "#94a3b8" }}>
        <div style={{
          width: "36px",
          height: "36px",
          border: "3px solid rgba(255,255,255,0.1)",
          borderTop: "3px solid #3b82f6",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
          margin: "0 auto 12px auto"
        }}></div>
        <p style={{ margin: 0, fontSize: "14px" }}>Initializing live QR stream...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "20px", color: "#f87171", textAlign: "center" }}>
        <p>{error}</p>
      </div>
    );
  }

  // Active token for the current time slot
  const pool = tokensData?.tokenPool || [];
  const safeSlot = pool.length > 0 ? currentSlot % pool.length : 0;
  const currentNonce = pool[safeSlot];

  const qrPayload = JSON.stringify({
    sessionId,
    nonce: currentNonce,
    index: safeSlot,
  });

  const progressPercent = ((intervalSeconds - secondsLeft + 1) / intervalSeconds) * 100;

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      textAlign: "center",
      padding: "16px 10px"
    }}>
      {/* QR Code Container with High-Contrast White Mat */}
      <div style={{
        background: "#ffffff",
        padding: "16px",
        borderRadius: "16px",
        boxShadow: "0 10px 30px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: "16px"
      }}>
        {tokensData.tokenPool ? (
          <QRCodeSVG
            value={qrPayload}
            size={240}
            level="M"
            includeMargin={false}
            bgColor="#ffffff"
            fgColor="#000000"
          />
        ) : (
          <img
            src={tokensData.fallbackImage}
            alt="QR Code"
            style={{ width: "240px", height: "240px", display: "block" }}
          />
        )}
      </div>

      {/* 5-Second Local Countdown Progress Bar */}
      {tokensData.tokenPool && (
        <div style={{ width: "100%", maxWidth: "272px", marginBottom: "8px" }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "12.5px",
            color: "#94a3b8",
            marginBottom: "6px"
          }}>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "#10b981",
                boxShadow: "0 0 8px #10b981"
              }}></span>
              Rotating Live
            </span>
            <span style={{ fontWeight: 600, color: "#38bdf8" }}>
              Refreshes in {secondsLeft}s
            </span>
          </div>

          <div style={{
            height: "5px",
            background: "rgba(255, 255, 255, 0.1)",
            borderRadius: "3px",
            overflow: "hidden"
          }}>
            <div style={{
              height: "100%",
              width: `${progressPercent}%`,
              background: "linear-gradient(90deg, #3b82f6, #38bdf8)",
              borderRadius: "3px",
              transition: "width 1s linear"
            }}></div>
          </div>
        </div>
      )}

      <p style={{
        margin: "8px 0 0 0",
        fontSize: "13px",
        color: "#cbd5e1",
        fontWeight: 500
      }}>
        Students: Scan with your smartphone to mark attendance
      </p>
    </div>
  );
}
