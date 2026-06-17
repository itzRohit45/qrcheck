import mongoose, { model, Schema } from "mongoose";

const teacherSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  dob: { type: String, required: true },
  dept: { type: String, required: true },
  password: { type: String, required: true },
  courses: [{ type: Schema.Types.ObjectId, ref: "Course" }], // List of courses created by teacher
  tokenVersion: { type: Number, default: 0 }, // Invalidates old logins (Layer 4)
});

export const Teacher = model("Teacher", teacherSchema);
