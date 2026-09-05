import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Html5QrcodeScanner } from "html5-qrcode";
import { clientServer, getDeviceId } from "../src/config";
import {
  loadModels,
  captureSingleDescriptor,
} from "../src/faceApi";
import toast from "react-hot-toast";
import "../styles/QRScanner.css";

export default function QRScanner({ sessionId, onSuccess }) {
  const [step, setStep] = useState("scan"); // scan | face | result
  const [message, setMessage] = useState("");
  const [isAuthError, setIsAuthError] = useState(false);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  const qrDataRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const navigate = useNavigate();

  // Preload face-api models immediately so there is no delay after QR is scanned
  useEffect(() => {
    loadModels().catch((e) => console.error("Failed to preload face models:", e));
  }, []);

  // Step 1: scan the rotating QR code
  useEffect(() => {
    if (step !== "scan") return;

    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        rememberLastUsedCamera: true,
        supportedScanTypes: [0],
      },
      false
    );

    scanner.render(
      async (decodedText) => {
        try {
          const parsed = JSON.parse(decodedText);
          if (parsed.sessionId !== sessionId) {
            toast.error("Invalid QR Code: Does not match this session!");
            return;
          }
        } catch {
          toast.error("Invalid QR format!");
          return;
        }

        qrDataRef.current = decodedText;
        try {
          await scanner.clear();
        } catch {
          /* ignore */
        }
        setMessage("Align your face and click 'Capture & Verify'");
        setStep("face");
      },
      () => {
        /* per-frame decode errors are expected; ignore */
      }
    );

    return () => {
      scanner.clear().catch(() => {});
    };
  }, [step, sessionId]);

  // Step 2: Camera setup for face verification
  useEffect(() => {
    if (step !== "face") return;
    let cancelled = false;

    (async () => {
      try {
        setMessage("Starting camera...");
        await loadModels();

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setMessage("Align your face and click 'Capture & Verify'");
      } catch (e) {
        setMessage("Camera error: " + (e.message || "Failed to access camera"));
      }
    })();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [step]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const finish = (ok, msg, isAuth = false) => {
    stopCamera();
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

  // Capture face and submit attendance
  const handleVerifyFace = async () => {
    if (!videoRef.current || busy) return;
    setBusy(true);
    setMessage("Reading face...");

    try {
      const descriptor = await captureSingleDescriptor(videoRef.current);
      if (!descriptor) {
        setMessage("No face detected clearly. Please center your face in good light and retry.");
        setBusy(false);
        return;
      }

      setMessage("Verifying your identity with server...");
      const res = await clientServer.post("/sessions/mark-attendance", {
        sessionId,
        scannedQRData: qrDataRef.current,
        deviceId: getDeviceId(),
        faceDescriptor: descriptor,
      });

      setBusy(false);
      finish(true, res.data.message || "Attendance marked successfully!");
    } catch (e) {
      setBusy(false);
      const isAuth = e.response?.status === 401;
      const errorMsg =
        (isAuth
          ? "Session expired or invalid login. Please log in again to mark attendance."
          : e.response?.data?.error ||
            e.response?.data?.message ||
            e.message ||
            "Failed to mark attendance.");

      if (isAuth) {
        localStorage.removeItem("token");
      }

      finish(false, errorMsg, isAuth);
    }
  };

  // Retry ONLY face verification without re-scanning QR code!
  const retryFaceOnly = () => {
    setSuccess(false);
    setIsAuthError(false);
    setMessage("Align your face and click 'Capture & Verify'");
    setStep("face");
  };

  // Re-scan QR code from scratch
  const rescanQR = () => {
    qrDataRef.current = null;
    setSuccess(false);
    setIsAuthError(false);
    setMessage("");
    setStep("scan");
  };

  return (
    <div className="qr-scanner-wrapper">
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
            <p className="qr-scanner-subtitle">Align the QR code displayed on the screen</p>
          </div>
          <div id="qr-reader" />
        </>
      )}

      {step === "face" && (
        <>
          <div className="qr-scanner-header">
            <h2 className="qr-scanner-title">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 5a2 2 0 0 1 2-2h2"></path>
                <path d="M19 5a2 2 0 0 0-2-2h-2"></path>
                <path d="M5 19a2 2 0 0 0 2 2h2"></path>
                <path d="M19 19a2 2 0 0 1-2 2h-2"></path>
                <circle cx="9" cy="10" r="1"></circle>
                <circle cx="15" cy="10" r="1"></circle>
                <path d="M9.5 15a3.5 3.5 0 0 0 5 0"></path>
              </svg>
              Face Verification
            </h2>
            <p className="qr-scanner-subtitle">QR verified! Now verify your face to complete attendance</p>
          </div>

          <div className="qr-status-pill">
            <span className="face-status-dot"></span>
            <span>{message}</span>
          </div>

          <div className="face-camera-wrapper" style={{ margin: "0 auto 16px auto" }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="face-camera-video"
            />
            <div className="face-camera-corners">
              <span className="face-corner-tr"></span>
              <span className="face-corner-bl"></span>
            </div>
          </div>

          <div className="face-btn-group">
            <button
              className="face-btn-cancel"
              onClick={rescanQR}
              disabled={busy}
              title="Scan a different QR code"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
              Re-scan QR
            </button>

            <button
              className="face-btn-capture"
              onClick={handleVerifyFace}
              disabled={busy}
            >
              {busy ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}>
                    <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="10"></circle>
                  </svg>
                  Verifying...
                </>
              ) : (
                <>
                  <span className="face-btn-icon">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                      <circle cx="12" cy="13" r="4"></circle>
                    </svg>
                  </span>
                  Capture & Verify Face
                </>
              )}
            </button>
          </div>
        </>
      )}

      {step === "result" && (
        <div className="qr-result-container">
          <div className={`qr-result-badge ${success ? "success" : "error"}`}>
            {success ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
                <>
                  {/* Retry Face Verification directly using the valid scanned QR! */}
                  {qrDataRef.current && (
                    <button className="qr-retry-face-btn" onClick={retryFaceOnly}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="1 4 1 10 7 10"></polyline>
                        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                      </svg>
                      Retry Face Verification
                    </button>
                  )}

                  {/* Re-scan QR only if desired */}
                  <button className="qr-rescan-btn" onClick={rescanQR}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7"></rect>
                      <rect x="14" y="3" width="7" height="7"></rect>
                      <rect x="14" y="14" width="7" height="7"></rect>
                      <rect x="3" y="14" width="7" height="7"></rect>
                    </svg>
                    Re-scan QR Code
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
