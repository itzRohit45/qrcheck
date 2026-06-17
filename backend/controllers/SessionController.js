import QRCode from "qrcode";
import crypto from "crypto";
import { Session } from "../model/Session.js";
import { Course } from "../model/Course.js";
import { Student } from "../model/Student.js";

const GRACE_MS = 8000; // previousNonce stays valid this long after a rotation
const FACE_MATCH_THRESHOLD = 0.5; // euclidean distance; lower = stricter

const generateNonce = () => crypto.randomBytes(16).toString("hex");

const buildQrPayload = (sessionId, nonce) =>
  JSON.stringify({ sessionId: sessionId.toString(), nonce });

const euclideanDistance = (a, b) => {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
};

// Smallest distance between the live descriptor and any enrolled reference.
const bestFaceDistance = (references, probe) => {
  let best = Infinity;
  for (const ref of references) {
    if (!Array.isArray(ref) || ref.length !== probe.length) continue;
    const d = euclideanDistance(ref, probe);
    if (d < best) best = d;
  }
  return best;
};

export const createSession = async (req, res) => {
  try {
    const { courseId, duration } = req.body;

    if (!courseId || !duration) {
      return res
        .status(400)
        .json({ error: "courseId and duration are required!" });
    }

    const course = await Course.findById(courseId).populate("students");
    if (!course) {
      return res.status(404).json({ error: "Course not found!" });
    }

    const expiresAt = new Date(Date.now() + duration * 60000);

    // Prepopulate attendance with all enrolled students as "Absent"
    const initialAttendance = course.students.map((student) => ({
      studentId: student._id,
      status: "Absent",
      scannedAt: null,
    }));

    const session = new Session({
      courseId,
      duration,
      expiresAt,
      attendance: initialAttendance,
    });

    // Give the session a valid QR immediately (no blank screen before first tick)
    const nonce = generateNonce();
    session.currentNonce = nonce;
    session.previousNonce = null;
    session.nonceUpdatedAt = new Date();
    session.currentQRCode = await QRCode.toDataURL(
      buildQrPayload(session._id, nonce)
    );

    await session.save();

    course.sessions.push(session._id);
    await course.save();

    return res.json({
      message: "Session created successfully!",
      sessionId: session._id,
    });
  } catch (error) {
    console.error("Error creating session:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Rotate the nonce + QR for every active session (called on an interval in app.js).
export async function updateQRCode() {
  try {
    const activeSessions = await Session.find({
      expiresAt: { $gt: new Date() },
    });

    const updatedSessions = [];
    for (const session of activeSessions) {
      const nonce = generateNonce();
      session.previousNonce = session.currentNonce;
      session.currentNonce = nonce;
      session.nonceUpdatedAt = new Date();
      session.currentQRCode = await QRCode.toDataURL(
        buildQrPayload(session._id, nonce)
      );
      await session.save();

      updatedSessions.push({
        sessionId: session._id,
        newQRCode: session.currentQRCode,
      });
    }
    return updatedSessions;
  } catch (error) {
    console.error("Error updating QR codes:", error);
    return [];
  }
}

// Lets the QR display fetch the current code on mount (before the next socket tick).
export const getCurrentQR = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await Session.findById(sessionId).select(
      "currentQRCode expiresAt"
    );
    if (!session) {
      return res.status(404).json({ error: "Session not found!" });
    }
    return res.json({
      qrCode: session.currentQRCode,
      expiresAt: session.expiresAt,
      expired: session.expiresAt < new Date(),
    });
  } catch (error) {
    console.error("Error fetching current QR:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const markAttendance = async (req, res) => {
  try {
    const { sessionId, scannedQRData, deviceId, faceDescriptor } = req.body;
    // Layer 4: the student is taken from the auth token, never trusted from the body.
    const studentId = req.user?.id;

    if (!studentId) {
      return res.status(401).json({ error: "Not authenticated." });
    }
    if (!sessionId || !scannedQRData || !deviceId) {
      return res
        .status(400)
        .json({ error: "Session, QR data and device id are required!" });
    }

    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found!" });
    }

    // Layer 2: server-side time validation (client clock is never trusted)
    if (session.expiresAt < new Date()) {
      return res.status(400).json({ error: "Session has ended." });
    }

    // Layer 1: QR payload + nonce must match what the server currently issues
    let qrData;
    try {
      qrData = JSON.parse(scannedQRData);
    } catch {
      return res.status(400).json({ error: "Invalid QR Code!" });
    }

    if (qrData.sessionId !== session._id.toString()) {
      return res
        .status(400)
        .json({ error: "QR Code does not match this session!" });
    }

    const matchesCurrent =
      qrData.nonce && qrData.nonce === session.currentNonce;
    const matchesPrevious =
      qrData.nonce &&
      qrData.nonce === session.previousNonce &&
      Date.now() - new Date(session.nonceUpdatedAt).getTime() <= GRACE_MS;

    if (!matchesCurrent && !matchesPrevious) {
      return res
        .status(400)
        .json({ error: "QR Code expired. Scan the latest code on screen." });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ error: "Student not found!" });
    }

    // Layer 3: device binding (one account == one device)
    let deviceJustBound = false;
    if (!student.deviceId) {
      student.deviceId = deviceId;
      deviceJustBound = true;
    } else if (student.deviceId !== deviceId) {
      return res.status(403).json({
        error:
          "This account is locked to another device. Ask your teacher to reset your device.",
      });
    }

    // Layer 5: face verification — the accept/reject decision is made on the server
    if (!student.faceDescriptors || student.faceDescriptors.length === 0) {
      return res.status(403).json({
        error: "Face not enrolled yet. Please complete face enrollment first.",
      });
    }
    if (!Array.isArray(faceDescriptor) || faceDescriptor.length !== 128) {
      return res
        .status(400)
        .json({ error: "Invalid face scan. Please try again." });
    }
    const distance = bestFaceDistance(student.faceDescriptors, faceDescriptor);
    if (distance > FACE_MATCH_THRESHOLD) {
      return res
        .status(403)
        .json({ error: "Face does not match the enrolled student." });
    }

    // All checks passed — mark present
    const record = session.attendance.find(
      (r) => r.studentId.toString() === studentId.toString()
    );

    if (record) {
      if (record.status === "Present") {
        if (deviceJustBound) await student.save();
        return res.status(400).json({ error: "Attendance already marked!" });
      }
      record.status = "Present";
      record.scannedAt = new Date();
    } else {
      session.attendance.push({
        studentId,
        status: "Present",
        scannedAt: new Date(),
      });
    }

    if (deviceJustBound) await student.save();
    await session.save();
    return res.json({ message: "Attendance marked successfully!" });
  } catch (error) {
    console.error("Error marking attendance:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateAttendanceStatus = async (req, res) => {
  try {
    const { sessionId, studentId, status } = req.body;

    if (!sessionId || !studentId || !status) {
      return res.status(400).json({ error: "All fields are required!" });
    }

    if (!["Present", "Absent"].includes(status)) {
      return res.status(400).json({ error: "Invalid status value!" });
    }

    const updateResult = await Session.updateOne(
      { _id: sessionId, "attendance.studentId": studentId },
      {
        $set: {
          "attendance.$.status": status,
          "attendance.$.scannedAt": status === "Present" ? new Date() : null,
        },
      }
    );

    if (updateResult.modifiedCount === 0) {
      return res.status(404).json({
        error: "Attendance record not found for the student in this session!",
      });
    }

    return res.json({ message: "Attendance status updated successfully!" });
  } catch (error) {
    console.error("Error updating attendance status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
