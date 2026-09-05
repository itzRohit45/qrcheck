import { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { clientServer, getDeviceId } from "../src/config";
import {
  loadModels,
  runLiveness,
  captureSingleDescriptor,
} from "../src/faceApi";
import toast from "react-hot-toast";
import "../styles/QRScanner.css";

export default function QRScanner({ sessionId, onSuccess }) {
  const [step, setStep] = useState("scan"); // scan | face | result
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  const qrDataRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Step 1: scan the rotating QR code.
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
            return; // Don't stop the scanner, just ignore this scan
          }
        } catch (e) {
          toast.error("Invalid QR format!");
          return;
        }

        qrDataRef.current = decodedText;
        try {
          await scanner.clear();
        } catch {
          /* ignore */
        }
        setMessage("");
        setStep("face");
      },
      () => {
        /* per-frame decode errors are expected; ignore */
      }
    );

    return () => {
      scanner.clear().catch(() => {});
    };
  }, [step]);

  // Step 2: liveness + face match, then submit.
  useEffect(() => {
    if (step !== "face") return;
    let cancelled = false;

    const stopCamera = () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };

    const finish = (ok, msg) => {
      stopCamera();
      if (cancelled) return;
      setSuccess(ok);
      setMessage(msg);
      setStep("result");
      if (ok && onSuccess) {
        setTimeout(() => {
          onSuccess();
        }, 1500);
      }
    };

    (async () => {
      try {
        setMessage("Loading Face Recognition...");
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

        const { live, sawFace } = await runLiveness(videoRef.current, (s) => {
          if (!cancelled) setMessage(s);
        });
        if (cancelled) return;

        if (!sawFace) {
          return finish(false, "No face detected. Retry in better lighting.");
        }
        if (!live) {
          return finish(
            false,
            "Liveness check failed. Please blink or move your head and retry."
          );
        }

        setMessage("Verifying your identity...");
        const descriptor = await captureSingleDescriptor(videoRef.current);
        if (cancelled) return;
        if (!descriptor) {
          return finish(false, "Could not read your face. Please retry.");
        }

        const res = await clientServer.post("/sessions/mark-attendance", {
          sessionId,
          scannedQRData: qrDataRef.current,
          deviceId: getDeviceId(),
          faceDescriptor: descriptor,
        });
        finish(true, res.data.message || "Attendance marked successfully!");
      } catch (e) {
        finish(
          false,
          e.response?.data?.error || e.message || "Failed to mark attendance."
        );
      }
    })();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [step, sessionId]);

  const retry = () => {
    qrDataRef.current = null;
    setSuccess(false);
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
              Verifying Face ID
            </h2>
          </div>
          <div className="qr-status-pill">
            <span className="face-status-dot"></span>
            <span>{message}</span>
          </div>
          <div className="face-camera-wrapper" style={{ margin: "0 auto" }}>
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
        </>
      )}

      {step === "result" && (
        <div className="qr-result-container">
          <div className={`qr-result-badge ${success ? "success" : "error"}`}>
            {success ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
            )}
            <span>{message}</span>
          </div>

          {!success && (
            <button className="qr-retry-btn" onClick={retry}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10"></polyline>
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
              </svg>
              Try Again
            </button>
          )}
        </div>
      )}
    </div>
  );
}
