import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const generateAttendancePDF = (course, session, onlyAbsent = false) => {
  if (!session || !session.attendance) return;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const sessionDate = new Date(session.date).toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const sessionTime = new Date(session.date).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const total = session.attendance.length;
  const present = session.attendance.filter((a) => a.status === "Present").length;
  const absent = total - present;
  const rate = total > 0 ? ((present / total) * 100).toFixed(1) : "0";

  // Document Title & Header
  const title = onlyAbsent
    ? `Absentee Report - ${course.courseName}`
    : `Attendance Summary - ${course.courseName}`;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(title, 14, 20);

  // Subtitle / Course Metadata
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text(
    `Course: ${course.courseName} (${course.courseCode || "N/A"}) | Instructor: ${course.teacherId?.name || "Faculty"}`,
    14,
    27
  );
  doc.text(
    `Session Date: ${sessionDate} at ${sessionTime} | Duration: ${session.duration} mins`,
    14,
    33
  );

  // Stats Summary Box
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `Total Enrolled: ${total}   |   Present: ${present}   |   Absent: ${absent}   |   Attendance Rate: ${rate}%`,
    14,
    40
  );

  // Filter list
  const list = onlyAbsent
    ? session.attendance.filter((a) => a.status === "Absent")
    : session.attendance;

  const tableData = list.map((record, index) => {
    const student = record.studentId || {};
    const scanTime = record.scannedAt
      ? new Date(record.scannedAt).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      : "Not Recorded";

    return [
      index + 1,
      student.rollNo || "N/A",
      student.name || "Unknown Student",
      student.branch || "N/A",
      record.status,
      scanTime,
    ];
  });

  autoTable(doc, {
    startY: 46,
    head: [["#", "Roll Number", "Student Name", "Branch", "Status", "Scanned At"]],
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: onlyAbsent ? [225, 29, 72] : [37, 99, 235], // Rose red for absent, Royal blue for all
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    styles: {
      fontSize: 9,
      cellPadding: 3,
      textColor: [30, 41, 59],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 4) {
        if (data.cell.raw === "Present") {
          data.cell.styles.textColor = [5, 150, 105]; // emerald-600
          data.cell.styles.fontStyle = "bold";
        } else if (data.cell.raw === "Absent") {
          data.cell.styles.textColor = [225, 29, 72]; // rose-600
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  const safeCourseName = (course.courseName || "Course").replace(/[^a-zA-Z0-9_-]/g, "_");
  const dateTag = new Date(session.date).toISOString().slice(0, 10);
  const filename = onlyAbsent
    ? `Absentees_${safeCourseName}_${dateTag}.pdf`
    : `Attendance_${safeCourseName}_${dateTag}.pdf`;

  doc.save(filename);
};

export const exportAttendanceCSV = (course, session) => {
  if (!session || !session.attendance) return;

  const headers = ["Index", "Roll Number", "Student Name", "Branch", "Status", "Scanned At"];
  const rows = session.attendance.map((record, idx) => {
    const student = record.studentId || {};
    const scanTime = record.scannedAt
      ? new Date(record.scannedAt).toLocaleString()
      : "Not Recorded";

    return [
      idx + 1,
      `"${student.rollNo || ""}"`,
      `"${student.name || ""}"`,
      `"${student.branch || ""}"`,
      `"${record.status}"`,
      `"${scanTime}"`,
    ];
  });

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);

  const safeCourseName = (course.courseName || "Course").replace(/[^a-zA-Z0-9_-]/g, "_");
  const dateTag = new Date(session.date).toISOString().slice(0, 10);
  link.setAttribute("download", `Attendance_${safeCourseName}_${dateTag}.csv`);

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
