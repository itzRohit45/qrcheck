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

/*
========================================================================================
[CONFIGURATION] PURE QR MODE vs BIOMETRIC FACE ID
- Set REQUIRE_FACE_ID = false for instant 1-step QR attendance (Professor's design).
- Set REQUIRE_FACE_ID = true to restore 2-step Face Recognition verification.
All Face ID code, models, and liveness helpers are 100% preserved below!
========================================================================================
*/
const REQUIRE_FACE_ID = false;

export default function QRScanner({ sessionId, onSuccess }) {
  const [step, setStep] = useState("scan"); // scan | face | submitting | result
  const [message, setMessage] = useState("");
  const [isAuthError, setIsAuthError] = useState(false);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  const qrDataRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const navigate = useNavigate();

  // Preload face models only if Face ID is enabled
  useEffect(() => {
    if (REQUIRE_FACE_ID) {
      loadModels().catch((e) => console.error("Face model preload:", e));
    }
  }, []);

  // Step 1: Scan the rotating QR code
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

        // =====================================================================
        // PURE QR MODE: Directly submit attendance without camera/face lag!
        // =====================================================================
        if (!REQUIRE_FACE_ID) {
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
          return;
        }

        // =====================================================================
        // [PRESERVED] BIOMETRIC FACE ID STEP (Active if REQUIRE_FACE_ID = true)
        // =====================================================================
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

  /*
  ==============================================================================
  [PRESERVED] FACE CAMERA & RECOGNITION HELPERS
  These functions are preserved for when REQUIRE_FACE_ID is enabled.
  ==============================================================================
  */
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

  // Preserved: Manual face descriptor capture & submission
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
  };

  // Re-scan QR code from scratch
  const rescanQR = () => {
    qrDataRef.current = null;
    setSuccess(false);
    setIsAuthError(false);
    setMessage("");
    setStep("scan");
  };

  const retryFaceOnly = () => {
    setSuccess(false);
    setIsAuthError(false);
    setMessage("Align your face and click 'Capture & Verify'");
    setStep("face");
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
            <p className="qr-scanner-subtitle">Align the QR code displayed on the screen</p>
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

      {/* 3. [PRESERVED] Face Verification View (if REQUIRE_FACE_ID = true) */}
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
            <button className="face-btn-cancel" onClick={rescanQR} disabled={busy}>
              Re-scan QR
            </button>
            <button className="face-btn-capture" onClick={handleVerifyFace} disabled={busy}>
              {busy ? "Verifying..." : "Capture & Verify Face"}
            </button>
          </div>
        </>
      )}

      {/* 4. Result View */}
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
                <>
                  {REQUIRE_FACE_ID && qrDataRef.current && (
                    <button className="qr-retry-face-btn" onClick={retryFaceOnly}>
                      Retry Face Verification
                    </button>
                  )}
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
