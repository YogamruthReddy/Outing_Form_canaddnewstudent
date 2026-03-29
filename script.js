// --- 1. Data Strategy: Smart Sync (File + Local) ---
const select = document.getElementById("studentSelect");
const STORAGE_KEY = 'localStudentsData';

// Initial Load Strategy:
// 1. Always load 'window.students' (from data.js) as base.
// 2. Check 'localStudentsData' in LocalStorage.
// 3. Merge strictly NEW additions from local (ID check) into base.

let allStudents = [];

// --- 1. Data Initialization (Smart Merge) ---
// Priority: data.js (window.students) -> localStorage additions
function loadStudents() {
  const fileData = window.students || [];
  let mergedData = [...fileData];

  const localRaw = localStorage.getItem('localStudentsData');
  if (localRaw) {
    try {
      const localData = JSON.parse(localRaw);
      // Find students present in Local but MISSING in File (User added custom students)
      const newAdditions = localData.filter(l => !fileData.some(f => f.id === l.id));

      if (newAdditions.length > 0) {
        // Append new additions
        mergedData = [...mergedData, ...newAdditions];
      }
    } catch (e) {
      console.error("Error merging local data", e);
    }
  }

  allStudents = mergedData;
  // Sync the merged result back to cache so next reload is consistent
  saveStudents();
}

function saveStudents() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(allStudents));
}

// Reset data to factory settings (re-read data.js)
// Reset data to factory settings (re-read data.js)
function resetDataFactory() {
  if (confirm("WARNING: This will wipe all custom changes and restore data.js defaults. Continue?")) {
    localStorage.removeItem('localStudentsData');
    localStorage.removeItem(ADMIN_SESSION_KEY);
    window.location.reload();
  }
}

// Initialize
loadStudents();


// --- 2. Populate Dropdown ---
function renderDropdown() {
  select.innerHTML = '<option value="" disabled selected>Select ID / Name</option>';
  allStudents.forEach((s, i) => {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = `${s.name} (${s.id})`;
    select.appendChild(opt);
  });

  // Ensure form is locked initially until a student & PIN are provided
  // However, avoid error if function not defined yet (hoisting handles it usually, but be safe)
  if (typeof toggleFormLock === 'function') {
    toggleFormLock(true);
  }
}
renderDropdown();


// --- 3. Modal & Form Logic (Public & Admin) ---

// --- OTP Helpers ---
function getStudentPin() {
  return [...document.querySelectorAll(".student-pin-box")]
    .map(b => b.value)
    .join("");
}

// --- Save Student (Perfect Mapping) ---
let lastAddedStudent = null; // Track most recent add for quick actions

function saveNewStudent() {
  const pin = getStudentPin();
  const error = document.getElementById("studentError");

  const newStudent = {
    name: document.getElementById("studentName").value.trim(),
    id: document.getElementById("studentId").value.trim(),
    gender: document.getElementById("studentGender").value,
    program: document.getElementById("studentProgram").value.trim(),
    batch: document.getElementById("studentBatch").value.trim(),
    father: document.getElementById("fatherName").value.trim(),

    parents: [
      {
        name: document.getElementById("fatherName").value.trim(),
        email: document.getElementById("fatherEmail").value.trim(),
        phone: document.getElementById("fatherPhone").value.trim()
      },
      {
        name: document.getElementById("motherName").value.trim(),
        email: document.getElementById("motherEmail").value.trim(),
        phone: document.getElementById("motherPhone").value.trim()
      },
      {
        name: document.getElementById("studentName").value.trim(),
        email: document.getElementById("studentEmail").value.trim(),
        phone: document.getElementById("studentPhone").value.trim()
      }
    ],

    signature: document.getElementById("studentSignature").value.trim(),
    pin,

    // 🔽 NEW FIELDS (ADD-ON)
    meta: {
      createdAt: new Date().toISOString(),
      createdBy: "Admin",
      source: "Admin Panel",
      status: "active"
    },

    notifications: {
      whatsapp: {
        sent: false,
        sentTo: null,
        sentAt: null
      }
    }
  };

  // basic validation
  if (!newStudent.name || !newStudent.id || !newStudent.program || !newStudent.batch || !pin || pin.length !== 5) {
    if (error) error.style.display = "block";
    return;
  }

  if (currentEditIndex !== null) {
    // UPDATE EXISTING - Preserve meta/notifications if they exist, or add if missing
    const existing = allStudents[currentEditIndex];
    newStudent.meta = existing.meta || newStudent.meta;
    newStudent.notifications = existing.notifications || newStudent.notifications;

    allStudents[currentEditIndex] = newStudent;
    alert(`Student Updated: ${newStudent.name}`);
    currentEditIndex = null; // Reset
  } else {
    // CREATE NEW
    allStudents.push(newStudent);
    lastAddedStudent = newStudent; // Track for quick actions

    // Show success modal first
    openSuccessModal();

    // AUTO-SEND: Open WhatsApp after 1 second
    // Note: Some browsers might block this popup since it's delayed.
    // The modal button serves as a backup.
    setTimeout(() => {
      sendStudentToWhatsApp(newStudent);
    }, 1000);
  }

  localStorage.setItem('localStudentsData', JSON.stringify(allStudents));

  closeAddStudent();
  renderDropdown();

  if (typeof renderAdminList === 'function' && document.getElementById('adminDashboardModal').classList.contains('active')) {
    renderAdminList();
  }

  // Auto-Select the new student for preview
  const select = document.getElementById('studentSelect');
  if (select) {
    // Find the index of the newly added/updated student
    const newIndex = allStudents.findIndex(s => s.id === newStudent.id);
    if (newIndex !== -1) {
      select.value = newIndex; // Select by Index
      if (typeof handleStudentChange === 'function') handleStudentChange(); // Trigger Preview
    }
  }
}

// --- Success Modal Logic ---
function openSuccessModal() {
  document.getElementById('successOverlay').classList.add('active');
}

function closeSuccessModal() {
  document.getElementById('successOverlay').classList.remove('active');
}

function triggerLastAddedWhatsApp() {
  if (lastAddedStudent) {
    sendStudentToWhatsApp(lastAddedStudent);
    closeSuccessModal();
  } else {
    alert("No recent student found.");
  }
}

function openAddStudentModal() {
  // Clear Inputs
  document.querySelectorAll('#addStudentOverlay input').forEach(i => i.value = '');
  document.querySelectorAll('.student-pin-box').forEach(i => i.value = '');
  document.getElementById('studentGender').value = '';
  document.getElementById('studentError').style.display = 'none';

  document.getElementById('addStudentOverlay').classList.add('active');
}

function closeAddStudent() {
  document.getElementById('addStudentOverlay').classList.remove('active');
}

// --- OTP Auto-Focus (Reuse Existing Logic) ---
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll(".student-pin-box").forEach((box, i, arr) => {
    box.addEventListener("input", () => {
      if (box.value && arr[i + 1]) arr[i + 1].focus();
    });

    box.addEventListener("keydown", e => {
      if (e.key === "Backspace" && !box.value && arr[i - 1]) {
        arr[i - 1].focus();
      }
    });
  });
});


// --- 4. Admin Auth & Dashboard Logic ---

// Admin Session Key
const ADMIN_SESSION_KEY = 'adminSessionActive';

// Enterprise Admin Credentials
const ADMIN_CREDENTIALS = {
  sessionId: "28476",
  mobile: "9848723235",
  answer: "sumit"
};

function openAdminAuth() {
  if (localStorage.getItem(ADMIN_SESSION_KEY) === 'true') {
    openAdminDashboard();
  } else {
    document.getElementById('adminAuthModal').classList.add('active');
    // Reset inputs
    document.querySelectorAll('.otp-box').forEach(i => i.value = '');
    document.getElementById('adminMobile').value = '';
    document.getElementById('adminAnswer').value = '';
    document.getElementById('adminError').style.display = 'none';
    if (document.querySelector('.otp-box')) document.querySelector('.otp-box').focus();
  }
}

function closeAdminAuth() {
  document.getElementById('adminAuthModal').classList.remove('active');
}

// OTP Auto-Focus Logic
document.querySelectorAll(".otp-box").forEach((box, i, arr) => {
  box.addEventListener("input", () => {
    if (box.value && arr[i + 1]) arr[i + 1].focus();
  });

  box.addEventListener("keydown", e => {
    if (e.key === "Backspace" && !box.value && arr[i - 1]) {
      arr[i - 1].focus();
    }
  });
});

function getEnteredSessionId() {
  return [...document.querySelectorAll(".otp-box")]
    .map(b => b.value)
    .join("");
}

function verifyAdminAccess() {
  const sessionId = getEnteredSessionId();
  const mobile = document.getElementById("adminMobile").value.trim();
  const answer = document.getElementById("adminAnswer").value.trim().toLowerCase();

  if (
    sessionId === ADMIN_CREDENTIALS.sessionId &&
    mobile === ADMIN_CREDENTIALS.mobile &&
    answer === ADMIN_CREDENTIALS.answer
  ) {
    localStorage.setItem(ADMIN_SESSION_KEY, 'true');
    closeAdminAuth();
    openAdminDashboard();
  } else {
    const error = document.getElementById("adminError");
    error.style.display = "block";

    // Simple shake effect
    const card = document.querySelector('.admin-card');
    card.style.transform = "translateX(5px)";
    setTimeout(() => { card.style.transform = "translateX(-5px)"; }, 50);
    setTimeout(() => { card.style.transform = "translateX(5px)"; }, 100);
    setTimeout(() => { card.style.transform = "translateX(0)"; }, 150);
  }
}

function adminLogout() {
  localStorage.removeItem(ADMIN_SESSION_KEY);
  closeAdminDashboard();
  alert("Logged out of Admin Mode");
}

function closeAdminDashboard() {
  document.getElementById('adminDashboardModal').classList.remove('active');
}

function openAdminDashboard() {
  document.getElementById('adminDashboardModal').classList.add('active');
  renderAdminList();
}

function renderAdminList() {
  const tbody = document.getElementById('studentListBody');
  const totalCount = document.getElementById('totalCount');

  tbody.innerHTML = '';
  // Safely update count if element exists
  if (totalCount) totalCount.textContent = allStudents.length;

  allStudents.forEach((s, i) => {
    const row = document.createElement('tr');
    row.innerHTML = `
            <td><span style="font-weight: 600; color: #000000;">${s.name}</span></td>
            <td><span class="badge gray">${s.id}</span></td>
            <td>${s.program}</td>
            <td><span class="badge gray" style="letter-spacing: 1px;">${s.pin || "----"}</span></td>
            <td class="text-right">
                <button onclick="triggerWhatsApp(${i})" class="icon-btn whatsapp" title="Send via WhatsApp" style="color: #25D366; margin-right: 8px;">
                   <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"
                       xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M20.52 3.48A11.89 11.89 0 0012 0C5.373 0 .01 5.373.01 12.001
                      0 14.24.6 16.3 1.71 18.03L0 24l6.21-1.62A11.94 11.94 0 0012 24
                      c6.627 0 12-5.373 12-12 0-3.2-1.24-6.2-3.48-8.52z"/>
                  </svg>
                </button>
                <button onclick="editStudent(${i})" class="icon-btn edit" title="Edit">
                   <i class="fa-solid fa-pen-to-square"></i>
                </button>
                <button onclick="deleteStudent(${i})" class="icon-btn delete" title="Delete">
                   <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
    tbody.appendChild(row);
  });
}

// --- Delete Student Logic ---
let studentToDeleteIndex = null;

function deleteStudent(index) {
  studentToDeleteIndex = index;
  const student = allStudents[index];

  if (student) {
    // Populate modal text
    const display = document.getElementById('deleteStudentNameDisplay');
    if (display) {
      display.innerHTML = `Are you sure you want to remove <b>${student.name}</b>?<br>This action cannot be undone.`;
    }
    document.getElementById('deleteConfirmationOverlay').classList.add('active');
  }
}

function closeDeleteModal() {
  studentToDeleteIndex = null;
  document.getElementById('deleteConfirmationOverlay').classList.remove('active');
}

function confirmDeleteStudent() {
  if (studentToDeleteIndex !== null) {
    allStudents.splice(studentToDeleteIndex, 1);

    // Persist
    localStorage.setItem('localStudentsData', JSON.stringify(allStudents));

    // Refresh UI
    renderAdminList();
    renderDropdown();

    closeDeleteModal();
  }
}

function exportDataJS() {
  // Generate the content exactly as data.js expects
  const content = `window.students = ${JSON.stringify(allStudents, null, 4)};`;

  const blob = new Blob([content], { type: "text/javascript" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "data.js";
  document.body.appendChild(a); // Required for Firefox sometimes
  a.click();

  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  alert("Downloaded 'data.js'. Replace the file in your project folder to make changes permanent.");
}

// --- Edit & Save Logic ---
let currentEditIndex = null; // Global tracker for edit mode

function editStudent(index) {
  currentEditIndex = index;
  const s = allStudents[index];

  // Populate IDs
  document.getElementById('studentName').value = s.name;
  document.getElementById('studentId').value = s.id;
  document.getElementById('studentGender').value = s.gender;
  document.getElementById('studentProgram').value = s.program;
  document.getElementById('studentBatch').value = s.batch || "2024-2028"; // Fallback

  // Parents - Father
  if (s.parents && s.parents[0]) {
    document.getElementById('fatherName').value = s.parents[0].name;
    document.getElementById('fatherEmail').value = s.parents[0].email;
    document.getElementById('fatherPhone').value = s.parents[0].phone;
  }

  // Parents - Mother
  if (s.parents && s.parents[1]) {
    document.getElementById('motherName').value = s.parents[1].name;
    document.getElementById('motherEmail').value = s.parents[1].email;
    document.getElementById('motherPhone').value = s.parents[1].phone;
  }

  // Parents - Student Contact
  if (s.parents && s.parents[2]) {
    document.getElementById('studentEmail').value = s.parents[2].email;
    document.getElementById('studentPhone').value = s.parents[2].phone;
  }

  document.getElementById('studentSignature').value = s.signature;

  // Populate PIN Boxes
  const pinStr = (s.pin || "").toString();
  const pinBoxes = document.querySelectorAll('.student-pin-box');
  pinBoxes.forEach((box, i) => {
    box.value = pinStr[i] || "";
  });

  // Change Title and Button for context
  document.querySelector('#addStudentOverlay h2').textContent = "Edit Student Record";
  document.querySelector('#addStudentOverlay .primary-btn').textContent = "Update Student";

  // Open Modal without clearing
  document.getElementById('addStudentOverlay').classList.add('active');
  document.getElementById('studentError').style.display = 'none';
}

function openAddStudentModal(isEdit = false) {
  if (!isEdit) {
    // RESET for New Student
    currentEditIndex = null;
    document.querySelectorAll('#addStudentOverlay input').forEach(i => i.value = '');
    document.querySelectorAll('.student-pin-box').forEach(i => i.value = '');
    document.getElementById('studentGender').value = '';

    document.querySelector('#addStudentOverlay h2').textContent = "Add New Student";
    document.querySelector('#addStudentOverlay .primary-btn').textContent = "Save Student Record";
  }

  document.getElementById('studentError').style.display = 'none';
  document.getElementById('addStudentOverlay').classList.add('active');
}



// --- 5. PIN Authentication Logic ---

const pinSection = document.getElementById('pin-auth-section');
const pinInputs = document.querySelectorAll('.pin-input');
const pinError = document.getElementById('pin-error');
const pinSuccess = document.getElementById('pin-success');
const formElementsToLock = [
  'outDate', 'inDate', 'outingType', 'previewBtn' // IDs of elements to lock
];

function handleStudentChange() {
  // 1. Reset everything
  pinSection.style.display = 'block';
  pinInputs.forEach(input => {
    input.value = '';
    input.classList.remove('success', 'error');
    input.disabled = false;
  });
  pinError.style.display = 'none';
  pinSuccess.style.display = 'none';

  // 2. Lock Form
  toggleFormLock(true);

  // 3. Focus first box
  pinInputs[0].focus();
}

function toggleFormLock(locked) {
  // Lock/Unlock Date Inputs and Selects
  document.getElementById('outDate').disabled = locked;
  document.getElementById('inDate').disabled = locked;
  document.getElementById('outingType').disabled = locked;

  // Lock/Unlock Preview Button
  // We target the button via its onclick handler or just by querying standard buttons in the box
  const previewBtn = document.querySelector('button[onclick="generatePreview()"]');
  if (previewBtn) {
    previewBtn.disabled = locked;
    previewBtn.style.opacity = locked ? '0.5' : '1';
    previewBtn.style.cursor = locked ? 'not-allowed' : 'pointer';
  }
}

// Initialize PIN Listeners
pinInputs.forEach((input, index) => {
  input.addEventListener('keydown', (e) => {
    // Backspace: move to prev
    if (e.key === 'Backspace' && !input.value && index > 0) {
      pinInputs[index - 1].focus();
    }
  });

  input.addEventListener('input', (e) => {
    const val = e.target.value;

    // 1. Only allow numbers
    if (!/^\d*$/.test(val)) {
      e.target.value = '';
      return;
    }

    // 2. Auto-advance
    if (val && index < pinInputs.length - 1) {
      pinInputs[index + 1].focus();
    }

    // 3. Check specific PIN logic when full
    checkPin();
  });
});

function getenteredPin() {
  return Array.from(pinInputs).map(i => i.value).join('');
}

function checkPin() {
  const entered = getenteredPin();
  if (entered.length < 5) return; // Wait for full PIN

  const selectedIndex = select.value;
  if (!selectedIndex) return;

  const student = allStudents[selectedIndex];

  // PIN Check logic - STRICT ENFORCEMENT
  if (!student.pin) {
    pinError.textContent = "Access Denied: No PIN assigned. Contact Admin.";
    pinError.style.display = 'block';
    return;
  }

  // Ensure strict string comparison
  const correctPin = String(student.pin).trim();

  if (entered === correctPin) {
    // SUCCESS
    pinInputs.forEach(i => {
      i.classList.add('success');
      i.classList.remove('error');
      i.disabled = true; // Lock the active inputs
    });
    pinSuccess.style.display = 'block';
    pinError.style.display = 'none';

    toggleFormLock(false); // UNLOCK FORM
  } else {
    // ERROR
    pinInputs.forEach(i => i.classList.add('error'));
    pinError.style.display = 'block';
    pinError.textContent = "Incorrect PIN"; // Clear feedback
    pinSuccess.style.display = 'none';

    // Shake animation? Optional.
    setTimeout(() => {
      pinInputs.forEach(i => {
        i.value = '';
        i.classList.remove('error');
      });
      pinInputs[0].focus();
    }, 1000);
  }
}


// --- 6. Main Application Logic ---

function generatePreview() {
  if (!select.value) {
    if (allStudents.length === 0) {
      alert("No data available. Please add a student.");
    } else {
      alert("Please select a student identity");
    }
    return;
  }

  const s = allStudents[select.value];

  const outDateVal = document.getElementById("outDate").value;
  const inDateVal = document.getElementById("inDate").value;
  const type = document.getElementById("outingType").value;

  if (!outDateVal || !inDateVal || !type) {
    alert("Please fill all fields");
    return;
  }

  // Date formatting helper
  const formatDate = (dateStr, separator) => {
    const d = new Date(dateStr);
    const day = d.getDate();
    const month = d.getMonth() + 1; // 0-indexed
    const year = d.getFullYear();
    return `${day}${separator}${month}${separator}${year}`;
  };

  const outDateFormatted = formatDate(outDateVal, ".");
  const inDateFormatted = formatDate(inDateVal, ".");

  // Bottom date is today
  const todayObj = new Date();
  const todayFormatted = `${todayObj.getDate()}-${todayObj.getMonth() + 1}-${todayObj.getFullYear()}`;

  const preview = document.getElementById("preview");
  preview.style.display = "block";

  // STRICT FORMATTING implementation
  preview.innerHTML = `
  <div class="page">
  <div style="font-family: 'Times New Roman', Times, serif; font-size: 14pt; line-height: 1.6; color: black; padding: 20px;">

    <!-- Header -->
    <h3 style="text-align:center; text-transform: uppercase; margin-bottom: 40px; text-decoration: underline;">UNDERTAKING BY PARENTS</h3>

    <!-- Paragraph 1 -->
    <p style="margin-bottom: 30px; text-align: justify;">
      I hereby confirm that my ward, <b>${s.gender === 'Female' ? 'Ms.' : 'Mr.'} ${s.name}</b>, registered under the student
      ID <b>${s.id}</b> of the <b>${s.program}</b> program, is registered for the academic year
      <b>${s.batch}</b>.
    </p>

    <!-- Consent Header -->
    <p style="font-weight: bold; margin-bottom: 20px;">Letter of Consent:</p>

    <!-- Paragraph 2 -->
    <p style="margin-bottom: 30px; text-align: justify;">
      As the father of <b>${s.name}</b> , a <b>B.Tech (${s.batch})</b> <b>${s.program}</b> student at <b>Woxsen University</b>, I respectfully request your permission to allow my ${s.gender === 'Female' ? 'daughter' : 'son'} to depart from the
      campus on <b>${outDateFormatted}</b>, for a <b>${type}</b>. My ${s.gender === 'Female' ? 'daughter' : 'son'} intends to return on <b>${inDateFormatted}</b>.
    </p>

    <!-- Note Paragraph -->
    <p style="margin-bottom: 30px; text-align: justify;">
      Outing & leave are permitted only during university leave declared for festivals, national
      holidays, and weekends.
    </p>

    <!-- Confirmation Header -->
    <p style="font-weight: bold; margin-bottom: 15px;">The Parents/Guardian confirms the following,</p>

    <!-- List -->
    <ol style="margin-bottom: 40px; padding-left: 25px;">
      <li style="margin-bottom: 5px;">I assure you that it is my responsibility for my ward during the outgoings and have been informed of the same by the university officials.</li>
      <li>I firmly insist my ward not to deviate from the campus policy and adhere to the rules and regulations meticulously.</li>
    </ol>

    <!-- Date and Signature Section -->
    <div style="margin-bottom: 10px; overflow: hidden; display: flex; align-items: flex-end; justify-content: space-between;">
      <div style="font-weight: bold; font-size: 16px;">Date: ${todayFormatted}</div>
      <div style="text-align: right;">
         <div style="font-weight: bold; margin-bottom: 5px;">ParentsSignature</div>
         <img src="${s.signature}" width="150" style="display: block; margin-left: auto;">
      </div>
    </div>

    <br>

    <div class="page-break"></div>
    <!-- Contact Table -->
    <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12pt;">
      <thead>
        <tr style="background-color: #d9d9d9;">
          <th style="border: 1px solid #bfbfbf; padding: 8px; text-align: center;">Name</th>
          <th style="border: 1px solid #bfbfbf; padding: 8px; text-align: center;">Email</th>
          <th style="border: 1px solid #bfbfbf; padding: 8px; text-align: center;">Mobile Number</th>
        </tr>
      </thead>
      <tbody>
        ${s.parents.map(p => `
        <tr>
          <td style="border: 1px solid #bfbfbf; padding: 8px; text-align: center; font-weight: bold;">${p.name}</td>
          <td style="border: 1px solid #bfbfbf; padding: 8px; text-align: center;">${p.email}</td>
          <td style="border: 1px solid #bfbfbf; padding: 8px; text-align: center; font-weight: bold;">${p.phone}</td>
        </tr>
        `).join("")}
      </tbody>
    </table>

  </div>
  </div>
  `;

  document.getElementById("downloadWrapper").style.display = "flex";
}

// --- WhatsApp Notification Logic ---
function sendStudentToWhatsApp(student) {
  if (!student) {
    alert("No student data available to send.");
    return;
  }

  const adminNumber = "919848723235"; // 91 + your number

  const message = `
New Student Record Added

Name: ${student.name}
Student ID: ${student.id}
Gender: ${student.gender}
Program: ${student.program}
Batch: ${student.batch}

Father:
${student.parents[0].name}
${student.parents[0].phone}
${student.parents[0].email}

Mother:
${student.parents[1].name}
${student.parents[1].phone}
${student.parents[1].email}

Student Contact:
${student.parents[2].email}
${student.parents[2].phone}

Signature:
${student.signature}

Authorization PIN: ${student.pin}
`;

  const url =
    "https://wa.me/" +
    adminNumber +
    "?text=" +
    encodeURIComponent(message);

  window.open(url, "_blank");

  // OPTIONAL: mark notification as sent
  if (!student.notifications) {
    student.notifications = { whatsapp: {} };
  }

  student.notifications.whatsapp = {
    sent: true,
    sentTo: "9848723235",
    sentAt: new Date().toISOString()
  };

  localStorage.setItem('localStudentsData', JSON.stringify(allStudents));

  // Refresh UI to show status if needed
  if (typeof renderAdminList === 'function' && document.getElementById('adminDashboardModal').classList.contains('active')) {
    renderAdminList();
  }
}

function triggerWhatsApp(index) {
  const student = allStudents[index];
  sendStudentToWhatsApp(student);
}

// --- PWA Service Worker Registration ---
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js")
    .then(() => console.log("Service Worker Registered"))
    .catch(err => console.error("Service Worker Failed", err));
}
