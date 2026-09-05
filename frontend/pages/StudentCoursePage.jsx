import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { clientServer } from "../src/config";
import styles from "../styles/StudentCoursePage.module.css";
import QRScanner from "../pages/QRScanner";
import toast from "react-hot-toast";

const StudentCoursePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState("");
  const [studentId, setStudentId] = useState(null);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [attendanceData, setAttendanceData] = useState({});
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const fetchCourseDetails = async () => {
    try {
      const res = await clientServer.get(`/courses/${id}`);
      setCourse(res.data);
    } catch (error) {
      console.error("Error fetching course details:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveCourse = async () => {
    if (!studentId || !id) return;
    try {
      setIsLeaving(true);
      await clientServer.post("/courses/leave-class", {
        courseId: id,
        studentId: studentId,
      });
      toast.success("Successfully left the class");
      navigate("/student-dashboard");
    } catch (err) {
      console.error("Error leaving class:", err);
      toast.error(err.response?.data?.error || "Failed to leave class");
    } finally {
      setIsLeaving(false);
      setShowLeaveModal(false);
    }
  };

  useEffect(() => {
    fetchCourseDetails();
    const storedStudentId = localStorage.getItem("id");
    if (storedStudentId) {
      setStudentId(storedStudentId);
    }
  }, [id]);

  const isScannerEnabled = (session) => {
    const now = new Date();
    const sessionStart = new Date(session.date);
    const sessionEnd = new Date(session.expiresAt);
    return now >= sessionStart && now <= sessionEnd;
  };

  if (loading) {
    return (
      <div className={styles["loading-container"]}>
        <div className={styles["loading-spinner"]}></div>
        <p>Loading course details...</p>
      </div>
    );
  }

  if (!course) {
    return (
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
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h3>Course Not Found</h3>
        <p>
          The course you're looking for doesn't exist or you don't have access
          to it.
        </p>
      </div>
    );
  }

  return (
    <div className={styles["dashboard-wrapper"]}>
      <aside className={styles.sidebar}>
        <div className={styles["sidebar-menu"]}>
          <a href="/student-dashboard" className={styles["menu-item"]}>
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
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            </span>
            <span>Back</span>
          </a>
        </div>
        <div className={styles["course-info-sidebar"]}>
          <span className={styles["course-code-badge"]}>
            {course.courseCode}
          </span>
          <h3>{course.courseName}</h3>
          <div className={styles["invitation-code"]}>
            <p>Instructor: {course.teacherId?.name || "Unknown"}</p>
          </div>
          <button
            type="button"
            className={styles["leave-course-sidebar-btn"]}
            onClick={() => setShowLeaveModal(true)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Leave Class</span>
          </button>
        </div>
      </aside>

      <main className={styles["dashboard-content"]}>
        <header className={styles["content-header"]}>
          <div className={styles["page-title"]}>
            <h1>Session Details</h1>
            <p className={styles["welcome-text"]}>
              View and manage your sessions for this course
            </p>
          </div>
          <div className={styles["header-actions"]}>
            <div className={styles["instructor-info"]}>
              Instructor: {course.teacherId?.name || "Unknown"}
            </div>
            <button
              type="button"
              className={styles["leave-header-btn"]}
              onClick={() => setShowLeaveModal(true)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Leave Class</span>
            </button>
          </div>
        </header>

        <div className={styles["dashboard-body"]}>
          <div className={styles.section}>
            <h2 className={styles["section-title"]}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginRight: "8px" }}
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              Available Sessions
            </h2>

            {course.sessions.length > 0 ? (
              <div className={styles["table-container"]}>
                <table className={styles["data-table"]}>
                  <thead>
                    <tr>
                      <th>Expires At</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {course.sessions.map((session) => {
                      const sessionActive = isScannerEnabled(session);
                      const attendanceStatus =
                        session.attendance.find(
                          (att) => att.studentId._id === studentId
                        )?.status || "Not Marked";

                      return (
                        <tr key={session._id}>
                          <td>
                            {new Date(session.expiresAt).toLocaleString()}
                          </td>
                          <td>
                            <span
                              className={`${styles["status-badge"]} ${
                                attendanceStatus === "Present"
                                  ? styles.present
                                  : styles.absent
                              }`}
                            >
                              {attendanceStatus}
                            </span>
                          </td>
                          <td>
                            {attendanceStatus === "Present" ? (
                              <button
                                className={`${styles["action-btn"]} ${styles["inactive-btn"]}`}
                                disabled
                                style={{ backgroundColor: "#2e7d32" }}
                              >
                                Marked
                              </button>
                            ) : sessionActive ? (
                              <button
                                className={styles["action-btn"]}
                                onClick={() => {
                                  setSessionId(session._id);
                                  setShowQRScanner(true);
                                }}
                              >
                                Scan QR
                              </button>
                            ) : (
                              <button
                                className={`${styles["action-btn"]} ${styles["inactive-btn"]}`}
                                disabled
                              >
                                Scan QR
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className={styles["empty-state-mini"]}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ marginBottom: "12px" }}
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <p>No sessions available yet.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {showAttendanceModal && (
        <div className={styles.modal}>
          <div className={styles["modal-content"]}>
            <h2>Attendance Status</h2>
            <div className={styles["student-info"]}>
              <p>
                <strong>Name:</strong> {attendanceData.name}
              </p>
              <p>
                <strong>Roll No:</strong> {attendanceData.rollNo}
              </p>
              <p>
                <strong>Status:</strong> {attendanceData.status}
              </p>
            </div>
            <div className={styles["modal-actions"]}>
              <button
                className={styles["cancel-btn"]}
                onClick={() => setShowAttendanceModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showQRScanner && (
        <div className={styles.modal}>
          <div className={`${styles["modal-content"]} ${styles["modal-scanner"]}`}>
            <QRScanner 
              sessionId={sessionId} 
              studentId={studentId} 
              onClose={() => setShowQRScanner(false)}
              onSuccess={() => {
                setShowQRScanner(false);
                fetchCourseDetails(); // Refresh the attendance list to show "Present"
              }}
            />
          </div>
        </div>
      )}

      {/* Leave Class Modal */}
      {showLeaveModal && (
        <div
          className={styles.modal}
          onClick={() => !isLeaving && setShowLeaveModal(false)}
        >
          <div
            className={styles["modal-content"]}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Leave Class</h2>
            <p>
              Are you sure you want to leave <strong>{course.courseName}</strong>?
              All your attendance records for this course will be completely removed.
            </p>
            <div className={styles["modal-actions"]}>
              <button
                type="button"
                disabled={isLeaving}
                onClick={() => setShowLeaveModal(false)}
                className={styles["cancel-btn"]}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isLeaving}
                onClick={handleLeaveCourse}
                className={styles["confirm-leave-btn"]}
              >
                {isLeaving ? "Leaving..." : "Leave Class"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentCoursePage;
