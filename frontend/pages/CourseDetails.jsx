import React, { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { clientServer } from "../src/config";
import QRDisplay from "../pages/QRDisplay";
import styles from "../styles/CourseDetails.module.css";
import toast from "react-hot-toast";
import {
  generateAttendancePDF,
  exportAttendanceCSV,
} from "../src/utils/exportUtils";

const CourseDetails = () => {
  const { id } = useParams();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modals & Navigation states
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [sessionDetails, setSessionDetails] = useState({
    courseId: "",
    duration: "",
  });
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  // Active Session Analytics View (replacing the old floating modal)
  const [activeSession, setActiveSession] = useState(null);
  const [attendanceFilter, setAttendanceFilter] = useState("all"); // 'all' | 'present' | 'absent'
  const [attendanceSearch, setAttendanceSearch] = useState("");

  // Enrolled Students list search
  const [studentSearch, setStudentSearch] = useState("");

  // QR Display modal state
  const [showQR, setShowQR] = useState(false);
  const [sessionIdForQR, setSessionIdForQR] = useState("");

  const [isSyncing, setIsSyncing] = useState(false);

  const fetchCourseDetails = async (preserveActiveSessionId = null) => {
    try {
      setIsSyncing(true);
      const res = await clientServer.get(`/courses/${id}`);
      setCourse(res.data);

      // Keep active session in sync with fresh data
      const targetSessionId = preserveActiveSessionId || activeSession?._id;
      if (targetSessionId && res.data.sessions) {
        const updated = res.data.sessions.find(
          (s) => s._id === targetSessionId
        );
        if (updated) {
          setActiveSession(updated);
        }
      }
    } catch (error) {
      console.error("Error fetching course details:", error);
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  };

  // Initial load and periodic background auto-sync every 4 seconds
  useEffect(() => {
    fetchCourseDetails();

    const interval = setInterval(() => {
      fetchCourseDetails();
    }, 4000);

    return () => clearInterval(interval);
  }, [id, activeSession?._id]);

  // Open a session and immediately fetch fresh data
  const handleOpenSession = async (session) => {
    setActiveSession(session);
    await fetchCourseDetails(session._id);
  };

  // Back to sessions overview and immediately fetch fresh data
  const handleBackToOverview = async () => {
    setActiveSession(null);
    await fetchCourseDetails();
  };

  const handleCreateSession = async () => {
    if (isCreatingSession) return;

    if (!sessionDetails.duration || Number(sessionDetails.duration) <= 0) {
      return toast.error("Please enter a valid session duration in minutes.");
    }

    setIsCreatingSession(true);
    try {
      const res = await clientServer.post("/sessions/create", {
        courseId: id,
        duration: Number(sessionDetails.duration),
      });
      toast.success("Session started successfully!");
      setShowSessionModal(false);
      setSessionDetails({ courseId: "", duration: "" });

      // Refresh course details and auto-open QR
      await fetchCourseDetails(res.data.sessionId);
      setSessionIdForQR(res.data.sessionId);
      setShowQR(true);
    } catch (error) {
      console.error("Error creating session:", error);
      toast.error(error.response?.data?.error || "Failed to create session.");
    } finally {
      setIsCreatingSession(false);
    }
  };

  // Inline Quick Toggle Status (No modal needed!)
  const handleQuickStatusToggle = async (studentId, currentStatus) => {
    if (!activeSession) return;
    const nextStatus = currentStatus === "Present" ? "Absent" : "Present";

    try {
      await clientServer.patch("/sessions/update-attendance-status", {
        sessionId: activeSession._id,
        studentId: studentId,
        status: nextStatus,
      });

      toast.success(`Marked as ${nextStatus}`);

      // Optimistically update active session attendance
      setActiveSession((prev) => {
        if (!prev) return prev;
        const updated = (prev.attendance || []).map((rec) => {
          const sId = rec.studentId?._id || rec.studentId;
          if (sId === studentId) {
            return {
              ...rec,
              status: nextStatus,
              scannedAt: nextStatus === "Present" ? new Date().toISOString() : null,
            };
          }
          return rec;
        });
        return { ...prev, attendance: updated };
      });

      // Refresh course state in background
      fetchCourseDetails(activeSession._id);
    } catch (error) {
      console.error("Error updating attendance status:", error);
      toast.error(error.response?.data?.error || "Failed to update attendance.");
    }
  };

  // Reset Student Registered Phone
  const handleResetDevice = async (studentId, studentName = "") => {
    const label = studentName ? `for ${studentName}` : "";
    if (
      !window.confirm(
        `Reset registered phone ${label}? The student will be able to register a new phone on their next scan.`
      )
    ) {
      return;
    }

    try {
      await clientServer.post("/users/reset-device", { studentId });
      toast.success("Phone reset. Student can now scan from a new device.");
      fetchCourseDetails(activeSession?._id);
    } catch (error) {
      console.error("Error resetting device:", error);
      toast.error(error.response?.data?.message || "Failed to reset device.");
    }
  };

  // Filtered attendance for active session
  const filteredAttendance = useMemo(() => {
    if (!activeSession || !activeSession.attendance) return [];

    return activeSession.attendance.filter((rec) => {
      const student = rec.studentId || {};
      const statusMatch =
        attendanceFilter === "all" ||
        rec.status.toLowerCase() === attendanceFilter.toLowerCase();

      const q = attendanceSearch.toLowerCase().trim();
      const searchMatch =
        !q ||
        (student.name && student.name.toLowerCase().includes(q)) ||
        (student.rollNo && student.rollNo.toLowerCase().includes(q)) ||
        (student.branch && student.branch.toLowerCase().includes(q));

      return statusMatch && searchMatch;
    });
  }, [activeSession, attendanceFilter, attendanceSearch]);

  // Filtered enrolled students for course overview
  const filteredStudents = useMemo(() => {
    if (!course || !course.students) return [];
    const q = studentSearch.toLowerCase().trim();
    if (!q) return course.students;
    return course.students.filter(
      (s) =>
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.rollNo && s.rollNo.toLowerCase().includes(q)) ||
        (s.branch && s.branch.toLowerCase().includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q))
    );
  }, [course, studentSearch]);

  // Helper to determine if a student has registered device or marked attendance
  const isStudentDeviceBound = (student) => {
    if (student.deviceId) return true;
    // Fallback: check if student has any recorded attendance in course sessions
    if (course?.sessions) {
      for (const sess of course.sessions) {
        if (
          sess.attendance?.some(
            (a) =>
              (a.studentId?._id === student._id || a.studentId === student._id) &&
              a.scannedAt
          )
        ) {
          return true;
        }
      }
    }
    return false;
  };

  // Compute analytics for active session
  const sessionAnalytics = useMemo(() => {
    if (!activeSession || !activeSession.attendance) {
      return { total: 0, present: 0, absent: 0, rate: 0 };
    }
    const total = activeSession.attendance.length;
    const present = activeSession.attendance.filter(
      (a) => a.status === "Present"
    ).length;
    const absent = total - present;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;
    return { total, present, absent, rate };
  }, [activeSession]);

  if (loading) {
    return (
      <div className={styles["loading-container"]}>
        <div className={styles["loading-spinner"]}></div>
        <p>Loading course dashboard...</p>
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
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        </div>
        <h3>Course Not Found</h3>
        <p>The course you are looking for does not exist or you lack permission.</p>
        <Link to="/teacher-dashboard" className={styles["action-btn-primary"]}>
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className={styles["dashboard-wrapper"]}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles["sidebar-menu"]}>
          <Link to="/teacher-dashboard" className={styles["menu-item"]}>
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
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
            </span>
            <span>Dashboard</span>
          </Link>

          <button
            className={`${styles["menu-item"]} ${
              activeSession === null ? styles.active : ""
            }`}
            onClick={handleBackToOverview}
          >
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
            <span>Course Overview</span>
          </button>
        </div>

        <div className={styles["course-info-sidebar"]}>
          <div className={styles["course-code-tag"]}>{course.courseCode}</div>
          <h3>{course.courseName}</h3>
          <div className={styles["sidebar-meta-item"]}>
            <span className={styles["meta-label"]}>Invite Code:</span>
            <span className={styles["meta-value-code"]}>
              {course.invitationCode}
            </span>
          </div>
          <div className={styles["sidebar-meta-item"]}>
            <span className={styles["meta-label"]}>Enrolled:</span>
            <span className={styles["meta-value"]}>
              {course.students?.length || 0} students
            </span>
          </div>
          <div className={styles["sidebar-meta-item"]}>
            <span className={styles["meta-label"]}>Sessions:</span>
            <span className={styles["meta-value"]}>
              {course.sessions?.length || 0} held
            </span>
          </div>
        </div>

        <div className={styles["sidebar-footer"]}>
          <button
            onClick={() => {
              setSessionDetails({
                courseId: course._id,
                duration: "45",
              });
              setShowSessionModal(true);
            }}
            className={styles["create-session-btn"]}
          >
            <span className={styles["btn-icon"]}>+</span>
            <span>Start Session</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className={styles["dashboard-content"]}>
        {/* Top Header */}
        <header className={styles["content-header"]}>
          <div className={styles["page-title"]}>
            <div className={styles["breadcrumb"]}>
              <Link to="/teacher-dashboard">Dashboard</Link>
              <span className={styles["breadcrumb-sep"]}>/</span>
              <span>{course.courseCode}</span>
              {activeSession && (
                <>
                  <span className={styles["breadcrumb-sep"]}>/</span>
                  <span className={styles["breadcrumb-current"]}>
                    Session Analytics
                  </span>
                </>
              )}
            </div>
            <h1>{course.courseName}</h1>
          </div>

          <div className={styles["instructor-info"]}>
            <span className={styles["instructor-role"]}>Instructor</span>
            <span className={styles["instructor-name"]}>
              {course.teacherId?.name || "Teacher"}
            </span>
          </div>
        </header>

        <div className={styles["dashboard-body"]}>
          {/* VIEW 1: ACTIVE SESSION ATTENDANCE & ANALYTICS */}
          {activeSession ? (
            <div className={styles["session-view-container"]}>
              {/* Back to overview and Session Header */}
              <div className={styles["session-view-header"]}>
                <div className={styles["session-title-group"]}>
                  <div className={styles["top-nav-row"]}>
                    <button
                      onClick={handleBackToOverview}
                      className={styles["back-to-list-btn"]}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <line x1="19" y1="12" x2="5" y2="12"></line>
                        <polyline points="12 19 5 12 12 5"></polyline>
                      </svg>
                      <span>Back to Sessions</span>
                    </button>

                    <button
                      onClick={() => fetchCourseDetails(activeSession._id)}
                      className={styles["sync-btn"]}
                      disabled={isSyncing}
                      title="Sync live attendance data"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className={isSyncing ? styles["spin-icon"] : ""}
                      >
                        <polyline points="23 4 23 10 17 10"></polyline>
                        <polyline points="1 20 1 14 7 14"></polyline>
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                      </svg>
                      <span>{isSyncing ? "Syncing..." : "Sync"}</span>
                    </button>
                  </div>

                  <div>
                    <div className={styles["session-badge-row"]}>
                      <span
                        className={
                          new Date(activeSession.expiresAt) > new Date()
                            ? styles["live-badge"]
                            : styles["completed-badge"]
                        }
                      >
                        {new Date(activeSession.expiresAt) > new Date()
                          ? "Live Session"
                          : "Completed Session"}
                      </span>
                      <span className={styles["session-date-tag"]}>
                        {new Date(activeSession.date).toLocaleString([], {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className={styles["session-duration-tag"]}>
                        {activeSession.duration} Mins
                      </span>
                    </div>
                    <h2 className={styles["session-view-title"]}>
                      Session Attendance & Analytics
                    </h2>
                  </div>
                </div>

                {/* Export & Action Buttons */}
                <div className={styles["session-action-toolbar"]}>
                  <button
                    className={styles["export-btn-danger"]}
                    onClick={() =>
                      generateAttendancePDF(course, activeSession, true)
                    }
                    title="Download list of absent students as PDF"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                      <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                    <span>Absentee PDF</span>
                  </button>

                  <button
                    className={styles["export-btn-primary"]}
                    onClick={() =>
                      generateAttendancePDF(course, activeSession, false)
                    }
                    title="Download full attendance report as PDF"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7 10 12 15 17 10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    <span>Full Attendance PDF</span>
                  </button>

                  <button
                    className={styles["export-btn-secondary"]}
                    onClick={() => exportAttendanceCSV(course, activeSession)}
                    title="Export data as CSV spreadsheet"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="8 17 12 21 16 17"></polyline>
                      <line x1="12" y1="12" x2="12" y2="21"></line>
                      <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"></path>
                    </svg>
                    <span>CSV</span>
                  </button>

                  {new Date(activeSession.expiresAt) > new Date() && (
                    <button
                      className={styles["reopen-qr-btn"]}
                      onClick={() => {
                        setSessionIdForQR(activeSession._id);
                        setShowQR(true);
                      }}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <rect x="3" y="3" width="7" height="7"></rect>
                        <rect x="14" y="3" width="7" height="7"></rect>
                        <rect x="14" y="14" width="7" height="7"></rect>
                        <rect x="3" y="14" width="7" height="7"></rect>
                      </svg>
                      <span>Show QR Code</span>
                    </button>
                  )}
                </div>
              </div>

              {/* KPI Analytics Cards */}
              <div className={styles["kpi-grid"]}>
                <div className={styles["kpi-card"]}>
                  <div className={styles["kpi-label"]}>Total Students</div>
                  <div className={styles["kpi-value"]}>
                    {sessionAnalytics.total}
                  </div>
                  <div className={styles["kpi-subtext"]}>
                    Registered in class
                  </div>
                </div>

                <div className={`${styles["kpi-card"]} ${styles["kpi-present"]}`}>
                  <div className={styles["kpi-label"]}>Present</div>
                  <div className={styles["kpi-value"]}>
                    {sessionAnalytics.present}
                  </div>
                  <div className={styles["kpi-subtext"]}>
                    {sessionAnalytics.rate}% attended
                  </div>
                </div>

                <div className={`${styles["kpi-card"]} ${styles["kpi-absent"]}`}>
                  <div className={styles["kpi-label"]}>Absent</div>
                  <div className={styles["kpi-value"]}>
                    {sessionAnalytics.absent}
                  </div>
                  <div className={styles["kpi-subtext"]}>
                    {sessionAnalytics.total > 0
                      ? (100 - sessionAnalytics.rate).toFixed(0)
                      : 0}
                    % absent
                  </div>
                </div>

                <div className={styles["kpi-card"]}>
                  <div className={styles["kpi-label"]}>Attendance Rate</div>
                  <div className={styles["kpi-value"]}>
                    {sessionAnalytics.rate}%
                  </div>
                  <div className={styles["kpi-bar-mini"]}>
                    <div
                      className={styles["kpi-bar-fill"]}
                      style={{ width: `${sessionAnalytics.rate}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Graphical Visual Analytics */}
              <div className={styles["analytics-graph-container"]}>
                <div className={styles["graph-card"]}>
                  <h3 className={styles["graph-title"]}>
                    Attendance Distribution
                  </h3>
                  <div className={styles["graph-content"]}>
                    {/* SVG Donut Chart */}
                    <div className={styles["donut-container"]}>
                      <svg viewBox="0 0 100 100" className={styles["donut-svg"]}>
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          className={styles["donut-track"]}
                        />
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          className={styles["donut-segment-present"]}
                          strokeDasharray={`${
                            (sessionAnalytics.rate / 100) * 251.3
                          } 251.3`}
                          strokeDashoffset="0"
                        />
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          className={styles["donut-segment-absent"]}
                          strokeDasharray={`${
                            ((100 - sessionAnalytics.rate) / 100) * 251.3
                          } 251.3`}
                          strokeDashoffset={`-${
                            (sessionAnalytics.rate / 100) * 251.3
                          }`}
                        />
                      </svg>
                      <div className={styles["donut-center-text"]}>
                        <span className={styles["donut-percent"]}>
                          {sessionAnalytics.rate}%
                        </span>
                        <span className={styles["donut-label"]}>Present</span>
                      </div>
                    </div>

                    {/* Donut Legend */}
                    <div className={styles["donut-legend"]}>
                      <div className={styles["legend-item"]}>
                        <div
                          className={`${styles["legend-dot"]} ${styles["dot-present"]}`}
                        ></div>
                        <div className={styles["legend-text"]}>
                          <span className={styles["legend-label"]}>Present</span>
                          <span className={styles["legend-count"]}>
                            {sessionAnalytics.present} students (
                            {sessionAnalytics.rate}%)
                          </span>
                        </div>
                      </div>

                      <div className={styles["legend-item"]}>
                        <div
                          className={`${styles["legend-dot"]} ${styles["dot-absent"]}`}
                        ></div>
                        <div className={styles["legend-text"]}>
                          <span className={styles["legend-label"]}>Absent</span>
                          <span className={styles["legend-count"]}>
                            {sessionAnalytics.absent} students (
                            {sessionAnalytics.total > 0
                              ? (100 - sessionAnalytics.rate).toFixed(0)
                              : 0}
                            %)
                          </span>
                        </div>
                      </div>

                      <div className={styles["legend-item"]}>
                        <div
                          className={`${styles["legend-dot"]} ${styles["dot-total"]}`}
                        ></div>
                        <div className={styles["legend-text"]}>
                          <span className={styles["legend-label"]}>
                            Total Students
                          </span>
                          <span className={styles["legend-count"]}>
                            {sessionAnalytics.total} enrolled
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Progress Breakdown Card */}
                <div className={styles["session-meta-card"]}>
                  <h3 className={styles["graph-title"]}>Session Overview</h3>
                  <div className={styles["meta-progress-wrapper"]}>
                    <div className={styles["meta-progress-labels"]}>
                      <span>Present ({sessionAnalytics.present})</span>
                      <span>Absent ({sessionAnalytics.absent})</span>
                    </div>
                    <div className={styles["stacked-progress-bar"]}>
                      <div
                        className={styles["progress-fill-present"]}
                        style={{ width: `${sessionAnalytics.rate}%` }}
                      ></div>
                      <div
                        className={styles["progress-fill-absent"]}
                        style={{ width: `${100 - sessionAnalytics.rate}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className={styles["session-info-list"]}>
                    <div className={styles["info-row"]}>
                      <span className={styles["info-label"]}>Created</span>
                      <span className={styles["info-val"]}>
                        {new Date(activeSession.date).toLocaleString()}
                      </span>
                    </div>
                    <div className={styles["info-row"]}>
                      <span className={styles["info-label"]}>Expires</span>
                      <span className={styles["info-val"]}>
                        {new Date(activeSession.expiresAt).toLocaleString()}
                      </span>
                    </div>
                    <div className={styles["info-row"]}>
                      <span className={styles["info-label"]}>Duration</span>
                      <span className={styles["info-val"]}>
                        {activeSession.duration} minutes
                      </span>
                    </div>
                    <div className={styles["info-row"]}>
                      <span className={styles["info-label"]}>Status</span>
                      <span className={styles["info-val"]}>
                        {new Date(activeSession.expiresAt) > new Date() ? (
                          <span className={styles["status-active-pill"]}>
                            Active / In Progress
                          </span>
                        ) : (
                          <span className={styles["status-closed-pill"]}>
                            Session Closed
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Attendance Records Section */}
              <div className={styles["records-section"]}>
                <div className={styles["records-header"]}>
                  <div className={styles["records-title-group"]}>
                    <h3>Attendance List</h3>
                    <span className={styles["records-count-badge"]}>
                      {filteredAttendance.length} records
                    </span>
                  </div>

                  <div className={styles["records-controls"]}>
                    {/* Filter Tabs */}
                    <div className={styles["filter-tab-group"]}>
                      <button
                        className={`${styles["filter-tab"]} ${
                          attendanceFilter === "all" ? styles["tab-active"] : ""
                        }`}
                        onClick={() => setAttendanceFilter("all")}
                      >
                        All ({sessionAnalytics.total})
                      </button>
                      <button
                        className={`${styles["filter-tab"]} ${
                          attendanceFilter === "present"
                            ? styles["tab-active"]
                            : ""
                        }`}
                        onClick={() => setAttendanceFilter("present")}
                      >
                        Present ({sessionAnalytics.present})
                      </button>
                      <button
                        className={`${styles["filter-tab"]} ${
                          attendanceFilter === "absent"
                            ? styles["tab-active"]
                            : ""
                        }`}
                        onClick={() => setAttendanceFilter("absent")}
                      >
                        Absent ({sessionAnalytics.absent})
                      </button>
                    </div>

                    {/* Search Box */}
                    <div className={styles["search-box"]}>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className={styles["search-icon"]}
                      >
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                      </svg>
                      <input
                        type="text"
                        placeholder="Search student or roll no..."
                        value={attendanceSearch}
                        onChange={(e) => setAttendanceSearch(e.target.value)}
                        className={styles["search-input"]}
                      />
                      {attendanceSearch && (
                        <button
                          className={styles["clear-search-btn"]}
                          onClick={() => setAttendanceSearch("")}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {filteredAttendance.length > 0 ? (
                  <>
                    {/* Desktop View Table */}
                    <div className={styles["desktop-table-container"]}>
                      <table className={styles["data-table"]}>
                        <thead>
                          <tr>
                            <th>Student</th>
                            <th>Roll Number</th>
                            <th>Branch</th>
                            <th>Status</th>
                            <th>Scanned At</th>
                            <th style={{ textAlign: "center" }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredAttendance.map((rec) => {
                            const student = rec.studentId || {};
                            const studentId = student._id || rec.studentId;
                            const branch =
                              student.branch ||
                              course.students?.find((s) => s._id === studentId)
                                ?.branch ||
                              "N/A";
                            const isPresent = rec.status === "Present";

                            return (
                              <tr key={studentId}>
                                <td>
                                  <div className={styles["student-cell"]}>
                                    <div className={styles["avatar-circle"]}>
                                      {(student.name || "S")
                                        .split(" ")
                                        .map((n) => n[0])
                                        .slice(0, 2)
                                        .join("")
                                        .toUpperCase()}
                                    </div>
                                    <div className={styles["student-text-group"]}>
                                      <span className={styles["student-name"]}>
                                        {student.name || "Student"}
                                      </span>
                                      <span className={styles["student-email"]}>
                                        {student.email || ""}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <span className={styles["roll-badge"]}>
                                    {student.rollNo || "N/A"}
                                  </span>
                                </td>
                                <td>
                                  <span className={styles["branch-badge"]}>
                                    {branch}
                                  </span>
                                </td>
                                <td>
                                  <span
                                    className={
                                      isPresent
                                        ? styles["status-present"]
                                        : styles["status-absent"]
                                    }
                                  >
                                    {rec.status}
                                  </span>
                                </td>
                                <td>
                                  <span className={styles["scan-time-text"]}>
                                    {rec.scannedAt
                                      ? new Date(rec.scannedAt).toLocaleTimeString(
                                          [],
                                          {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                            second: "2-digit",
                                          }
                                        )
                                      : "Not scanned"}
                                  </span>
                                </td>
                                <td>
                                  <div className={styles["inline-action-group"]}>
                                    <button
                                      className={
                                        isPresent
                                          ? styles["btn-mark-absent"]
                                          : styles["btn-mark-present"]
                                      }
                                      onClick={() =>
                                        handleQuickStatusToggle(
                                          studentId,
                                          rec.status
                                        )
                                      }
                                      title={`Mark as ${
                                        isPresent ? "Absent" : "Present"
                                      }`}
                                    >
                                      {isPresent ? "Mark Absent" : "Mark Present"}
                                    </button>

                                    <button
                                      className={styles["btn-reset-device"]}
                                      onClick={() =>
                                        handleResetDevice(studentId, student.name)
                                      }
                                      title="Reset registered phone for student"
                                    >
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="13"
                                        height="13"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                      >
                                        <rect
                                          x="5"
                                          y="2"
                                          width="14"
                                          height="20"
                                          rx="2"
                                          ry="2"
                                        ></rect>
                                        <line
                                          x1="12"
                                          y1="18"
                                          x2="12.01"
                                          y2="18"
                                        ></line>
                                      </svg>
                                      <span>Reset Phone</span>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Card View List */}
                    <div className={styles["mobile-cards-list"]}>
                      {filteredAttendance.map((rec) => {
                        const student = rec.studentId || {};
                        const studentId = student._id || rec.studentId;
                        const branch =
                          student.branch ||
                          course.students?.find((s) => s._id === studentId)
                            ?.branch ||
                          "N/A";
                        const isPresent = rec.status === "Present";

                        return (
                          <div
                            key={studentId}
                            className={styles["mobile-item-card"]}
                          >
                            <div className={styles["mobile-card-top"]}>
                              <div className={styles["avatar-circle"]}>
                                {(student.name || "S")
                                  .split(" ")
                                  .map((n) => n[0])
                                  .slice(0, 2)
                                  .join("")
                                  .toUpperCase()}
                              </div>
                              <div className={styles["student-text-group"]}>
                                <span className={styles["student-name"]}>
                                  {student.name || "Student"}
                                </span>
                                <span className={styles["student-email"]}>
                                  {student.email || ""}
                                </span>
                              </div>
                              <span
                                className={
                                  isPresent
                                    ? styles["status-present"]
                                    : styles["status-absent"]
                                }
                              >
                                {rec.status}
                              </span>
                            </div>

                            <div className={styles["mobile-card-meta-row"]}>
                              <span className={styles["roll-badge"]}>
                                {student.rollNo || "N/A"}
                              </span>
                              <span className={styles["branch-badge"]}>
                                {branch}
                              </span>
                              <span className={styles["scan-time-text"]}>
                                {rec.scannedAt
                                  ? new Date(rec.scannedAt).toLocaleTimeString(
                                      [],
                                      {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      }
                                    )
                                  : "Not scanned"}
                              </span>
                            </div>

                            <div className={styles["mobile-card-action-row"]}>
                              <button
                                className={
                                  isPresent
                                    ? styles["btn-mark-absent-mobile"]
                                    : styles["btn-mark-present-mobile"]
                                }
                                onClick={() =>
                                  handleQuickStatusToggle(studentId, rec.status)
                                }
                              >
                                {isPresent ? "Mark Absent" : "Mark Present"}
                              </button>

                              <button
                                className={styles["btn-reset-device-mobile"]}
                                onClick={() =>
                                  handleResetDevice(studentId, student.name)
                                }
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="13"
                                  height="13"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <rect
                                    x="5"
                                    y="2"
                                    width="14"
                                    height="20"
                                    rx="2"
                                    ry="2"
                                  ></rect>
                                  <line
                                    x1="12"
                                    y1="18"
                                    x2="12.01"
                                    y2="18"
                                  ></line>
                                </svg>
                                <span>Reset Phone</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className={styles["empty-state-mini"]}>
                    <p>No student records match this filter.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* VIEW 2: COURSE OVERVIEW (Enrolled Students & Attendance Sessions) */
            <>
              {/* Enrolled Students Section */}
              <div className={styles["section-card"]}>
                <div className={styles["card-header-row"]}>
                  <div className={styles["header-title-block"]}>
                    <h2 className={styles["section-title"]}>
                      Enrolled Students
                    </h2>
                    <span className={styles["counter-pill"]}>
                      {course.students?.length || 0} Total
                    </span>
                  </div>

                  <div className={styles["search-box"]}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className={styles["search-icon"]}
                    >
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <input
                      type="text"
                      placeholder="Search enrolled students..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className={styles["search-input"]}
                    />
                    {studentSearch && (
                      <button
                        className={styles["clear-search-btn"]}
                        onClick={() => setStudentSearch("")}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {filteredStudents.length > 0 ? (
                  <>
                    {/* Desktop View Table */}
                    <div className={styles["desktop-table-container"]}>
                      <table className={styles["data-table"]}>
                        <thead>
                          <tr>
                            <th>Student</th>
                            <th>Roll Number</th>
                            <th>Branch</th>
                            <th>Device Status</th>
                            <th style={{ textAlign: "center" }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredStudents.map((student) => {
                            const isBound = isStudentDeviceBound(student);
                            return (
                              <tr key={student._id}>
                                <td>
                                  <div className={styles["student-cell"]}>
                                    <div className={styles["avatar-circle"]}>
                                      {(student.name || "S")
                                        .split(" ")
                                        .map((n) => n[0])
                                        .slice(0, 2)
                                        .join("")
                                        .toUpperCase()}
                                    </div>
                                    <div className={styles["student-text-group"]}>
                                      <span className={styles["student-name"]}>
                                        {student.name}
                                      </span>
                                      <span className={styles["student-email"]}>
                                        {student.email}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <span className={styles["roll-badge"]}>
                                    {student.rollNo}
                                  </span>
                                </td>
                                <td>
                                  <span className={styles["branch-badge"]}>
                                    {student.branch || "General"}
                                  </span>
                                </td>
                                <td>
                                  {isBound ? (
                                    <span className={styles["device-bound-pill"]}>
                                      <span
                                        className={styles["device-dot-bound"]}
                                      ></span>
                                      Device Linked
                                    </span>
                                  ) : (
                                    <span className={styles["device-unbound-pill"]}>
                                      Not Linked
                                    </span>
                                  )}
                                </td>
                                <td>
                                  <div className={styles["inline-action-group"]}>
                                    <button
                                      className={styles["btn-reset-device"]}
                                      onClick={() =>
                                        handleResetDevice(
                                          student._id,
                                          student.name
                                        )
                                      }
                                      title="Reset registered phone for student"
                                    >
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="13"
                                        height="13"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                      >
                                        <rect
                                          x="5"
                                          y="2"
                                          width="14"
                                          height="20"
                                          rx="2"
                                          ry="2"
                                        ></rect>
                                        <line
                                          x1="12"
                                          y1="18"
                                          x2="12.01"
                                          y2="18"
                                        ></line>
                                      </svg>
                                      <span>Reset Device</span>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Card View List */}
                    <div className={styles["mobile-cards-list"]}>
                      {filteredStudents.map((student) => {
                        const isBound = isStudentDeviceBound(student);
                        return (
                          <div
                            key={student._id}
                            className={styles["mobile-item-card"]}
                          >
                            <div className={styles["mobile-card-top"]}>
                              <div className={styles["avatar-circle"]}>
                                {(student.name || "S")
                                  .split(" ")
                                  .map((n) => n[0])
                                  .slice(0, 2)
                                  .join("")
                                  .toUpperCase()}
                              </div>
                              <div className={styles["student-text-group"]}>
                                <span className={styles["student-name"]}>
                                  {student.name}
                                </span>
                                <span className={styles["student-email"]}>
                                  {student.email}
                                </span>
                              </div>
                            </div>

                            <div className={styles["mobile-card-meta-row"]}>
                              <span className={styles["roll-badge"]}>
                                {student.rollNo}
                              </span>
                              <span className={styles["branch-badge"]}>
                                {student.branch || "General"}
                              </span>
                              {isBound ? (
                                <span className={styles["device-bound-pill"]}>
                                  <span
                                    className={styles["device-dot-bound"]}
                                  ></span>
                                  Device Linked
                                </span>
                              ) : (
                                <span className={styles["device-unbound-pill"]}>
                                  Not Linked
                                </span>
                              )}
                            </div>

                            <div className={styles["mobile-card-action-row"]}>
                              <button
                                className={styles["btn-reset-device-mobile"]}
                                onClick={() =>
                                  handleResetDevice(
                                    student._id,
                                    student.name
                                  )
                                }
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <rect
                                    x="5"
                                    y="2"
                                    width="14"
                                    height="20"
                                    rx="2"
                                    ry="2"
                                  ></rect>
                                  <line
                                    x1="12"
                                    y1="18"
                                    x2="12.01"
                                    y2="18"
                                  ></line>
                                </svg>
                                <span>Reset Registered Phone</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className={styles["empty-state-mini"]}>
                    <p>
                      {studentSearch
                        ? "No students match your search."
                        : "No students enrolled in this course yet."}
                    </p>
                  </div>
                )}
              </div>

              {/* Attendance Sessions Section */}
              <div className={styles["section-card"]}>
                <div className={styles["card-header-row"]}>
                  <div className={styles["header-title-block"]}>
                    <h2 className={styles["section-title"]}>
                      Attendance Sessions
                    </h2>
                    <span className={styles["counter-pill"]}>
                      {course.sessions?.length || 0} Sessions
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      setSessionDetails({
                        courseId: course._id,
                        duration: "45",
                      });
                      setShowSessionModal(true);
                    }}
                    className={styles["start-session-header-btn"]}
                  >
                    + New Session
                  </button>
                </div>

                {course.sessions && course.sessions.length > 0 ? (
                  <>
                    {/* Desktop View Table */}
                    <div className={styles["desktop-table-container"]}>
                      <table className={styles["data-table"]}>
                        <thead>
                          <tr>
                            <th>Date & Time</th>
                            <th>Duration</th>
                            <th>Status</th>
                            <th>Attendance Summary</th>
                            <th style={{ textAlign: "center" }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {course.sessions.map((session) => {
                            const isLive =
                              new Date(session.expiresAt) > new Date();
                            const presentCount =
                              session.attendance?.filter(
                                (a) => a.status === "Present"
                              ).length || 0;
                            const totalCount =
                              session.attendance?.length ||
                              course.students?.length ||
                              0;
                            const rate =
                              totalCount > 0
                                ? Math.round((presentCount / totalCount) * 100)
                                : 0;

                            return (
                              <tr key={session._id}>
                                <td>
                                  <div className={styles["session-datetime-cell"]}>
                                    <span className={styles["session-date-text"]}>
                                      {new Date(session.date).toLocaleDateString(
                                        [],
                                        {
                                          weekday: "short",
                                          month: "short",
                                          day: "numeric",
                                          year: "numeric",
                                        }
                                      )}
                                    </span>
                                    <span className={styles["session-time-text"]}>
                                      {new Date(session.date).toLocaleTimeString(
                                        [],
                                        {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        }
                                      )}
                                    </span>
                                  </div>
                                </td>
                                <td>{session.duration} mins</td>
                                <td>
                                  <span
                                    className={
                                      isLive
                                        ? styles["live-badge"]
                                        : styles["completed-badge"]
                                    }
                                  >
                                    {isLive ? "Live" : "Completed"}
                                  </span>
                                </td>
                                <td>
                                  <div className={styles["summary-cell"]}>
                                    <span className={styles["summary-counts"]}>
                                      <strong>{presentCount}</strong> /{" "}
                                      {totalCount} Present ({rate}%)
                                    </span>
                                    <div className={styles["summary-bar"]}>
                                      <div
                                        className={styles["summary-bar-fill"]}
                                        style={{ width: `${rate}%` }}
                                      ></div>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <div className={styles["inline-action-group"]}>
                                    <button
                                      className={styles["action-btn-primary"]}
                                      onClick={() => handleOpenSession(session)}
                                      title="View attendance details & analytics"
                                    >
                                      View Analytics
                                    </button>

                                    {isLive && (
                                      <button
                                        className={styles["action-btn-emerald"]}
                                        onClick={() => {
                                          setSessionIdForQR(session._id);
                                          setShowQR(true);
                                        }}
                                        title="Display QR code on screen"
                                      >
                                        Show QR
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Card View List */}
                    <div className={styles["mobile-cards-list"]}>
                      {course.sessions.map((session) => {
                        const isLive =
                          new Date(session.expiresAt) > new Date();
                        const presentCount =
                          session.attendance?.filter(
                            (a) => a.status === "Present"
                          ).length || 0;
                        const totalCount =
                          session.attendance?.length ||
                          course.students?.length ||
                          0;
                        const rate =
                          totalCount > 0
                            ? Math.round((presentCount / totalCount) * 100)
                            : 0;

                        return (
                          <div
                            key={session._id}
                            className={styles["mobile-item-card"]}
                          >
                            <div className={styles["mobile-session-header"]}>
                              <div>
                                <div className={styles["session-date-text"]}>
                                  {new Date(session.date).toLocaleDateString(
                                    [],
                                    {
                                      weekday: "short",
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    }
                                  )}
                                </div>
                                <div className={styles["session-time-text"]}>
                                  {new Date(session.date).toLocaleTimeString(
                                    [],
                                    {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    }
                                  )}{" "}
                                  • {session.duration} mins
                                </div>
                              </div>
                              <span
                                className={
                                  isLive
                                    ? styles["live-badge"]
                                    : styles["completed-badge"]
                                }
                              >
                                {isLive ? "Live" : "Completed"}
                              </span>
                            </div>

                            <div className={styles["mobile-session-summary"]}>
                              <div className={styles["mobile-summary-text"]}>
                                <strong>{presentCount}</strong> of {totalCount}{" "}
                                Present ({rate}%)
                              </div>
                              <div className={styles["summary-bar-mobile"]}>
                                <div
                                  className={styles["summary-bar-fill"]}
                                  style={{ width: `${rate}%` }}
                                ></div>
                              </div>
                            </div>

                            <div className={styles["mobile-session-actions"]}>
                              <button
                                className={styles["action-btn-primary-mobile"]}
                                onClick={() => handleOpenSession(session)}
                              >
                                View Analytics & Attendance
                              </button>
                              {isLive && (
                                <button
                                  className={styles["action-btn-emerald-mobile"]}
                                  onClick={() => {
                                    setSessionIdForQR(session._id);
                                    setShowQR(true);
                                  }}
                                >
                                  Show QR
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className={styles["empty-state-mini"]}>
                    <p>No attendance sessions created yet.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      {/* Create New Session Modal */}
      {showSessionModal && (
        <div className={styles.modal}>
          <div className={styles["modal-content"]}>
            <h2>Start Attendance Session</h2>
            <p>
              Start an attendance session for{" "}
              <strong>{course.courseName}</strong>.
            </p>

            <div className={styles["form-field"]}>
              <label className={styles["field-label"]}>
                Duration (minutes)
              </label>
              <input
                type="number"
                min="1"
                max="360"
                className={styles["code-input"]}
                placeholder="e.g. 45"
                value={sessionDetails.duration}
                onChange={(e) =>
                  setSessionDetails((prev) => ({
                    ...prev,
                    duration: e.target.value,
                  }))
                }
              />
            </div>

            <div className={styles["modal-actions"]}>
              <button
                className={styles["cancel-btn"]}
                onClick={() => setShowSessionModal(false)}
              >
                Cancel
              </button>
              <button
                className={styles["join-btn"]}
                onClick={handleCreateSession}
                disabled={isCreatingSession}
              >
                {isCreatingSession ? "Starting..." : "Start & Open QR"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Projector Modal */}
      {showQR && sessionIdForQR && (
        <div className={styles["qr-fullscreen-modal"]}>
          <div className={styles["qr-modal-card"]}>
            <div className={styles["qr-modal-header"]}>
              <div>
                <h3>Attendance QR Code</h3>
                <p>{course.courseName} • Scan to mark attendance</p>
              </div>
              <button
                className={styles["close-qr-icon-btn"]}
                onClick={() => setShowQR(false)}
              >
                ✕
              </button>
            </div>

            <div className={styles["qr-display-wrapper"]}>
              <QRDisplay sessionId={sessionIdForQR} />
            </div>

            <div className={styles["qr-modal-footer"]}>
              <button
                className={styles["join-btn"]}
                onClick={() => setShowQR(false)}
              >
                Close QR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseDetails;
