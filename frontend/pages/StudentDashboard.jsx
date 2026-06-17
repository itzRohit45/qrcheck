import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "../styles/StudentDashboard.module.css";
import { clientServer } from "../src/config";
import FaceEnroll from "./FaceEnroll";
import toast from "react-hot-toast";

const StudentDashboard = () => {
  const [courses, setCourses] = useState([]);
  const [invitationCode, setInvitationCode] = useState("");
  const [courseName, setCourseName] = useState("");
  const [studentId, setStudentId] = useState(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [faceEnrolled, setFaceEnrolled] = useState(true);
  const [showFaceEnroll, setShowFaceEnroll] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        const userEmail = localStorage.getItem("email");
        if (!userEmail) {
          navigate("/login");
          return;
        }
        const res = await clientServer.get(`/users/user?email=${userEmail}`);
        if (res.data.user) {
          localStorage.setItem("id", res.data.user._id);
          setStudentId(res.data.user._id);
          setUserName(res.data.user.name || userEmail.split("@")[0]);
          localStorage.setItem(
            "name",
            res.data.user.name || userEmail.split("@")[0]
          );
          const enrolled = !!res.data.user.faceEnrolled;
          setFaceEnrolled(enrolled);
          localStorage.setItem("faceEnrolled", enrolled ? "true" : "false");
          if (!enrolled) setShowFaceEnroll(true);
        }
      } catch (error) {
        console.error("Error fetching user details:", error);
        toast.error("Failed to load user information. Please try logging in again.");
        navigate("/login");
      }
    };
    fetchUserDetails();
  }, [navigate]);

  useEffect(() => {
    const fetchCourses = async () => {
      if (!studentId) return;
      try {
        setIsLoading(true);
        const res = await clientServer.get(
          `/courses/student/${studentId}/classes`
        );
        setCourses(res.data);
      } catch (error) {
        console.error("Error fetching courses:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCourses();
  }, [studentId]);

  const handleJoinClass = async () => {
    if (!studentId) return toast.error("Student ID not found");
    if (!invitationCode.trim()) return toast.error("Invitation code is required");
    if (!courseName.trim()) return toast.error("Course name is required");

    try {
      await clientServer.post("/courses/join-class", {
        studentId,
        invitationCode,
        courseName,
      });

      setInvitationCode("");
      setCourseName("");
      setShowJoinModal(false);

      const updatedCourses = await clientServer.get(
        `/courses/student/${studentId}/classes`
      );
      setCourses(updatedCourses.data);
      toast.success("Joined class successfully!");
    } catch (error) {
      console.error("Error joining class:", error);
      toast.error(error.response?.data?.error || "Invalid data or server error");
    }
  };

  const renderEmptyState = () => (
    <div className={styles["empty-state"]}>
      <div className={styles["empty-icon"]}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="64"
          height="64"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
      </div>
      <h3>No Classes Yet</h3>
      <p>Join a class using an invitation code to get started</p>
      <button
        onClick={() => setShowJoinModal(true)}
        className={styles["join-empty-btn"]}
      >
        Join Your First Class
      </button>
    </div>
  );

  return (
    <div className={styles["dashboard-wrapper"]}>
      <aside className={styles.sidebar}>
        <div className={styles["sidebar-menu"]}>
          <p className={`${styles["menu-item"]} ${styles.active}`}>
            <span className={styles["menu-icon"]}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
            </span>
            <span>Dashboard</span>
          </p>
        </div>

        <div className={styles["sidebar-footer"]}>
          <button
            onClick={() => setShowJoinModal(true)}
            className={styles["join-btn"]}
            style={{ marginBottom: "10px", backgroundColor: "#00c853" }}
          >
            <span className={styles["btn-icon"]}>+</span>
            <span>Join Class</span>
          </button>
          <button
            onClick={() => setShowFaceEnroll(true)}
            className={styles["join-btn"]}
            style={{ backgroundColor: faceEnrolled ? "#3b82f6" : "#ef4444" }}
          >
            <span className={styles["btn-icon"]}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 5a2 2 0 0 1 2-2h2"></path><path d="M19 5a2 2 0 0 0-2-2h-2"></path><path d="M5 19a2 2 0 0 0 2 2h2"></path><path d="M19 19a2 2 0 0 1-2 2h-2"></path><path d="M9 9h.01"></path><path d="M15 9h.01"></path><path d="M12 15h.01"></path></svg>
            </span>
            <span>{faceEnrolled ? "Update Face ID" : "Set up Face ID"}</span>
          </button>
        </div>
      </aside>

      <main className={styles["dashboard-content"]}>
        <header className={styles["content-header"]}>
          <div className={styles["page-title"]}>
            <p className={styles["welcome-text"]}>Welcome back, {userName}!</p>
            <h1 style={{ marginTop: "5px" }}>Your Classes</h1>
          </div>
        </header>

        {!faceEnrolled && (
          <div
            style={{
              margin: "12px 0",
              padding: "12px",
              borderRadius: 8,
              background: "#fff3cd",
              color: "#856404",
              border: "1px solid #ffeeba",
            }}
          >
            You must set up Face ID before you can mark attendance.{" "}
            <button onClick={() => setShowFaceEnroll(true)}>Set up now</button>
          </div>
        )}

        {isLoading ? (
          <div className={styles["loading-container"]}>
            <div className={styles["loading-spinner"]}></div>
            <p>Loading your classes...</p>
          </div>
        ) : (
          <div className={styles["dashboard-body"]}>
            {courses.length > 0 ? (
              <div className={styles["course-grid"]}>
                {courses.map((course) => (
                  <div
                    key={course._id}
                    className={styles["course-card"]}
                    onClick={() => navigate(`/student/course/${course._id}`)}
                  >
                    <div className={styles["course-color-indicator"]}></div>
                    <div className={styles["course-content"]}>
                      <h3>{course.courseName}</h3>
                      <p className={styles["course-code"]}>
                        Code: {course.courseCode}
                      </p>
                      <p style={{ margin: "5px 0", color: "#a0a3bd", fontSize: "0.85em" }}>
                        Instructor: {course.teacherId?.name || "Unknown"}
                      </p>
                      <div className={styles["course-details"]}></div>
                      <button className={styles["view-btn"]}>
                        View Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              renderEmptyState()
            )}
          </div>
        )}
      </main>

      {/* Face Enrollment Modal */}
      {showFaceEnroll && (
        <div className={styles.modal}>
          <div className={styles["modal-content"]}>
            <FaceEnroll
              onDone={() => {
                setFaceEnrolled(true);
                setShowFaceEnroll(false);
              }}
              onCancel={() => setShowFaceEnroll(false)}
            />
          </div>
        </div>
      )}

      {/* Join Class Modal */}
      {showJoinModal && (
        <div className={styles.modal}>
          <div className={styles["modal-content"]}>
            <h2>Join a Class</h2>
            <p>Enter the details provided by your instructor</p>
            <input
              type="text"
              placeholder="Enter Course Name"
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              className={styles["code-input"]}
            />
            <input
              type="text"
              placeholder="Enter Invitation Code"
              value={invitationCode}
              onChange={(e) => setInvitationCode(e.target.value)}
              className={styles["code-input"]}
            />
            <div className={styles["modal-actions"]}>
              <button
                onClick={() => setShowJoinModal(false)}
                className={styles["cancel-btn"]}
              >
                Cancel
              </button>
              <button onClick={handleJoinClass} className={styles["join-btn"]}>
                Join Class
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;
