import { useEffect, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import axios from "axios";

export default function QRScanner({ sessionId, studentId }) {
  const [result, setResult] = useState("");
  const [hasPermission, setHasPermission] = useState(null);
  const [facingMode, setFacingMode] = useState("environment");
  const [locationStatus, setLocationStatus] = useState({ active: false, accuracy: null });

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then(() => setHasPermission(true))
      .catch(() => setHasPermission(false));
    
    // Start monitoring location accuracy
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLocationStatus({
          active: true,
          accuracy: position.coords.accuracy,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
      },
      (error) => {
        console.error("Location watch error:", error);
        setLocationStatus({ active: false, accuracy: null });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
    
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    if (!hasPermission) return;

    const scanner = new Html5QrcodeScanner("qr-reader", {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      facingMode,
      disableFlip: true,
      rememberLastUsedCamera: true,
      supportedScanTypes: [0],
    });

    scanner.render(
      async (decodedText) => {
        scanner.clear();
        handleScan(decodedText);
      },
      (errorMessage) => {
        console.error("QR Scan Error:", errorMessage);
      }
    );

    return () => scanner.clear();
  }, [hasPermission, facingMode]);

  const handleScan = async (data) => {
    if (!data) return;

    console.log("Scanned QR Code Data:", data);
    setResult("Processing... Please wait");
    
    try {
      const position = await getUserLocation();
      
      // Display accuracy warning if needed
      if (position.poorAccuracy) {
        setResult(`⚠️ Low GPS accuracy (${Math.round(position.accuracy)}m). Try moving to an open area.`);
        
        // Optional: Ask user if they want to continue despite poor accuracy
        if (!window.confirm(`Your GPS accuracy is poor (${Math.round(position.accuracy)}m). This may affect attendance marking. Continue anyway?`)) {
          setResult("Attendance marking cancelled due to poor GPS accuracy. Please try again in an open area.");
          return;
        }
      }
      
      const res = await axios.post(
        "https://scanme-wkq3.onrender.com/sessions/mark-attendance",
        {
          studentId,
          sessionId,
          latitude: position.latitude,
          longitude: position.longitude,
          accuracy: position.accuracy, // Send accuracy to backend
          scannedQRData: data,
        }
      );

      setResult(res.data.message);
    } catch (error) {
      console.error("Error processing QR Code:", error);
      if (error.latitude === null) {
        setResult("Location access denied. Please enable location and try again.");
      } else {
        setResult(error.response?.data?.error || "Failed to mark attendance");
      }
    }
  };

  return (
    <div>
      <button
        onClick={() =>
          setFacingMode(facingMode === "environment" ? "user" : "environment")
        }
      >
        Switch Camera
      </button>
      
      {/* Location Status Indicator */}
      {locationStatus.active && (
        <div style={{ 
          margin: '10px 0', 
          padding: '8px', 
          borderRadius: '4px',
          backgroundColor: locationStatus.accuracy > 100 ? '#fff3cd' : '#d4edda',
          color: locationStatus.accuracy > 100 ? '#856404' : '#155724',
          border: `1px solid ${locationStatus.accuracy > 100 ? '#ffeeba' : '#c3e6cb'}`
        }}>
          <p style={{ margin: '0' }}>
            {locationStatus.accuracy > 100 ? 
              `⚠️ GPS Accuracy: ${Math.round(locationStatus.accuracy)}m (Poor)` : 
              `✅ GPS Accuracy: ${Math.round(locationStatus.accuracy)}m (Good)`}
          </p>
          {locationStatus.accuracy > 100 && (
            <p style={{ margin: '5px 0 0 0', fontSize: '0.9em' }}>
              Try moving to an open area away from buildings for better accuracy.
            </p>
          )}
        </div>
      )}
      
      <div id="qr-reader"></div>
      <p>{result}</p>
    </div>
  );
}

// Get user location
async function getUserLocation() {
  return new Promise((resolve, reject) => {
    const geoOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };
    
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Check if accuracy is too poor (more than 100 meters)
        if (pos.coords.accuracy > 100) {
          // Still resolve but with accuracy warning
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            poorAccuracy: true
          });
        } else {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            poorAccuracy: false
          });
        }
      },
      (err) => {
        console.error("Geolocation Error:", err);
        reject({ latitude: null, longitude: null, error: err.message });
      },
      geoOptions
    );
  });
}
