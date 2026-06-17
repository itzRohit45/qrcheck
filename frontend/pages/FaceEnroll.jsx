import { useEffect, useRef, useState } from "react";
import { clientServer } from "../src/config";
import { loadModels, captureDescriptors } from "../src/faceApi";

export default function FaceEnroll({ onDone, onCancel }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState("Loading Face Recognition...");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
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
        setReady(true);
        setStatus("Center your face in good light, then click Capture.");
      } catch (e) {
        setStatus("Camera/model error: " + (e.message || e));
      }
    })();
    return () => {
      cancelled = true;
      if (streamRef.current)
        streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const handleEnroll = async () => {
    if (!ready || busy) return;
    setBusy(true);
    try {
      const descriptors = await captureDescriptors(videoRef.current, 5, setStatus);
      if (descriptors.length < 3) {
        setStatus("Could not read your face clearly. Improve lighting and retry.");
        setBusy(false);
        return;
      }
      setStatus("Saving...");
      await clientServer.post("/users/enroll-face", { descriptors });
      localStorage.setItem("faceEnrolled", "true");
      setStatus("Face enrolled successfully!");
      stopCamera();
      onDone && onDone();
    } catch (e) {
      setStatus(e.response?.data?.message || "Enrollment failed. Please retry.");
      setBusy(false);
    }
  };

  return (
    <div style={{ textAlign: "center" }}>
      <h2>Set up Face ID</h2>
      <p style={{ fontSize: "0.9em", color: "#555" }}>
        We capture a few angles of your face. Turn your head slightly between
        captures for best accuracy.
      </p>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: 320,
          maxWidth: "100%",
          borderRadius: 8,
          transform: "scaleX(-1)",
          background: "#000",
        }}
      />
      <p style={{ fontWeight: 600 }}>{status}</p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        {onCancel && (
          <button
            onClick={() => {
              stopCamera();
              onCancel();
            }}
            disabled={busy}
          >
            Cancel
          </button>
        )}
        <button onClick={handleEnroll} disabled={!ready || busy}>
          {busy ? "Capturing..." : "Capture & Enroll"}
        </button>
      </div>
    </div>
  );
}
