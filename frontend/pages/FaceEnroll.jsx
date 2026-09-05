import { useEffect, useRef, useState } from "react";
import { clientServer } from "../src/config";
import { loadModels, captureSingleDescriptor } from "../src/faceApi";
import "../styles/FaceEnroll.css";

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
    <div className="face-enroll-container">
      <div className="face-enroll-header">
        <h2 className="face-enroll-title">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 5a2 2 0 0 1 2-2h2"></path>
            <path d="M19 5a2 2 0 0 0-2-2h-2"></path>
            <path d="M5 19a2 2 0 0 0 2 2h2"></path>
            <path d="M19 19a2 2 0 0 1-2 2h-2"></path>
            <circle cx="9" cy="10" r="1"></circle>
            <circle cx="15" cy="10" r="1"></circle>
            <path d="M9.5 15a3.5 3.5 0 0 0 5 0"></path>
          </svg>
          Set up Face ID
        </h2>
        <p className="face-enroll-subtitle">Calibrate facial recognition for verified attendance</p>
      </div>
      
      {!busy && (
        <div className="face-enroll-tips">
          <div className="face-enroll-tips-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            Tips for best accuracy
          </div>
          <ul className="face-enroll-tips-list">
            <li>Ensure you have bright, even lighting on your face</li>
            <li>Take off glasses or masks if possible</li>
            <li>Follow each pose prompt below before capturing</li>
          </ul>
        </div>
      )}

      {/* 5-Step Visual Progress Tracker */}
      <div className="face-step-tracker">
        {prompts.map((p, idx) => {
          const isCompleted = idx < descriptors.length;
          const isActive = idx === descriptors.length;
          return (
            <div key={idx} className="face-step-item" title={p}>
              <div className={`face-step-dot ${isCompleted ? "completed" : ""} ${isActive ? "active" : ""}`}>
                {isCompleted ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                ) : (
                  idx + 1
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Video Viewport with HUD target brackets */}
      <div className="face-camera-wrapper">
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

      {/* Status Instruction Badge */}
      <div className="face-status-container">
        <span className="face-status-dot"></span>
        <span className="face-status-text">{status}</span>
      </div>

      {/* Action Buttons */}
      <div className="face-btn-group">
        {onCancel && (
          <button
            className="face-btn-cancel"
            onClick={() => {
              stopCamera();
              onCancel();
            }}
            disabled={busy}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
            Cancel
          </button>
        )}
        <button
          className="face-btn-capture"
          onClick={handleEnrollStep}
          disabled={!ready || busy}
        >
          {busy ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}>
                <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="10"></circle>
              </svg>
              Capturing...
            </>
          ) : (
            <>
              <span className="face-btn-icon">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                  <circle cx="12" cy="13" r="4"></circle>
                </svg>
              </span>
              Capture {descriptors.length + 1}/{prompts.length}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
