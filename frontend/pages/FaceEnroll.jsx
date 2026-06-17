import { useEffect, useRef, useState } from "react";
import { clientServer } from "../src/config";
import { loadModels, captureSingleDescriptor } from "../src/faceApi";

export default function FaceEnroll({ onDone, onCancel }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState("Loading Face Recognition...");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [descriptors, setDescriptors] = useState([]);
  
  const prompts = [
    "Look Straight",
    "Slightly Turn Left",
    "Slightly Turn Right",
    "Look Slightly Up",
    "Look Slightly Down"
  ];

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

  const handleEnrollStep = async () => {
    if (!ready || busy) return;
    setBusy(true);
    
    const currentIndex = descriptors.length;
    setStatus(`Capturing: ${prompts[currentIndex]}...`);
    
    try {
      const descriptor = await captureSingleDescriptor(videoRef.current);
      if (!descriptor) {
        setStatus("Could not read your face clearly. Please try again.");
        setBusy(false);
        return;
      }
      
      const newDescriptors = [...descriptors, descriptor];
      setDescriptors(newDescriptors);
      
      if (newDescriptors.length === prompts.length) {
        setStatus("Saving...");
        await clientServer.post("/users/enroll-face", { descriptors: newDescriptors });
        localStorage.setItem("faceEnrolled", "true");
        setStatus("Face enrolled successfully!");
        stopCamera();
        if (onDone) onDone();
      } else {
        setStatus(`Next: ${prompts[newDescriptors.length]}. Click Capture.`);
        setBusy(false);
      }
    } catch (e) {
      setStatus(e.response?.data?.message || "Enrollment failed. Please retry.");
      setBusy(false);
    }
  };

  return (
    <div style={{ textAlign: "center" }}>
      <h2>Set up Face ID</h2>
      
      {!busy && (
        <div style={{ 
          fontSize: "0.9em", 
          color: "#ccc", 
          backgroundColor: "rgba(255,255,255,0.05)", 
          padding: "10px", 
          borderRadius: "8px",
          marginBottom: "15px",
          textAlign: "left"
        }}>
          <strong>Tips for best accuracy:</strong>
          <ul style={{ paddingLeft: "20px", marginTop: "5px", marginBottom: "0" }}>
            <li>Ensure you have good lighting on your face</li>
            <li>Take off glasses or masks if possible</li>
            <li>Follow the on-screen prompts during capture</li>
          </ul>
        </div>
      )}
      
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
        <button onClick={handleEnrollStep} disabled={!ready || busy}>
          {busy ? "Capturing..." : `Capture ${descriptors.length + 1}/${prompts.length}`}
        </button>
      </div>
    </div>
  );
}
