import express from "express";
import {
  createClass,
  getTeacherClasses,
  joinClass,
  getClassStudents,
  getStudentClasses,
  getCourseDetails,
  deleteClass,
  leaveClass,
} from "../controllers/courseController.js";

const router = express.Router();

// 🟢 Create a New Class
router.post("/create-class", createClass);

// 🟢 Get All Classes for a Teacher
router.get("/teacher/:teacherId/classes", getTeacherClasses);

// 🟢 Student Joins Class via Invitation Code
router.post("/join-class", joinClass);

// Student Leaves Class / Teacher Removes Student
router.post("/leave-class", leaveClass);

// 🟢 Get All Students in a Course
router.get("/course/:courseId/students", getClassStudents);

router.get("/student/:studentId/classes", getStudentClasses);

router.get("/:id", getCourseDetails);

// Delete a Course and its associated sessions
router.delete("/:id", deleteClass);

export default router;
