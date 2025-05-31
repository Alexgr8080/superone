/ committee.js - Committee dashboard and thesis evaluation functionality
// Fixed version with proper database connections and error handling

// --- Module State ---
let committeeSupabaseClient = null;
let committeeCurrentUser = null;
let committeeUserRoles = [];
let committeeCurrentOrganization = null;
let committeeModuleInitialized = false;
let committeeLoadingState = false;

// Thesis review data 
let pendingTheses = [];
let reviewedTheses = [];
let currentThesisDetails = null;
let currentEvaluation = {
    thesis_id: null,
    scores: {},
    comments: {},
    overall_score: null,
    overall_comment: '',
    recommendation: 'pending'
};

const evaluationCriteria = [
    { id: 'originality', name: 'Originality & Innovation', maxScore: 10 },
    { id: 'methodology', name: 'Research Methodology', maxScore: 10 },
    { id: 'analysis', name: 'Data Analysis & Interpretation', maxScore: 10 },
    { id: 'literature', name: 'Literature Review', maxScore: 10 },
    { id: 'structure', name: 'Structure & Organization', maxScore: 10 },
    { id: 'presentation', name: 'Presentation & Clarity', maxScore: 10 },
    { id: 'conclusion', name: 'Conclusions & Impact', maxScore: 10 }
];

// DOM Elements cache
const CommitteeDOM = {
    dashboardContainer: null,
    pendingThesesContainer: null,
    pendingThesesCount: null,
    reviewedThesesContainer: null, 
    reviewedThesesCount: null,
    thesisDetailsContainer: null,
    evaluationFormContainer: null,
    userNameDisplay: null,
    loadingOverlay: null,
    notificationBadge: null,
    searchInput: null,
    statusFilter: null,
    evaluationSubmitBtn: null,
    evaluationSaveBtn: null,
    overallScoreDisplay: null,
    criteriaScoreInputs: {},
    criteriaCommentInputs: {}
};

// --- Initialization Functions ---

async function initializeCommitteeModule() {
    console.log('committee.js: Initializing committee module...');
    try {
        if (committeeModuleInitialized) {
            console.log('committee.js: Committee module already initialized');
            return;
        }
        
        showLoading('Initializing committee dashboard...');
        cacheCommitteeDOMElements();
        
        // Get Supabase client using the common function
        committeeSupabaseClient = getSupabaseClient();
        
        if (!committeeSupabaseClient) {
            console.warn('committee.js: Supabase client not immediately available. Waiting for connection event.');
            // This function will be called again when the Supabase connection is ready
            return;
        }
        
        // Check authentication
        const { data: { user }, error: userError } = await committeeSupabaseClient.auth.getUser();
        if (userError || !user) {
            console.error('committee.js: Authentication error', userError);
            hideLoading();
            displayErrorMessage('User not authenticated. Please log in.');
            window.location.href = '/login.html';
            return;
        }
        
        committeeCurrentUser = user;
        await loadCommitteeUserData();
        
        if (!verifyCommitteeAccess()) {
            hideLoading();
            displayErrorMessage('You do not have committee access.');
            window.location.href = '/index.html';
            return;
        }
        
        setupEventListeners();
        await loadDashboardData();
        
        committeeModuleInitialized = true;
        hideLoading();
        console.log('committee.js: Committee module initialized successfully');
    } catch (error) {
        console.error('committee.js: Error initializing committee module:', error);
        displayErrorMessage(`Failed to initialize committee dashboard: ${error.message}`);
        hideLoading();
    }
}

function cacheCommitteeDOMElements() {
    try {
        CommitteeDOM.dashboardContainer = document.getElementById('committee-dashboard');
        CommitteeDOM.pendingThesesContainer = document.getElementById('pending-theses-list');
        CommitteeDOM.pendingThesesCount = document.getElementById('pending-theses-count');
        CommitteeDOM.reviewedThesesContainer = document.getElementById('reviewed-theses-list');
        CommitteeDOM.reviewedThesesCount = document.getElementById('reviewed-theses-count');
        CommitteeDOM.thesisDetailsContainer = document.getElementById('thesis-details-container');
        CommitteeDOM.evaluationFormContainer = document.getElementById('evaluation-form-container');
        CommitteeDOM.userNameDisplay = document.querySelector('.user-name');
        CommitteeDOM.loadingOverlay = document.getElementById('loadingOverlay') || createLoadingOverlay();
        CommitteeDOM.notificationBadge = document.querySelector('.notification-badge');
        CommitteeDOM.searchInput = document.getElementById('search-thesis');
        CommitteeDOM.statusFilter = document.getElementById('status-filter');
        CommitteeDOM.evaluationSubmitBtn = document.getElementById('submit-evaluation');
        CommitteeDOM.evaluationSaveBtn = document.getElementById('save-evaluation');
        CommitteeDOM.overallScoreDisplay = document.getElementById('overall-score');
        
        // Initialize criteria inputs cache
        evaluationCriteria.forEach(criterion => {
            CommitteeDOM.criteriaScoreInputs[criterion.id] = document.getElementById(`score-${criterion.id}`);
            CommitteeDOM.criteriaCommentInputs[criterion.id] = document.getElementById(`comment-${criterion.id}`);
        });
        
        console.log('committee.js: DOM elements cached successfully');
    } catch (error) {
        console.error('committee.js: Error caching DOM elements:', error);
    }
}

function createLoadingOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'loadingOverlay';
    overlay.className = 'loading-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '10000';
    overlay.innerHTML = `<div class="spinner-content" style="text-align: center; color: white;">
                          <div class="spinner-border text-primary" role="status"></div>
                          <p class="mt-2">Loading...</p>
                        </div>`;
    document.body.appendChild(overlay);
    return overlay;
}

async function loadCommitteeUserData() {
    try {
        if (!committeeCurrentUser || !committeeCurrentUser.id) {
            throw new Error('Current user not available');
        }
        
        // Fetch user roles
        const { data: userRoles, error: rolesError } = await committeeSupabaseClient
            .from('user_roles')
            .select('*, roles(*)')
            .eq('user_id', committeeCurrentUser.id);
            
        if (rolesError) throw rolesError;
        
        committeeUserRoles = userRoles.map(ur => ({
            ...ur,
            roleName: ur.roles?.name || 'Unknown Role'
        }));
        
        // Check if user has committee role
        const isCommittee = committeeUserRoles.some(role => 
            role.roleName.toLowerCase().includes('committee') || 
            role.permissions?.includes('committee_access'));
            
        if (!isCommittee) {
            console.warn('User does not have committee role');
        }
        
        // Fetch organization data
        let organizationId = committeeCurrentUser.user_metadata?.organization_id;
        
        if (organizationId) {
            const { data: org, error: orgError } = await committeeSupabaseClient
                .from('organizations')
                .select('*')
                .eq('id', organizationId)
                .single();
                
            if (orgError) throw orgError;
            committeeCurrentOrganization = org;
        } else {
            // Try to find organization through user-organization relationship
            const { data: orgUserData, error: orgUserError } = await committeeSupabaseClient
                .from('organization_users')
                .select('organization_id, organizations(*)')
                .eq('user_id', committeeCurrentUser.id)
                .maybeSingle();
                
            if (orgUserError) throw orgUserError;
            
            if (orgUserData && orgUserData.organizations) {
                committeeCurrentOrganization = orgUserData.organizations;
            }
        }
        
        // Update UI with user info
        if (CommitteeDOM.userNameDisplay) {
            CommitteeDOM.userNameDisplay.textContent = committeeCurrentUser.user_metadata?.full_name || 
                                                    committeeCurrentUser.email;
        }
        
    } catch (error) {
        console.error('committee.js: Error loading user data:', error);
        throw error;
    }
}

function verifyCommitteeAccess() {
    // Check if user has committee role
    return committeeUserRoles.some(role => 
        role.roleName.toLowerCase().includes('committee') || 
        role.permissions?.includes('committee_access'));
}

function setupEventListeners() {
    try {
        // Search and filter
        CommitteeDOM.searchInput?.addEventListener('input', debounce(() => {
            filterTheses(CommitteeDOM.searchInput.value, CommitteeDOM.statusFilter?.value);
        }, 300));
        
        CommitteeDOM.statusFilter?.addEventListener('change', () => {
            filterTheses(CommitteeDOM.searchInput?.value, CommitteeDOM.statusFilter.value);
        });
        
        // Evaluation form 
        evaluationCriteria.forEach(criterion => {
            const scoreInput = CommitteeDOM.criteriaScoreInputs[criterion.id];
            if (scoreInput) {
                scoreInput.addEventListener('input', () => {
                    updateCriterionScore(criterion.id, scoreInput.value);
                });
            }
        });
        
        CommitteeDOM.evaluationSaveBtn?.addEventListener('click', () => {
            saveEvaluation(false); // Draft
        });
        
        CommitteeDOM.evaluationSubmitBtn?.addEventListener('click', () => {
            saveEvaluation(true); // Final submission
        });
        
        console.log('committee.js: Event listeners set up');
    } catch (error) {
        console.error('committee.js: Error setting up event listeners:', error);
    }
}

// --- Dashboard Data ---

async function loadDashboardData() {
    try {
        if (!committeeCurrentOrganization) {
            console.warn('committee.js: Organization data not available');
            return;
        }
        
        showLoading('Loading theses...');
        
        // Get theses assigned to this committee member
        const { data: assignedTheses, error: assignmentError } = await committeeSupabaseClient
            .from('thesis_committee_assignments')
            .select(`
                id, assigned_at, status,
                thesis:thesis_id(
                    id, title, abstract, submitted_at, status,
                    student:student_id(id, users(email, raw_user_meta_data))
                )
            `)
            .eq('committee_member_id', committeeCurrentUser.id)
            .order('assigned_at', { ascending: false });
            
        if (assignmentError) throw assignmentError;
        
        // Split into pending and reviewed
        pendingTheses = [];
        reviewedTheses = [];
        
        if (assignedTheses) {
            for (const assignment of assignedTheses) {
                if (!assignment.thesis) continue;
                
                const thesisItem = {
                    assignment_id: assignment.id,
                    assignment_status: assignment.status,
                    assigned_at: assignment.assigned_at,
                    thesis_id: assignment.thesis.id,
                    title: assignment.thesis.title,
                    abstract: assignment.thesis.abstract,
                    submitted_at: assignment.thesis.submitted_at,
                    thesis_status: assignment.thesis.status,
                    student_name: assignment.thesis.student?.users?.raw_user_meta_data?.full_name || 
                                assignment.thesis.student?.users?.email || 'Unknown Student',
                    student_email: assignment.thesis.student?.users?.email || 'No email'
                };
                
                if (assignment.status === 'reviewed' || assignment.status === 'completed') {
                    reviewedTheses.push(thesisItem);
                } else {
                    pendingTheses.push(thesisItem);
                }
            }
        }
        
        renderThesesLists();
        updateNotifications();
        hideLoading();
        
    } catch (error) {
        console.error('committee.js: Error loading dashboard data:', error);
        displayErrorMessage('Failed to load committee assignments.');
        hideLoading();
    }
}

function renderThesesLists() {
    // Render pending theses
    if (CommitteeDOM.pendingThesesContainer) {
        CommitteeDOM.pendingThesesContainer.innerHTML = '';
        
        if (pendingTheses.length === 0) {
            CommitteeDOM.pendingThesesContainer.innerHTML = 
                '<div class="alert alert-info">No pending theses for review</div>';
        } else {
            pendingTheses.forEach(thesis => {
                const thesisCard = createThesisCard(thesis, 'pending');
                CommitteeDOM.pendingThesesContainer.appendChild(thesisCard);
            });
        }
        
        if (CommitteeDOM.pendingThesesCount) {
            CommitteeDOM.pendingThesesCount.textContent = pendingTheses.length;
        }
    }
    
    // Render reviewed theses
    if (CommitteeDOM.reviewedThesesContainer) {
        CommitteeDOM.reviewedThesesContainer.innerHTML = '';
        
        if (reviewedTheses.length === 0) {
            CommitteeDOM.reviewedThesesContainer.innerHTML = 
                '<div class="alert alert-info">No reviewed theses</div>';
        } else {
            reviewedTheses.forEach(thesis => {
                const thesisCard = createThesisCard(thesis, 'reviewed');
                CommitteeDOM.reviewedThesesContainer.appendChild(thesisCard);
            });
        }
        
        if (CommitteeDOM.reviewedThesesCount) {
            CommitteeDOM.reviewedThesesCount.textContent = reviewedTheses.length;
        }
    }
}

function createThesisCard(thesis, listType) {
    const card = document.createElement('div');
    card.className = 'card mb-3';
    card.dataset.thesisId = thesis.thesis_id;
    
    let statusBadge;
    if (listType === 'pending') {
        statusBadge = `<span class="badge bg-warning">Pending Review</span>`;
    } else {
        statusBadge = `<span class="badge bg-success">Reviewed</span>`;
    }
    
    card.innerHTML = `
        <div class="card-body">
            <h5 class="card-title">${thesis.title}</h5>
            <h6 class="card-subtitle mb-2 text-muted">
                By ${thesis.student_name} ${statusBadge}
            </h6>
            <p class="card-text mb-2">
                <small>Submitted: ${new Date(thesis.submitted_at).toLocaleDateString()}</small>
            </p>
            <p class="card-text text-truncate">${thesis.abstract || 'No abstract provided'}</p>
            <button class="btn btn-primary btn-sm view-thesis" data-thesis-id="${thesis.thesis_id}">
                View Details
            </button>
            ${listType === 'pending' ? 
                `<button class="btn btn-success btn-sm evaluate-thesis" data-thesis-id="${thesis.thesis_id}">
                    Start Evaluation
                </button>` : 
                `<button class="btn btn-secondary btn-sm view-evaluation" data-thesis-id="${thesis.thesis_id}">
                    View Evaluation
                </button>`
            }
        </div>
    `;
    
    // Add event listeners to buttons
    setTimeout(() => {
        const viewBtn = card.querySelector('.view-thesis');
        viewBtn?.addEventListener('click', () => viewThesisDetails(thesis.thesis_id));
        
        if (listType === 'pending') {
            const evaluateBtn = card.querySelector('.evaluate-thesis');
            evaluateBtn?.addEventListener('click', () => startEvaluation(thesis.thesis_id));
        } else {
            const viewEvalBtn = card.querySelector('.view-evaluation');
            viewEvalBtn?.addEventListener('click', () => viewEvaluation(thesis.thesis_id));
        }
    }, 0);
    
    return card;
}

function filterTheses(searchQuery, statusFilter) {
    const normalizedQuery = (searchQuery || '').toLowerCase().trim();
    
    // Filter and render pending
    const filteredPending = pendingTheses.filter(thesis => {
        const matchesSearch = !normalizedQuery || 
            thesis.title.toLowerCase().includes(normalizedQuery) ||
            thesis.abstract?.toLowerCase().includes(normalizedQuery) ||
            thesis.student_name.toLowerCase().includes(normalizedQuery);
            
        return matchesSearch;
    });
    
    // Filter and render reviewed
    const filteredReviewed = reviewedTheses.filter(thesis => {
        const matchesSearch = !normalizedQuery || 
            thesis.title.toLowerCase().includes(normalizedQuery) ||
            thesis.abstract?.toLowerCase().includes(normalizedQuery) ||
            thesis.student_name.toLowerCase().includes(normalizedQuery);
            
        return matchesSearch;
    });
    
    // Render filtered lists
    if (CommitteeDOM.pendingThesesContainer) {
        CommitteeDOM.pendingThesesContainer.innerHTML = '';
        
        if (filteredPending.length === 0) {
            CommitteeDOM.pendingThesesContainer.innerHTML = 
                '<div class="alert alert-info">No matching pending theses</div>';
        } else {
            filteredPending.forEach(thesis => {
                const thesisCard = createThesisCard(thesis, 'pending');
                CommitteeDOM.pendingThesesContainer.appendChild(thesisCard);
            });
        }
    }
    
    if (CommitteeDOM.reviewedThesesContainer) {
        CommitteeDOM.reviewedThesesContainer.innerHTML = '';
        
        if (filteredReviewed.length === 0) {
            CommitteeDOM.reviewedThesesContainer.innerHTML = 
                '<div class="alert alert-info">No matching reviewed theses</div>';
        } else {
            filteredReviewed.forEach(thesis => {
                const thesisCard = createThesisCard(thesis, 'reviewed');
                CommitteeDOM.reviewedThesesContainer.appendChild(thesisCard);
            });
        }
    }
}

function updateNotifications() {
    if (CommitteeDOM.notificationBadge) {
        const pendingCount = pendingTheses.length;
        if (pendingCount > 0) {
            CommitteeDOM.notificationBadge.textContent = pendingCount;
            CommitteeDOM.notificationBadge.classList.remove('hidden');
        } else {
            CommitteeDOM.notificationBadge.classList.add('hidden');
        }
    }
}

// --- Thesis Details and Files ---

async function viewThesisDetails(thesisId) {
    try {
        showLoading('Loading thesis details...');
        
        const { data: thesis, error } = await committeeSupabaseClient
            .from('thesis_submissions')
            .select(`
                *,
                student:student_id(id, users(email, raw_user_meta_data)),
                supervisor:supervisor_id(id, users(email, raw_user_meta_data)),
                thesis_files(*)
            `)
            .eq('id', thesisId)
            .single();
            
        if (error) throw error;
        
        currentThesisDetails = thesis;
        renderThesisDetails(thesis);
        hideLoading();
        
    } catch (error) {
        console.error('committee.js: Error loading thesis details:', error);
        displayErrorMessage('Failed to load thesis details.');
        hideLoading();
    }
}

function renderThesisDetails(thesis) {
    if (!CommitteeDOM.thesisDetailsContainer) return;
    
    // Show details panel and hide evaluation form
    CommitteeDOM.thesisDetailsContainer.classList.remove('hidden');
    if (CommitteeDOM.evaluationFormContainer) {
        CommitteeDOM.evaluationFormContainer.classList.add('hidden');
    }
    
    const studentName = thesis.student?.users?.raw_user_meta_data?.full_name || 
                      thesis.student?.users?.email || 'Unknown Student';
                      
    const supervisorName = thesis.supervisor?.users?.raw_user_meta_data?.full_name || 
                         thesis.supervisor?.users?.email || 'Unassigned';
    
    // Create status badge
    let statusBadgeClass = 'bg-secondary';
    if (thesis.status === 'submitted') statusBadgeClass = 'bg-info';
    if (thesis.status === 'approved') statusBadgeClass = 'bg-success';
    if (thesis.status === 'rejected') statusBadgeClass = 'bg-danger';
    if (thesis.status === 'revision_required') statusBadgeClass = 'bg-warning';
    
    CommitteeDOM.thesisDetailsContainer.innerHTML = `
        <h3>Thesis Details</h3>
        <button class="btn btn-close close-details" style="float: right;"></button>
        <h4>${thesis.title}</h4>
        <div class="mb-3">
            <span class="badge ${statusBadgeClass}">${formatStatus(thesis.status)}</span>
        </div>
        
        <div class="row mb-3">
            <div class="col-md-6">
                <p><strong>Student:</strong> ${studentName}</p>
                <p><strong>Supervisor:</strong> ${supervisorName}</p>
                <p><strong>Submitted:</strong> ${new Date(thesis.submitted_at).toLocaleDateString()}</p>
            </div>
            <div class="col-md-6">
                <p><strong>Program:</strong> ${thesis.program_name || 'Not specified'}</p>
                <p><strong>Last Updated:</strong> ${new Date(thesis.updated_at).toLocaleDateString()}</p>
            </div>
        </div>
        
        <div class="mb-4">
            <h5>Abstract</h5>
            <div class="p-3 bg-light rounded">
                ${thesis.abstract || 'No abstract provided'}
            </div>
        </div>
        
        <div class="mb-4">
            <h5>Files</h5>
            <div id="thesis-files-list">
                ${renderThesisFilesList(thesis.thesis_files || [])}
            </div>
        </div>
        
        <div class="mb-4">
            <h5>Actions</h5>
            <button class="btn btn-primary evaluate-thesis-btn" data-thesis-id="${thesis.id}">
                ${isThesisReviewed(thesis.id) ? 'View Evaluation' : 'Start Evaluation'}
            </button>
            <button class="btn btn-secondary back-to-list-btn">Back to List</button>
        </div>
    `;
    
    // Add event listeners
    setTimeout(() => {
        const closeBtn = CommitteeDOM.thesisDetailsContainer.querySelector('.close-details');
        closeBtn?.addEventListener('click', () => {
            CommitteeDOM.thesisDetailsContainer.classList.add('hidden');
        });
        
        const evaluateBtn = CommitteeDOM.thesisDetailsContainer.querySelector('.evaluate-thesis-btn');
        evaluateBtn?.addEventListener('click', () => {
            if (isThesisReviewed(thesis.id)) {
                viewEvaluation(thesis.id);
            } else {
                startEvaluation(thesis.id);
            }
        });
        
        const backBtn = CommitteeDOM.thesisDetailsContainer.querySelector('.back-to-list-btn');
        backBtn?.addEventListener('click', () => {
            CommitteeDOM.thesisDetailsContainer.classList.add('hidden');
        });
        
        // File view buttons
        const fileViewBtns = CommitteeDOM.thesisDetailsContainer.querySelectorAll('.view-file-btn');
        fileViewBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const filePath = btn.dataset.filePath;
                viewThesisFile(filePath);
            });
        });
    }, 0);
}

function renderThesisFilesList(files) {
    if (!files || files.length === 0) {
        return '<div class="alert alert-warning">No files uploaded</div>';
    }
    
    // Group files into main document and supporting documents
    const mainDocument = files.find(file => file.is_main_document);
    const supportingFiles = files.filter(file => !file.is_main_document);
    
    let filesHtml = '';
    
    if (mainDocument) {
        filesHtml += `
            <div class="mb-3">
                <h6>Main Document</h6>
                <div class="d-flex align-items-center border p-2 rounded">
                    <div class="me-auto">
                        <strong>${mainDocument.file_name}</strong><br>
                        <small class="text-muted">
                            ${formatFileSize(mainDocument.file_size)} • 
                            Uploaded ${new Date(mainDocument.uploaded_at).toLocaleDateString()}
                        </small>
                    </div>
                    <button class="btn btn-sm btn-primary view-file-btn" 
                        data-file-path="${mainDocument.file_path}">
                        View
                    </button>
                </div>
            </div>
        `;
    }
    
    if (supportingFiles.length > 0) {
        filesHtml += `<h6>Supporting Documents</h6>`;
        
        supportingFiles.forEach(file => {
            filesHtml += `
                <div class="d-flex align-items-center border p-2 rounded mb-2">
                    <div class="me-auto">
                        <strong>${file.file_name}</strong><br>
                        <small class="text-muted">
                            ${formatFileSize(file.file_size)} • 
                            Uploaded ${new Date(file.uploaded_at).toLocaleDateString()}
                        </small>
                    </div>
                    <button class="btn btn-sm btn-primary view-file-btn" 
                        data-file-path="${file.file_path}">
                        View
                    </button>
                </div>
            `;
        });
    }
    
    return filesHtml;
}

async function viewThesisFile(filePath) {
    try {
        showLoading('Preparing file for viewing...');
        
        const { data, error } = await committeeSupabaseClient.storage
            .from('thesis_files')
            .createSignedUrl(filePath, 60); // 60 seconds
            
        if (error) throw error;
        
        hideLoading();
        window.open(data.signedUrl, '_blank');
    } catch (error) {
        console.error('committee.js: Error viewing file:', error);
        displayErrorMessage('Failed to access file. Please try again.');
        hideLoading();
    }
}

// --- Evaluation Functions ---

function isThesisReviewed(thesisId) {
    // Check if this thesis is in the reviewed list
    return reviewedTheses.some(thesis => thesis.thesis_id === thesisId);
}

async function startEvaluation(thesisId) {
    try {
        if (!CommitteeDOM.evaluationFormContainer) return;
        
        showLoading('Loading evaluation form...');
        
        // Get thesis details if not already loaded
        if (!currentThesisDetails || currentThesisDetails.id !== thesisId) {
            await viewThesisDetails(thesisId);
        }
        
        // Hide details, show evaluation form
        CommitteeDOM.thesisDetailsContainer.classList.add('hidden');
        CommitteeDOM.evaluationFormContainer.classList.remove('hidden');
        
        // Check if we already have an evaluation in progress
        const { data: existingEval, error: evalError } = await committeeSupabaseClient
            .from('thesis_evaluations')
            .select('*')
            .eq('thesis_id', thesisId)
            .eq('evaluator_id', committeeCurrentUser.id)
            .maybeSingle();
            
        if (evalError) throw evalError;
        
        // Initialize current evaluation
        if (existingEval) {
            currentEvaluation = {
                id: existingEval.id,
                thesis_id: existingEval.thesis_id,
                scores: existingEval.scores || {},
                comments: existingEval.comments || {},
                overall_score: existingEval.overall_score,
                overall_comment: existingEval.overall_comment || '',
                recommendation: existingEval.recommendation || 'pending'
            };
        } else {
            currentEvaluation = {
                thesis_id: thesisId,
                scores: {},
                comments: {},
                overall_score: null,
                overall_comment: '',
                recommendation: 'pending'
            };
        }
        
        renderEvaluationForm();
        hideLoading();
    } catch (error) {
        console.error('committee.js: Error starting evaluation:', error);
        displayErrorMessage('Failed to load evaluation form.');
        hideLoading();
    }
}

function renderEvaluationForm() {
    if (!CommitteeDOM.evaluationFormContainer) return;
    
    // Prepare thesis info
    const thesis = currentThesisDetails;
    const thesisTitle = thesis.title;
    const studentName = thesis.student?.users?.raw_user_meta_data?.full_name || 
                      thesis.student?.users?.email || 'Unknown Student';
    
    // Create form HTML
    CommitteeDOM.evaluationFormContainer.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h3>Thesis Evaluation</h3>
            <button class="btn btn-close close-evaluation"></button>
        </div>
        
        <div class="alert alert-primary">
            <strong>Evaluating:</strong> "${thesisTitle}" by ${studentName}
        </div>
        
        <form id="evaluation-form">
            <div class="mb-4">
                <h5>Evaluation Criteria</h5>
                <p class="text-muted">Rate each criterion from 1-10</p>
                
                <div class="criteria-container">
                    ${evaluationCriteria.map(criterion => `
                        <div class="criterion-item card mb-3">
                            <div class="card-body">
                                <h6>${criterion.name}</h6>
                                <div class="row align-items-center">
                                    <div class="col-md-6">
                                        <label for="score-${criterion.id}" class="form-label">Score (1-10):</label>
                                        <input type="range" class="form-range" 
                                            id="score-${criterion.id}" 
                                            min="1" max="10" step="1" 
                                            value="${currentEvaluation.scores[criterion.id] || 5}">
                                        <div class="d-flex justify-content-between">
                                            <small>Poor (1)</small>
                                            <small>Excellent (10)</small>
                                        </div>
                                        <div class="text-center">
                                            <strong>Score: <span class="score-value">${currentEvaluation.scores[criterion.id] || 5}</span></strong>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <label for="comment-${criterion.id}" class="form-label">Comments:</label>
                                        <textarea class="form-control" id="comment-${criterion.id}" rows="2"
                                            placeholder="Optional comments for this criterion">${currentEvaluation.comments[criterion.id] || ''}</textarea>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="card mb-4">
                <div class="card-body">
                    <h5>Overall Assessment</h5>
                    <div class="row">
                        <div class="col-md-3">
                            <div class="text-center mb-3">
                                <div class="display-4" id="overall-score">${currentEvaluation.overall_score || '-'}</div>
                                <p class="text-muted">Overall Score</p>
                            </div>
                        </div>
                        <div class="col-md-9">
                            <div class="mb-3">
                                <label for="overall-comment" class="form-label">Overall Comments:</label>
                                <textarea class="form-control" id="overall-comment" rows="4"
                                    placeholder="Provide overall feedback on this thesis">${currentEvaluation.overall_comment || ''}</textarea>
                            </div>
                            
                            <div class="mb-3">
                                <label class="form-label">Recommendation:</label>
                                <div class="d-flex">
                                    <div class="form-check me-3">
                                        <input class="form-check-input" type="radio" name="recommendation" 
                                            id="rec-approve" value="approve" ${currentEvaluation.recommendation === 'approve' ? 'checked' : ''}>
                                        <label class="form-check-label" for="rec-approve">Approve</label>
                                    </div>
                                    <div class="form-check me-3">
                                        <input class="form-check-input" type="radio" name="recommendation" 
                                            id="rec-revisions" value="revisions" ${currentEvaluation.recommendation === 'revisions' ? 'checked' : ''}>
                                        <label class="form-check-label" for="rec-revisions">Approve with Revisions</label>
                                    </div>
                                    <div class="form-check">
                                        <input class="form-check-input" type="radio" name="recommendation" 
                                            id="rec-reject" value="reject" ${currentEvaluation.recommendation === 'reject' ? 'checked' : ''}>
                                        <label class="form-check-label" for="rec-reject">Reject</label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="d-flex justify-content-between">
                <button type="button" class="btn btn-secondary" id="back-to-thesis-btn">Back to Thesis</button>
                <div>
                    <button type="button" class="btn btn-outline-primary me-2" id="save-evaluation">Save Draft</button>
                    <button type="submit" class="btn btn-success" id="submit-evaluation">Submit Evaluation</button>
                </div>
            </div>
        </form>
    `;
    
    // Add event listeners
    setTimeout(() => {
        // Close button
        const closeBtn = CommitteeDOM.evaluationFormContainer.querySelector('.close-evaluation');
        closeBtn?.addEventListener('click', () => {
            CommitteeDOM.evaluationFormContainer.classList.add('hidden');
        });
        
        // Back button
        const backBtn = document.getElementById('back-to-thesis-btn');
        backBtn?.addEventListener('click', () => {
            CommitteeDOM.evaluationFormContainer.classList.add('hidden');
            CommitteeDOM.thesisDetailsContainer.classList.remove('hidden');
        });
        
        // Score inputs
        evaluationCriteria.forEach(criterion => {
            const scoreInput = document.getElementById(`score-${criterion.id}`);
            const scoreDisplay = scoreInput?.closest('.col-md-6').querySelector('.score-value');
            
            scoreInput?.addEventListener('input', () => {
                if (scoreDisplay) scoreDisplay.textContent = scoreInput.value;
                updateCriterionScore(criterion.id, scoreInput.value);
            });
            
            const commentInput = document.getElementById(`comment-${criterion.id}`);
            commentInput?.addEventListener('input', () => {
                currentEvaluation.comments[criterion.id] = commentInput.value;
            });
        });
        
        // Overall comment
        const overallComment = document.getElementById('overall-comment');
        overallComment?.addEventListener('input', () => {
            currentEvaluation.overall_comment = overallComment.value;
        });
        
        // Recommendation radio buttons
        const recommendationRadios = document.querySelectorAll('input[name="recommendation"]');
        recommendationRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (radio.checked) {
                    currentEvaluation.recommendation = radio.value;
                }
            });
        });
        
        // Save draft button
        const saveBtn = document.getElementById('save-evaluation');
        saveBtn?.addEventListener('click', () => saveEvaluation(false));
        
        // Submit button
        const submitBtn = document.getElementById('submit-evaluation');
        const form = document.getElementById('evaluation-form');
        form?.addEventListener('submit', (e) => {
            e.preventDefault();
            saveEvaluation(true);
        });
    }, 0);
}

function updateCriterionScore(criterionId, score) {
    score = parseInt(score) || 0;
    currentEvaluation.scores[criterionId] = score;
    
    // Recalculate overall score
    let totalScore = 0;
    let criteriaCount = 0;
    
    for (const criterion of evaluationCriteria) {
        if (currentEvaluation.scores[criterion.id]) {
            totalScore += parseInt(currentEvaluation.scores[criterion.id]);
            criteriaCount++;
        }
    }
    
    if (criteriaCount > 0) {
        currentEvaluation.overall_score = Math.round(totalScore / criteriaCount);
    } else {
        currentEvaluation.overall_score = null;
    }
    
    // Update overall score display
    if (CommitteeDOM.overallScoreDisplay) {
        CommitteeDOM.overallScoreDisplay.textContent = currentEvaluation.overall_score || '-';
    }
}

async function saveEvaluation(isSubmission) {
    try {
        showLoading(isSubmission ? 'Submitting evaluation...' : 'Saving draft...');
        
        // Gather form data
        const overallComment = document.getElementById('overall-comment')?.value || '';
        const recommendation = document.querySelector('input[name="recommendation"]:checked')?.value || 'pending';
        
        const evaluationData = {
            thesis_id: currentEvaluation.thesis_id,
            evaluator_id: committeeCurrentUser.id,
            scores: currentEvaluation.scores,
            comments: currentEvaluation.comments,
            overall_score: currentEvaluation.overall_score,
            overall_comment: overallComment,
            recommendation: recommendation,
            status: isSubmission ? 'submitted' : 'draft'
        };
        
        // Validation for submission
        if (isSubmission) {
            if (!currentEvaluation.overall_score) {
                hideLoading();
                displayErrorMessage('Please rate all criteria before submitting.');
                return;
            }
            
            if (!recommendation || recommendation === 'pending') {
                hideLoading();
                displayErrorMessage('Please select a recommendation before submitting.');
                return;
            }
            
            if (!overallComment.trim()) {
                hideLoading();
                displayErrorMessage('Please provide overall comments before submitting.');
                return;
            }
            
            // Add submission date
            evaluationData.submitted_at = new Date().toISOString();
        }
        
        let result;
        
        if (currentEvaluation.id) {
            // Update existing evaluation
            const { data, error } = await committeeSupabaseClient
                .from('thesis_evaluations')
                .update(evaluationData)
                .eq('id', currentEvaluation.id)
                .select()
                .single();
                
            if (error) throw error;
            result = data;
        } else {
            // Insert new evaluation
            const { data, error } = await committeeSupabaseClient
                .from('thesis_evaluations')
                .insert(evaluationData)
                .select()
                .single();
                
            if (error) throw error;
            result = data;
            currentEvaluation.id = result.id;
        }
        
        // If submitted, also update the assignment status
        if (isSubmission) {
            const assignmentUpdate = {
                status: 'reviewed',
                completed_at: new Date().toISOString()
            };
            
            // Find the assignment ID
            const assignment = pendingTheses.find(t => t.thesis_id === currentEvaluation.thesis_id);
            
            if (assignment?.assignment_id) {
                const { error: assignmentError } = await committeeSupabaseClient
                    .from('thesis_committee_assignments')
                    .update(assignmentUpdate)
                    .eq('id', assignment.assignment_id);
                    
                if (assignmentError) {
                    console.error('committee.js: Error updating assignment:', assignmentError);
                }
                
                // Move from pending to reviewed
                const thesisToMove = pendingTheses.find(t => t.thesis_id === currentEvaluation.thesis_id);
                if (thesisToMove) {
                    thesisToMove.assignment_status = 'reviewed';
                    reviewedTheses.push(thesisToMove);
                    pendingTheses = pendingTheses.filter(t => t.thesis_id !== currentEvaluation.thesis_id);
                    renderThesesLists();
                    updateNotifications();
                }
            }
            
            hideLoading();
            displaySuccessMessage('Evaluation submitted successfully!');
            CommitteeDOM.evaluationFormContainer.classList.add('hidden');
        } else {
            hideLoading();
            displaySuccessMessage('Evaluation saved as draft.');
        }
    } catch (error) {
        console.error('committee.js: Error saving evaluation:', error);
        displayErrorMessage('Failed to save evaluation. Please try again.');
        hideLoading();
    }
}

async function viewEvaluation(thesisId) {
    try {
        showLoading('Loading evaluation...');
        
        // Get thesis details if not already loaded
        if (!currentThesisDetails || currentThesisDetails.id !== thesisId) {
            await viewThesisDetails(thesisId);
        }
        
        // Get evaluation
        const { data: evaluation, error } = await committeeSupabaseClient
            .from('thesis_evaluations')
            .select('*')
            .eq('thesis_id', thesisId)
            .eq('evaluator_id', committeeCurrentUser.id)
            .single();
            
        if (error) throw error;
        
        if (!evaluation) {
            hideLoading();
            displayErrorMessage('Evaluation not found.');
            return;
        }
        
        currentEvaluation = {
            id: evaluation.id,
            thesis_id: evaluation.thesis_id,
            scores: evaluation.scores || {},
            comments: evaluation.comments || {},
            overall_score: evaluation.overall_score,
            overall_comment: evaluation.overall_comment || '',
            recommendation: evaluation.recommendation || 'pending'
        };
        
        CommitteeDOM.thesisDetailsContainer.classList.add('hidden');
        renderEvaluationForm();
        
        // Disable form inputs if evaluation is submitted
        if (evaluation.status === 'submitted') {
            const form = document.getElementById('evaluation-form');
            const inputs = form?.querySelectorAll('input, textarea, button[type="submit"]');
            inputs?.forEach(input => {
                input.disabled = true;
            });
            
            // Add view-only notification
            const viewOnlyAlert = document.createElement('div');
            viewOnlyAlert.className = 'alert alert-info mt-3';
            viewOnlyAlert.textContent = 'This evaluation has been submitted and is now in view-only mode.';
            form?.prepend(viewOnlyAlert);
        }
        
        CommitteeDOM.evaluationFormContainer.classList.remove('hidden');
        hideLoading();
    } catch (error) {
        console.error('committee.js: Error viewing evaluation:', error);
        displayErrorMessage('Failed to load evaluation.');
        hideLoading();
    }
}

// --- Utility Functions ---

function formatStatus(status) {
    if (!status) return 'Unknown';
    
    const statusMap = {
        'draft': 'Draft',
        'submitted': 'Submitted',
        'under_review': 'Under Review',
        'revision_required': 'Revision Required',
        'approved': 'Approved',
        'rejected': 'Rejected'
    };
    
    return statusMap[status] || status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function formatFileSize(bytes) {
    if (!bytes || isNaN(bytes)) return '0 B';
    
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function showLoading(message) {
    committeeLoadingState = true;
    if (CommitteeDOM.loadingOverlay) {
        const loadingText = CommitteeDOM.loadingOverlay.querySelector('.spinner-content p');
        if (loadingText) loadingText.textContent = message || 'Loading...';
        CommitteeDOM.loadingOverlay.style.display = 'flex';
    }
}

function hideLoading() {
    committeeLoadingState = false;
    if (CommitteeDOM.loadingOverlay) {
        CommitteeDOM.loadingOverlay.style.display = 'none';
    }
}

function displayErrorMessage(message) {
    // Create or reuse error alert
    let errorAlert = document.getElementById('committee-error-alert');
    if (!errorAlert) {
        errorAlert = document.createElement('div');
        errorAlert.id = 'committee-error-alert';
        errorAlert.className = 'alert alert-danger alert-dismissible fade show fixed-top m-3';
        errorAlert.setAttribute('role', 'alert');
        errorAlert.innerHTML = `
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            <div class="alert-message"></div>
        `;
        document.body.appendChild(errorAlert);
        
        // Add event listener to close button
        errorAlert.querySelector('.btn-close').addEventListener('click', () => {
            errorAlert.classList.remove('show');
        });
    }
    
    // Update message and show
    errorAlert.querySelector('.alert-message').textContent = message;
    errorAlert.classList.add('show');
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        if (errorAlert) {
            errorAlert.classList.remove('show');
        }
    }, 5000);
}

function displaySuccessMessage(message) {
    // Create or reuse success alert
    let successAlert = document.getElementById('committee-success-alert');
    if (!successAlert) {
        successAlert = document.createElement('div');
        successAlert.id = 'committee-success-alert';
        successAlert.className = 'alert alert-success alert-dismissible fade show fixed-top m-3';
        successAlert.setAttribute('role', 'alert');
        successAlert.innerHTML = `
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            <div class="alert-message"></div>
        `;
        document.body.appendChild(successAlert);
        
        // Add event listener to close button
        successAlert.querySelector('.btn-close').addEventListener('click', () => {
            successAlert.classList.remove('show');
        });
    }
    
    // Update message and show
    successAlert.querySelector('.alert-message').textContent = message;
    successAlert.classList.add('show');
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        if (successAlert) {
            successAlert.classList.remove('show');
        }
    }, 3000);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('committee.js: DOM loaded, initializing...');
    initializeCommitteeModule();
});

// Listen for Supabase connection event
document.addEventListener('supabaseConnectionReady', function() {
    console.log('committee.js: Supabase connection ready event received');
    if (!committeeModuleInitialized) {
        initializeCommitteeModule();
    }
});

// Export key functions
window.viewThesisDetails = viewThesisDetails;
window.startEvaluation = startEvaluation;
window.viewEvaluation = viewEvaluation;