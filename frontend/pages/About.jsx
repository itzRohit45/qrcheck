import React, { useState } from "react";
import "../styles/About.css";
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';

const tutorialSteps = [
  {
    title: "1. Register & Login",
    content: "New users can securely register as a teacher or student. An OTP is sent to your registered email for verification before allowing password setup. Once registered, log in to access your dashboard.",
  },
  {
    title: "2. Setting up Face ID",
    content: "After logging in as a student, the system will guide you through a one-time process of capturing your face from multiple angles to create a secure biometric profile.",
  },
  {
    title: "3. Creating & Joining Classes",
    content: "Teachers can create new classes and generate a unique invite code. Students can use this code to join the class directly from their dashboard.",
  },
  {
    title: "4. Creating an Attendance Session",
    content: "Teachers can initiate a new attendance session for their class. This generates a secure, continuously rotating QR code that is displayed on the screen.",
  },
  {
    title: "5. Scanning & Verifying",
    content: "Students use the app to scan the session's QR code. Once the QR code is validated, the app uses Face Recognition to securely verify the student's identity before marking them present.",
  },
  {
    title: "6. Managing Attendance",
    content: "Teachers have access to a real-time post-session overview where they can review attendance records, reset locked student devices, and make manual adjustments if necessary.",
  },
];

const About = ({ toggleDone }) => {
  const [active, setActive] = useState(0);

  const onNext = () => {
    if (active < tutorialSteps.length - 1) {
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

  const Slide = ({ title, content, active }) => {
    return (
      <div className={`slide ${active ? "active" : ""}`}>
        <div className="tutorial-card">
          <h3>{title}</h3>
          <p>{content}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="slider">
      <h2 style={{ textAlign: "center" }}>Tutorial</h2>
      <div className="slides">
        {tutorialSteps.map((step, i) => (
          <Slide key={step.title} {...step} active={i === active} />
        ))}
      </div>
      <div className="navigation">
        <div className="navigation-bottom">
          {tutorialSteps.map((step, i) => (
            <button
              className={`preview ${i === active ? "active" : ""}`}
              key={step.title}
              onClick={() => setActive(i)}
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
