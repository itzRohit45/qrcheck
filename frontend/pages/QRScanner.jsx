import { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { clientServer, getDeviceId } from "../src/config";
import {
  loadModels,
  runLiveness,
  captureSingleDescriptor,
} from "../src/faceApi";

export default function QRScanner({ sessionId }) {
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
    };

    (async () => {
      try {
        setMessage("Loading face models...");
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
    <div style={{ textAlign: "center" }}>
      {step === "scan" && (
        <>
          <p>Scan the session QR code on screen</p>
          <div id="qr-reader" />
        </>
      )}

      {step === "face" && (
        <>
          <p style={{ fontWeight: 600 }}>{message}</p>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: 300,
              maxWidth: "100%",
              borderRadius: 8,
              transform: "scaleX(-1)",
              background: "#000",
            }}
          />
        </>
      )}

      {step === "result" && (
        <>
          <p
            style={{
              color: success ? "green" : "crimson",
              fontWeight: 600,
            }}
          >
            {message}
          </p>
          {!success && <button onClick={retry}>Try Again</button>}
        </>
      )}
    </div>
  );
}
