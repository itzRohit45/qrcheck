import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Html5QrcodeScanner } from "html5-qrcode";
import { clientServer, getDeviceId } from "../src/config";
import toast from "react-hot-toast";
import "../styles/QRScanner.css";

export default function QRScanner({ sessionId, onSuccess }) {
  const [step, setStep] = useState("scan"); // "scan" | "submitting" | "result"
  const [message, setMessage] = useState("");
  const [isAuthError, setIsAuthError] = useState(false);
  const [success, setSuccess] = useState(false);

  const qrDataRef = useRef(null);
  const navigate = useNavigate();

  // Scan the rotating QR code
  useEffect(() => {
    if (step !== "scan") return;

    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      {
        fps: 20,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          return {
            width: Math.floor(minEdge * 0.9),
            height: Math.floor(minEdge * 0.9),
          };
        },
        videoConstraints: {
          facingMode: "environment",
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
        },
        showZoomSliderIfSupported: true,
        defaultZoomValueIfSupported: 1,
        showTorchButtonIfSupported: true,
        useBarCodeDetectorIfSupported: true,
        rememberLastUsedCamera: true,
        supportedScanTypes: [0],
      },
      false
    );

    scanner.render(
      async (decodedText) => {
        let scannedSessionId = null;
        try {
          const parsed = JSON.parse(decodedText);
          scannedSessionId = parsed.sessionId || parsed.s;
        } catch {
          if (decodedText.includes(":")) {
            scannedSessionId = decodedText.split(":")[0];
          }
        }

        if (!scannedSessionId || scannedSessionId !== sessionId) {
          toast.error("Invalid QR Code: Does not match this session!");
          return;
        }

        qrDataRef.current = decodedText;
        try {
          await scanner.clear();
        } catch {
          /* ignore */
        }

        // Submit attendance with device binding
        setMessage("Recording attendance...");
        setStep("submitting");

        try {
          const res = await clientServer.post("/sessions/mark-attendance", {
            sessionId,
            scannedQRData: decodedText,
            deviceId: getDeviceId(),
          });
          finish(true, res.data.message || "Attendance marked successfully!");
        } catch (e) {
          const isAuth = e.response?.status === 401;
          const errorMsg = isAuth
            ? "Session expired or invalid login. Please log in again to mark attendance."
            : e.response?.data?.error ||
              e.response?.data?.message ||
              e.message ||
              "Failed to mark attendance.";

          if (isAuth) {
            localStorage.removeItem("token");
          }
          finish(false, errorMsg, isAuth);
        }
      },
      () => {
        /* per-frame decode errors are expected; ignore */
      }
    );

    return () => {
      scanner.clear().catch(() => {});
    };
  }, [step, sessionId]);

  const finish = (ok, msg, isAuth = false) => {
    setSuccess(ok);
    setMessage(msg);
    setIsAuthError(isAuth);
    setStep("result");
    if (ok && onSuccess) {
      setTimeout(() => {
        onSuccess();
      }, 1500);
    }
  };

  const rescanQR = () => {
    qrDataRef.current = null;
    setSuccess(false);
    setIsAuthError(false);
    setMessage("");
    setStep("scan");
  };

  return (
    <div className="qr-scanner-wrapper">
      {/* 1. QR Scanner View */}
      {step === "scan" && (
        <>
          <div className="qr-scanner-header">
            <h2 className="qr-scanner-title">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
              Scan Session QR Code
            </h2>
            <p className="qr-scanner-subtitle">Align the rotating QR code displayed on the screen</p>
          </div>
          <div id="qr-reader" />
        </>
      )}

      {/* 2. Submitting / Processing State */}
      {step === "submitting" && (
        <div style={{ padding: "40px 20px", textAlign: "center" }}>
          <div style={{
            width: "44px",
            height: "44px",
            border: "3px solid rgba(255, 255, 255, 0.1)",
            borderTop: "3px solid #38bdf8",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
            margin: "0 auto 16px auto"
          }}></div>
          <p style={{ fontSize: "16px", fontWeight: 600, color: "#e2e8f0", margin: 0 }}>
            {message}
          </p>
        </div>
      )}

      {/* 3. Result View */}
      {step === "result" && (
        <div className="qr-result-container">
          <div className={`qr-result-badge ${success ? "success" : "error"}`}>
            {success ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
            )}
            <span>{message}</span>
          </div>

          {!success && (
            <div className="qr-actions-row">
              {isAuthError ? (
                <button
                  className="qr-login-btn"
                  onClick={() => {
                    localStorage.clear();
                    navigate("/login");
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                    <polyline points="10 17 15 12 10 7"></polyline>
                    <line x1="15" y1="12" x2="3" y2="12"></line>
                  </svg>
                  Log In Again
                </button>
              ) : (
                <button className="qr-rescan-btn" onClick={rescanQR}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="14" y="14" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                  </svg>
                  Re-scan QR Code
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
