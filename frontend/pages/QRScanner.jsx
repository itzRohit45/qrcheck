import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import { clientServer, getDeviceId } from "../src/config";
import toast from "react-hot-toast";
import "../styles/QRScanner.css";

export default function QRScanner({ sessionId, onSuccess, onClose }) {
  const [step, setStep] = useState("scan"); // "scan" | "submitting" | "result"
  const [message, setMessage] = useState("");
  const [isAuthError, setIsAuthError] = useState(false);
  const [success, setSuccess] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [facingMode, setFacingMode] = useState("environment"); // "environment" | "user"

  // Camera Zoom states
  const [hasZoom, setHasZoom] = useState(false);
  const [zoomRange, setZoomRange] = useState({ min: 1, max: 5, step: 0.1 });
  const [currentZoom, setCurrentZoom] = useState(1);
  const zoomCapabilityRef = useRef(null);

  const html5QrCodeRef = useRef(null);
  const isSubmittingRef = useRef(false);
  const navigate = useNavigate();

  const stopScannerSafely = useCallback(async () => {
    try {
      if (
        html5QrCodeRef.current &&
        html5QrCodeRef.current.getState() === Html5QrcodeScannerState.SCANNING
      ) {
        await html5QrCodeRef.current.stop();
      }
    } catch {
      /* ignore cleanup error */
    }
  }, []);

  const handleScanSuccess = useCallback(
    async (decodedText) => {
      if (isSubmittingRef.current) return;
      isSubmittingRef.current = true;

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
        isSubmittingRef.current = false;
        toast.error("QR Code does not match this class session!");
        return;
      }

      // Stop camera before showing submitting state
      await stopScannerSafely();

      setMessage("Recording your attendance...");
      setStep("submitting");

      try {
        const res = await clientServer.post("/sessions/mark-attendance", {
          sessionId,
          scannedQRData: decodedText,
          deviceId: getDeviceId(),
        });
        setSuccess(true);
        setMessage(res.data.message || "Attendance marked successfully!");
        setStep("result");
        if (onSuccess) {
          setTimeout(() => {
            onSuccess();
          }, 1400);
        }
      } catch (e) {
        const isAuth = e.response?.status === 401;
        const errorMsg = isAuth
          ? "Login expired. Please log in again to mark attendance."
          : e.response?.data?.error ||
            e.response?.data?.message ||
            e.message ||
            "Failed to mark attendance.";

        if (isAuth) {
          localStorage.removeItem("token");
        }
        setSuccess(false);
        setIsAuthError(isAuth);
        setMessage(errorMsg);
        setStep("result");
      } finally {
        isSubmittingRef.current = false;
      }
    },
    [sessionId, onSuccess, stopScannerSafely]
  );

  // Initialize camera scanner on mount
  useEffect(() => {
    if (step !== "scan") return;

    let isMounted = true;
    const scannerId = "custom-qr-reader";
    const qrCode = new Html5Qrcode(scannerId);
    html5QrCodeRef.current = qrCode;

    const startCamera = async () => {
      try {
        setCameraError("");
        setIsCameraReady(false);

        await qrCode.start(
          { facingMode },
          {
            fps: 20,
            qrbox: { width: 220, height: 220 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (isMounted) handleScanSuccess(decodedText);
          },
          () => {
            /* frame decode misses are normal */
          }
        );

        if (isMounted) {
          setIsCameraReady(true);
          try {
            const caps = qrCode.getRunningTrackCapabilities();
            setHasTorch(Boolean(caps.torch));
          } catch {
            setHasTorch(false);
          }

          // Detect & initialize camera zoom capability
          try {
            const cameraCaps = qrCode.getRunningTrackCameraCapabilities();
            const zFeature = cameraCaps?.zoomFeature?.();
            if (zFeature && zFeature.isSupported()) {
              zoomCapabilityRef.current = zFeature;
              const minVal = Number(zFeature.min()) || 1;
              const maxVal = Number(zFeature.max()) || 5;
              const stepVal = Number(zFeature.step()) || 0.1;
              setZoomRange({ min: minVal, max: maxVal, step: stepVal });
              const curVal = zFeature.value ? zFeature.value() : minVal;
              setCurrentZoom(curVal || 1);
              setHasZoom(true);
            } else {
              const trackCaps = qrCode.getRunningTrackCapabilities();
              if (trackCaps?.zoom) {
                setZoomRange({
                  min: Number(trackCaps.zoom.min) || 1,
                  max: Number(trackCaps.zoom.max) || 5,
                  step: Number(trackCaps.zoom.step) || 0.1,
                });
                setCurrentZoom(1);
                setHasZoom(true);
              } else {
                setZoomRange({ min: 1, max: 4, step: 0.1 });
                setCurrentZoom(1);
                setHasZoom(true);
              }
            }
          } catch (zoomErr) {
            console.warn("Could not query zoom capability:", zoomErr);
            setZoomRange({ min: 1, max: 4, step: 0.1 });
            setCurrentZoom(1);
            setHasZoom(true);
          }
        }
      } catch (err) {
        console.error("Camera start failure:", err);
        if (isMounted) {
          setCameraError(
            "Unable to access camera. Please make sure camera permission is granted in your browser settings."
          );
        }
      }
    };

    startCamera();

    return () => {
      isMounted = false;
      if (qrCode.getState() === Html5QrcodeScannerState.SCANNING) {
        qrCode.stop().catch(() => {});
      }
      const videoElem = document.querySelector("#custom-qr-reader video");
      if (videoElem) {
        videoElem.style.transform = "none";
      }
    };
  }, [step, facingMode, handleScanSuccess]);

  // Handle Camera Zoom Change
  const handleZoomChange = async (val) => {
    const num = parseFloat(val);
    setCurrentZoom(num);

    // 1. Try html5-qrcode's zoomFeature
    if (zoomCapabilityRef.current && zoomCapabilityRef.current.isSupported()) {
      try {
        await zoomCapabilityRef.current.apply(num);
        return;
      } catch (err) {
        console.warn("zoomFeature.apply failed:", err);
      }
    }

    // 2. Try applying video constraints directly on running track
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.applyVideoConstraints({
          advanced: [{ zoom: num }],
        });
        return;
      } catch {
        // Track constraint zoom not accepted
      }
    }

    // 3. Fallback: visual scale on video element
    const videoElem = document.querySelector("#custom-qr-reader video");
    if (videoElem) {
      videoElem.style.transform = `scale(${num})`;
      videoElem.style.transformOrigin = "center center";
      videoElem.style.transition = "transform 0.1s ease";
    }
  };

  // Toggle Torch / Flashlight
  const toggleTorch = async () => {
    if (!html5QrCodeRef.current || !hasTorch) return;
    try {
      const nextTorch = !isTorchOn;
      await html5QrCodeRef.current.applyVideoConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setIsTorchOn(nextTorch);
    } catch {
      toast.error("Torch not supported on this camera.");
    }
  };

  // Flip Camera
  const flipCamera = async () => {
    await stopScannerSafely();
    zoomCapabilityRef.current = null;
    setCurrentZoom(1);
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  const rescanQR = () => {
    setSuccess(false);
    setIsAuthError(false);
    setMessage("");
    setCurrentZoom(1);
    setStep("scan");
  };

  return (
    <div className="native-qr-scanner-modal">
      {/* 1. Camera Scanning View */}
      {step === "scan" && (
        <div className="native-scanner-card">
          {/* Header */}
          <div className="native-scanner-header">
            <div className="native-header-text">
              <h2 className="native-scanner-title">Scan QR Code</h2>
              <p className="native-scanner-subtitle">
                Point your camera at the screen to mark attendance
              </p>
            </div>
            {onClose && (
              <button
                type="button"
                className="native-close-btn"
                onClick={onClose}
                aria-label="Close"
              >
                ✕
              </button>
            )}
          </div>

          {/* Camera Viewport with Custom Target Reticle */}
          <div className="native-viewport-wrapper">
            <div id="custom-qr-reader" className="native-qr-video-box" />

            {/* Viewfinder Target Reticle Overlay */}
            {isCameraReady && (
              <div className="native-reticle-overlay">
                <div className="reticle-box">
                  <span className="reticle-corner corner-tl"></span>
                  <span className="reticle-corner corner-tr"></span>
                  <span className="reticle-corner corner-bl"></span>
                  <span className="reticle-corner corner-br"></span>
                  <div className="scanning-laser-line"></div>
                </div>
              </div>
            )}

            {/* Camera Loading Spinner */}
            {!isCameraReady && !cameraError && (
              <div className="native-camera-loading">
                <div className="native-spinner"></div>
                <span>Starting camera...</span>
              </div>
            )}

            {/* Camera Error Message */}
            {cameraError && (
              <div className="native-camera-error">
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <p>{cameraError}</p>
                <button
                  className="native-retry-camera-btn"
                  onClick={() => setFacingMode((f) => f)}
                >
                  Retry Camera
                </button>
              </div>
            )}
          </div>

          {/* Native Zoom Control Slider */}
          {isCameraReady && hasZoom && (
            <div className="native-zoom-container">
              <span className="native-zoom-badge">
                {currentZoom.toFixed(1)}x
              </span>
              <div className="native-zoom-slider-wrapper">
                <span className="native-zoom-limit">{zoomRange.min}x</span>
                <input
                  type="range"
                  min={zoomRange.min}
                  max={zoomRange.max}
                  step={zoomRange.step}
                  value={currentZoom}
                  onChange={(e) => handleZoomChange(e.target.value)}
                  className="native-zoom-slider"
                  aria-label="Camera Zoom"
                />
                <span className="native-zoom-limit">{zoomRange.max}x</span>
              </div>
            </div>
          )}

          {/* Compact Camera Controls Toolbar */}
          {isCameraReady && (
            <div className="native-camera-tools">
              {hasTorch && (
                <button
                  type="button"
                  className={`native-tool-btn ${isTorchOn ? "tool-active" : ""}`}
                  onClick={toggleTorch}
                  title="Toggle Flash"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                  </svg>
                  <span>{isTorchOn ? "Flash On" : "Flash"}</span>
                </button>
              )}

              <button
                type="button"
                className="native-tool-btn"
                onClick={flipCamera}
                title="Switch Camera"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M23 4v6h-6"></path>
                  <path d="M1 20v-6h6"></path>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                </svg>
                <span>Switch</span>
              </button>
            </div>
          )}

          {/* Bottom Cancel Button */}
          {onClose && (
            <div className="native-scanner-footer">
              <button
                type="button"
                className="native-cancel-btn"
                onClick={onClose}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* 2. Submitting / Processing State */}
      {step === "submitting" && (
        <div className="native-scanner-card native-status-card">
          <div className="native-status-spinner"></div>
          <h3>Submitting Attendance</h3>
          <p>{message}</p>
        </div>
      )}

      {/* 3. Result View */}
      {step === "result" && (
        <div className="native-scanner-card native-status-card">
          <div
            className={`native-result-icon ${
              success ? "result-success" : "result-error"
            }`}
          >
            {success ? (
              <svg
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            ) : (
              <svg
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ef4444"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
            )}
          </div>

          <h3 className={success ? "text-success" : "text-error"}>
            {success ? "Attendance Marked!" : "Scan Failed"}
          </h3>
          <p className="native-result-msg">{message}</p>

          {!success && (
            <div className="native-result-actions">
              {isAuthError ? (
                <button
                  className="native-primary-btn"
                  onClick={() => {
                    localStorage.clear();
                    navigate("/login");
                  }}
                >
                  Log In Again
                </button>
              ) : (
                <button className="native-primary-btn" onClick={rescanQR}>
                  Try Again
                </button>
              )}

              {onClose && (
                <button
                  type="button"
                  className="native-secondary-btn"
                  onClick={onClose}
                >
                  Close
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
