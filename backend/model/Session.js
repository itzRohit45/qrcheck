import mongoose, { model, Schema } from "mongoose";

const sessionSchema = new Schema(
  {
    date: { type: Date, default: Date.now },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    duration: { type: Number, required: true }, // Session duration in minutes
    expiresAt: { type: Date, required: true }, // End time of session
    currentQRCode: { type: String }, // Latest QR image (data URL) for display
    currentNonce: { type: String }, // Latest valid nonce embedded in the QR
    previousNonce: { type: String }, // Previous nonce, accepted during a short grace window
    tokenPool: [{ type: String }], // Pre-generated pool of unique one-time tokens for this session
    rotationInterval: { type: Number, default: 5 }, // Seconds each token is displayed on teacher screen
    recentNonces: [
      {
        nonce: { type: String },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    nonceUpdatedAt: { type: Date, default: Date.now }, // When currentNonce was last rotated
    attendance: [
      {
        studentId: { type: Schema.Types.ObjectId, ref: "Student" },
        status: { type: String, enum: ["Present", "Absent"], required: true },
        scannedAt: { type: Date },
      },
    ],
  },
  { timestamps: true }
);

export const Session = model("Session", sessionSchema);
