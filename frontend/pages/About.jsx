import React, { useState } from "react";
import "../styles/About.css";
import signup from "../assets/Signup.png";
import login from "../assets/Login.png";
import createclass from "../assets/createclass.png";
import teacherd from "../assets/Teacher Dashboard.png";
import newSession from "../assets/New Session.jpeg";
import qr from "../assets/QR.jpeg";
import AfterSession from "../assets/After Session.jpeg";
import CourseDetails from "../assets/CourseDetails.jpeg";
import studentd from "../assets/student dashboard.png";
import joinclass from "../assets/joinclass.png";
import StudentCourseDetails from "../assets/StudentCourseDetails.jpeg";
import QrScanner from "../assets/Qr Scanner.jpeg";
import forgorPW from "../assets/Forgot pw.png";
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';

const assets = [
  {
    image_url: signup,
    title: "User Registration",
    caption:
      "New users can register as a teacher or student. An OTP is sent to their registered email for verification before allowing password setup.",
  },
  {
    image_url: login,
    title: "Secure Login",
    caption:
      "Users authenticate using their email and password. Upon successful login, a JSON Web Token (JWT) is generated for secure access.",
  },
  {
    image_url: teacherd,
    title: "Teacher Dashboard Overview",
    caption:
      "Teachers can view all previously created attendance Classes and have quick access to Class details or initiate new Classes.",
  },
  {
    image_url: createclass,
    title: "Class Creation",
    caption:
      "Teachers can create new classes by entering details like course name, course code, and an invitation code for student access.",
  },
  {
    image_url: CourseDetails,
    title: "Class Details View",
    caption:
      "Teachers can view a list of enrolled students and the sessions created under each class. Teachers can also reset student devices.",
  },
  {
    image_url: newSession,
    title: "Initiate New Attendance Session",
    caption:
      "Teachers can set up a new session by specifying location, date, time, and expiration.",
  },
  {
    image_url: qr,
    title: "Session QR Code",
    caption:
      "A unique, continuously rotating QR code is generated for each session, preventing students from taking pictures of it.",
  },
  {
    image_url: AfterSession,
    title: "Post-Session Overview",
    caption:
      "Teachers can review attendance, see which students were marked present, and manually adjust status if necessary.",
  },
  {
    image_url: studentd,
    title: "Student Dashboard & Face ID",
    caption:
      "Students can view their classes, join new ones, and setup their Face ID profile for biometric verification.",
  },
  {
    image_url: joinclass,
    title: "Join a Class",
    caption:
      "Students join a class using the course name and invitation code shared by their teacher.",
  },
  {
    image_url: StudentCourseDetails,
    title: "Course Interaction",
    caption:
      "Students can view session details and participate by submitting attendance via QR scan.",
  },
  {
    image_url: QrScanner,
    title: "QR & Face Recognition",
    caption:
      "Students scan the QR code. The system validates the session and then uses Face Recognition to verify the student's identity before marking attendance.",
  },
  {
    image_url: forgorPW,
    title: "Password Recovery",
    caption:
      "Users can reset forgotten passwords via OTP-based email verification followed by setting a new password.",
  },
];

const About = ({ toggleDone }) => {
  const [active, setActive] = useState(0);
  const [showContent, setShowContent] = useState(false);

  const onNext = () => {
    if (active < assets.length - 1) {
      setActive(active + 1);
    } else {
      toggleDone();
    }
  };

  const onPrev = () => {
    if (active > 0) {
      setActive(active - 1);
    }
  };

  const Slide = ({ image_url, title, caption, active }) => {
    return (
      <div className={`slide ${active ? "active" : ""}`}>
        <img
          src={image_url}
          alt={caption}
          onMouseEnter={() => setShowContent(true)}
          onMouseLeave={() => setShowContent(false)}
        />
        {showContent && (
          <span
            onMouseEnter={() => setShowContent(true)}
            onMouseLeave={() => setShowContent(false)}
            className="caption"
          >
            <ul>
              <h3>{title}</h3>
              <li>
                <p>{caption}</p>
              </li>
            </ul>
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="slider">
      <h2 style={{ textAlign: "center" }}>Tutorial</h2>
      <div className="slides">
        {assets.map((e, i) => (
          <Slide key={e.caption} {...e} active={i === active} />
        ))}
      </div>
      <div className="navigation">
        <div className="navigation-bottom">
          {assets.map((e, i) => (
            <button
              className={`preview ${i === active ? "active" : ""}`}
              key={e.caption}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(active)}
              style={{ width: "1px" }}
            />
          ))}
        </div>
        <div className="navigation-next-prev">
          <div className="next-prev prev" onClick={onPrev}>
            <ArrowBackIosIcon style={{ color: 'white', fontSize: 32 }} />
          </div>
          <div className="next-prev next" onClick={onNext}>
            <ArrowForwardIosIcon style={{ color: 'white', fontSize: 32 }} />
          </div>
        </div>
      </div>
      <button className="skipbtn" onClick={toggleDone}>
        Skip
      </button>
    </div>
  );
};

export default About;
