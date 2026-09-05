import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "../styles/TeacherDashboard.module.css";
import { clientServer } from "../src/config";
import toast from "react-hot-toast";

const TeacherDashboard = () => {
  const [classes, setClasses] = useState([]);
  const [showClassModal, setShowClassModal] = useState(false);
  const [courseName, setCourseName] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [invitationCode, setInvitationCode] = useState("");
  const [teacherId, setTeacherId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userName, setUserName] = useState("");

  const [courseToDelete, setCourseToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
          setTeacherId(res.data.user._id);
          setUserName(res.data.user.name || userEmail.split("@")[0]);
          // Store name in localStorage for Nav component
          localStorage.setItem(
            "name",
            res.data.user.name || userEmail.split("@")[0]
          );
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
    const fetchClasses = async () => {
      if (!teacherId) return;
      try {
        setIsLoading(true);
        const res = await clientServer.get(
          `/courses/teacher/${teacherId}/classes`
        );
        setClasses(res.data);
      } catch (error) {
        console.error("Error fetching classes:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchClasses();
  }, [teacherId]);

  const handleCreateClass = async () => {
    if (!teacherId) return toast.error("Teacher ID not found");
    if (!courseName.trim() || !courseCode.trim() || !invitationCode.trim())
      return toast.error("All fields are required!");

    try {
      await clientServer.post("/courses/create-class", {
        teacherId,
        courseName,
        courseCode,
        invitationCode,
      });

      setCourseName("");
      setCourseCode("");
      setInvitationCode("");
      setShowClassModal(false);

      const updatedClasses = await clientServer.get(
        `/courses/teacher/${teacherId}/classes`
      );
      setClasses(updatedClasses.data);
      toast.success("Class created successfully!");
    } catch (error) {
      console.error("Error creating class:", error);
      toast.error(error.response?.data?.message || "Something went wrong!");
    }
  };

  const handleConfirmDeleteCourse = async () => {
    if (!courseToDelete) return;
    setIsDeleting(true);
    try {
      await clientServer.delete(`/courses/${courseToDelete._id}`, {
        data: { teacherId },
      });
      toast.success("Class deleted successfully!");
      setCourseToDelete(null);

      const updatedClasses = await clientServer.get(
        `/courses/teacher/${teacherId}/classes`
      );
      setClasses(updatedClasses.data);
    } catch (error) {
      console.error("Error deleting class:", error);
      toast.error(error.response?.data?.error || "Failed to delete class.");
    } finally {
      setIsDeleting(false);
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
          <rect x="3" y="3" width="7" height="7"></rect>
          <rect x="14" y="3" width="7" height="7"></rect>
          <rect x="14" y="14" width="7" height="7"></rect>
          <rect x="3" y="14" width="7" height="7"></rect>
        </svg>
      </div>
      <h3>No Classes Yet</h3>
      <p>Create your first class to get started</p>
      <button
        onClick={() => setShowClassModal(true)}
        className={styles["create-empty-btn"]}
      >
        Create Your First Class
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
            onClick={() => setShowClassModal(true)}
            className={styles["create-btn"]}
          >
            <span className={styles["btn-icon"]}>+</span>
            <span>Create Class</span>
          </button>
        </div>
      </aside>

      <main className={styles["dashboard-content"]}>
        <header className={styles["content-header"]}>
          <div className={styles["page-title"]}>
            <p className={styles["welcome-text"]}>Welcome back, {userName}!</p>
            <h1>Your Classes</h1>
          </div>
        </header>

        {isLoading ? (
          <div className={styles["loading-container"]}>
            <div className={styles["loading-spinner"]}></div>
            <p style={{ marginTop: "5px" }}>Loading your classes...</p>
          </div>
        ) : (
          <div className={styles["dashboard-body"]}>
            {classes.length > 0 ? (
              <div className={styles["class-grid"]}>
                {classes.map((classItem) => (
                  <div
                    key={classItem._id}
                    className={styles["class-card"]}
                    onClick={() => navigate(`/course/${classItem._id}`)}
                  >
                    <div className={styles["class-color-indicator"]}></div>
                    <div className={styles["class-content"]}>
                      <h3>{classItem.courseName}</h3>
                      <p className={styles["course-code"]}>
                        Code: {classItem.courseCode}
                      </p>
                      <div className={styles["class-details"]}>
                        <p className={styles["invitation-code"]}>
                          Invitation: {classItem.invitationCode}
                        </p>
                        <p className={styles["student-count"]}>
                          {classItem.students.length || 0} Students
                        </p>
                      </div>
                      <div className={styles["card-actions"]}>
                        <button className={styles["view-btn"]}>
                          View Details
                        </button>
                        <button
                          type="button"
                          className={styles["delete-card-btn"]}
                          onClick={(e) => {
                            e.stopPropagation();
                            setCourseToDelete(classItem);
                          }}
                          title="Delete class"
                          aria-label="Delete class"
                        >
                          <svg
                            width="15"
                            height="15"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                        </button>
                      </div>
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

      {/* Create Class Modal */}
      {showClassModal && (
        <div className={styles.modal}>
          <div className={styles["modal-content"]}>
            <h2>Create New Class</h2>
            <p>Fill in the details for your new class</p>
            <input
              type="text"
              placeholder="Enter Course Name"
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              className={styles["code-input"]}
            />
            <input
              type="text"
              placeholder="Enter Course Code"
              value={courseCode}
              onChange={(e) => setCourseCode(e.target.value)}
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
                onClick={() => setShowClassModal(false)}
                className={styles["cancel-btn"]}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateClass}
                className={styles["create-btn"]}
              >
                Create Class
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Class Confirmation Modal */}
      {courseToDelete && (
        <div
          className={styles.modal}
          onClick={() => !isDeleting && setCourseToDelete(null)}
        >
          <div
            className={styles["modal-content"]}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ color: "#f87171", margin: "0 0 12px 0" }}>
              Delete Class
            </h2>
            <p style={{ margin: "0 0 12px 0", color: "#eaeaea" }}>
              Are you sure you want to permanently delete{" "}
              <strong>{courseToDelete.courseName}</strong> (
              {courseToDelete.courseCode})?
            </p>
            <p
              style={{
                fontSize: "13px",
                color: "#f87171",
                background: "rgba(239, 68, 68, 0.1)",
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid rgba(239, 68, 68, 0.25)",
                margin: "0 0 20px 0",
                lineHeight: "1.4",
              }}
            >
              This will permanently delete all attendance sessions, QR logs,
              and remove this class from all{" "}
              {courseToDelete.students?.length || 0} enrolled student
              accounts. This action cannot be undone.
            </p>
            <div className={styles["modal-actions"]}>
              <button
                type="button"
                onClick={() => setCourseToDelete(null)}
                className={styles["cancel-btn"]}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCourse}
                className={styles["confirm-delete-btn"]}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Yes, Delete Class"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;
