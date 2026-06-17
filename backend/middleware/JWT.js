import dotenv from "dotenv";
dotenv.config();
import jwt from "jsonwebtoken";
import { Student } from "../model/Student.js";
import { Teacher } from "../model/Teacher.js";

// Reads the token from an Authorization: Bearer header first, then the cookie.
function extractToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    return header.slice(7);
  }
  return req.cookies?.token || null;
}

async function verifyToken(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res
      .status(401)
      .json({ message: "Access Denied. No Token Provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Layer 4: only the most recent login is valid. A new login bumps
    // tokenVersion, so any older token (shared account, another device) fails here.
    const Model = decoded.type === "teacher" ? Teacher : Student;
    const user = await Model.findById(decoded.id).select("tokenVersion");
    if (!user || user.tokenVersion !== decoded.tokenVersion) {
      return res
        .status(401)
        .json({ message: "Session expired. Please log in again." });
    }

    req.user = decoded; // { id, email, type, tokenVersion }
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid or Expired Token" });
  }
}

function generateToken(data) {
  return jwt.sign(data, process.env.JWT_SECRET, { expiresIn: "12h" });
}

const JWT = {
  verifyToken,
  generateToken,
};

export default JWT;
