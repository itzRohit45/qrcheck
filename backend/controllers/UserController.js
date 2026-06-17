import dotenv from "dotenv";
dotenv.config();
import { Student } from "../model/Student.js";
import { Teacher } from "../model/Teacher.js";
import JWT from "../middleware/JWT.js";
import Mailer from "../middleware/Mailer.js";
import bcrypt from "bcryptjs";

async function Login(req, res) {
  const { email, password } = req.body;

  // 🛑 Validate inputs
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    let type = "student";
    let user = await Student.findOne({ email });

    if (!user) {
      type = "teacher";
      user = await Teacher.findOne({ email });
    }

    if (!user || !user.password) {
      return res.status(400).json({ message: "No such user or password missing" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // Layer 4: bump tokenVersion so any previously issued token is invalidated.
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    const token = JWT.generateToken({
      id: user._id,
      email: user.email,
      type,
      tokenVersion: user.tokenVersion,
    });

    const userObj = user.toObject();
    delete userObj.password;
    delete userObj.faceDescriptors;
    userObj.type = type;
    userObj.faceEnrolled =
      type === "student" ? (user.faceDescriptors?.length || 0) > 0 : true;

    res
      .cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "None",
      })
      .status(200)
      .json({ user: userObj, type, token });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error during login" });
  }
}

async function Signup(req, res) {
  const { name, email, rollNo, dob, branch, dept, password, type } = req.body;

  // 🛑 Validate required inputs
  if (!email || !password || !type) {
    return res
      .status(400)
      .json({ message: "Email, password, and user type are required" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    if (type === "student") {
      const existingUser = await Student.findOne({ email }).exec();
      if (existingUser) {
        return res
          .status(409)
          .json({ message: "Student already exists. Try logging in." });
      }

      const newUser = new Student({
        name,
        email,
        rollNo,
        dob,
        branch,
        dept,
        password: hashedPassword,
      });

      await newUser.save();
      return res
        .status(201)
        .json({ message: "Student registered successfully", user: newUser });
    }

    if (type === "teacher") {
      const existingUser = await Teacher.findOne({ email }).exec();
      if (existingUser) {
        return res
          .status(409)
          .json({ message: "Teacher already exists. Try logging in." });
      }

      const newUser = new Teacher({
        name,
        email,
        dob,
        dept,
        password: hashedPassword,
      });

      await newUser.save();
      return res
        .status(201)
        .json({ message: "Teacher registered successfully", user: newUser });
    }

    // 🛑 Invalid type
    return res.status(400).json({
      message: "Invalid user type. Must be either student or teacher.",
    });
  } catch (err) {
    console.error("Signup error:", err); // 👀 Logs the actual error in Render
    res.status(500).json({
      message: "An error occurred during signup. Please try again.",
      error: err.message, // 👈 Optional, remove in production
    });
  }
}

async function ForgotPassword(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }
  console.log("Email:", email);
  console.log("Password:", password);
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    let user = await Student.findOne({ email });

    if (user) {
      user.password = hashedPassword;
      await user.save();
      return res
        .status(200)
        .json({ message: "Password reset successful (student)" });
    }

    user = await Teacher.findOne({ email });
    if (user) {
      user.password = hashedPassword;
      await user.save();
      return res
        .status(200)
        .json({ message: "Password reset successful (teacher)" });
    }

    return res.status(404).json({ message: "User not found" });
  } catch (err) {
    console.error("Error resetting password:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function SendMail(req, res) {
  const { email, type } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000);

  let subject, text;

  if (type === "registration") {
    subject = "Your OTP for Registration";
    text = `Hello,

Thank you for signing up!

Your One-Time Password (OTP) for completing your registration is: ${otp}

Please enter this OTP to verify your email. This OTP is valid for the next 10 minutes.

If you did not initiate this request, feel free to ignore this email.

Best regards,  
Team AttendX`;
  } else if (type === "forgot") {
    subject = "OTP to Reset Your Password";
    text = `Hi,

You recently requested to reset your password.

Use the following OTP to proceed: ${otp}

If you didn't request a password reset, you can safely ignore this email.

Thanks,  
The Support Team`;
  } else {
    return res.status(400).json({ message: "Invalid email type." });
  }

  const result = await Mailer.sendMail(email, subject, text);

  if (result.success) {
    res.status(200).json({
      message: "OTP sent successfully. Please check your email.",
      otp: otp,
    });
  } else {
    res.status(500).json({ message: "Failed to send OTP. Please try again." });
  }
}

async function GetUserDetails(req, res) {
  const { email } = req.query; // ✅ Fetch email from query params

  try {
    let type = "student";
    let user = await Student.findOne({ email });

    if (!user) {
      type = "teacher";
      user = await Teacher.findOne({ email });
    }

    if (user) {
      const obj = user.toObject();
      delete obj.password;
      delete obj.faceDescriptors;
      obj.type = type;
      obj.faceEnrolled =
        type === "student" ? (user.faceDescriptors?.length || 0) > 0 : true;
      res.status(200).json({ user: obj });
    } else {
      res.status(404).json({ message: "User not found." });
    }
  } catch (err) {
    console.error("Error fetching user details:", err);
    res.status(500).json({ message: "Error fetching user details." });
  }
}

// Layer 5: store a student's enrolled face descriptors (sent by the browser).
async function EnrollFace(req, res) {
  try {
    if (req.user?.type !== "student") {
      return res.status(403).json({ message: "Only students enroll a face." });
    }

    const { descriptors } = req.body;
    if (
      !Array.isArray(descriptors) ||
      descriptors.length === 0 ||
      !descriptors.every(
        (d) => Array.isArray(d) && d.length === 128 && d.every((n) => typeof n === "number")
      )
    ) {
      return res
        .status(400)
        .json({ message: "Invalid face data. Please capture again." });
    }

    const student = await Student.findById(req.user.id);
    if (!student) {
      return res.status(404).json({ message: "Student not found." });
    }

    student.faceDescriptors = descriptors;
    await student.save();

    return res.status(200).json({ message: "Face enrolled successfully." });
  } catch (err) {
    console.error("Error enrolling face:", err);
    res.status(500).json({ message: "Error enrolling face." });
  }
}

// Layer 3: a teacher clears a student's device binding (e.g. they changed phones).
async function ResetDevice(req, res) {
  try {
    if (req.user?.type !== "teacher") {
      return res.status(403).json({ message: "Only teachers can reset devices." });
    }

    const { studentId } = req.body;
    if (!studentId) {
      return res.status(400).json({ message: "studentId is required." });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: "Student not found." });
    }

    student.deviceId = null;
    await student.save();

    return res.status(200).json({ message: "Device reset successfully." });
  } catch (err) {
    console.error("Error resetting device:", err);
    res.status(500).json({ message: "Error resetting device." });
  }
}

const UserController = {
  Login,
  Signup,
  ForgotPassword,
  SendMail,
  GetUserDetails,
  EnrollFace,
  ResetDevice,
};

export default UserController;
