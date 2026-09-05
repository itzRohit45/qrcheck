import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { clientServer } from "../src/config";

export default function QRDisplay({ sessionId }) {
  const [tokensData, setTokensData] = useState(null);
  const [currentSlot, setCurrentSlot] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const intervalSeconds = tokensData?.rotationInterval || 5;

  // Handle Escape key to exit fullscreen projector mode
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // 1. Fetch the pre-generated token pool once on mount
  useEffect(() => {
    if (!sessionId) return;
    let isMounted = true;

    clientServer
      .get(`/sessions/${sessionId}/tokens`)
      .then((res) => {
        if (!isMounted) return;
        if (res.data && res.data.tokenPool && res.data.tokenPool.length > 0) {
          const serverTime = res.data.serverTime || Date.now();
          const timeOffset = serverTime - Date.now();
          setTokensData({ ...res.data, timeOffset });
          const interval = res.data.rotationInterval || 5;
          const startTime = new Date(res.data.date).getTime();
          const syncedNow = Date.now() + timeOffset;
          const elapsed = Math.max(0, (syncedNow - startTime) / 1000);
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

  // 2. High-performance local timer: rotates QR code every 5 seconds synchronized with server clock
  useEffect(() => {
    if (!tokensData || !tokensData.tokenPool) return;

    const interval = tokensData.rotationInterval || 5;
    const startTime = new Date(tokensData.date).getTime();
    const timeOffset = tokensData.timeOffset || 0;

    const timer = setInterval(() => {
      const syncedNow = Date.now() + timeOffset;
      const elapsedSeconds = Math.max(0, (syncedNow - startTime) / 1000);
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
            size={260}
            level="L"
            includeMargin={false}
            bgColor="#ffffff"
            fgColor="#000000"
          />
        ) : (
          <img
            src={tokensData.fallbackImage}
            alt="QR Code"
            style={{ width: "260px", height: "260px", display: "block" }}
          />
        )}
      </div>

      {/* 5-Second Local Countdown Progress Bar */}
      {tokensData.tokenPool && (
        <div style={{ width: "100%", maxWidth: "280px", marginBottom: "10px" }}>
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

      {/* Projector Fullscreen Mode Button for Large Auditoriums */}
      <button
        onClick={() => setIsFullscreen(true)}
        style={{
          marginTop: "6px",
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px 16px",
          background: "rgba(56, 189, 248, 0.1)",
          border: "1px solid rgba(56, 189, 248, 0.28)",
          borderRadius: "8px",
          color: "#38bdf8",
          fontSize: "13px",
          fontWeight: "600",
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(56, 189, 248, 0.2)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(56, 189, 248, 0.1)")}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
        </svg>
        Projector Fullscreen Mode
      </button>

      <p style={{
        margin: "12px 0 0 0",
        fontSize: "13px",
        color: "#94a3b8",
        fontWeight: 500
      }}>
        Students: Scan with your smartphone to mark attendance
      </p>

      {/* Fullscreen Projector Overlay for Classroom Displays / Last Benches */}
      {isFullscreen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            backgroundColor: "#070a13",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            boxSizing: "border-box",
          }}
        >
          {/* Top Bar */}
          <div
            style={{
              position: "absolute",
              top: "24px",
              left: "32px",
              right: "32px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  background: "#10b981",
                  boxShadow: "0 0 10px #10b981",
                }}
              ></span>
              <span style={{ color: "#f8fafc", fontSize: "16px", fontWeight: 700 }}>
                Live Attendance Stream
              </span>
            </div>

            <button
              onClick={() => setIsFullscreen(false)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 18px",
                background: "rgba(255, 255, 255, 0.1)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                borderRadius: "8px",
                color: "#f8fafc",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.18)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)")}
            >
              Exit Fullscreen (Esc)
            </button>
          </div>

          {/* Giant High-Contrast QR Code for Projector Distance */}
          <div
            style={{
              background: "#ffffff",
              padding: "28px",
              borderRadius: "24px",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "24px",
            }}
          >
            {tokensData.tokenPool ? (
              <QRCodeSVG
                value={qrPayload}
                size={Math.min(window.innerWidth * 0.75, window.innerHeight * 0.58, 480)}
                level="L"
                includeMargin={false}
                bgColor="#ffffff"
                fgColor="#000000"
              />
            ) : (
              <img
                src={tokensData.fallbackImage}
                alt="QR Code"
                style={{
                  width: `${Math.min(window.innerWidth * 0.75, window.innerHeight * 0.58, 480)}px`,
                  height: `${Math.min(window.innerWidth * 0.75, window.innerHeight * 0.58, 480)}px`,
                  display: "block",
                }}
              />
            )}
          </div>

          {/* Countdown & Status */}
          {tokensData.tokenPool && (
            <div style={{ width: "100%", maxWidth: "480px", marginBottom: "16px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "14px",
                  color: "#94a3b8",
                  marginBottom: "8px",
                }}
              >
                <span>Anti-proxy dynamic QR</span>
                <span style={{ fontWeight: 700, color: "#38bdf8", fontSize: "15px" }}>
                  Refreshes in {secondsLeft}s
                </span>
              </div>

              <div
                style={{
                  height: "8px",
                  background: "rgba(255, 255, 255, 0.12)",
                  borderRadius: "4px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${progressPercent}%`,
                    background: "linear-gradient(90deg, #3b82f6, #38bdf8)",
                    borderRadius: "4px",
                    transition: "width 1s linear",
                  }}
                ></div>
              </div>
            </div>
          )}

          <p style={{ margin: 0, fontSize: "15px", color: "#cbd5e1" }}>
            Point your smartphone camera at the screen to mark your attendance
          </p>
        </div>
      )}
    </div>
  );
}
