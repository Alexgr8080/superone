console.log('student.js: Script loaded.');

// --- Student Dashboard State & Initialization ---
let studentSupabaseClient = null;
let studentCurrentUser = null;
let studentProfileData = null; // Stores the student's own profile data from 'students' table
let studentProjectData = null;
let studentSupervisorData = null;
let studentMeetingsData = [];
let studentSubmissionsData = [];
let studentNotificationsData = [];
let isStudentDashboardInitialized = false;

// --- DOM Element Cache ---
const StudentDOM = {
    pageTitle: document.getElementById('page-title'),
    userNameDisplay: document.getElementById('user-name-display'),
    userAvatar: document.getElementById('user-avatar'), // Assuming an img or div for avatar

    // Dashboard Summary Section
    projectTitleSummary: document.getElementById('project-title-summary'),
    projectStageSummary: document.getElementById('project-stage-summary'),
    projectDeadlineSummary: document.getElementById('project-deadline-summary'),
    projectProgressBar: document.getElementById('project-progress-bar'),
    projectProgressText: document.getElementById('project-progress-text'),
    supervisorInfoContent: document.getElementById('supervisor-info-content'),
    upcomingMeetingContent: document.getElementById('upcoming-meeting-content'),

    // My Project Section
    projectDetailsContent: document.getElementById('project-details-content'),

    // Meetings Section
    meetingsListContent: document.getElementById('meetings-list-content'),
    requestMeetingBtn: document.getElementById('requestMeetingBtn'),

    // Submissions Section
    submissionsListContent: document.getElementById('submissions-list-content'),
    newSubmissionBtn: document.getElementById('newSubmissionBtn'),

    // Notifications Section
    notificationsListContent: document.getElementById('notifications-list-content'),
    notificationCountBadge: document.getElementById('notification-count-badge'),
    markAllNotificationsReadBtn: document.getElementById('markAllNotificationsReadBtn'),


    // Profile Section
    studentProfileContent: document.getElementById('student-profile-content'),

    // Modal Elements
    formModal: document.getElementById('formModal'),
    modalTitle: document.getElementById('modalTitle'),
    modalForm: document.getElementById('modalForm'),
    modalFormContent: document.getElementById('modalFormContent'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    modalCancelBtn: document.getElementById('modalCancelBtn'),
    modalSubmitBtn: document.getElementById('modalSubmitBtn'),

    loadingOverlay: document.getElementById('loading-overlay'),
    // Add other elements from student.html as needed
};

// --- Initialization ---
async function initializeStudentDashboard() {
    if (isStudentDashboardInitialized) {
        console.log('student.js: Student Dashboard already initialized.');
        return;
    }
    console.log('student.js: Initializing Student Dashboard...');
    showLoading('Initializing dashboard...');

    try {
        // 1. Ensure Auth module is ready
        if (!window.auth || typeof window.auth.getCurrentUser !== 'function') {
            console.error('student.js: Auth module not available.');
            handleStudentError('Dashboard cannot load: Authentication system missing.');
            hideLoading();
            return;
        }

        // 2. Get current user from auth module
        studentCurrentUser = window.auth.getCurrentUser();
        if (!studentCurrentUser) {
            console.warn('student.js: No current user. Redirecting to login.');
            // script.js should handle redirection. If not, this page won't work.
            handleStudentError('Not logged in. Please log in.');
            hideLoading();
            // window.location.href = PathConfig.LOGIN; // Fallback redirect
            return;
        }
        console.log('student.js: Current user:', studentCurrentUser.email);

        // 3. Get Supabase client
        if (!window.supabaseClientInstance || typeof window.supabaseClientInstance.getClient !== 'function') {
            console.error('student.js: supabaseClientInstance not available.');
            handleStudentError('Dashboard cannot load: Database connection failed.');
            hideLoading();
            return;
        }
        studentSupabaseClient = window.supabaseClientInstance.getClient();
        if (!studentSupabaseClient) {
            console.error('student.js: Failed to get Supabase client.');
            handleStudentError('Dashboard cannot load: Database client failed to initialize.');
            hideLoading();
            return;
        }
        console.log('student.js: Supabase client obtained.');

        // 4. Fetch student-specific data
        await fetchStudentProfileData(); // Fetches student's own detailed profile
        if (!studentProfileData) {
            // This is critical. If student's own profile from 'students' table can't be fetched,
            // they might not be set up correctly in the database.
            console.error('student.js: Critical - Could not load student profile data from "students" table.');
            handleStudentError('Could not load your profile. Please contact support if this issue persists.');
            hideLoading();
            return; // Stop further execution
        }

        await fetchStudentProjectData();
        await fetchStudentSupervisorData(); // Depends on studentProfileData having supervisor_id
        await fetchStudentMeetingsData();
        await fetchStudentSubmissionsData();
        await fetchStudentNotifications();


        // 5. Populate UI
        populateStudentHeader();
        populateDashboardSummary();
        populateMyProjectSection();
        populateMeetingsSection();
        populateSubmissionsSection();
        populateNotificationsSection();
        populateProfileSection();


        // 6. Setup Event Listeners for student dashboard
        setupStudentEventListeners();
        setupRealtimeStudentSubscriptions();


        isStudentDashboardInitialized = true;
        console.log('student.js: Student Dashboard initialized successfully.');

    } catch (error) {
        console.error('student.js: Error initializing student dashboard:', error);
        handleStudentError(`Initialization failed: ${error.message}`);
    } finally {
        hideLoading();
    }
}

// --- Data Fetching Functions ---
async function fetchStudentProfileData() {
    if (!studentCurrentUser || !studentSupabaseClient) return;
    console.log('student.js: Fetching student profile data...');
    try {
        const { data, error } = await studentSupabaseClient
            .from('students') // Assuming your students table is named 'students'
            .select(`
                *, 
                program:program_id (name), 
                department:department_id (name)
            `)
            .eq('user_id', studentCurrentUser.id) // Assuming 'user_id' in 'students' table links to 'auth.users.id'
            .single();

        if (error) throw error;
        studentProfileData = data;
        console.log('student.js: Student profile data fetched:', studentProfileData);
        if (!studentProfileData) {
             console.warn('student.js: No detailed profile found for this user in the "students" table.');
        }
    } catch (error) {
        console.error('student.js: Error fetching student profile data:', error);
        studentProfileData = null; // Ensure it's null on error
    }
}

async function fetchStudentProjectData() {
    if (!studentProfileData || !studentProfileData.project_id || !studentSupabaseClient) {
        console.log('student.js: No project_id found for student or client not ready. Skipping project data fetch.');
        studentProjectData = null;
        return;
    }
    console.log('student.js: Fetching student project data for project_id:', studentProfileData.project_id);
    try {
        const { data, error } = await studentSupabaseClient
            .from('projects') // Assuming 'projects' table
            .select('*')
            .eq('id', studentProfileData.project_id)
            .single();
        if (error) throw error;
        studentProjectData = data;
        console.log('student.js: Student project data:', studentProjectData);
    } catch (error) {
        console.error('student.js: Error fetching student project data:', error);
        studentProjectData = null;
    }
}

async function fetchStudentSupervisorData() {
    if (!studentProfileData || !studentProfileData.supervisor_id || !studentSupabaseClient) {
        console.log('student.js: No supervisor_id found for student or client not ready. Skipping supervisor data fetch.');
        studentSupervisorData = null;
        return;
    }
    console.log('student.js: Fetching supervisor data for supervisor_id:', studentProfileData.supervisor_id);
    try {
        // Assuming 'supervisors' table stores supervisor details and links to auth.users via 'user_id'
        // Or, if 'supervisor_id' in 'students' table directly links to 'auth.users.id' of the supervisor:
        const { data: supervisorUser, error: userError } = await studentSupabaseClient
            .from('users') // Querying the auth.users table or a 'profiles' table for supervisors
            .select('id, email, raw_user_meta_data->full_name as full_name, raw_user_meta_data->avatar_url as avatar_url') // Adjust fields
            .eq('id', studentProfileData.supervisor_id)
            .single();

        if (userError) throw userError;

        // If you have a separate 'supervisors' table with more details:
        const { data: supervisorProfile, error: profileError } = await studentSupabaseClient
            .from('supervisors') // Your specific supervisors table
            .select('department_id, office_location, phone_number, title, departments(name)') // Example fields
            .eq('user_id', studentProfileData.supervisor_id) // Assuming 'user_id' in 'supervisors' links to 'auth.users.id'
            .single();
        
        if (profileError && profileError.code !== 'PGRST116') { // Ignore 'not found' for profile if basic user info is enough
            console.warn('student.js: Could not fetch detailed supervisor profile, but basic user info might be available.', profileError);
        }

        studentSupervisorData = { ...supervisorUser, ...supervisorProfile };
        console.log('student.js: Student supervisor data:', studentSupervisorData);

    } catch (error) {
        console.error('student.js: Error fetching student supervisor data:', error);
        studentSupervisorData = null;
    }
}


async function fetchStudentMeetingsData() {
    if (!studentProfileData || !studentSupabaseClient) return;
    console.log('student.js: Fetching student meetings data...');
    try {
        const { data, error } = await studentSupabaseClient
            .from('meetings')
            .select('*, supervisor:supervisor_id(user_id, raw_user_meta_data->full_name as full_name)') // Example join
            .eq('student_id', studentProfileData.id) // Student's ID from the 'students' table
            .order('meeting_date', { ascending: false });
        if (error) throw error;
        studentMeetingsData = data || [];
        console.log('student.js: Student meetings data:', studentMeetingsData);
    } catch (error) {
        console.error('student.js: Error fetching student meetings data:', error);
        studentMeetingsData = [];
    }
}

async function fetchStudentSubmissionsData() {
    if (!studentProfileData || !studentSupabaseClient) return;
    console.log('student.js: Fetching student submissions data...');
    try {
        const { data, error } = await studentSupabaseClient
            .from('submissions') // Assuming 'submissions' table
            .select('*, projects(title)') // Example join
            .eq('student_id', studentProfileData.id)
            .order('submission_date', { ascending: false });
        if (error) throw error;
        studentSubmissionsData = data || [];
        console.log('student.js: Student submissions data:', studentSubmissionsData);
    } catch (error) {
        console.error('student.js: Error fetching student submissions data:', error);
        studentSubmissionsData = [];
    }
}

async function fetchStudentNotifications() {
    if (!studentCurrentUser || !studentSupabaseClient) return;
    console.log('student.js: Fetching student notifications...');
    try {
        const { data, error, count } = await studentSupabaseClient
            .from('notifications')
            .select('*', { count: 'exact' })
            .eq('user_id', studentCurrentUser.id)
            .eq('is_read', false) // Only unread notifications for the badge
            .order('created_at', { ascending: false });

        if (error) throw error;
        studentNotificationsData = data || []; // Store all fetched notifications (could be just unread or all)
        
        if (StudentDOM.notificationCountBadge) {
            StudentDOM.notificationCountBadge.textContent = count || 0;
            StudentDOM.notificationCountBadge.classList.toggle('hidden', !count || count === 0);
        }
        console.log('student.js: Student notifications data (unread count for badge):', count);
    } catch (error) {
        console.error('student.js: Error fetching student notifications:', error);
        studentNotificationsData = [];
    }
}


// --- UI Population Functions ---
function populateStudentHeader() {
    if (studentProfileData && StudentDOM.userNameDisplay) {
        StudentDOM.userNameDisplay.textContent = `${studentProfileData.first_name || ''} ${studentProfileData.last_name || studentCurrentUser.email}`;
    } else if (studentCurrentUser && StudentDOM.userNameDisplay) {
         StudentDOM.userNameDisplay.textContent = studentCurrentUser.email; // Fallback to email
    }
    // Add avatar logic if available (e.g., studentProfileData.avatar_url)
    if (StudentDOM.userAvatar && studentProfileData?.avatar_url) {
        StudentDOM.userAvatar.innerHTML = `<img src="${studentProfileData.avatar_url}" alt="User Avatar" class="w-full h-full rounded-full object-cover">`;
    } else if (StudentDOM.userAvatar && studentProfileData?.first_name) {
        const initials = (studentProfileData.first_name[0] || '') + (studentProfileData.last_name ? studentProfileData.last_name[0] : '');
        StudentDOM.userAvatar.innerHTML = `<span class="text-xl font-semibold">${initials.toUpperCase()}</span>`;
        StudentDOM.userAvatar.classList.add('bg-blue-500', 'text-white', 'flex', 'items-center', 'justify-center', 'rounded-full', 'w-10', 'h-10');
    }
}

function populateDashboardSummary() {
    if (studentProjectData && StudentDOM.projectTitleSummary) {
        StudentDOM.projectTitleSummary.textContent = studentProjectData.title || 'Project Title Not Set';
        StudentDOM.projectStageSummary.textContent = studentProjectData.current_stage || 'N/A';
        StudentDOM.projectDeadlineSummary.textContent = studentProjectData.next_deadline ? new Date(studentProjectData.next_deadline).toLocaleDateString() : 'N/A';
        const progress = studentProjectData.progress_percentage || 0;
        if (StudentDOM.projectProgressBar) StudentDOM.projectProgressBar.style.width = `${progress}%`;
        if (StudentDOM.projectProgressText) StudentDOM.projectProgressText.textContent = `${progress}%`;
    } else {
        if (StudentDOM.projectTitleSummary) StudentDOM.projectTitleSummary.textContent = 'No active project';
    }

    if (studentSupervisorData && StudentDOM.supervisorInfoContent) {
        const supervisorName = studentSupervisorData.full_name || studentSupervisorData.email || 'N/A';
        StudentDOM.supervisorInfoContent.innerHTML = `
            <h3 class="text-lg font-semibold text-gray-700 mb-2">${supervisorName}</h3>
            <p class="text-gray-600">Email: ${studentSupervisorData.email || 'N/A'}</p>
            <p class="text-gray-600">Department: ${studentSupervisorData.departments?.name || 'N/A'}</p>
            <p class="text-gray-600">Office: ${studentSupervisorData.office_location || 'N/A'}</p>
        `;
    } else if (StudentDOM.supervisorInfoContent) {
        StudentDOM.supervisorInfoContent.textContent = 'Supervisor details not available.';
    }

    if (StudentDOM.upcomingMeetingContent) {
        const upcomingMeeting = studentMeetingsData.filter(m => new Date(m.meeting_date) >= new Date()).sort((a,b) => new Date(a.meeting_date) - new Date(b.meeting_date))[0];
        if (upcomingMeeting) {
            StudentDOM.upcomingMeetingContent.innerHTML = `
                <h3 class="text-lg font-semibold text-gray-700 mb-2">${upcomingMeeting.title || 'Meeting'}</h3>
                <p class="text-gray-600">Date: ${new Date(upcomingMeeting.meeting_date).toLocaleDateString()}</p>
                <p class="text-gray-600">Time: ${formatTime(upcomingMeeting.start_time)} - ${formatTime(upcomingMeeting.end_time)}</p>
                <p class="text-gray-600">Location: ${upcomingMeeting.location || 'N/A'}</p>
                <p class="text-gray-600">With: ${upcomingMeeting.supervisor?.full_name || 'Supervisor'}</p>
            `;
        } else {
            StudentDOM.upcomingMeetingContent.textContent = 'No upcoming meetings scheduled.';
        }
    }
}

function populateMyProjectSection() {
    if (!StudentDOM.projectDetailsContent) return;
    if (studentProjectData) {
        StudentDOM.projectDetailsContent.innerHTML = `
            <h2 class="text-xl font-semibold text-gray-800 mb-2">${studentProjectData.title || 'N/A'}</h2>
            <p class="text-gray-600 mb-4"><strong>Description:</strong> ${studentProjectData.description || 'No description provided.'}</p>
            <p class="text-gray-600"><strong>Status:</strong> <span class="font-medium ${getStatusColor(studentProjectData.status)}">${studentProjectData.status ? studentProjectData.status.replace(/_/g, ' ') : 'N/A'}</span></p>
            <p class="text-gray-600"><strong>Start Date:</strong> ${studentProjectData.start_date ? new Date(studentProjectData.start_date).toLocaleDateString() : 'N/A'}</p>
            <p class="text-gray-600"><strong>Expected End Date:</strong> ${studentProjectData.expected_end_date ? new Date(studentProjectData.expected_end_date).toLocaleDateString() : 'N/A'}</p>
            <div class="mt-4">
                <h4 class="font-semibold text-gray-700">Overall Progress:</h4>
                <div class="w-full bg-gray-200 rounded-full h-4 mt-1">
                    <div class="bg-green-500 h-4 rounded-full" style="width: ${studentProjectData.progress_percentage || 0}%"></div>
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
        html += `
            <li class="p-4 bg-white rounded-lg shadow">
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="text-lg font-semibold text-blue-700">${meeting.title || 'Meeting'}</h3>
                        <p class="text-sm text-gray-600">With: ${meeting.supervisor?.full_name || 'Supervisor'}</p>
                    </div>
                    <span class="text-sm text-gray-500">${new Date(meeting.meeting_date).toLocaleDateString()}</span>
                </div>
                <p class="text-sm text-gray-600 mt-1">Time: ${formatTime(meeting.start_time)} - ${formatTime(meeting.end_time)}</p>
                <p class="text-sm text-gray-600">Location: ${meeting.location || 'N/A'}</p>
                ${meeting.notes ? `<p class="mt-2 text-sm text-gray-500 bg-gray-50 p-2 rounded"><strong>Notes:</strong> ${meeting.notes}</p>` : ''}
                ${meeting.student_summary ? `<p class="mt-2 text-sm text-gray-500 bg-blue-50 p-2 rounded"><strong>Your Summary:</strong> ${meeting.student_summary}</p>` : ''}
                ${meeting.supervisor_feedback ? `<p class="mt-2 text-sm text-gray-500 bg-green-50 p-2 rounded"><strong>Supervisor Feedback:</strong> ${meeting.supervisor_feedback}</p>` : ''}
                 <div class="mt-3 text-right">
                    ${!meeting.student_summary ? `<button data-meeting-id="${meeting.id}" class="add-meeting-summary-btn text-sm bg-yellow-500 hover:bg-yellow-600 text-white py-1 px-3 rounded-md">Add Summary</button>` : ''}
                </div>
            </li>
        `;
    });
    html += '</ul>';
    StudentDOM.meetingsListContent.innerHTML = html;

    // Add event listeners for "Add Summary" buttons
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
                        <p class="text-sm text-gray-600">Type: ${submission.submission_type || 'N/A'}</p>
                    </div>
                    <span class="text-sm text-gray-500">Submitted: ${new Date(submission.submission_date).toLocaleDateString()}</span>
                </div>
                <p class="text-sm text-gray-600 mt-1">Status: <span class="font-medium ${getStatusColor(submission.status)}">${submission.status ? submission.status.replace(/_/g, ' ') : 'N/A'}</span></p>
                ${submission.description ? `<p class="mt-2 text-sm text-gray-500 bg-gray-50 p-2 rounded"><strong>Description:</strong> ${submission.description}</p>` : ''}
                ${submission.supervisor_feedback ? `<p class="mt-2 text-sm text-gray-500 bg-yellow-50 p-2 rounded"><strong>Feedback:</strong> ${submission.supervisor_feedback}</p>` : ''}
                ${submission.grade ? `<p class="mt-1 text-sm text-gray-600"><strong>Grade:</strong> ${submission.grade}</p>` : ''}
                </li>
        `;
    });
    html += '</ul>';
    StudentDOM.submissionsListContent.innerHTML = html;
}

function populateNotificationsSection() {
    if (!StudentDOM.notificationsListContent) return;

    // Fetch all notifications (read and unread) for display in this section
    studentSupabaseClient.from('notifications')
        .select('*')
        .eq('user_id', studentCurrentUser.id)
        .order('created_at', { ascending: false })
        .limit(20) // Display recent 20
        .then(({ data, error }) => {
            if (error) {
                console.error("Error fetching all notifications for display:", error);
                StudentDOM.notificationsListContent.innerHTML = '<p class="text-red-500">Could not load notifications.</p>';
                return;
            }
            const allNotifications = data || [];
            if (allNotifications.length === 0) {
                StudentDOM.notificationsListContent.innerHTML = '<p class="text-gray-500">No notifications.</p>';
                return;
            }

            let html = '';
            allNotifications.forEach(notification => {
                html += `
                    <div class="p-3 rounded-md ${notification.is_read ? 'bg-gray-100' : 'bg-blue-50 border border-blue-200'}">
                        <div class="flex justify-between items-center mb-1">
                            <h4 class="font-semibold ${notification.is_read ? 'text-gray-700' : 'text-blue-700'}">${notification.title}</h4>
                            <span class="text-xs text-gray-500">${new Date(notification.created_at).toLocaleString()}</span>
                        </div>
                        <p class="text-sm ${notification.is_read ? 'text-gray-600' : 'text-blue-600'}">${notification.message}</p>
                        ${!notification.is_read ? `<button data-notification-id="${notification.id}" class="mark-single-notification-read-btn text-xs text-blue-500 hover:underline mt-1">Mark as read</button>` : ''}
                    </div>
                `;
            });
            StudentDOM.notificationsListContent.innerHTML = html;

            document.querySelectorAll('.mark-single-notification-read-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const notificationId = e.target.dataset.notificationId;
                    await markNotificationAsRead(notificationId, true); // true to also refresh list
                });
            });
        });
}


function populateProfileSection() {
    if (!StudentDOM.studentProfileContent || !studentProfileData) {
         if(StudentDOM.studentProfileContent) StudentDOM.studentProfileContent.innerHTML = '<p class="text-gray-600">Your profile details could not be loaded.</p>';
        return;
    }
    StudentDOM.studentProfileContent.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div class="md:col-span-1 flex flex-col items-center">
                ${studentProfileData.avatar_url ? `<img src="${studentProfileData.avatar_url}" alt="Profile" class="w-32 h-32 rounded-full object-cover mb-4 shadow-md">` : 
                `<div class="w-32 h-32 rounded-full bg-blue-500 text-white flex items-center justify-center text-4xl font-semibold mb-4 shadow-md">${(studentProfileData.first_name ? studentProfileData.first_name[0] : '') + (studentProfileData.last_name ? studentProfileData.last_name[0] : '')}</div>`}
                <h3 class="text-2xl font-semibold text-gray-800">${studentProfileData.first_name || ''} ${studentProfileData.last_name || ''}</h3>
                <p class="text-gray-600">${studentCurrentUser.email}</p>
                <button id="editProfileBtn" class="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md text-sm">Edit Profile</button>
            </div>
            <div class="md:col-span-2 space-y-3">
                <p><strong>Student ID:</strong> ${studentProfileData.student_system_id || 'N/A'}</p>
                <p><strong>Program:</strong> ${studentProfileData.program?.name || 'N/A'}</p>
                <p><strong>Department:</strong> ${studentProfileData.department?.name || 'N/A'}</p>
                <p><strong>Year of Study:</strong> ${studentProfileData.year_of_study || 'N/A'}</p>
                <p><strong>Enrollment Date:</strong> ${studentProfileData.enrollment_date ? new Date(studentProfileData.enrollment_date).toLocaleDateString() : 'N/A'}</p>
                <p><strong>Expected Completion:</strong> ${studentProfileData.expected_completion_date ? new Date(studentProfileData.expected_completion_date).toLocaleDateString() : 'N/A'}</p>
                <p><strong>Contact Number:</strong> ${studentProfileData.phone_number || 'N/A'}</p>
            </div>
        </div>
    `;
    // Add event listener for edit profile button if it exists
    const editProfileBtn = document.getElementById('editProfileBtn');
    if(editProfileBtn) editProfileBtn.addEventListener('click', openEditProfileModal);
}


// --- Event Listeners & UI Interaction ---
function setupStudentEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.id.replace('nav-', '') + '-content';
            document.querySelectorAll('.content-section').forEach(section => section.classList.add('hidden'));
            const activeSection = document.getElementById(targetId);
            if (activeSection) activeSection.classList.remove('hidden');

            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active-nav', 'bg-blue-700')); // Assuming active-nav handles all active styles
            link.classList.add('active-nav', 'bg-blue-700');


            if (StudentDOM.pageTitle) StudentDOM.pageTitle.textContent = link.textContent.trim().replace(/Notifications\s*\d*/, 'Notifications');

            // If navigating to notifications, refresh them to get latest read/unread status for display
            if (targetId === 'notifications-content') {
                populateNotificationsSection(); // This fetches all for display
            }
        });
    });

    // Logout
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            if (window.auth && window.auth.signOut) {
                await window.auth.signOut(); // script.js handles redirection
            }
        });
    }

    // Modal general listeners
    if (StudentDOM.closeModalBtn) StudentDOM.closeModalBtn.addEventListener('click', closeModal);
    if (StudentDOM.modalCancelBtn) StudentDOM.modalCancelBtn.addEventListener('click', closeModal);
    if (StudentDOM.formModal) StudentDOM.formModal.addEventListener('click', (e) => { if(e.target === StudentDOM.formModal) closeModal();});


    // Specific button listeners
    if (StudentDOM.requestMeetingBtn) StudentDOM.requestMeetingBtn.addEventListener('click', openRequestMeetingModal);
    if (StudentDOM.newSubmissionBtn) StudentDOM.newSubmissionBtn.addEventListener('click', openNewSubmissionModal);
    if (StudentDOM.markAllNotificationsReadBtn) StudentDOM.markAllNotificationsReadBtn.addEventListener('click', markAllStudentNotificationsAsRead);

}

function setupRealtimeStudentSubscriptions() {
    if (!studentSupabaseClient || !studentCurrentUser) return;

    // Notifications for this student
    studentSupabaseClient.channel(`student_notifications_${studentCurrentUser.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${studentCurrentUser.id}` }, payload => {
            console.log('student.js: Realtime new notification:', payload.new);
            showStudentToast(`New notification: ${payload.new.title}`, 'info');
            fetchStudentNotifications(); // Refresh badge and list if on notifications page
            if(document.getElementById('notifications-content')?.classList.contains('hidden') === false) {
                populateNotificationsSection(); // If on notifications page, refresh its content
            }
        })
        .subscribe();

    // Updates to student's project (example)
    if (studentProfileData && studentProfileData.project_id) {
        studentSupabaseClient.channel(`student_project_${studentProfileData.project_id}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'projects', filter: `id=eq.${studentProfileData.project_id}` }, payload => {
                console.log('student.js: Realtime project update:', payload.new);
                showStudentToast('Your project details have been updated.', 'info');
                fetchStudentProjectData().then(populateDashboardSummary).then(populateMyProjectSection);
            })
            .subscribe();
    }
    // Add more subscriptions as needed (e.g., for meetings, submissions status changes)
     // Meetings involving this student
    if (studentProfileData) { // studentProfileData.id is the ID from the 'students' table
        studentSupabaseClient.channel(`student_meetings_${studentProfileData.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'meetings', filter: `student_id=eq.${studentProfileData.id}` }, payload => {
                console.log('student.js: Realtime meeting update/insert/delete:', payload);
                showStudentToast('A meeting has been updated or scheduled.', 'info');
                fetchStudentMeetingsData().then(populateMeetingsSection).then(populateDashboardSummary);
            })
            .subscribe();
    }
}


// --- Modal Handling ---
function openModal(title, formHtml, submitHandler) {
    if (!StudentDOM.formModal || !StudentDOM.modalTitle || !StudentDOM.modalFormContent || !StudentDOM.modalForm) return;
    StudentDOM.modalTitle.textContent = title;
    StudentDOM.modalFormContent.innerHTML = formHtml;
    StudentDOM.formModal.style.display = 'flex'; // Use flex for centering

    // Clone and replace the submit button to remove old event listeners
    const oldSubmitBtn = StudentDOM.modalSubmitBtn;
    const newSubmitBtn = oldSubmitBtn.cloneNode(true);
    oldSubmitBtn.parentNode.replaceChild(newSubmitBtn, oldSubmitBtn);
    StudentDOM.modalSubmitBtn = newSubmitBtn; // Update cache

    StudentDOM.modalSubmitBtn.onclick = async (e) => { // Use onclick for simplicity here, or manage add/removeEventListener
        e.preventDefault();
        const formData = new FormData(StudentDOM.modalForm);
        const data = Object.fromEntries(formData.entries());
        showLoading('Submitting...');
        try {
            await submitHandler(data);
            closeModal();
        } catch (error) {
            console.error("Modal submission error:", error);
            handleStudentError(`Submission failed: ${error.message}`);
        } finally {
            hideLoading();
        }
    };
}

function closeModal() {
    if (StudentDOM.formModal) StudentDOM.formModal.style.display = 'none';
    if (StudentDOM.modalForm) StudentDOM.modalForm.reset();
    if (StudentDOM.modalFormContent) StudentDOM.modalFormContent.innerHTML = ''; // Clear content
}

function openRequestMeetingModal() {
    if (!studentProfileData || !studentProfileData.supervisor_id) {
        handleStudentError("Cannot request meeting: Supervisor information missing.");
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
        // Add student_id and supervisor_id to data if not already there via hidden fields
        data.student_id = studentProfileData.id;
        data.supervisor_id = studentProfileData.supervisor_id;
        data.status = 'pending_supervisor_approval'; // Initial status for student request
        data.meeting_date = null; // Supervisor will set this
        data.start_time = null;
        data.end_time = null;


        const { error } = await studentSupabaseClient.from('meetings').insert(data);
        if (error) throw error;
        showStudentToast('Meeting request sent successfully!', 'success');
        fetchStudentMeetingsData().then(populateMeetingsSection); // Refresh meetings list
    });
}

function openNewSubmissionModal() {
    if (!studentProfileData || !studentProfileData.project_id) {
        handleStudentError("Cannot make submission: Project information missing.");
        return;
    }
    const formHtml = `
        <div class="mb-4">
            <label for="submissionTitle" class="block text-sm font-medium text-gray-700">Title/Milestone</label>
            <input type="text" name="title" id="submissionTitle" class="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" required>
        </div>
        <div class="mb-4">
            <label for="submissionType" class="block text-sm font-medium text-gray-700">Type</label>
            <select name="submission_type" id="submissionType" class="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md">
                <option value="draft_chapter">Draft Chapter</option>
                <option value="literature_review">Literature Review</option>
                <option value="research_proposal">Research Proposal</option>
                <option value="progress_report">Progress Report</option>
                <option value="final_thesis_draft">Final Thesis Draft</option>
                <option value="ethics_form">Ethics Form</option>
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
            <p class="text-xs text-gray-500 mt-1">Max file size: 5MB per file. Allowed types: PDF, DOCX, ZIP.</p>
        </div>
        <input type="hidden" name="student_id" value="${studentProfileData.id}">
        <input type="hidden" name="project_id" value="${studentProfileData.project_id}">
        <input type="hidden" name="status" value="submitted">
    `;
    openModal('New Submission', formHtml, async (data) => {
        const files = document.getElementById('submissionFiles').files;
        data.submission_date = new Date().toISOString();
        data.student_id = studentProfileData.id; // from 'students' table
        data.project_id = studentProfileData.project_id;
        data.status = 'submitted';

        // 1. Insert submission record
        const { data: submissionResult, error: submissionError } = await studentSupabaseClient
            .from('submissions')
            .insert(data)
            .select() // Important to get the ID of the new submission
            .single();

        if (submissionError) throw submissionError;
        const submissionId = submissionResult.id;

        // 2. Handle file uploads if any
        if (files.length > 0 && submissionId) {
            showLoading('Uploading files...');
            for (const file of files) {
                // Basic validation (enhance as needed)
                if (file.size > 5 * 1024 * 1024) {
                    handleStudentError(`File ${file.name} is too large (max 5MB).`);
                    continue;
                }
                const filePath = `submissions/${studentCurrentUser.id}/${submissionId}/${file.name}`;
                const { error: uploadError } = await studentSupabaseClient.storage
                    .from('submission_files') // Ensure this bucket exists and has RLS policies
                    .upload(filePath, file);

                if (uploadError) {
                    console.error(`Error uploading ${file.name}:`, uploadError);
                    handleStudentError(`Failed to upload ${file.name}.`);
                } else {
                    // Optionally, store file metadata in an 'attachments' table linked to the submission
                    await studentSupabaseClient.from('attachments').insert({
                        submission_id: submissionId,
                        file_name: file.name,
                        file_path: filePath, // Store the path for retrieval/deletion
                        file_type: file.type,
                        file_size: file.size,
                        uploaded_by: studentCurrentUser.id
                    });
                    console.log(`File ${file.name} uploaded successfully.`);
                }
            }
        }

        showStudentToast('Submission successful!', 'success');
        fetchStudentSubmissionsData().then(populateSubmissionsSection);
    });
}

function openAddMeetingSummaryModal(meetingId) {
    const meeting = studentMeetingsData.find(m => m.id === meetingId);
    if (!meeting) {
        handleStudentError("Meeting not found.");
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
        showStudentToast('Meeting summary saved!', 'success');
        fetchStudentMeetingsData().then(populateMeetingsSection);
    });
}

function openEditProfileModal() {
    if (!studentProfileData) {
        handleStudentError("Profile data not loaded. Cannot edit.");
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
            <input type="url" name="avatar_url" id="avatarUrl" value="${studentProfileData.avatar_url || ''}" class="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md">
        </div>
        `;
    openModal('Edit Your Profile', formHtml, async (data) => {
        // Filter out empty strings for optional fields to avoid overwriting with empty if not changed
        const updateData = {};
        for (const key in data) {
            if (data[key] !== '' || key === 'first_name' || key === 'last_name') { // Required fields always included
                updateData[key] = data[key];
            }
        }
        
        const { error } = await studentSupabaseClient
            .from('students')
            .update(updateData)
            .eq('id', studentProfileData.id); // Use the ID from the 'students' table
        if (error) throw error;

        // Also update auth.users user_metadata if names/avatar changed
        const metadataUpdate = {};
        if (data.first_name || data.last_name) {
            metadataUpdate.full_name = `${data.first_name || studentProfileData.first_name} ${data.last_name || studentProfileData.last_name}`.trim();
        }
        if (data.avatar_url) {
            metadataUpdate.avatar_url = data.avatar_url;
        }

        if (Object.keys(metadataUpdate).length > 0) {
            const { error: userUpdateError } = await studentSupabaseClient.auth.updateUser({ data: metadataUpdate });
            if (userUpdateError) console.warn("Error updating user metadata in auth:", userUpdateError);
        }

        showStudentToast('Profile updated successfully!', 'success');
        await fetchStudentProfileData(); // Re-fetch to get updated data
        populateStudentHeader();
        populateProfileSection();
    });
}


// --- Utility Functions ---
function showLoading(message = 'Loading...') {
    if (StudentDOM.loadingOverlay) {
        StudentDOM.loadingOverlay.querySelector('i').nextSibling.textContent = ` ${message}`;
        StudentDOM.loadingOverlay.classList.remove('hidden');
    }
}

function hideLoading() {
    if (StudentDOM.loadingOverlay) StudentDOM.loadingOverlay.classList.add('hidden');
}

function handleStudentError(message, errorObj = null) {
    console.error(`StudentDashboard Error: ${message}`, errorObj || '');
    // You can implement a more sophisticated error display, e.g., a toast notification
    alert(`Error: ${message}`); // Simple fallback
}

function showStudentToast(message, type = 'info', duration = 3000) {
    const toastId = 'studentToast';
    let toastElement = document.getElementById(toastId);
    if (!toastElement) {
        toastElement = document.createElement('div');
        toastElement.id = toastId;
        toastElement.className = 'fixed bottom-5 right-5 p-3 rounded-md shadow-lg text-white text-sm z-50 transition-opacity duration-300 ease-in-out';
        document.body.appendChild(toastElement);
    }

    toastElement.textContent = message;
    toastElement.classList.remove('bg-green-500', 'bg-red-500', 'bg-blue-500', 'opacity-0');

    if (type === 'success') toastElement.classList.add('bg-green-500');
    else if (type === 'error') toastElement.classList.add('bg-red-500');
    else toastElement.classList.add('bg-blue-500'); // Default to info

    toastElement.style.opacity = '1';

    setTimeout(() => {
        toastElement.style.opacity = '0';
        setTimeout(() => {
            if (toastElement.parentNode) { // Check if still in DOM
                 toastElement.remove();
            }
        }, 300); // Allow fade out
    }, duration);
}


function formatTime(timeString) { // HH:MM:SS or HH:MM
    if (!timeString) return 'N/A';
    const parts = timeString.split(':');
    if (parts.length < 2) return timeString; // Invalid format
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12; // Convert 0 to 12 for 12 AM/PM
    return `${displayHours}:${minutes < 10 ? '0' : ''}${minutes} ${ampm}`;
}

function getStatusColor(status) {
    // Consistent with Tailwind classes if possible, or define your own
    if (!status) return 'text-gray-600';
    status = status.toLowerCase().replace(/ /g, '_');
    if (status.includes('track') || status.includes('approved') || status.includes('completed')) return 'text-green-600';
    if (status.includes('behind') || status.includes('pending') || status.includes('review')) return 'text-yellow-600';
    if (status.includes('attention') || status.includes('rejected') || status.includes('overdue')) return 'text-red-600';
    return 'text-gray-600';
}

async function markNotificationAsRead(notificationId, refreshList = false) {
    try {
        const { error } = await studentSupabaseClient
            .from('notifications')
            .update({ is_read: true })
            .eq('id', notificationId)
            .eq('user_id', studentCurrentUser.id); // Ensure student can only mark their own

        if (error) throw error;

        // Update local badge count
        const currentCount = parseInt(StudentDOM.notificationCountBadge.textContent) || 0;
        if (currentCount > 0) {
            StudentDOM.notificationCountBadge.textContent = currentCount - 1;
        }
        if (currentCount -1 <= 0) StudentDOM.notificationCountBadge.classList.add('hidden');


        if (refreshList && document.getElementById('notifications-content')?.classList.contains('hidden') === false) {
            populateNotificationsSection(); // Refresh the list view
        } else {
            // If not on notifications page, just remove the specific button or mark visually
            const button = document.querySelector(`.mark-single-notification-read-btn[data-notification-id="${notificationId}"]`);
            if (button) {
                button.closest('.p-3').classList.remove('bg-blue-50', 'border-blue-200');
                button.closest('.p-3').classList.add('bg-gray-100');
                button.remove();
            }
        }
         showStudentToast('Notification marked as read.', 'success');

    } catch (error) {
        console.error("Error marking notification as read:", error);
        handleStudentError("Could not mark notification as read.");
    }
}

async function markAllStudentNotificationsAsRead() {
    if (!studentCurrentUser || !studentSupabaseClient) return;
    showLoading("Marking all as read...");
    try {
        const { error } = await studentSupabaseClient
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', studentCurrentUser.id)
            .eq('is_read', false); // Only update unread ones

        if (error) throw error;

        if (StudentDOM.notificationCountBadge) {
            StudentDOM.notificationCountBadge.textContent = '0';
            StudentDOM.notificationCountBadge.classList.add('hidden');
        }
        // Refresh the notifications list if currently visible
        if (document.getElementById('notifications-content')?.classList.contains('hidden') === false) {
            populateNotificationsSection();
        }
        showStudentToast('All notifications marked as read.', 'success');
    } catch (error) {
        console.error("Error marking all notifications as read:", error);
        handleStudentError("Could not mark all notifications as read.");
    } finally {
        hideLoading();
    }
}


// --- Global Invocation ---
// script.js should ideally control when initializeStudentDashboard is called
// after auth state is confirmed and routing to student page is done.
// Expose it globally for script.js to call.
window.initializeStudentPage = initializeStudentDashboard;

// Fallback or direct call if script.js doesn't manage it:
document.addEventListener('DOMContentLoaded', () => {
    console.log('student.js: DOMContentLoaded.');
    // Check if auth is ready, if so, and on student page, initialize
    // This is a fallback; script.js should be the primary controller.
    if (window.auth && window.auth.getCurrentUser() && window.location.pathname.includes('student.html')) { // Or more robust path check
        console.log('student.js: DOMContentLoaded, user & auth ready, on student page. Initializing...');
        initializeStudentDashboard();
    } else {
         console.log('student.js: DOMContentLoaded. Waiting for script.js to initialize or auth events.');
    }
});

// Listen for auth readiness from auth.js
document.addEventListener(window.auth?.AuthEvents?.AUTH_MODULE_READY || 'authModuleReady', (event) => {
    console.log('student.js: AuthModuleReady event received.', event.detail);
    if (event.detail && event.detail.success) {
        // Check if current page is student dashboard before initializing
        if (window.location.pathname.includes('student.html')) { // Adjust path as needed
            console.log('student.js: Auth ready and on student page, attempting to initialize dashboard.');
            initializeStudentDashboard();
        }
    } else {
        console.error('student.js: Auth module failed to initialize. Student dashboard cannot proceed.');
        handleStudentError('Authentication services failed to load. Dashboard cannot be displayed.');
    }
});