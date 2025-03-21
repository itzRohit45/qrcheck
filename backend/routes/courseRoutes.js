import express from "express";
import {
  createClass,
  getTeacherClasses,
  joinClass,
  getClassStudents,
} from "../controllers/courseController.js";

const router = express.Router();

// 🟢 Create a New Class
router.post("/create-class", createClass);

// 🟢 Get All Classes for a Teacher
router.get("/teacher/:teacherId/classes", getTeacherClasses);

// 🟢 Student Joins Class via Invitation Code
router.post("/join-class", joinClass);

// 🟢 Get All Students in a Course
router.get("/course/:courseId/students", getClassStudents);

export default router;
