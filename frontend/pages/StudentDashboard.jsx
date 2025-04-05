import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "../styles/StudentDashboard.module.css";
import { clientServer } from "../src/config";

const StudentDashboard = () => {
  const [courses, setCourses] = useState([]);
  const [invitationCode, setInvitationCode] = useState("");
  const [studentId, setStudentId] = useState(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userName, setUserName] = useState("");

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
        }
      } catch (error) {
        console.error("Error fetching user details:", error);
        alert("Failed to load user information. Please try logging in again.");
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
        const res = await clientServer.get(`/courses/student/${studentId}/classes`);
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
    if (!studentId) return alert("Student ID not found");
    if (!invitationCode.trim()) return alert("Invitation code is required");

    try {
      await clientServer.post("/courses/join-class", {
        studentId,
        invitationCode,
      });

      setInvitationCode("");
      setShowJoinModal(false);

      const updatedCourses = await clientServer.get(`/courses/student/${studentId}/classes`);
      setCourses(updatedCourses.data);
    } catch (error) {
      console.error("Error joining class:", error);
      alert(error.response?.data?.message || "Invalid invitation code or server error");
    }
  };

  const renderEmptyState = () => (
    <div className={styles["empty-state"]}>
      <div className={styles["empty-icon"]}>
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
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
        <div className={styles["logo-container"]}>
          <div className={styles.logo}>
            <img src="/logo.png" alt="ScanMe Logo" className={styles["logo-img"]} />
          </div>
          <h2>ScanMe</h2>
        </div>
        
        <div className={styles["sidebar-menu"]}>
          <a href="/dashboard" className={`${styles["menu-item"]} ${styles.active}`}>
            <span className={styles["menu-icon"]}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
            </span>
            <span>Dashboard</span>
          </a>
          
          <a href="/attendance" className={styles["menu-item"]}>
            <span className={styles["menu-icon"]}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4"></path>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
              </svg>
            </span>
            <span>Attendance</span>
          </a>
          
          <a href="/profile" className={styles["menu-item"]}>
            <span className={styles["menu-icon"]}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </span>
            <span>Profile</span>
          </a>
        </div>
        
        <div className={styles["sidebar-footer"]}>
          <button 
            onClick={() => setShowJoinModal(true)} 
            className={styles["join-btn"]}
          >
            <span className={styles["btn-icon"]}>+</span>
            <span>Join Class</span>
          </button>
        </div>
      </aside>
  
      <main className={styles["dashboard-content"]}>
        <header className={styles["content-header"]}>
          <div className={styles["page-title"]}>
            <h1>Your Classes</h1>
            <p className={styles["welcome-text"]}>Welcome back, {userName}!</p>
          </div>
          
          <div className={styles["header-actions"]}>
            <div className={styles["search-box"]}>
              <input 
                type="text" 
                placeholder="Search classes..." 
                className={styles["search-input"]}
              />
              <span className={styles["search-icon"]}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </span>
            </div>
            
            <button className={styles["scan-btn"]}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7V5a2 2 0 0 1 2-2h2"></path>
                <path d="M17 3h2a2 2 0 0 1 2 2v2"></path>
                <path d="M21 17v2a2 2 0 0 1-2 2h-2"></path>
                <path d="M7 21H5a2 2 0 0 1-2-2v-2"></path>
                <rect x="7" y="7" width="10" height="10" rx="2"></rect>
              </svg>
              Scan QR
            </button>
          </div>
        </header>
        
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
                    onClick={() => navigate(`/course/${course._id}`)}
                  >
                    <div className={styles["course-color-indicator"]}></div>
                    <div className={styles["course-content"]}>
                      <h3>{course.courseName}</h3>
                      <p className={styles["course-code"]}>Code: {course.courseCode}</p>
                      <div className={styles["course-details"]}>
                        <p className={styles["instructor-name"]}>
                          {course.instructor?.name || "Instructor"}
                        </p>
                        <p className={styles["attendance-stat"]}>
                          {course.attendanceRate || "--"}% Attendance
                        </p>
                      </div>
                      <button className={styles["view-btn"]}>
                        View Details
                      </button>
                    </div>
                  </div>
                ))}
                <div 
                  className={`${styles["course-card"]} ${styles["add-class-card"]}`}
                  onClick={() => setShowJoinModal(true)}
                >
                  <div className={styles["add-class-content"]}>
                    <div className={styles["add-icon"]}>+</div>
                    <p>Join New Class</p>
                  </div>
                </div>
              </div>
            ) : (
              renderEmptyState()
            )}
          </div>
        )}
      </main>
  
      {/* Join Class Modal */}
      {showJoinModal && (
        <div className={styles.modal}>
          <div className={styles["modal-content"]}>
            <h2>Join a Class</h2>
            <p>Enter the invitation code provided by your instructor</p>
            <input
              type="text"
              placeholder="Enter Invitation Code"
              value={invitationCode}
              onChange={(e) => setInvitationCode(e.target.value)}
              className={styles["code-input"]}
            />
            <div className={styles["modal-actions"]}>
              <button onClick={() => setShowJoinModal(false)} className={styles["cancel-btn"]}>
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