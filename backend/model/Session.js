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
