/* ==========================================================================
   phantom-bounty — Core Application Script
   Firebase Auth Guard, Role Authorization, Realtime Sync, UI Renderers
   ========================================================================== */

// 1. Firebase Configuration & Initialization
const firebaseConfig = {
  apiKey: "AIzaSyC1_m2aMJeAW93BkgQ0VUM9KdtzT2OZelM",
  authDomain: "phantomsec-ca297.firebaseapp.com",
  databaseURL: "https://phantomsec-ca297-default-rtdb.firebaseio.com",
  projectId: "phantomsec-ca297",
  storageBucket: "phantomsec-ca297.firebasestorage.app",
  messagingSenderId: "15497490169",
  appId: "1:15497490169:web:a8454e1ed0fda9de04fc28"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.database();

// Global Application State
let currentUser = null;
let myProfile = null;
let activeChatId = null;
let community = [];
let myChats = [];
let profiles = {};
let jobs = [];
let reports = [];

// DOM Selector & Helper Functions
const $ = (selector) => document.querySelector(selector);  const $$ = (selector) => document.querySelectorAll(selector);

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function avatar(user, extraClass = '') {
  const name = user?.displayName || user?.companyName || user?.email || 'U';
  const initial = name.charAt(0).toUpperCase();
  return `<div class="avatar-circle ${extraClass}">${esc(initial)}</div>`;
}

function toast(msg, isError = false) {
  let container = $('#toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:10px;';
    document.body.appendChild(container);
  }
  const t = document.createElement('div');
  t.style.cssText = `padding:12px 20px;border-radius:8px;background:${isError ? '#ff4d4f' : '#00e676'};color:${isError ? '#fff' : '#0a0a0c'};font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.3);font-size:14px;`;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

/* ==========================================================================
   2. Protected Pages & Dynamic Auth Guard
   ========================================================================== */

const PRIVATE_PAGES = [
  'messages',
  'community',
  'reports',
  'company-reports',
  'profile',
  'post-program',
  'post-service',
  'submit-report'
];

const currentPage = document.body.dataset.page;

if (PRIVATE_PAGES.includes(currentPage)) {
  document.body.style.display = 'none';
}

auth.onAuthStateChanged(async (user) => {
  const isPrivatePage = PRIVATE_PAGES.includes(currentPage);

  if (!user && isPrivatePage) {
    window.location.replace('login.html');
    return;
  }

  if (user) {
    currentUser = user;
    
    try {
      const profileRef = db.ref('profiles/' + user.uid);
      const snap = await profileRef.once('value');
      myProfile = snap.val();

      // Auto-heal missing profile entries ONLY if role is completely missing
      if (!myProfile) {
        const defaultRole = (currentPage === 'post-program' || currentPage === 'company-reports') ? 'company' : 'hunter';
        await profileRef.set({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email.split('@')[0],
          role: defaultRole,
          createdAt: Date.now()
        });
        const updatedSnap = await profileRef.once('value');
        myProfile = updatedSnap.val();
      } else if (!myProfile.role) {
        // If profile exists but role property is missing, default safely
        await profileRef.update({ role: 'hunter' });
        myProfile.role = 'hunter';
      }
    } catch (err) {
      console.error("Error loading profile:", err);
    }
    const userRole = (myProfile?.role || '').toLowerCase().trim();

    // Guard Company-only routes
    if (currentPage === 'company-reports' || currentPage === 'post-program') {
      if (userRole !== 'company') {
        alert('Access Denied: This page is strictly accessible by Company accounts only.');
        window.location.replace('index.html');
        return;
      }
    }

    // Guard Hunter-only routes (reports.html, submit-report.html, post-service.html)
    if (currentPage === 'reports' || currentPage === 'post-service' || currentPage === 'submit-report') {
      if (userRole !== 'hunter') {
        alert('Access Denied: This page is strictly accessible by Security Researchers (Hunters) only.');
        window.location.replace('index.html');
        return;
      }
    }

    document.body.style.display = 'block';
    renderNav();
    initRealtimeSync();
  } else {
    currentUser = null;
    myProfile = null;
    document.body.style.display = 'block';
    renderNav();
  }

  if (currentPage === 'jobs' && typeof renderJobs === 'function') renderJobs();
  if (currentPage === 'community' && typeof renderCommunity === 'function') renderCommunity();
  if (currentPage === 'messages' && typeof renderMessages === 'function') renderMessages();
  if (currentPage === 'profile' && typeof renderProfile === 'function') renderProfile();
  if (currentPage === 'company-reports' && typeof renderCompanyReports === 'function') renderCompanyReports();
  if (currentPage === 'reports' && typeof renderHunterReports === 'function') renderHunterReports();
});

/* ==========================================================================
   3. Logout & Program Actions
   ========================================================================== */

async function handleLogout(e) {
  if (e) e.preventDefault();
  try {
    await auth.signOut();
    currentUser = null;
    myProfile = null;
    sessionStorage.clear();
    toast('Logged out successfully');
    window.location.replace('login.html');
  } catch (error) {
    console.error("Logout Error:", error);
    toast("Logout failed: " + error.message, true);
  }
}
window.handleLogout = handleLogout;

async function deleteProgram(jobId) {
  if (!currentUser) return;
  if (!confirm("Are you sure you want to delete this bounty program?")) return;

  try {
    const snap = await db.ref('jobs/' + jobId).once('value');
    const job = snap.val();

    if (!job || job.ownerId !== currentUser.uid) {
      toast("Unauthorized to delete this program.", true);
      return;
    }

    await db.ref('jobs/' + jobId).remove();
    toast("Bounty program deleted successfully!");
  } catch (error) {
    toast("Failed to delete: " + error.message, true);
  }
}
window.deleteProgram = deleteProgram;

/* ==========================================================================
   4. Navigation Bar & Profile Renderers
   ========================================================================== */

function renderNav() {
  const navRight = $('#navRight');
  const sideProfile = $('#sideProfileInfo');
  const userRole = (myProfile?.role || '').toLowerCase().trim();

  if (currentUser) {
    const actionBtn = (userRole === 'company')
      ? '<a href="post-program.html" class="btn primary small">+ Post Program</a>'
      : '<a href="post-service.html" class="btn primary small">+ Hunter Service</a>';

    if (navRight) {
      navRight.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;">
          ${actionBtn}
          <a href="profile.html" style="display:flex;align-items:center;gap:8px;text-decoration:none;color:inherit;font-weight:600;">
            ${avatar(myProfile || currentUser)}
            <span>${esc(myProfile?.displayName || myProfile?.companyName || currentUser.email)}</span>
          </a>
          <button class="btn secondary small" type="button" onclick="handleLogout(event)">Log out</button>
        </div>
      `;
    }

    if (sideProfile) {
      sideProfile.innerHTML = `
        <div style="padding:14px;border-bottom:1px solid rgba(255,255,255,0.08);margin-bottom:12px">
          <div style="display:flex;align-items:center;gap:10px">
            ${avatar(myProfile || currentUser)}
            <div style="overflow:hidden">
              <div style="font-weight:700;white-space:nowrap;text-overflow:ellipsis;overflow:hidden">
                ${esc(myProfile?.displayName || myProfile?.companyName || currentUser.email)}
              </div>
              <div class="small muted" style="text-transform:capitalize">${esc(myProfile?.role || 'Company')} Account</div>
            </div>
          </div>
          <button class="btn secondary small" style="width:100%;margin-top:12px" type="button" onclick="handleLogout(event)">Log out</button>
        </div>
      `;
    }
  } else {
    if (navRight) {
      navRight.innerHTML = `
        <a class="btn" href="login.html">Log in</a>
        <a class="btn primary" href="signup.html">Sign up</a>
      `;
    }
  }
}

/* ==========================================================================
   5. Realtime Database Subscriptions
   ========================================================================== */

function initRealtimeSync() {
  db.ref('profiles').on('value', (snap) => {
    profiles = snap.val() || {};
    if (currentUser && profiles[currentUser.uid]) {
      myProfile = profiles[currentUser.uid];
    }
    renderNav();
    if (typeof renderProfile === 'function') renderProfile();
  });

  db.ref('jobs').on('value', (snap) => {
    const data = snap.val() || {};
    jobs = Object.values(data).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (typeof renderJobs === 'function') renderJobs();
  });

  db.ref('reports').on('value', (snap) => {
    const data = snap.val() || {};
    reports = Object.values(data).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (typeof renderCompanyReports === 'function') renderCompanyReports();
    if (typeof renderHunterReports === 'function') renderHunterReports();
  });

  db.ref('community').on('value', (snap) => {
    const data = snap.val() || {};
    community = Object.values(data).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (typeof renderCommunity === 'function') renderCommunity();
  });

  if (currentUser) {
    db.ref('chats').on('value', (snap) => {
      const data = snap.val() || {};
      myChats = Object.values(data).filter(c => c.participants && c.participants.includes(currentUser.uid));
      if (typeof renderMessages === 'function') renderMessages();
    });
  }
}

/* ==========================================================================
   6. Company Reports Inbox Renderer (COMPANY'S RECEIVED REPORTS ONLY)
   ========================================================================== */

function renderCompanyReports() {
  const container = $('#companyReportsContainer');
  if (!container || !currentUser) return;

  const statusFilter = $('#statusFilter')?.value || 'ALL';

  // Strict Filter: Only reports submitted to programs owned by this logged-in company
  let myCompanyReports = reports.filter(r => r.ownerId === currentUser.uid);

  if (statusFilter !== 'ALL') {
    myCompanyReports = myCompanyReports.filter(r => (r.status || 'Pending Review') === statusFilter);
  }

  if (!myCompanyReports.length) {
    container.innerHTML = `
      <div class="card" style="padding:40px; text-align:center; background:#121318; border:1px solid rgba(255,255,255,0.1); border-radius:12px;">
        <h3 style="margin-bottom:8px; color:#fff;">No Vulnerability Reports Found</h3>
        <p class="muted" style="color:#aaa;">You have not received any vulnerability reports matching this filter yet.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = myCompanyReports.map(r => {
    const severityColors = {
      'Critical': '#ff4d4f',
      'High': '#ff7a45',
      'Medium': '#ffc53d',
      'Low': '#73d13d'
    };
    const sevColor = severityColors[r.severity] || '#00e676';

    return `
      <article class="card" style="padding:24px; margin-bottom:20px; background:#121318; border:1px solid rgba(255,255,255,0.1); border-radius:12px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:14px; margin-bottom:16px;">
          <div>
            <span class="small muted" style="color:#00e676; font-weight:600;">Program: ${esc(r.programTitle || 'Bounty Program')}</span>
            <h2 style="font-size:20px; color:#fff; margin:4px 0 6px 0;">${esc(r.title)}</h2>
            <div class="small muted" style="color:#aaa;">
              Submitted by <strong>${esc(r.hunterName || 'Security Researcher')}</strong> on ${fmtDate(r.createdAt)}
            </div>
          </div>
          <div>
            <span style="padding:4px 12px; border-radius:20px; font-size:12px; font-weight:700; background:rgba(255,255,255,0.08); color:${sevColor}; border:1px solid ${sevColor};">
              ${esc(r.severity || 'Medium')}
            </span>
          </div>
        </div>

        <div style="margin-bottom:20px;">
          <h4 style="font-size:14px; color:#aaa; margin-bottom:6px;">Proof of Concept / Description:</h4>
          <p style="white-space:pre-wrap; color:#ddd; background:#1a1b23; padding:16px; border-radius:8px; border:1px solid rgba(255,255,255,0.05); font-family:inherit;">${esc(r.description)}</p>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); padding:12px 16px; border-radius:8px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <label style="font-size:13px; font-weight:600; color:#aaa;">Update Status:</label>
            <select onchange="updateReportStatus('${r.id}', this.value)" style="padding:6px 12px; background:#1a1b23; color:#fff; border:1px solid rgba(255,255,255,0.2); border-radius:6px; font-size:13px;">
              <option value="Pending Review" ${r.status === 'Pending Review' ? 'selected' : ''}>Pending Review</option>
              <option value="Accepted" ${r.status === 'Accepted' ? 'selected' : ''}>Accepted</option>
              <option value="Rewarded" ${r.status === 'Rewarded' ? 'selected' : ''}>Rewarded</option>
              <option value="Rejected" ${r.status === 'Rejected' ? 'selected' : ''}>Rejected</option>
            </select>
          </div>

          <div>
            <button class="btn primary small" style="padding:8px 16px; background:#00e676; color:#0a0a0c; font-weight:700; border:none; border-radius:6px; cursor:pointer;" onclick="startChat('${r.hunterId}', '${esc(r.title)}')">
              Message Researcher
            </button>
          </div>
        </div>
      </article>
    `;
  }).join('');
}
window.renderCompanyReports = renderCompanyReports;

async function updateReportStatus(reportId, newStatus) {
  try {
    await db.ref('reports/' + reportId).update({
      status: newStatus,
      updatedAt: Date.now()
    });
    toast(`Report status updated to "${newStatus}"`);
  } catch (err) {
    console.error("Error updating report status:", err);
    toast("Failed to update status: " + err.message, true);
  }
}
window.updateReportStatus = updateReportStatus;


/* ==========================================================================
   7. Hunter Reports Renderer (HUNTER'S OWN SUBMITTED REPORTS ONLY)
   ========================================================================== */

function renderHunterReports() {
  const container = $('#hunterReportsContainer');
  if (!container || !currentUser) return;

  // Strict Filter: Only show reports submitted by this logged-in hunter
  const mySubmissions = reports.filter(r => r.hunterId === currentUser.uid);

  if (!mySubmissions.length) {
    container.innerHTML = `
      <div class="card" style="padding:40px; text-align:center; background:#121318; border:1px solid rgba(255,255,255,0.1); border-radius:12px;">
        <h3 style="margin-bottom:8px; color:#fff;">No Reports Submitted Yet</h3>
        <p class="muted" style="color:#aaa;">You haven't submitted any vulnerability reports. Browse active bounty programs to get started.</p>
        <a href="index.html" class="btn primary" style="margin-top:15px; display:inline-block;">View Bounty Programs</a>
      </div>
    `;
    return;
  }

  container.innerHTML = mySubmissions.map(r => {
    const severityColors = {
      'Critical': '#ff4d4f',
      'High': '#ff7a45',
      'Medium': '#ffc53d',
      'Low': '#73d13d'
    };
    const sevColor = severityColors[r.severity] || '#00e676';

    return `
      <article class="card" style="padding:24px; margin-bottom:20px; background:#121318; border:1px solid rgba(255,255,255,0.1); border-radius:12px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:14px; margin-bottom:16px;">
          <div>
            <span class="small muted" style="color:#00e676; font-weight:600;">Program: ${esc(r.programTitle || 'Bounty Program')}</span>
            <h2 style="font-size:20px; color:#fff; margin:4px 0 6px 0;">${esc(r.title)}</h2>
            <div class="small muted" style="color:#aaa;">
              Submitted on ${fmtDate(r.createdAt)} · Status: <strong style="color:var(--cyan);">${esc(r.status || 'Pending Review')}</strong>
            </div>
          </div>
          <div>
            <span style="padding:4px 12px; border-radius:20px; font-size:12px; font-weight:700; background:rgba(255,255,255,0.08); color:${sevColor}; border:1px solid ${sevColor};">
              ${esc(r.severity || 'Medium')}
            </span>
          </div>
        </div>

        <div style="margin-bottom:15px;">
          <h4 style="font-size:14px; color:#aaa; margin-bottom:6px;">Description & PoC:</h4>
          <p style="white-space:pre-wrap; color:#ddd; background:#1a1b23; padding:14px; border-radius:8px; border:1px solid rgba(255,255,255,0.05); font-size:14px;">${esc(r.description)}</p>
        </div>

        <div style="display:flex; justify-content:flex-end; align-items:center; gap:10px;">
          <button class="btn secondary small" onclick="startChat('${r.ownerId}', '${esc(r.programTitle)} - Report Inquiry')">
            Message Program Owner
          </button>
        </div>
      </article>
    `;
  }).join('');
}
window.renderHunterReports = renderHunterReports;


/* ==========================================================================
   8. Form Submissions (Report Submission Handler with ownerId lookup)
   ========================================================================== */

document.addEventListener('submit', async (e) => {
  // Handle Chat Form Submissions
  if (e.target && e.target.id === 'chatForm') {
    e.preventDefault();
    if (!activeChatId || !currentUser) return;
    const input = $('#msgInput');
    const text = input.value.trim();
    if (!text) return;

    const msgRef = db.ref('chats/' + activeChatId + '/messages').push();
    await msgRef.set({
      id: msgRef.key,
      senderId: currentUser.uid,
      text: text,
      timestamp: Date.now()
    });

    await db.ref('chats/' + activeChatId).update({ updatedAt: Date.now() });
    input.value = '';
    return;
  }

  // Handle Vulnerability Report Submission Form
  if (e.target && e.target.id === 'submitReportForm') {
    e.preventDefault();

    if (!currentUser) {
      toast('Please log in first to submit a report.', true);
      window.location.href = 'login.html';
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const programId = urlParams.get('programId');

    if (!programId) {
      toast('Error: Missing bounty program reference.', true);
      return;
    }

    const title = $('#reportTitle')?.value.trim();
    const severity = $('#reportSeverity')?.value || 'Medium';
    const description = $('#reportDescription')?.value.trim();

    if (!title || !description) {
      toast('Please fill in all required fields.', true);
      return;
    }

    try {
      // Fetch target program to grab company ownerId
      const jobSnap = await db.ref('jobs/' + programId).once('value');
      const job = jobSnap.val();

      if (!job) {
        toast('Bounty program no longer exists.', true);
        return;
      }

      const reportRef = db.ref('reports').push();
      const reportId = reportRef.key;

      const reportData = {
        id: reportId,
        programId: programId,
        programTitle: job.title || 'Bounty Program',
        ownerId: job.ownerId, // 🔑 Essential: Links report to the correct company user!
        hunterId: currentUser.uid,
        hunterName: myProfile?.displayName || currentUser.email.split('@')[0],
        title: title,
        severity: severity,
        description: description,
        status: 'Pending Review',
        createdAt: Date.now()
      };

      await reportRef.set(reportData);

      const currentCount = job.applicantsCount || 0;
      await db.ref('jobs/' + programId).update({ applicantsCount: currentCount + 1 });

      toast('Vulnerability report submitted successfully!');
      setTimeout(() => {
        window.location.href = 'reports.html';
      }, 1500);

    } catch (err) {
      console.error("Submission error:", err);
      toast('Failed to submit report: ' + err.message, true);
    }
  }
});

/* ==========================================================================
   9. Remaining Views (Jobs, Community, Messages, Profile)
   ========================================================================== */

function renderJobs() {
  const container = $('#jobListContainer');
  if (!container) return;

  const userRole = (myProfile?.role || '').toLowerCase().trim();
  const searchVal = ($('#jobSearch')?.value || '').toLowerCase();
  const filtered = jobs.filter(j =>
    (j.title && j.title.toLowerCase().includes(searchVal)) ||
    (j.category && j.category.toLowerCase().includes(searchVal)) ||
    (j.description && j.description.toLowerCase().includes(searchVal))
  );

  container.innerHTML = filtered.length ? filtered.map(j => {
    const isOwner = currentUser && (j.ownerId === currentUser.uid);

    let actionButtons = '';
    if (isOwner) {
      actionButtons = `
        <div style="display:flex; gap:8px; align-items:center;">
          <button class="btn danger small" style="background:#ff4d4f; color:#fff;" onclick="deleteProgram('${j.id}')">Delete Program</button>
        </div>
      `;
    } else if (userRole === 'company') {
      actionButtons = `<span class="small muted">Company View</span>`;
    } else {
      actionButtons = `
        <div style="display:flex; gap:8px;">
          <a class="btn secondary small" href="submit-report.html?programId=${j.id}">Submit Report</a>
          <button class="btn primary small" onclick="startChat('${j.ownerId}', '${esc(j.title)}')">Contact</button>
        </div>
      `;
    }

    return `
      <article class="card job" id="job-card-${j.id}">
        <div class="jobtop">
          <div>
            <h3>${esc(j.title)}</h3>
            <div class="muted small">${esc(j.ownerName || 'Organization')} · Posted ${fmtDate(j.createdAt)}</div>
          </div>
          <div class="badge">${esc(j.budget || 'Bounty')}</div>
        </div>
        <p style="margin:12px 0;white-space:pre-wrap">${esc(j.description)}</p>
        <div class="tags">
          <span class="tag">${esc(j.category || 'Web')}</span>
          ${(j.skills || []).map(s => `<span class="tag">${esc(s)}</span>`).join('')}
        </div>
        <div style="margin-top:16px;display:flex;justify-content:space-between;align-items:center">
          <span class="small muted">${j.applicantsCount || 0} Reports submitted</span>
          ${actionButtons}
        </div>
      </article>
    `;
  }).join('') : `<div class="empty">No active bounty programs found.</div>`;
}

async function startChat(targetUid, title) {
  if (!currentUser) {
    toast('Please log in first', true);
    window.location.href = 'login.html';
    return;
  }
  if (targetUid === currentUser.uid) {
    toast('You cannot message yourself', true);
    return;
  }

  const existing = myChats.find(c => c.participants.includes(targetUid));
  if (existing) {
    window.location.href = `messages.html?chat=${existing.id}`;
    return;
  }

  const ref = db.ref('chats').push();
  const chatId = ref.key;
  await ref.set({
    id: chatId,
    participants: [currentUser.uid, targetUid],
    jobTitle: title || 'Inquiry',
    createdAt: Date.now(),
    updatedAt: Date.now()
  });

  window.location.href = `messages.html?chat=${chatId}`;
}
window.startChat = startChat;

function renderCommunity() {
  const container = $('#communityContainer');
  if (!container) return;

  container.innerHTML = community.length ? community.map(c => `
    <article class="card job" style="margin-bottom:14px">
      <div class="jobtop">
        <div style="display:flex;align-items:center;gap:10px">
          ${avatar({ displayName: c.authorName })}
          <div>
            <h3 style="font-size:16px;margin:0">${esc(c.authorName)}</h3>
            <div class="muted small">${esc((c.authorRole || '').toLowerCase() === 'company' ? 'Organization' : 'Security Researcher')} · ${fmtDate(c.createdAt)}</div>
          </div>
        </div>
      </div>
      <p style="margin-top:12px;white-space:pre-wrap">${esc(c.content)}</p>
    </article>
  `).join('') : `<div class="empty">No discussions yet.</div>`;
}

function renderMessages() {
  const chatList = $('#chatList');
  if (!chatList) return;

  chatList.innerHTML = myChats.length ? myChats.map(c => {
    const otherUid = c.participants.find(p => p !== currentUser.uid);
    const otherUser = profiles[otherUid] || { displayName: 'User' };
    return `
      <div class="chat-person ${activeChatId === c.id ? 'active' : ''}" onclick="selectChat('${c.id}')" style="padding:12px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.05);display:flex;gap:10px;align-items:center">
        ${avatar(otherUser)}
        <div>
          <strong style="display:block">${esc(otherUser.displayName || otherUser.companyName || 'User')}</strong>
          <div class="small muted">${esc(c.jobTitle || 'Discussion')}</div>
        </div>
      </div>
    `;
  }).join('') : `<div class="empty small" style="padding:16px">No active conversations</div>`;

  const urlParams = new URLSearchParams(window.location.search);
  const paramChat = urlParams.get('chat');
  if (paramChat && activeChatId !== paramChat) selectChat(paramChat);
}

function selectChat(chatId) {
  activeChatId = chatId;
  const chat = myChats.find(c => c.id === chatId);
  const chatForm = $('#chatForm');
  if (chatForm) chatForm.classList.remove('hidden');

  if (chat) {
    const otherUid = chat.participants.find(p => p !== currentUser.uid);
    const otherUser = profiles[otherUid] || { displayName: 'User' };
    const chatHeader = $('#chatHeader');
    if (chatHeader) chatHeader.innerHTML = `Chatting with <strong>${esc(otherUser.displayName || otherUser.companyName || 'User')}</strong> (${esc(chat.jobTitle)})`;
  }

  db.ref('chats/' + chatId + '/messages').on('value', (snap) => {
    const msgs = Object.values(snap.val() || {});
    const messageList = $('#messageList');
    if (!messageList) return;

    messageList.innerHTML = msgs.length ? msgs.map(m => `
      <div class="bubble ${m.senderId === currentUser.uid ? 'mine' : ''}" style="margin:8px 0;padding:10px 14px;border-radius:10px;max-width:75%;${m.senderId === currentUser.uid ? 'margin-left:auto;background:#00e676;color:#0a0a0c;' : 'background:rgba(255,255,255,0.08);color:#fff;'}">
        <div>${esc(m.text)}</div>
        <div class="small muted" style="font-size:10px;margin-top:4px;opacity:0.8;text-align:right">${new Date(m.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
      </div>
    `).join('') : `<div class="empty">No messages yet. Send a message to begin.</div>`;

    messageList.scrollTop = messageList.scrollHeight;
  });
}
window.selectChat = selectChat;

function renderProfile() {
  const container = $('#profileCard');
  if (!container || !currentUser) return;

  container.innerHTML = `
    <div style="display:flex;gap:18px;align-items:center;margin-bottom:20px">
      ${avatar(myProfile || currentUser, 'large')}
      <div>
        <h2 style="margin:0">${esc(myProfile?.displayName || myProfile?.companyName || currentUser.email)}</h2>
        <span class="muted" style="text-transform:capitalize">${esc(myProfile?.role || 'Company')} Account</span>
      </div>
    </div>
    <p style="margin-bottom:20px">${esc(myProfile?.bio || 'No bio provided.')}</p>
    <div style="display:flex;gap:12px;margin-top:20px">
      <button class="btn secondary" type="button" onclick="handleLogout(event)">Log Out</button>
    </div>
  `;
}
