import express from "express";
import {
  createSession,
  markAttendance,
  updateAttendanceStatus,
  getCurrentQR,
} from "../controllers/SessionController.js";
import JWT from "../middleware/JWT.js";

const router = express.Router();

router.post("/create", JWT.verifyToken, createSession);
router.get("/:sessionId/current-qr", getCurrentQR);
router.post("/mark-attendance", JWT.verifyToken, markAttendance);
router.patch(
  "/update-attendance-status",
  JWT.verifyToken,
  updateAttendanceStatus
);

export default router;
