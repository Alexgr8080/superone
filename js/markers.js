// markers.js - Logic for the Markers Dashboard

// --- Module State --- 
let markSupabaseClient = null;
let markCurrentUser = null;
let markUserOrgData = null; // { organization: {id, name}, roles: [{id, name}] }
let markMarkerProfile = null; // Data from public.markers table
let markModuleInitialized = false;

// --- DOM Element Cache --- 
const MarkerDOM = {
    userNameDisplay: null,
    userAvatar: null,
    portalType: null, // "Marker Portal"
    notificationCountBadge: null,

    // Overview Stats
    totalAssignmentsStat: null,
    pendingMarkingStat: null,
    completedMarkingStat: null,

    // Assignments Section
    assignmentsContainer: null,

    // Moderation Section
    moderationContainer: null,

    // Feedback Templates Section
    feedbackTemplatesContainer: null,

    // Profile Section
    profileContainer: null
};

// --- Marker Dashboard Initialization --- 
async function initializeMarkerDashboard() {
    try {
        console.log('markers.js: Initializing marker dashboard...');
        
        // Get Supabase client
        markSupabaseClient = getSupabaseClient();
        
        // Check authentication
        const { data: { user }, error } = await markSupabaseClient.auth.getUser();
        
        if (error || !user) {
            window.location.href = PathConfig.LOGIN;
            return;
        }
        
        markCurrentUser = user;
        
        // Cache DOM Elements
        cacheMarkerDOMElements();
        
        // Get user's organization and roles
        const orgData = await getUserOrganizationData();
        if (!orgData) {
            console.error('markers.js: Failed to get user organization data');
            return;
        }
        
        markUserOrgData = orgData;
        
        // Display user info
        displayUserInfo();
        
        // Get marker profile
        await getMarkerProfile();
        
        // Load dashboard data
        await loadDashboardData();
        
        // Setup event listeners
        setupEventListeners();
        
        markModuleInitialized = true;
        console.log('markers.js: Marker dashboard initialized');
        
    } catch (err) {
        console.error('markers.js: Error initializing marker dashboard:', err);
    }
}

// --- Helper Functions ---

function cacheMarkerDOMElements() {
    MarkerDOM.userNameDisplay = document.getElementById('user-name');
    MarkerDOM.userAvatar = document.getElementById('user-avatar');
    MarkerDOM.portalType = document.getElementById('portal-type');
    MarkerDOM.notificationCountBadge = document.getElementById('notification-count');
    
    MarkerDOM.totalAssignmentsStat = document.querySelector('.total-assignments-count');
    MarkerDOM.pendingMarkingStat = document.querySelector('.pending-marking-count');
    MarkerDOM.completedMarkingStat = document.querySelector('.completed-marking-count');
    
    MarkerDOM.assignmentsContainer = document.getElementById('assignments-section');
    MarkerDOM.moderationContainer = document.getElementById('moderation-section');
    MarkerDOM.feedbackTemplatesContainer = document.getElementById('feedback-templates-section');
    MarkerDOM.profileContainer = document.getElementById('profile-section');
}

function displayUserInfo() {
    if (markCurrentUser && MarkerDOM.userNameDisplay) {
        MarkerDOM.userNameDisplay.textContent = markCurrentUser.user_metadata.full_name || markCurrentUser.email;
    }
    
    if (MarkerDOM.portalType) {
        MarkerDOM.portalType.textContent = "Marker Portal";
    }
    
    // Set notification count (placeholder)
    if (MarkerDOM.notificationCountBadge) {
        MarkerDOM.notificationCountBadge.textContent = "0";
    }
}

async function getMarkerProfile() {
    try {
        const { data, error } = await markSupabaseClient
            .from('markers')
            .select('*')
            .eq('user_id', markCurrentUser.id)
            .single();
            
        if (error) throw error;
        
        markMarkerProfile = data;
        return data;
    } catch (err) {
        console.error('markers.js: Error fetching marker profile:', err);
        return null;
    }
}

async function loadDashboardData() {
    await Promise.all([
        loadMarkingStats(),
        loadAssignmentsList(),
        loadModerationList()
    ]);
}

async function loadMarkingStats() {
    try {
        // Total assignments
        const { data: totalData, error: totalError } = await markSupabaseClient
            .from('thesis_marking')
            .select('id')
            .eq('marker_id', markMarkerProfile.id);
            
        if (totalError) throw totalError;
        
        if (MarkerDOM.totalAssignmentsStat) {
            MarkerDOM.totalAssignmentsStat.textContent = totalData.length || '0';
        }
        
        // Pending marking
        const { data: pendingData, error: pendingError } = await markSupabaseClient
            .from('thesis_marking')
            .select('id')
            .eq('marker_id', markMarkerProfile.id)
            .in('status', ['pending', 'in_progress']);
            
        if (pendingError) throw pendingError;
        
        if (MarkerDOM.pendingMarkingStat) {
            MarkerDOM.pendingMarkingStat.textContent = pendingData.length || '0';
        }
        
        // Completed marking
        const { data: completedData, error: completedError } = await markSupabaseClient
            .from('thesis_marking')
            .select('id')
            .eq('marker_id', markMarkerProfile.id)
            .eq('status', 'completed');
            
        if (completedError) throw completedError;
        
        if (MarkerDOM.completedMarkingStat) {
            MarkerDOM.completedMarkingStat.textContent = completedData.length || '0';
        }
    } catch (err) {
        console.error('markers.js: Error loading marking stats:', err);
    }
}

async function loadAssignmentsList() {
    try {
        const { data, error } = await markSupabaseClient
            .from('thesis_marking')
            .select(`
                id,
                status,
                thesis_submissions (
                    id,
                    title,
                    abstract,
                    students (
                        id,
                        user_id,
                        users (
                            id,
                            user_metadata
                        )
                    )
                ),
                created_at
            `)
            .eq('marker_id', markMarkerProfile.id)
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        
        if (MarkerDOM.assignmentsContainer && data) {
            const assignmentsList = document.createElement('div');
            assignmentsList.className = 'assignments-list';
            
            if (data.length === 0) {
                assignmentsList.innerHTML = '<p>No assignments found</p>';
            } else {
                data.forEach(assignment => {
                    const submission = assignment.thesis_submissions;
                    const student = submission?.students;
                    const studentName = student?.users?.user_metadata?.full_name || 'Unknown Student';
                    
                    const assignmentCard = document.createElement('div');
                    assignmentCard.className = `card assignment-card ${assignment.status}`;
                    
                    let statusBadgeClass = 'badge-secondary';
                    let statusText = 'Unknown';
                    
                    switch(assignment.status) {
                        case 'pending':
                            statusBadgeClass = 'badge-warning';
                            statusText = 'Pending';
                            break;
                        case 'in_progress':
                            statusBadgeClass = 'badge-info';
                            statusText = 'In Progress';
                            break;
                        case 'completed':
                            statusBadgeClass = 'badge-success';
                            statusText = 'Completed';
                            break;
                    }
                    
                    const assignmentDate = new Date(assignment.created_at).toLocaleDateString();
                    
                    assignmentCard.innerHTML = `
                        <div class="card-header">
                            <span class="badge ${statusBadgeClass}">${statusText}</span>
                            <h5 class="card-title">${submission.title}</h5>
                        </div>
                                               <div class="card-body">
                            <p><strong>Student:</strong> ${studentName}</p>
                            <p><strong>Assigned:</strong> ${assignmentDate}</p>
                            <p class="abstract-preview">${submission.abstract ? submission.abstract.substring(0, 100) + '...' : 'No abstract provided'}</p>
                        </div>
                        <div class="card-footer">
                            <a href="/thesis-marking.html?id=${assignment.id}" class="btn btn-primary">
                                ${assignment.status === 'completed' ? 'Review Marking' : 'Start Marking'}
                            </a>
                        </div>
                    `;
                    
                    assignmentsList.appendChild(assignmentCard);
                });
            }
            
            MarkerDOM.assignmentsContainer.innerHTML = '<h3>My Assignments</h3>';
            MarkerDOM.assignmentsContainer.appendChild(assignmentsList);
        }
    } catch (err) {
        console.error('markers.js: Error loading assignments list:', err);
        if (MarkerDOM.assignmentsContainer) {
            MarkerDOM.assignmentsContainer.innerHTML = '<h3>My Assignments</h3><p>Failed to load assignments</p>';
        }
    }
}

async function loadModerationList() {
    try {
        // Load submissions that need moderation
        // This is for second markers or moderators to review
        const { data, error } = await markSupabaseClient
            .from('thesis_marking')
            .select(`
                id,
                thesis_submissions (
                    id,
                    title,
                    students (
                        id,
                        user_id,
                        users (
                            id,
                            user_metadata
                        )
                    )
                ),
                markers (
                    id,
                    user_id,
                    users (
                        id,
                        user_metadata
                    )
                ),
                grade,
                status,
                created_at
            `)
            .eq('status', 'completed')
            .neq('marker_id', markMarkerProfile.id)
            .order('created_at', { ascending: false })
            .limit(5);
            
        if (error) throw error;
        
        if (MarkerDOM.moderationContainer && data) {
            const moderationList = document.createElement('div');
            moderationList.className = 'moderation-list';
            
            if (data.length === 0) {
                moderationList.innerHTML = '<p>No submissions to moderate</p>';
            } else {
                data.forEach(marking => {
                    const submission = marking.thesis_submissions;
                    const student = submission?.students;
                    const studentName = student?.users?.user_metadata?.full_name || 'Unknown Student';
                    const markerName = marking.markers?.users?.user_metadata?.full_name || 'Unknown Marker';
                    
                    const moderationCard = document.createElement('div');
                    moderationCard.className = 'card moderation-card';
                    
                    moderationCard.innerHTML = `
                        <div class="card-header">
                            <h5 class="card-title">${submission.title}</h5>
                        </div>
                        <div class="card-body">
                            <p><strong>Student:</strong> ${studentName}</p>
                            <p><strong>Primary Marker:</strong> ${markerName}</p>
                            <p><strong>Grade Assigned:</strong> ${marking.grade || 'Not graded'}</p>
                        </div>
                        <div class="card-footer">
                            <a href="/thesis-moderation.html?id=${marking.id}" class="btn btn-primary">Review</a>
                        </div>
                    `;
                    
                    moderationList.appendChild(moderationCard);
                });
            }
            
            MarkerDOM.moderationContainer.innerHTML = '<h3>Submissions to Moderate</h3>';
            MarkerDOM.moderationContainer.appendChild(moderationList);
        }
    } catch (err) {
        console.error('markers.js: Error loading moderation list:', err);
        if (MarkerDOM.moderationContainer) {
            MarkerDOM.moderationContainer.innerHTML = '<h3>Submissions to Moderate</h3><p>Failed to load moderation list</p>';
        }
    }
}

async function loadFeedbackTemplates() {
    // Implement feedback templates functionality
    // This could be a way for markers to save and reuse common feedback
    if (MarkerDOM.feedbackTemplatesContainer) {
        MarkerDOM.feedbackTemplatesContainer.innerHTML = `
            <h3>Feedback Templates</h3>
            <p>Create reusable feedback templates to speed up the marking process.</p>
            <div class="templates-list">
                <p>Feature under development</p>
            </div>
            <button class="btn btn-outline-primary" disabled>Create New Template</button>
        `;
    }
}

function setupEventListeners() {
    // Add event listeners for filters, sorting, etc.
    const filterButtons = document.querySelectorAll('.filter-btn');
    if (filterButtons) {
        filterButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const filter = e.target.dataset.filter;
                filterAssignments(filter);
            });
        });
    }
    
    // Profile section functionality
    if (MarkerDOM.profileContainer) {
        const profileForm = MarkerDOM.profileContainer.querySelector('form');
        if (profileForm) {
            profileForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await updateMarkerProfile(new FormData(profileForm));
            });
        }
    }
}

function filterAssignments(filter) {
    const assignmentCards = document.querySelectorAll('.assignment-card');
    if (!assignmentCards.length) return;
    
    assignmentCards.forEach(card => {
        if (filter === 'all') {
            card.style.display = 'block';
        } else {
            if (card.classList.contains(filter)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        }
    });
}

async function updateMarkerProfile(formData) {
    try {
        const profileData = {
            department: formData.get('department'),
            areas_of_expertise: formData.get('expertise').split(',').map(area => area.trim()),
            updated_at: new Date().toISOString()
        };
        
        const { error } = await markSupabaseClient
            .from('markers')
            .update(profileData)
            .eq('id', markMarkerProfile.id);
            
        if (error) throw error;
        
        alert('Profile updated successfully');
        
        // Refresh marker profile data
        await getMarkerProfile();
    } catch (err) {
        console.error('markers.js: Error updating marker profile:', err);
        alert('Failed to update profile');
    }
}

// Initialize the dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check if we're on the markers dashboard page
    if (window.location.pathname.includes('markers.html')) {
        initializeMarkerDashboard();
    }
});
