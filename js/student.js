// Student_supevision_system/js/student.js

// --- Student Dashboard State & Initialization ---
let studentSupabaseClient = null; // Will be set by initializeStudentDashboard
let studentCurrentUser = null;    // Will be set by initializeStudentDashboard
let studentOrgData = null;        // Will be set by initializeStudentDashboard
let studentProfileData = null;
let studentProjectData = null;
let studentSupervisorData = null;
let studentMeetingsData = [];
let studentSubmissionsData = [];
let studentNotificationsData = [];
let isStudentDashboardInitialized = false; // Keep this to prevent re-initialization if called multiple times

// --- DOM Element Cache ---
const StudentDOM = { // Ensure these IDs match your student.html
  pageTitle: null,
  userNameDisplay: null,
  userAvatar: null,
  projectTitleSummary: null,
  projectStageSummary: null,
  projectDeadlineSummary: null,
  projectProgressBar: null,
  projectProgressText: null,
  supervisorInfoContent: null,
  upcomingMeetingContent: null,
  projectDetailsContent: null,
  meetingsListContent: null,
  requestMeetingBtn: null,
  submissionsListContent: null,
  newSubmissionBtn: null,
  notificationsListContent: null,
  notificationCountBadge: null,
  markAllNotificationsReadBtn: null,
  studentProfileContent: null,
  formModal: null,
  modalTitle: null,
  modalForm: null,
  modalFormContent: null,
  closeModalBtn: null,
  modalCancelBtn: null,
  modalSubmitBtn: null,
  loadingOverlay: null, // This should be the global loading overlay controlled by app.js/script.js
};

/**
 * Safely caches DOM elements for the student dashboard.
 * This should be called once during initialization.
 */
function cacheStudentDOMElements() {
    StudentDOM.pageTitle = document.getElementById('page-title');
    StudentDOM.userNameDisplay = document.getElementById('user-name-display'); // Matches student.html
    StudentDOM.userAvatar = document.getElementById('user-avatar'); // Matches student.html

    StudentDOM.projectTitleSummary = document.getElementById('project-title-summary');
    StudentDOM.projectStageSummary = document.getElementById('project-stage-summary');
    StudentDOM.projectDeadlineSummary = document.getElementById('project-deadline-summary');
    StudentDOM.projectProgressBar = document.getElementById('project-progress-bar');
    StudentDOM.projectProgressText = document.getElementById('project-progress-text');
    StudentDOM.supervisorInfoContent = document.getElementById('supervisor-info-content');
    StudentDOM.upcomingMeetingContent = document.getElementById('upcoming-meeting-content');

    StudentDOM.projectDetailsContent = document.getElementById('project-details-content');

    StudentDOM.meetingsListContent = document.getElementById('meetings-list-content');
    StudentDOM.requestMeetingBtn = document.getElementById('requestMeetingBtn');

    StudentDOM.submissionsListContent = document.getElementById('submissions-list-content');
    StudentDOM.newSubmissionBtn = document.getElementById('newSubmissionBtn');

    StudentDOM.notificationsListContent = document.getElementById('notifications-list-content');
    StudentDOM.notificationCountBadge = document.getElementById('notification-count-badge');
    StudentDOM.markAllNotificationsReadBtn = document.getElementById('markAllNotificationsReadBtn');

    StudentDOM.studentProfileContent = document.getElementById('student-profile-content');

    StudentDOM.formModal = document.getElementById('formModal');
    StudentDOM.modalTitle = document.getElementById('modalTitle');
    StudentDOM.modalForm = document.getElementById('modalForm');
    StudentDOM.modalFormContent = document.getElementById('modalFormContent');
    StudentDOM.closeModalBtn = document.getElementById('closeModalBtn'); // General modal close
    StudentDOM.modalCancelBtn = document.getElementById('modalCancelBtn');
    StudentDOM.modalSubmitBtn = document.getElementById('modalSubmitBtn');

    // Use the global loading overlay defined in index.html / controlled by app.js or script.js
    StudentDOM.loadingOverlay = document.getElementById('loadingOverlay');

    // Verify required elements (optional, for debugging)
    for (const key in StudentDOM) {
        if (StudentDOM[key] === null && key !== 'loadingOverlay') { // loadingOverlay might be shared
            // console.warn(`StudentDOM: Element for '${key}' not found.`);
        }
    }
}


/**
 * Main initialization function for the Student Dashboard.
 * Expected to be called by app.js AFTER auth is initialized.
 * @param {Object} user - The authenticated user object from auth.js.
 * @param {Object} orgData - The user's organization and role data from auth.js.
 */
async function initializeStudentDashboard(user, orgData) {
  if (isStudentDashboardInitialized) {
    console.log('Student.js: Dashboard already initialized.');
    return;
  }
  console.log('Student.js: Initializing Student Dashboard with user:', user ? user.email : 'No User', 'and orgData:', orgData);
  // showGlobalLoading should be used if available from script.js or app.js
  if (typeof window.showGlobalLoading === 'function') window.showGlobalLoading('Initializing student dashboard...');


  try {
    if (!user) {
      throw new Error("User data is required for student dashboard initialization.");
    }
    if (!orgData) {
      throw new Error("Organization data is required for student dashboard initialization.")
    }

    studentCurrentUser = user;
    studentOrgData = orgData;

    // Get Supabase client using the global getter
    studentSupabaseClient = await window.getSupabaseClient();
    if (!studentSupabaseClient) {
      throw new Error('Failed to get Supabase client for Student Dashboard.');
    }
    console.log('Student.js: Supabase client obtained.');

    cacheStudentDOMElements(); // Cache DOM elements

    // Fetch student-specific data
    // Ensure studentProfileData is loaded before other dependent data fetches
    await fetchStudentProfileData();
    if (!studentProfileData) {
      // This is critical. If student's own profile from 'students' table can't be fetched,
      // they might not be set up correctly in the database or not be a student.
      throw new Error('Could not load your student profile. Please contact support if this issue persists.');
    }

    // Now fetch other data that might depend on studentProfileData
    await Promise.all([
        fetchStudentProjectData(), // Depends on studentProfileData.project_id
        fetchStudentSupervisorData(), // Depends on studentProfileData.supervisor_id
        fetchStudentMeetingsData(),   // Depends on studentProfileData.id
        fetchStudentSubmissionsData(),// Depends on studentProfileData.id
        fetchStudentNotifications()   // Depends on studentCurrentUser.id
    ]);

    // Populate UI
    populateStudentHeader();
    populateDashboardSummary();
    populateMyProjectSection();
    populateMeetingsSection();
    populateSubmissionsSection();
    populateNotificationsSection();
    populateProfileSection();

    setupStudentEventListeners();
    setupRealtimeStudentSubscriptions();

    isStudentDashboardInitialized = true;
    console.log('Student.js: Student Dashboard initialized successfully.');

  } catch (error) {
    console.error('Student.js: Error initializing student dashboard:', error);
    if (typeof window.showGlobalError === 'function') {
        window.showGlobalError('Dashboard Initialization Failed', error.message);
    } else {
        alert(`Dashboard Initialization Failed: ${error.message}`);
    }
    // Potentially redirect to a safe page or show a persistent error message
    // window.location.href = PathConfig.LOGIN; // Or an error page
  } finally {
    if (typeof window.hideGlobalLoading === 'function') window.hideGlobalLoading();
  }
}
window.initializeStudentDashboard = initializeStudentDashboard; // Expose for app.js

// --- Data Fetching Functions ---
async function fetchStudentProfileData() {
  if (!studentCurrentUser || !studentSupabaseClient) {
      console.error('Student.js: Cannot fetch profile - user or Supabase client missing.');
      return;
  }
  console.log('Student.js: Fetching student profile data...');
  try {
    const { data, error } = await studentSupabaseClient
      .from('students')
      .select(`
          id, user_id, project_id, supervisor_id, student_system_id, 
          first_name, last_name, avatar_url, phone_number, 
          year_of_study, enrollment_date, expected_completion_date,
          program:program_id (id, name), 
          department:department_id (id, name)
      `)
      .eq('user_id', studentCurrentUser.id)
      .single();

    if (error) {
        if (error.code === 'PGRST116') { // Single row not found
            console.warn('Student.js: No detailed student profile found for this user in the "students" table.');
            studentProfileData = null;
            return; // Not necessarily an error that stops the app, but critical for this dashboard.
        }
        throw error; // Other errors are more severe
    }
    studentProfileData = data;
    console.log('Student.js: Student profile data fetched:', studentProfileData);
  } catch (error) {
    console.error('Student.js: Error fetching student profile data:', error);
    studentProfileData = null; // Ensure it's null on error
    // This error might be critical enough to throw again or handle by showing a UI error.
  }
}

async function fetchStudentProjectData() {
  if (!studentProfileData || !studentProfileData.project_id || !studentSupabaseClient) {
    console.log('Student.js: No project_id found for student or client not ready. Skipping project data fetch.');
    studentProjectData = null;
    return;
  }
  console.log('Student.js: Fetching student project data for project_id:', studentProfileData.project_id);
  try {
    const { data, error } = await studentSupabaseClient
      .from('projects')
      .select('*')
      .eq('id', studentProfileData.project_id)
      .single();
    if (error) throw error;
    studentProjectData = data;
    console.log('Student.js: Student project data:', studentProjectData);
  } catch (error) {
    console.error('Student.js: Error fetching student project data:', error);
    studentProjectData = null;
  }
}

async function fetchStudentSupervisorData() {
  if (!studentProfileData || !studentProfileData.supervisor_id || !studentSupabaseClient) {
    console.log('Student.js: No supervisor_id found for student or client not ready. Skipping supervisor data fetch.');
    studentSupervisorData = null;
    return;
  }
  console.log('Student.js: Fetching supervisor data for supervisor_id:', studentProfileData.supervisor_id);
  try {
    // This assumes 'supervisor_id' on 'students' table is the primary key of the 'supervisors' table.
    // And 'supervisors' table has a 'user_id' linking to 'auth.users' (or a 'profiles' table).
    const { data: supervisorDetails, error: supervisorError } = await studentSupabaseClient
        .from('supervisors')
        .select(`
            id,
            office_location,
            phone_number,
            title,
            department:department_id (name),
            user:user_id (id, email, raw_user_meta_data) 
        `)
        .eq('id', studentProfileData.supervisor_id) // supervisor_id from students table is FK to supervisors.id
        .single();

    if (supervisorError) throw supervisorError;

    if (supervisorDetails && supervisorDetails.user) {
        studentSupervisorData = {
            id: supervisorDetails.id, // supervisor record ID
            userId: supervisorDetails.user.id, // auth user ID
            email: supervisorDetails.user.email,
            fullName: supervisorDetails.user.raw_user_meta_data?.full_name || `${supervisorDetails.user.raw_user_meta_data?.first_name || ''} ${supervisorDetails.user.raw_user_meta_data?.last_name || ''}`.trim(),
            avatarUrl: supervisorDetails.user.raw_user_meta_data?.avatar_url,
            officeLocation: supervisorDetails.office_location,
            phoneNumber: supervisorDetails.phone_number,
            title: supervisorDetails.title,
            departmentName: supervisorDetails.department?.name
        };
    } else {
        studentSupervisorData = null;
    }
    console.log('Student.js: Student supervisor data:', studentSupervisorData);

  } catch (error) {
    console.error('Student.js: Error fetching student supervisor data:', error);
    studentSupervisorData = null;
  }
}


async function fetchStudentMeetingsData() {
  if (!studentProfileData || !studentProfileData.id || !studentSupabaseClient) { // Ensure studentProfileData.id exists
    console.warn('Student.js: Cannot fetch meetings without student profile ID.');
    studentMeetingsData = [];
    return;
  }
  console.log('Student.js: Fetching student meetings data for student.id:', studentProfileData.id);
  try {
    const { data, error } = await studentSupabaseClient
      .from('meetings')
      .select(`
        *, 
        supervisor:supervisor_id (user_id, users:user_id(raw_user_meta_data->>full_name as full_name))
      `)
      .eq('student_id', studentProfileData.id) // student_id is the FK in meetings table pointing to students.id
      .order('meeting_date', { ascending: false });
    if (error) throw error;
    studentMeetingsData = data || [];
    console.log('Student.js: Student meetings data:', studentMeetingsData);
  } catch (error) {
    console.error('Student.js: Error fetching student meetings data:', error);
    studentMeetingsData = [];
  }
}

async function fetchStudentSubmissionsData() {
  if (!studentProfileData || !studentProfileData.id || !studentSupabaseClient) {
    console.warn('Student.js: Cannot fetch submissions without student profile ID.');
    studentSubmissionsData = [];
    return;
  }
  console.log('Student.js: Fetching student submissions data for student.id:', studentProfileData.id);
  try {
    const { data, error } = await studentSupabaseClient
      .from('submissions') // Assuming 'submissions' table
      .select('*, projects(title)') // Assuming submissions links to projects
      .eq('student_id', studentProfileData.id) // student_id is FK in submissions table to students.id
      .order('submission_date', { ascending: false });
    if (error) throw error;
    studentSubmissionsData = data || [];
    console.log('Student.js: Student submissions data:', studentSubmissionsData);
  } catch (error) {
    console.error('Student.js: Error fetching student submissions data:', error);
    studentSubmissionsData = [];
  }
}

async function fetchStudentNotifications() {
  if (!studentCurrentUser || !studentCurrentUser.id || !studentSupabaseClient) {
      console.warn('Student.js: Cannot fetch notifications without current user ID.');
      studentNotificationsData = [];
      if(StudentDOM.notificationCountBadge) {
          StudentDOM.notificationCountBadge.textContent = 0;
          StudentDOM.notificationCountBadge.classList.add('hidden');
      }
      return;
  }
  console.log('Student.js: Fetching student notifications...');
  try {
    const { data, error, count } = await studentSupabaseClient
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', studentCurrentUser.id)
      // .eq('is_read', false) // Fetch all for display, filter for badge locally or fetch unread for badge separately
      .order('created_at', { ascending: false });

    if (error) throw error;
    studentNotificationsData = data || [];
    
    const unreadCount = studentNotificationsData.filter(n => !n.is_read).length;

    if (StudentDOM.notificationCountBadge) {
      StudentDOM.notificationCountBadge.textContent = unreadCount || 0;
      StudentDOM.notificationCountBadge.classList.toggle('hidden', !unreadCount || unreadCount === 0);
    }
    if (StudentDOM.markAllNotificationsReadBtn) {
        StudentDOM.markAllNotificationsReadBtn.disabled = (unreadCount === 0);
    }
    console.log('Student.js: Student notifications data fetched. Unread:', unreadCount);
  } catch (error) {
    console.error('Student.js: Error fetching student notifications:', error);
    studentNotificationsData = [];
  }
}


// --- UI Population Functions ---
function populateStudentHeader() {
    if (StudentDOM.userNameDisplay) {
        if (studentProfileData && (studentProfileData.first_name || studentProfileData.last_name)) {
            StudentDOM.userNameDisplay.textContent = `${studentProfileData.first_name || ''} ${studentProfileData.last_name || ''}`.trim();
        } else if (studentCurrentUser && studentCurrentUser.email) {
            StudentDOM.userNameDisplay.textContent = studentCurrentUser.email; // Fallback to email
        } else {
            StudentDOM.userNameDisplay.textContent = 'Student';
        }
    }

    if (StudentDOM.userAvatar) {
        if (studentProfileData?.avatar_url) {
            StudentDOM.userAvatar.innerHTML = `<img src="${studentProfileData.avatar_url}" alt="User Avatar" class="w-full h-full rounded-full object-cover">`;
        } else {
            const initials = (studentProfileData?.first_name?.[0] || '') + (studentProfileData?.last_name?.[0] || '');
            if (initials) {
                StudentDOM.userAvatar.innerHTML = `<span class="text-xl font-semibold">${initials.toUpperCase()}</span>`;
                 StudentDOM.userAvatar.className = 'w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center mr-3'; // Added missing mr-3 based on html
            } else {
                 StudentDOM.userAvatar.innerHTML = `<i class="fas fa-user text-xl"></i>`; // Fallback icon
                 StudentDOM.userAvatar.className = 'w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 mr-3';
            }
        }
    }
}

function populateDashboardSummary() {
    if (StudentDOM.projectTitleSummary) {
        StudentDOM.projectTitleSummary.textContent = studentProjectData?.title || 'No active project';
    }
    if (StudentDOM.projectStageSummary) {
        StudentDOM.projectStageSummary.textContent = studentProjectData?.current_stage ? capitalizeFirstLetter(studentProjectData.current_stage.replace(/_/g, ' ')) : 'N/A';
    }
    if (StudentDOM.projectDeadlineSummary) {
        StudentDOM.projectDeadlineSummary.textContent = studentProjectData?.next_deadline ? formatDate(studentProjectData.next_deadline) : 'N/A';
    }
    const progress = studentProjectData?.progress_percentage || 0;
    if (StudentDOM.projectProgressBar) StudentDOM.projectProgressBar.style.width = `${progress}%`;
    if (StudentDOM.projectProgressText) StudentDOM.projectProgressText.textContent = `${progress}%`;


    if (StudentDOM.supervisorInfoContent) {
        if (studentSupervisorData) {
            const supervisorName = studentSupervisorData.fullName || studentSupervisorData.email || 'N/A';
            StudentDOM.supervisorInfoContent.innerHTML = `
                <h3 class="text-lg font-semibold text-gray-700 mb-2">${supervisorName}</h3>
                <p class="text-gray-600 text-sm">Email: ${studentSupervisorData.email || 'N/A'}</p>
                <p class="text-gray-600 text-sm">Department: ${studentSupervisorData.departmentName || 'N/A'}</p>
                <p class="text-gray-600 text-sm">Office: ${studentSupervisorData.officeLocation || 'N/A'}</p>
            `;
        } else {
            StudentDOM.supervisorInfoContent.innerHTML = '<p class="text-gray-600">Supervisor details not available.</p>';
        }
    }

    if (StudentDOM.upcomingMeetingContent) {
        const upcomingMeeting = studentMeetingsData
            .filter(m => new Date(m.meeting_date) >= new Date())
            .sort((a,b) => new Date(a.meeting_date) - new Date(b.meeting_date))[0];
        if (upcomingMeeting) {
            const supervisorFullName = upcomingMeeting.supervisor?.users?.full_name || 'Supervisor';
            StudentDOM.upcomingMeetingContent.innerHTML = `
                <h3 class="text-lg font-semibold text-gray-700 mb-2">${upcomingMeeting.title || 'Meeting'}</h3>
                <p class="text-gray-600 text-sm">Date: ${formatDate(upcomingMeeting.meeting_date)}</p>
                <p class="text-gray-600 text-sm">Time: ${formatTime(upcomingMeeting.start_time)} - ${formatTime(upcomingMeeting.end_time)}</p>
                <p class="text-gray-600 text-sm">Location: ${upcomingMeeting.location || 'N/A'}</p>
                <p class="text-gray-600 text-sm">With: ${supervisorFullName}</p>
            `;
        } else {
            StudentDOM.upcomingMeetingContent.innerHTML = '<p class="text-gray-600">No upcoming meetings scheduled.</p>';
        }
    }
}

function populateMyProjectSection() {
  if (!StudentDOM.projectDetailsContent) return;
  if (studentProjectData) {
    StudentDOM.projectDetailsContent.innerHTML = `
        <h2 class="text-xl font-semibold text-gray-800 mb-2">${studentProjectData.title || 'N/A'}</h2>
        <p class="text-gray-600 mb-4"><strong>Description:</strong> ${studentProjectData.description || 'No description provided.'}</p>
        <p class="text-gray-600"><strong>Status:</strong> <span class="font-medium ${getStatusColor(studentProjectData.status)}">${studentProjectData.status ? capitalizeFirstLetter(studentProjectData.status.replace(/_/g, ' ')) : 'N/A'}</span></p>
        <p class="text-gray-600"><strong>Start Date:</strong> ${studentProjectData.start_date ? formatDate(studentProjectData.start_date) : 'N/A'}</p>
        <p class="text-gray-600"><strong>Expected End Date:</strong> ${studentProjectData.expected_end_date ? formatDate(studentProjectData.expected_end_date) : 'N/A'}</p>
        <div class="mt-4">
            <h4 class="font-semibold text-gray-700">Overall Progress:</h4>
            <div class="w-full bg-gray-200 rounded-full h-4 mt-1">
                <div class="bg-blue-600 h-4 rounded-full" style="width: ${studentProjectData.progress_percentage || 0}%"></div>
            </div>
            <p class="text-sm text-gray-500 text-right">${studentProjectData.progress_percentage || 0}%</p>
        </div>
        `;
  } else {
    StudentDOM.projectDetailsContent.innerHTML = '<p class="text-gray-600">No project details available. This might be because you are not yet assigned to a project or there was an issue loading the data.</p>';
  }
}

function populateMeetingsSection() {
  if (!StudentDOM.meetingsListContent) return;
  if (studentMeetingsData.length === 0) {
    StudentDOM.meetingsListContent.innerHTML = '<p class="text-gray-500">No meetings scheduled or recorded.</p>';
    return;
  }
  let html = '<ul class="space-y-4">';
  studentMeetingsData.forEach(meeting => {
    const supervisorFullName = meeting.supervisor?.users?.full_name || 'Supervisor';
    html += `
        <li class="p-4 bg-white rounded-lg shadow">
            <div class="flex justify-between items-start">
                <div>
                    <h3 class="text-lg font-semibold text-blue-700">${meeting.title || 'Meeting'}</h3>
                    <p class="text-sm text-gray-600">With: ${supervisorFullName}</p>
                </div>
                <span class="text-sm text-gray-500">${formatDate(meeting.meeting_date)}</span>
            </div>
            <p class="text-sm text-gray-600 mt-1">Time: ${formatTime(meeting.start_time)} - ${formatTime(meeting.end_time)}</p>
            <p class="text-sm text-gray-600">Location: ${meeting.location || 'N/A'}</p>
            ${meeting.notes ? `<p class="mt-2 text-sm text-gray-500 bg-gray-50 p-2 rounded"><strong>Notes:</strong> ${truncateText(meeting.notes, 150)}</p>` : ''}
            ${meeting.student_summary ? `<p class="mt-2 text-sm text-gray-500 bg-blue-50 p-2 rounded"><strong>Your Summary:</strong> ${truncateText(meeting.student_summary,150)}</p>` : ''}
            ${meeting.supervisor_feedback ? `<p class="mt-2 text-sm text-gray-500 bg-green-50 p-2 rounded"><strong>Supervisor Feedback:</strong> ${truncateText(meeting.supervisor_feedback,150)}</p>` : ''}
             <div class="mt-3 text-right">
                ${!meeting.student_summary ? `<button data-meeting-id="${meeting.id}" class="add-meeting-summary-btn text-sm bg-yellow-500 hover:bg-yellow-600 text-white py-1 px-3 rounded-md">Add Summary</button>` : ''}
            </div>
        </li>
    `;
  });
  html += '</ul>';
  StudentDOM.meetingsListContent.innerHTML = html;

  document.querySelectorAll('.add-meeting-summary-btn').forEach(button => {
    button.addEventListener('click', (e) => {
      const meetingId = e.target.dataset.meetingId;
      openAddMeetingSummaryModal(meetingId);
    });
  });
}

function populateSubmissionsSection() {
  if (!StudentDOM.submissionsListContent) return;
  if (studentSubmissionsData.length === 0) {
    StudentDOM.submissionsListContent.innerHTML = '<p class="text-gray-500">You have not made any submissions yet.</p>';
    return;
  }
  let html = '<ul class="space-y-4">';
  studentSubmissionsData.forEach(submission => {
    html += `
        <li class="p-4 bg-white rounded-lg shadow">
            <div class="flex justify-between items-start">
                <div>
                    <h3 class="text-lg font-semibold text-green-700">${submission.title || submission.projects?.title || 'Submission'}</h3>
                    <p class="text-sm text-gray-600">Type: ${submission.submission_type ? capitalizeFirstLetter(submission.submission_type.replace(/_/g, ' ')) : 'N/A'}</p>
                </div>
                <span class="text-sm text-gray-500">Submitted: ${formatDate(submission.submission_date)}</span>
            </div>
            <p class="text-sm text-gray-600 mt-1">Status: <span class="font-medium ${getStatusColor(submission.status)}">${submission.status ? capitalizeFirstLetter(submission.status.replace(/_/g, ' ')) : 'N/A'}</span></p>
            ${submission.description ? `<p class="mt-2 text-sm text-gray-500 bg-gray-50 p-2 rounded"><strong>Description:</strong> ${truncateText(submission.description,150)}</p>` : ''}
            ${submission.supervisor_feedback ? `<p class="mt-2 text-sm text-gray-500 bg-yellow-50 p-2 rounded"><strong>Feedback:</strong> ${truncateText(submission.supervisor_feedback,150)}</p>` : ''}
            ${submission.grade ? `<p class="mt-1 text-sm text-gray-600"><strong>Grade:</strong> ${submission.grade}</p>` : ''}
            </li>
    `;
  });
  html += '</ul>';
  StudentDOM.submissionsListContent.innerHTML = html;
}

function populateNotificationsSection() {
  if (!StudentDOM.notificationsListContent) return;

  if (studentNotificationsData.length === 0) {
    StudentDOM.notificationsListContent.innerHTML = '<p class="text-gray-500">No notifications.</p>';
    return;
  }

  let html = '<div class="space-y-3">'; // Added for consistent spacing
  studentNotificationsData.forEach(notification => { // Already fetched all, now displaying
    html += `
        <div class="p-3 rounded-md ${notification.is_read ? 'bg-gray-100' : 'bg-blue-50 border border-blue-200'}">
            <div class="flex justify-between items-center mb-1">
                <h4 class="font-semibold ${notification.is_read ? 'text-gray-700' : 'text-blue-700'}">${notification.title}</h4>
                <span class="text-xs text-gray-500">${formatDateTime(notification.created_at)}</span>
            </div>
            <p class="text-sm ${notification.is_read ? 'text-gray-600' : 'text-blue-600'}">${notification.message}</p>
            ${!notification.is_read ? `<button data-notification-id="${notification.id}" class="mark-single-notification-read-btn text-xs text-blue-500 hover:underline mt-1">Mark as read</button>` : ''}
        </div>
    `;
  });
  html += '</div>';
  StudentDOM.notificationsListContent.innerHTML = html;

  document.querySelectorAll('.mark-single-notification-read-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const notificationId = e.target.dataset.notificationId;
      await markNotificationAsRead(notificationId, true);
    });
  });
}


function populateProfileSection() {
  if (!StudentDOM.studentProfileContent || !studentProfileData) {
     if(StudentDOM.studentProfileContent) StudentDOM.studentProfileContent.innerHTML = '<p class="text-gray-600">Your profile details could not be loaded.</p>';
    return;
  }
  // Use studentProfileData (from 'students' table) for detailed profile info
  // Use studentCurrentUser.email for the primary email address
  StudentDOM.studentProfileContent.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="md:col-span-1 flex flex-col items-center">
            ${studentProfileData.avatar_url ? `<img src="${studentProfileData.avatar_url}" alt="Profile" class="w-32 h-32 rounded-full object-cover mb-4 shadow-md">` : 
            `<div class="w-32 h-32 rounded-full bg-blue-500 text-white flex items-center justify-center text-4xl font-semibold mb-4 shadow-md">${(studentProfileData.first_name ? studentProfileData.first_name[0] : '') + (studentProfileData.last_name ? studentProfileData.last_name[0] : '')}</div>`}
            <h3 class="text-2xl font-semibold text-gray-800">${studentProfileData.first_name || ''} ${studentProfileData.last_name || ''}</h3>
            <p class="text-gray-600">${studentCurrentUser.email}</p> {/* Email from auth user */}
            <button id="editProfileBtn" class="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md text-sm">Edit Profile</button>
        </div>
        <div class="md:col-span-2 space-y-3">
            <p><strong>Student ID:</strong> ${studentProfileData.student_system_id || 'N/A'}</p>
            <p><strong>Program:</strong> ${studentProfileData.program?.name || 'N/A'}</p>
            <p><strong>Department:</strong> ${studentProfileData.department?.name || 'N/A'}</p>
            <p><strong>Year of Study:</strong> ${studentProfileData.year_of_study || 'N/A'}</p>
            <p><strong>Enrollment Date:</strong> ${studentProfileData.enrollment_date ? formatDate(studentProfileData.enrollment_date) : 'N/A'}</p>
            <p><strong>Expected Completion:</strong> ${studentProfileData.expected_completion_date ? formatDate(studentProfileData.expected_completion_date) : 'N/A'}</p>
            <p><strong>Contact Number:</strong> ${studentProfileData.phone_number || 'N/A'}</p>
        </div>
    </div>
  `;
  const editProfileBtn = document.getElementById('editProfileBtn');
  if(editProfileBtn) editProfileBtn.addEventListener('click', openEditProfileModal);
}


// --- Event Listeners & UI Interaction ---
function setupStudentEventListeners() {
  document.querySelectorAll('.nav-item').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.id.replace('nav-', '') + '-content'; // e.g., dashboard-content
      document.querySelectorAll('.content-section').forEach(section => section.classList.add('hidden'));
      const activeSection = document.getElementById(targetId);
      if (activeSection) activeSection.classList.remove('hidden');

      document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active-nav', 'bg-blue-700'));
      link.classList.add('active-nav', 'bg-blue-700');

      if (StudentDOM.pageTitle) StudentDOM.pageTitle.textContent = link.textContent.trim().replace(/Notifications\s*\d*/, 'Notifications');

      if (targetId === 'notifications-content') {
        fetchStudentNotifications().then(populateNotificationsSection); // Re-fetch and populate
      }
    });
  });

  const logoutButton = document.getElementById('logoutButton');
  if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
      if (window.auth && typeof window.auth.logout === 'function') {
        await window.auth.logout(); // auth.js handles redirection via onAuthStateChange
      }
    });
  }

  if (StudentDOM.closeModalBtn) StudentDOM.closeModalBtn.addEventListener('click', closeModal);
  if (StudentDOM.modalCancelBtn) StudentDOM.modalCancelBtn.addEventListener('click', closeModal);
  if (StudentDOM.formModal) {
      StudentDOM.formModal.addEventListener('click', (e) => {
          if (e.target === StudentDOM.formModal) closeModal();
      });
  }

  if (StudentDOM.requestMeetingBtn) StudentDOM.requestMeetingBtn.addEventListener('click', openRequestMeetingModal);
  if (StudentDOM.newSubmissionBtn) {
    StudentDOM.newSubmissionBtn.addEventListener('click', () => {
        // Redirect to thesis submission page or open a modal
        if (window.PathConfig && PathConfig.THESIS_SUBMISSION) {
            window.location.href = PathConfig.THESIS_SUBMISSION; // Example redirect
        } else {
            openNewSubmissionModal(); // Fallback to modal if no specific page
        }
    });
  }
  if (StudentDOM.markAllNotificationsReadBtn) StudentDOM.markAllNotificationsReadBtn.addEventListener('click', markAllStudentNotificationsAsRead);
}

function setupRealtimeStudentSubscriptions() {
  if (!studentSupabaseClient || !studentCurrentUser || !studentProfileData?.id) return;

  // Notifications for this student (user_id)
  studentSupabaseClient.channel(`student_notifications_${studentCurrentUser.id}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${studentCurrentUser.id}` }, payload => {
      console.log('Student.js: Realtime new notification:', payload.new);
      if(typeof window.showToastNotification === 'function') window.showToastNotification(`New notification: ${payload.new.title}`, 'info');
      fetchStudentNotifications().then(() => { // Re-fetch all notifications
          if(document.getElementById('notifications-content')?.classList.contains('hidden') === false) {
              populateNotificationsSection(); // If on notifications page, refresh its content
          }
      });
    })
    .subscribe();

  // Updates to student's project (if project_id exists)
  if (studentProfileData.project_id) {
    studentSupabaseClient.channel(`student_project_${studentProfileData.project_id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'projects', filter: `id=eq.${studentProfileData.project_id}` }, async payload => {
        console.log('Student.js: Realtime project update:', payload.new);
        if(typeof window.showToastNotification === 'function') window.showToastNotification('Your project details have been updated.', 'info');
        await fetchStudentProjectData();
        populateDashboardSummary();
        populateMyProjectSection();
      })
      .subscribe();
  }

  // Meetings involving this student (student_id from 'students' table)
  studentSupabaseClient.channel(`student_meetings_${studentProfileData.id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'meetings', filter: `student_id=eq.${studentProfileData.id}` }, async payload => {
      console.log('Student.js: Realtime meeting update/insert/delete:', payload);
       if(typeof window.showToastNotification === 'function') window.showToastNotification('A meeting has been updated or scheduled.', 'info');
      await fetchStudentMeetingsData();
      populateMeetingsSection();
      populateDashboardSummary(); // For upcoming meeting
    })
    .subscribe();
  
  // Submissions by this student
  studentSupabaseClient.channel(`student_submissions_${studentProfileData.id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions', filter: `student_id=eq.${studentProfileData.id}`}, async payload => {
        console.log('Student.js: Realtime submission update:', payload);
        if(typeof window.showToastNotification === 'function') window.showToastNotification('A submission status has changed or new feedback is available.', 'info');
        await fetchStudentSubmissionsData();
        populateSubmissionsSection();
    })
    .subscribe();
}


// --- Modal Handling ---
// (openModal, closeModal, openRequestMeetingModal, openNewSubmissionModal, openAddMeetingSummaryModal, openEditProfileModal remain largely the same but ensure they use global utilities for loading/toast)

function openModal(title, formHtml, submitHandler, submitButtonText = 'Submit') {
  if (!StudentDOM.formModal || !StudentDOM.modalTitle || !StudentDOM.modalFormContent || !StudentDOM.modalForm || !StudentDOM.modalSubmitBtn) {
      console.error("Student.js: Modal DOM elements not found.");
      return;
  }
  StudentDOM.modalTitle.textContent = title;
  StudentDOM.modalFormContent.innerHTML = formHtml;
  StudentDOM.modalSubmitBtn.textContent = submitButtonText;
  StudentDOM.formModal.style.display = 'flex';

  const oldSubmitBtn = StudentDOM.modalSubmitBtn;
  const newSubmitBtn = oldSubmitBtn.cloneNode(true);
  oldSubmitBtn.parentNode.replaceChild(newSubmitBtn, oldSubmitBtn);
  StudentDOM.modalSubmitBtn = newSubmitBtn;

  StudentDOM.modalSubmitBtn.onclick = async (e) => {
    e.preventDefault();
    const formDataRaw = new FormData(StudentDOM.modalForm);
    const data = Object.fromEntries(formDataRaw.entries());

    if(typeof window.showGlobalLoading === 'function') window.showGlobalLoading('Submitting...');
    try {
      await submitHandler(data, formDataRaw); // Pass raw FormData if needed for files
      closeModal(); // Close modal on success
    } catch (error) {
      console.error("Student.js: Modal submission error:", error);
      if(typeof window.showToastNotification === 'function') window.showToastNotification(`Submission failed: ${error.message}`, 'danger');
      // Do not close modal on error, let user retry or cancel
    } finally {
      if(typeof window.hideGlobalLoading === 'function') window.hideGlobalLoading();
    }
  };
}

function closeModal() {
  if (StudentDOM.formModal) StudentDOM.formModal.style.display = 'none';
  if (StudentDOM.modalForm) StudentDOM.modalForm.reset();
  if (StudentDOM.modalFormContent) StudentDOM.modalFormContent.innerHTML = '';
}

function openRequestMeetingModal() {
  if (!studentProfileData || !studentProfileData.supervisor_id) {
    if(typeof window.showToastNotification === 'function') window.showToastNotification("Cannot request meeting: Supervisor information missing.", 'warning');
    return;
  }
  const formHtml = `
      <div class="mb-4">
          <label for="meetingTitle" class="block text-sm font-medium text-gray-700">Meeting Title/Purpose</label>
          <input type="text" name="title" id="meetingTitle" class="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" required>
      </div>
      <div class="mb-4">
          <label for="meetingAvailability" class="block text-sm font-medium text-gray-700">Your Availability (e.g., Dates, Times)</label>
          <textarea name="availability_notes" id="meetingAvailability" rows="3" class="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" required></textarea>
      </div>
      <input type="hidden" name="student_id" value="${studentProfileData.id}">
      <input type="hidden" name="supervisor_id" value="${studentProfileData.supervisor_id}">
      <input type="hidden" name="requested_by_student" value="true">
      <input type="hidden" name="status" value="pending_supervisor_approval">
  `;
  openModal('Request Meeting with Supervisor', formHtml, async (data) => {
    // Data from hidden fields already included
    data.meeting_date = null; // Supervisor will set this
    data.start_time = null;
    data.end_time = null;

    const { error } = await studentSupabaseClient.from('meetings').insert(data);
    if (error) throw error;
    if(typeof window.showToastNotification === 'function') window.showToastNotification('Meeting request sent successfully!', 'success');
    fetchStudentMeetingsData().then(populateMeetingsSection);
  });
}

function openNewSubmissionModal() { // This might be deprecated if redirecting to thesis-submission.html
  if (!studentProfileData || !studentProfileData.project_id) {
    if(typeof window.showToastNotification === 'function') window.showToastNotification("Cannot make submission: Project information missing.", 'warning');
    return;
  }
  // Simplified modal as thesis submission is a dedicated page now.
  // This could be for other small submissions if needed.
  const formHtml = `
      <p>To make a new thesis submission, please navigate to the dedicated Thesis Submission page.</p>
      <div class="mt-4">
          <a href="${PathConfig.THESIS_SUBMISSION}" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md">
              Go to Thesis Submission Page
          </a>
      </div>
      <hr class="my-4">
      <p class="text-sm text-gray-600">For other types of submissions (e.g., progress reports not part of the main thesis workflow), use the form below:</p>
      <div class="mb-4 mt-2">
          <label for="submissionTitle" class="block text-sm font-medium text-gray-700">Title/Milestone</label>
          <input type="text" name="title" id="submissionTitle" class="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md">
      </div>
      <div class="mb-4">
          <label for="submissionType" class="block text-sm font-medium text-gray-700">Type</label>
          <select name="submission_type" id="submissionType" class="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md">
              <option value="progress_report">Progress Report</option>
              <option value="ethics_form_update">Ethics Form Update</option>
              <option value="other">Other</option>
          </select>
      </div>
      <div class="mb-4">
          <label for="submissionDescription" class="block text-sm font-medium text-gray-700">Notes/Description</label>
          <textarea name="description" id="submissionDescription" rows="3" class="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"></textarea>
      </div>
      <div class="mb-4">
          <label for="submissionFiles" class="block text-sm font-medium text-gray-700">Attach File(s)</label>
          <input type="file" name="files" id="submissionFiles" class="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" multiple>
          <p class="text-xs text-gray-500 mt-1">Max file size: ${SystemConfig.MAX_UPLOAD_SIZE_MB}MB. Allowed: PDF, DOCX, ZIP.</p>
      </div>
      <input type="hidden" name="student_id" value="${studentProfileData.id}">
      <input type="hidden" name="project_id" value="${studentProfileData.project_id}">
      <input type="hidden" name="status" value="submitted">
  `;
  openModal('New Submission', formHtml, async (data, formDataRaw) => {
    const files = formDataRaw.getAll('files').filter(f => f.name); // formDataRaw.get('files') is just the first file

    if (!data.title && !files.length) { // Require title for non-file submissions
        if(typeof window.showToastNotification === 'function') window.showToastNotification('Please provide a title or attach files.', 'warning');
        throw new Error('Missing title or files.'); // Prevent modal from closing
    }
    if (!data.title && files.length > 0) { // If only files, use first file name as title
        data.title = files[0].name;
    }


    data.submission_date = new Date().toISOString();
    // student_id, project_id, status are from hidden fields

    const { data: submissionResult, error: submissionError } = await studentSupabaseClient
        .from('submissions')
        .insert(data)
        .select()
        .single();

    if (submissionError) throw submissionError;
    const submissionId = submissionResult.id;

    if (files.length > 0 && submissionId) {
      if(typeof window.showGlobalLoading === 'function') window.showGlobalLoading('Uploading files...');
      for (const file of files) {
        if (file.size > SystemConfig.MAX_UPLOAD_SIZE_MB * 1024 * 1024) {
          if(typeof window.showToastNotification === 'function') window.showToastNotification(`File ${file.name} is too large (max ${SystemConfig.MAX_UPLOAD_SIZE_MB}MB).`, 'warning');
          continue;
        }
        // Adjust filePath to be more specific to generic submissions if needed
        const filePath = `submissions/${studentProfileData.id}/${submissionId}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await studentSupabaseClient.storage
          .from('submission_files') // Ensure this bucket exists with appropriate policies
          .upload(filePath, file);

        if (uploadError) {
          console.error(`Student.js: Error uploading ${file.name}:`, uploadError);
          if(typeof window.showToastNotification === 'function') window.showToastNotification(`Failed to upload ${file.name}.`, 'danger');
        } else {
          await studentSupabaseClient.from('attachments').insert({ // Ensure 'attachments' table schema matches
            submission_id: submissionId,
            file_name: file.name, file_path: filePath, file_type: file.type, file_size: file.size,
            uploaded_by: studentCurrentUser.id
          });
        }
      }
    }
    if(typeof window.showToastNotification === 'function') window.showToastNotification('Submission successful!', 'success');
    fetchStudentSubmissionsData().then(populateSubmissionsSection);
  }, "Submit Other Document");
}

function openAddMeetingSummaryModal(meetingId) {
  const meeting = studentMeetingsData.find(m => m.id.toString() === meetingId.toString()); // Ensure ID comparison is robust
  if (!meeting) {
    if(typeof window.showToastNotification === 'function') window.showToastNotification("Meeting not found.", 'danger');
    return;
  }

  const formHtml = `
      <div class="mb-4">
          <label for="meetingSummary" class="block text-sm font-medium text-gray-700">Your Summary/Key Takeaways</label>
          <textarea name="student_summary" id="meetingSummary" rows="5" class="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" required>${meeting.student_summary || ''}</textarea>
      </div>
      <input type="hidden" name="meeting_id" value="${meetingId}">
  `;
  openModal('Add/Edit Your Meeting Summary', formHtml, async (data) => {
    const { error } = await studentSupabaseClient
      .from('meetings')
      .update({ student_summary: data.student_summary })
      .eq('id', meetingId);
    if (error) throw error;
    if(typeof window.showToastNotification === 'function') window.showToastNotification('Meeting summary saved!', 'success');
    fetchStudentMeetingsData().then(populateMeetingsSection);
  });
}

function openEditProfileModal() {
  if (!studentProfileData) { // Check against studentProfileData which comes from 'students' table
    if(typeof window.showToastNotification === 'function') window.showToastNotification("Profile data not loaded. Cannot edit.", 'warning');
    return;
  }
  const formHtml = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
              <label for="firstName" class="block text-sm font-medium text-gray-700">First Name</label>
              <input type="text" name="first_name" id="firstName" value="${studentProfileData.first_name || ''}" class="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" required>
          </div>
          <div>
              <label for="lastName" class="block text-sm font-medium text-gray-700">Last Name</label>
              <input type="text" name="last_name" id="lastName" value="${studentProfileData.last_name || ''}" class="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" required>
          </div>
      </div>
      <div class="mt-4">
          <label for="phoneNumber" class="block text-sm font-medium text-gray-700">Contact Number</label>
          <input type="tel" name="phone_number" id="phoneNumber" value="${studentProfileData.phone_number || ''}" class="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md">
      </div>
      <div class="mt-4">
          <label for="avatarUrl" class="block text-sm font-medium text-gray-700">Avatar URL (optional)</label>
          <input type="url" name="avatar_url" id="avatarUrl" value="${studentProfileData.avatar_url || ''}" class="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" placeholder="https://example.com/avatar.png">
      </div>
      `;
  openModal('Edit Your Profile', formHtml, async (data) => {
    const updateDataForStudentsTable = {
        first_name: data.first_name,
        last_name: data.last_name,
        phone_number: data.phone_number || null, // Ensure null if empty for DB
        avatar_url: data.avatar_url || null,    // Ensure null if empty
    };

    const { error: studentsUpdateError } = await studentSupabaseClient
      .from('students') // Update the 'students' table
      .update(updateDataForStudentsTable)
      .eq('id', studentProfileData.id); // studentProfileData.id is the PK of 'students' table
    if (studentsUpdateError) throw studentsUpdateError;

    // Also update auth.users user_metadata
    const metadataUpdate = {
        full_name: `${data.first_name || ''} ${data.last_name || ''}`.trim(),
        avatar_url: data.avatar_url || null,
        // Include any other metadata fields you want to sync from 'students' table if necessary
    };

    const { error: userUpdateError } = await studentSupabaseClient.auth.updateUser({ data: metadataUpdate });
    if (userUpdateError) console.warn("Student.js: Error updating user metadata in auth:", userUpdateError);

    if(typeof window.showToastNotification === 'function') window.showToastNotification('Profile updated successfully!', 'success');
    await fetchStudentProfileData(); // Re-fetch to get updated data from 'students' table
    populateStudentHeader();
    populateProfileSection();
  });
}

// --- Utility Functions ---
// (showLoading, hideLoading, handleStudentError were local, now should use global versions if defined e.g. in script.js or app.js)
// For now, keeping simplified local versions or using global if available for toast.

function getStatusColor(status) {
  if (!status) return 'text-gray-600';
  status = status.toLowerCase().replace(/ /g, '_');
  if (['on_track', 'approved', 'completed', 'active', 'submitted'].includes(status)) return 'text-green-600';
  if (['behind_schedule', 'pending_approval', 'under_review', 'changes_requested', 'at_risk', 'on_hold'].includes(status)) return 'text-yellow-600';
  if (['needs_attention', 'rejected', 'overdue', 'suspended', 'withdrawn'].includes(status)) return 'text-red-600';
  return 'text-gray-600'; // Default
}

async function markNotificationAsRead(notificationId, refreshList = false) {
  try {
    const { error } = await studentSupabaseClient
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', studentCurrentUser.id);

    if (error) throw error;

    // Optimistically update local data for faster UI response
    const notificationIndex = studentNotificationsData.findIndex(n => n.id.toString() === notificationId.toString());
    if (notificationIndex > -1) {
        studentNotificationsData[notificationIndex].is_read = true;
    }
    
    const unreadCount = studentNotificationsData.filter(n => !n.is_read).length;
    if (StudentDOM.notificationCountBadge) {
        StudentDOM.notificationCountBadge.textContent = unreadCount;
        StudentDOM.notificationCountBadge.classList.toggle('hidden', unreadCount === 0);
    }
    if (StudentDOM.markAllNotificationsReadBtn) {
        StudentDOM.markAllNotificationsReadBtn.disabled = (unreadCount === 0);
    }

    if (refreshList && document.getElementById('notifications-content')?.classList.contains('hidden') === false) {
      populateNotificationsSection(); // Refresh the list view if it's visible
    } else {
      // If not on notifications page, just visually mark the specific notification if it's somehow displayed elsewhere (less common)
      const button = document.querySelector(`.mark-single-notification-read-btn[data-notification-id="${notificationId}"]`);
      if (button) {
        const parentDiv = button.closest('.p-3'); // Assuming this structure from populateNotificationsSection
        if (parentDiv) {
            parentDiv.classList.remove('bg-blue-50', 'border-blue-200');
            parentDiv.classList.add('bg-gray-100');
            const title = parentDiv.querySelector('h4');
            if(title) title.classList.replace('text-blue-700', 'text-gray-700');
            const message = parentDiv.querySelector('p.text-sm');
            if(message) message.classList.replace('text-blue-600', 'text-gray-600');
        }
        button.remove();
      }
    }
    if(typeof window.showToastNotification === 'function') window.showToastNotification('Notification marked as read.', 'success', 2000);
  } catch (error) {
    console.error("Student.js: Error marking notification as read:", error);
    if(typeof window.showToastNotification === 'function') window.showToastNotification("Could not mark notification as read.", 'danger');
  }
}

async function markAllStudentNotificationsAsRead() {
  if (!studentCurrentUser || !studentSupabaseClient) return;
  if(typeof window.showGlobalLoading === 'function') window.showGlobalLoading("Marking all as read...");
  try {
    const { error } = await studentSupabaseClient
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', studentCurrentUser.id)
      .eq('is_read', false);

    if (error) throw error;

    // Optimistically update local data
    studentNotificationsData.forEach(n => n.is_read = true);

    if (StudentDOM.notificationCountBadge) {
      StudentDOM.notificationCountBadge.textContent = '0';
      StudentDOM.notificationCountBadge.classList.add('hidden');
    }
    if (StudentDOM.markAllNotificationsReadBtn) {
        StudentDOM.markAllNotificationsReadBtn.disabled = true;
    }

    if (document.getElementById('notifications-content')?.classList.contains('hidden') === false) {
      populateNotificationsSection();
    }
    if(typeof window.showToastNotification === 'function') window.showToastNotification('All notifications marked as read.', 'success');
  } catch (error) {
    console.error("Student.js: Error marking all notifications as read:", error);
    if(typeof window.showToastNotification === 'function') window.showToastNotification("Could not mark all notifications as read.", 'danger');
  } finally {
    if(typeof window.hideGlobalLoading === 'function') window.hideGlobalLoading();
  }
}

// --- Global Invocation ---
// The primary initialization (initializeStudentDashboard) is now called by app.js.
// The DOMContentLoaded listener and authModuleReady listener below are removed as they
// would conflict with app.js's controlled initialization.

console.log('student.js loaded. initializeStudentDashboard is available on window object.');