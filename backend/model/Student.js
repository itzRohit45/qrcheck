import mongoose, { model, Schema } from "mongoose";

const studentSchema = new Schema({
  name: { type: String, required: true },
  rollNo: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  dob: { type: String, required: true },
  branch: { type: String, required: true },
  dept: { type: String, required: true },
  password: { type: String, required: true },
  courses: [{ type: Schema.Types.ObjectId, ref: "Course" }], // Courses student enrolled in
  deviceId: { type: String, default: null }, // Bound device (Layer 3)
  tokenVersion: { type: Number, default: 0 }, // Invalidates old logins (Layer 4)
  faceDescriptors: { type: [[Number]], default: [] }, // Enrolled 128-d face vectors (Layer 5)
});

export const Student = model("Student", studentSchema);
