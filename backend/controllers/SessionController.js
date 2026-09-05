import QRCode from "qrcode";
import crypto from "crypto";
import { Session } from "../model/Session.js";
import { Course } from "../model/Course.js";
import { Student } from "../model/Student.js";

const generateNonce = () => crypto.randomBytes(16).toString("hex");

const buildQrPayload = (sessionId, nonce) =>
  JSON.stringify({ sessionId: sessionId.toString(), nonce });

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

    // Pre-generate token pool for this session (1 token per 5 seconds of session)
    const rotationInterval = 5; // seconds
    const totalTokens = Math.max(300, Math.ceil((duration * 60) / rotationInterval) + 50);
    const tokenPool = Array.from({ length: totalTokens }, () => generateNonce());

    const session = new Session({
      courseId,
      duration,
      expiresAt,
      attendance: initialAttendance,
      tokenPool,
      rotationInterval,
    });

    // Give the session a valid initial QR immediately
    const nonce = tokenPool[0] || generateNonce();
    session.currentNonce = nonce;
    session.previousNonce = null;
    session.recentNonces = [{ nonce, createdAt: new Date() }];
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
      tokenPoolCount: tokenPool.length,
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

      // Maintain a 2-minute rolling window of valid nonces
      const twoMinutesAgo = Date.now() - 120000;
      const recent = (session.recentNonces || []).filter(
        (n) => new Date(n.createdAt).getTime() > twoMinutesAgo
      );
      recent.push({ nonce, createdAt: new Date() });
      session.recentNonces = recent;

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

// Fetch pre-generated tokens for client-side rotation on the teacher's screen (0 latency)
export const getSessionTokens = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await Session.findById(sessionId).select(
      "date duration expiresAt tokenPool rotationInterval currentNonce currentQRCode"
    );
    if (!session) {
      return res.status(404).json({ error: "Session not found!" });
    }

    // If session doesn't have a token pool yet (e.g. created before this update), generate it on-the-fly
    if (!session.tokenPool || session.tokenPool.length === 0) {
      const rotationInterval = 5;
      const totalTokens = Math.max(300, Math.ceil((session.duration * 60) / rotationInterval) + 50);
      session.tokenPool = Array.from({ length: totalTokens }, () => generateNonce());
      session.rotationInterval = rotationInterval;
      await session.save();
    }

    return res.json({
      sessionId: session._id,
      date: session.date,
      serverTime: Date.now(),
      duration: session.duration,
      expiresAt: session.expiresAt,
      rotationInterval: session.rotationInterval || 5,
      tokenPool: session.tokenPool,
      currentNonce: session.currentNonce,
      currentQRCode: session.currentQRCode,
    });
  } catch (error) {
    console.error("Error fetching session tokens:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

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
    const { sessionId, scannedQRData, deviceId } = req.body;
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

    const now = Date.now();

    // Strict Anti-Screenshot QR Validation:
    // QR codes rotate every 5 seconds. We only accept:
    // 1. Current slot (0-5s old)
    // 2. Exactly 1 previous slot (at most 5-6s old, to absorb standard mobile HTTP network latency)
    // Any screenshot older than 1 slot (>= 10s old) or future slot is strictly rejected.
    let isQRValid = false;
    if (session.tokenPool && session.tokenPool.length > 0 && qrData.nonce) {
      const interval = session.rotationInterval || 5;
      const elapsedSeconds = Math.max(0, (now - new Date(session.date).getTime()) / 1000);
      const activeSlot = Math.floor(elapsedSeconds / interval);

      if (typeof qrData.index === "number") {
        const isCurrentSlot = qrData.index === activeSlot;
        const isGraceSlot = qrData.index === activeSlot - 1;

        if (
          (isCurrentSlot || isGraceSlot) &&
          session.tokenPool[qrData.index] === qrData.nonce
        ) {
          isQRValid = true;
        }
      } else {
        const previousSlot = Math.max(0, activeSlot - 1);
        if (
          session.tokenPool[activeSlot] === qrData.nonce ||
          session.tokenPool[previousSlot] === qrData.nonce
        ) {
          isQRValid = true;
        }
      }
    } else if (qrData.nonce) {
      // Fallback for sessions created without a tokenPool
      if (qrData.nonce === session.currentNonce) {
        isQRValid = true;
      }
    }

    if (!isQRValid) {
      return res
        .status(400)
        .json({ error: "QR Code expired. Please scan the latest code on screen." });
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
