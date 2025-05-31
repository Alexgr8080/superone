// thesis-marking.js

// --- Module State ---
let markingSupabaseClient = null;
let markingCurrentUser = null;
let markingId = null;
let markingData = null;
let thesisData = null;
let studentData = null;

// --- DOM Element Cache ---
const MarkingDOM = {
    thesisTitleEl: null,
    studentNameEl: null,
    submissionDateEl: null,
    markingStatusEl: null,
    thesisAbstractEl: null,
    thesisFilesEl: null,
    markingForm: null,
    saveDraftBtn: null,
    submitMarkingBtn: null,
    calculatedGradeEl: null
};

// --- Initialization ---
async function initializeThesisMarking() {
    try {
        console.log('thesis-marking.js: Initializing thesis marking...');
        
        // Get Supabase client
        markingSupabaseClient = getSupabaseClient();
        
        // Check authentication
        const { data: { user }, error } = await markingSupabaseClient.auth.getUser();
        
        if (error || !user) {
            window.location.href = PathConfig.LOGIN;
            return;
        }
        
        markingCurrentUser = user;
        
        // Cache DOM Elements
        cacheMarkingDOMElements();
        
        // Get marking ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        markingId = urlParams.get('id');
        
        if (!markingId) {
            showError('No marking ID specified');
            return;
        }
        
        // Load marking data
        await loadMarkingData();
        
        // Setup event listeners
        setupEventListeners();
        
        console.log('thesis-marking.js: Thesis marking initialized');
        
    } catch (err) {
        console.error('thesis-marking.js: Error initializing thesis marking:', err);
        showError('Failed to initialize marking form');
    }
}

function cacheMarkingDOMElements() {
    MarkingDOM.thesisTitleEl = document.getElementById('thesis-title');
    MarkingDOM.studentNameEl = document.getElementById('student-name');
    MarkingDOM.submissionDateEl = document.getElementById('submission-date');
    MarkingDOM.markingStatusEl = document.getElementById('marking-status');
    MarkingDOM.thesisAbstractEl = document.getElementById('thesis-abstract');
    MarkingDOM.thesisFilesEl = document.getElementById('thesis-files');
    MarkingDOM.markingForm = document.getElementById('marking-form');
    MarkingDOM.saveDraftBtn = document.getElementById('save-draft-btn');
    MarkingDOM.submitMarkingBtn = document.getElementById('submit-marking-btn');
    MarkingDOM.calculatedGradeEl = document.getElementById('calculated-grade');
}

async function loadMarkingData() {
    try {
        // Get marking assignment
        const { data: markingAssignment, error: markingError } = await markingSupabaseClient
            .from('thesis_marking')
            .select(`
                id,
                marker_id,
                thesis_submissions (
                    id,
                    title,
                    abstract,
                    status,
                    created_at,
                    students (
                        id,
                        user_id,
                        users (
                            id,
                            user_metadata
                        )
                    )
                ),
                status,
                grade,
                feedback,
                research_clarity,
                methodology,
                literature_breadth,
                literature_critical,
                data_analysis,
                results_presentation,
                discussion_quality,
                conclusion,
                structure,
                writing_quality,
                methodology_comments,
                literature_comments,
                data_comments,
                discussion_comments,
                structure_comments
            `)
            .eq('id', markingId)
            .single();
            
        if (markingError) throw markingError;
        
        if (!markingAssignment) {
            showError('Marking assignment not found');
            return;
        }
        
        markingData = markingAssignment;
        thesisData = markingAssignment.thesis_submissions;
        studentData = thesisData.students;
        
        // Update UI with thesis data
        updateThesisDetails();
        
        // If marking has already been started or completed, load saved values
        if (markingData.status !== 'pending') {
            loadSavedMarkingValues();
        }
        
        // Load thesis files
        await loadThesisFiles();
        
    } catch (err) {
        console.error('thesis-marking.js: Error loading marking data:', err);
        showError('Failed to load thesis data');
    }
}

function updateThesisDetails() {
    if (thesisData) {
        MarkingDOM.thesisTitleEl.textContent = thesisData.title || 'Untitled Thesis';
        
        const studentName = studentData?.users?.user_metadata?.full_name || 'Unknown Student';
        MarkingDOM.studentNameEl.textContent = studentName;
        
        const submissionDate = new Date(thesisData.created_at).toLocaleDateString();
        MarkingDOM.submissionDateEl.textContent = submissionDate;
        
        let statusText = 'Not Started';
        switch (markingData.status) {
            case 'pending':
                statusText = 'Not Started';
                break;
            case 'in_progress':
                statusText = 'In Progress';
                break;
            case 'completed':
                statusText = 'Completed';
                break;
        }
        MarkingDOM.markingStatusEl.textContent = statusText;
        
        // Set abstract
        MarkingDOM.thesisAbstractEl.innerHTML = thesisData.abstract || 'No abstract provided';
    }
}

async function loadThesisFiles() {
    try {
        const { data: files, error } = await markingSupabaseClient
            .from('thesis_files')
            .select('id, filename, file_path, file_type')
            .eq('thesis_submission_id', thesisData.id);
            
        if (error) throw error;
        
        if (MarkingDOM.thesisFilesEl) {
            if (!files || files.length === 0) {
                MarkingDOM.thesisFilesEl.innerHTML = '<p>No files attached</p>';
                return;
            }
            
            const filesList = document.createElement('ul');
            filesList.className = 'files-list';
            
            files.forEach(file => {
                const fileItem = document.createElement('li');
                fileItem.className = 'file-item';
                
                const fileIcon = getFileIcon(file.file_type);
                
                fileItem.innerHTML = `
                    <span class="file-icon">${fileIcon}</span>
                    <span class="file-name">${file.filename}</span>
                    <a href="#" class="file-action" data-id="${file.id}" data-path="${file.file_path}">Download</a>
                `;
                
                filesList.appendChild(fileItem);
            });
            
            MarkingDOM.thesisFilesEl.innerHTML = '';
            MarkingDOM.thesisFilesEl.appendChild(filesList);
            
            // Add event listeners to file download links
            document.querySelectorAll('.file-action').forEach(link => {
                link.addEventListener('click', async (e) => {
                    e.preventDefault();
                    const filePath = e.target.dataset.path;
                    
                    // Get a signed URL for the file
                    const { data: { signedURL }, error } = await markingSupabaseClient
                        .storage
                        .from('thesis-files')
                        .createSignedUrl(filePath, 60); // 60 second expiry
                        
                    if (error) {
                        console.error('thesis-marking.js: Error getting signed URL:', error);
                        alert('Failed to generate download link');
                        return;
                    }
                    
                    // Open the file in a new tab
                    window.open(signedURL, '_blank');
                });
            });
        }
    } catch (err) {
        console.error('thesis-marking.js: Error loading thesis files:', err);
        if (MarkingDOM.thesisFilesEl) {
            MarkingDOM.thesisFilesEl.innerHTML = '<p>Failed to load files</p>';
        }
    }
}

function loadSavedMarkingValues() {
    // Load saved criteria values
    const criteriaIds = [
        'research-clarity',
        'methodology',
        'literature-breadth',
        'literature-critical',
        'data-analysis',
        'results-presentation',
        'discussion-quality',
        'conclusion',
        'structure',
        'writing-quality'
    ];
    
    criteriaIds.forEach(id => {
        const dbField = id.replace('-', '_');
        const value = markingData[dbField];
        
        if (value !== null && value !== undefined) {
            const rangeInput = document.getElementById(id);
            if (rangeInput) {
                rangeInput.value = value;
                rangeInput.nextElementSibling.textContent = value + '%';
            }
        }
    });
    
    // Load saved comments
    const commentFields = [
        'methodology-comments',
        'literature-comments',
        'data-comments',
        'discussion-comments',
        'structure-comments'
    ];
    
    commentFields.forEach(id => {
        const dbField = id.replace('-', '_');
        const value = markingData[dbField];
        
        if (value !== null && value !== undefined) {
            const textarea = document.getElementById(id);
            if (textarea) {
                textarea.value = value;
            }
        }
    });
    
    // Load overall feedback
    const overallFeedback = document.getElementById('overall-feedback');
    if (overallFeedback && markingData.feedback) {
        overallFeedback.value = markingData.feedback;
    }
    
    // Calculate and display grade
    calculateFinalGrade();
}

function setupEventListeners() {
    if (MarkingDOM.markingForm) {
        MarkingDOM.