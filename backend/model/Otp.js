import { Schema, model } from "mongoose";

const otpSchema = new Schema({
  email: { type: String, required: true },
  otp: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now, index: { expires: 600 } }, // Automatically expires in 10 minutes
});

export const Otp = model("Otp", otpSchema);
