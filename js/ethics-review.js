// ethics-review.js - Logic for supervisors and committee members to review ethics submissions

// --- Module State ---
let reviewSupabaseClient = null;
let reviewCurrentUser = null;
let reviewUserRoles = [];
let reviewCurrentForm = null;
let reviewCurrentStudent = null;
let reviewMode = 'review'; // 'review' or 'view' (read-only)

// --- DOM Element Cache ---
const ReviewDOM = {
    formTitleDisplay: null,
    studentNameDisplay: null,
    formStatusDisplay: null,
    formSubmittedDateDisplay: null,
    formContentContainer: null,
    attachmentsContainer: null,
    feedbackTextarea: null,
    commentFileUploadInput: null,
    approveBtn: null,
    requestChangesBtn: null,
    rejectBtn: null,
    backToListBtn: null,
    historyContainer: null
};
document.addEventListener('DOMContentLoaded', () => {
  // Listen for auth module ready event
  window.addEventListener(AuthModuleEventsGlobal.AUTH_MODULE_READY, async (event) => {
    const { user, orgData } = event.detail;
    
    if (user && orgData) {
      await initializeEthicsFormReview(user, orgData);
    }
  });
});

/**
 * Initialize the ethics form review module
 */
async function initializeEthicsFormReview(user, orgData) {
  try {
    console.log('ethics-review.js: Initializing ethics form review...');
    
    // Get Supabase client
    reviewSupabaseClient = await getSupabaseClient();
    reviewCurrentUser = user;
    reviewUserRoles = orgData?.roles || [];
    
    // Cache DOM elements
    cacheReviewDOMElements();
    
    // Get form ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const formId = urlParams.get('id');
    
    if (!formId) {
      throw new Error('No form ID provided');
    }
    
    // Check if user has permission to review ethics forms
    const canReview = reviewUserRoles.some(role => 
      ['admin', 'supervisor', 'committee'].includes(role.name)
    );
    
    if (!canReview) {
      throw new Error('You do not have permission to review ethics forms');
    }
    
    // Load the ethics form
    await loadEthicsForm(formId);
    
    // Set up event listeners
    setupReviewEventListeners();
    
    console.log('Ethics form review initialized successfully');
  } catch (error) {
    console.error('Error initializing ethics form review:', error);
    displayReviewError(error.message);
  }
}

/**
 * Load the ethics form to review
 */
async function loadEthicsForm(formId) {
  try {
    // Get the ethics submission
    const { data: submissionData, error: submissionError } = await reviewSupabaseClient
      .from('ethics_submissions')
      .select(`
        *,
        student:student_id(
          id,
          user_id, 
          users:user_id(first_name, last_name, email),
          student_id
        )
      `)
      .eq('id', formId)
      .single();
    
    if (submissionError) throw submissionError;
    
    if (!submissionData) {
      throw new Error('Ethics form not found');
    }
    
    reviewCurrentForm = submissionData;
    reviewCurrentStudent = submissionData.student;
    
    // Get review history
    const { data: historyData, error: historyError } = await reviewSupabaseClient
      .from('ethics_reviews')
      .select(`
        *,
        reviewer:reviewer_id(first_name, last_name, email)
      `)
      .eq('submission_id', formId)
      .order('created_at', { ascending: true });
    
    if (historyError) throw historyError;
    
    reviewCurrentForm.reviews = historyData || [];
    
    // Update the UI
    updateReviewUI();
    
    return reviewCurrentForm;
  } catch (error) {
    console.error('Error loading ethics form:', error);
    throw error;
  }
}

/**
 * Update the ethics review UI
 */
function updateReviewUI() {
  if (!reviewCurrentForm || !reviewCurrentStudent) {
    displayReviewError('Form data not loaded');
    return;
  }
  
  // Update form metadata
  if (ReviewDOM.formTitleDisplay) {
    ReviewDOM.formTitleDisplay.textContent = reviewCurrentForm.title || 'Untitled Ethics Application';
  }
  
  if (ReviewDOM.studentNameDisplay) {
    const student = reviewCurrentStudent.users;
    ReviewDOM.studentNameDisplay.textContent = `${student.first_name} ${student.last_name} (${reviewCurrentStudent.student_id})`;
  }
  
  if (ReviewDOM.formStatusDisplay) {
    ReviewDOM.formStatusDisplay.textContent = capitalize(reviewCurrentForm.status);
    ReviewDOM.formStatusDisplay.className = `status-badge status-${reviewCurrentForm.status}`;
  }
  
  if (ReviewDOM.formSubmittedDateDisplay) {
    ReviewDOM.formSubmittedDateDisplay.textContent = formatDate(reviewCurrentForm.submitted_at);
  }
  
  // Render form content
  renderFormContent();
  
  // Render attachments
  renderFormAttachments();
  
  // Render review history
  renderReviewHistory();
}

/**
 * Render the ethics form content
 */
function renderFormContent() {
  if (!ReviewDOM.formContentContainer) return;
  
  const formData = reviewCurrentForm.form_data || {};
  let contentHtml = '<div class="ethics-form-content">';
  
  // Render each section of the form
  for (const [section, fields] of Object.entries(formData)) {
    contentHtml += `
      <div class="form-section">
        <h3>${formatSectionTitle(section)}</h3>
        <div class="form-fields">
    `;
    
    // Render each field in the section
    for (const [fieldName, value] of Object.entries(fields)) {
      contentHtml += `
        <div class="form-field">
          <div class="field-name">${formatFieldName(fieldName)}</div>
          <div class="field-value">${formatFieldValue(value)}</div>
        </div>
      `;
    }
    
    contentHtml += `
        </div>
      </div>
    `;
  }
  
  contentHtml += '</div>';
  ReviewDOM.formContentContainer.innerHTML = contentHtml;
}

/**
 * Setup event listeners for the review page
 */
function setupReviewEventListeners() {
  // Approve button
  if (ReviewDOM.approveBtn) {
    ReviewDOM.approveBtn.addEventListener('click', async () => {
      await submitReview('approved', 'The ethics application has been approved.');
    });
  }
  
  // Request changes button
  if (ReviewDOM.requestChangesBtn) {
    ReviewDOM.requestChangesBtn.addEventListener('click', async () => {
      const feedback = ReviewDOM.feedbackTextarea.value.trim();
      
      if (!feedback) {
        alert('Please provide feedback for requested changes');
        return;
      }
      
      await submitReview('changes_requested', feedback);
    });
  }
  
  // Reject button
  if (ReviewDOM.rejectBtn) {
    ReviewDOM.rejectBtn.addEventListener('click', async () => {
      const feedback = ReviewDOM.feedbackTextarea.value.trim();
      
      if (!feedback) {
        alert('Please provide reasons for rejection');
        return;
      }
      
      await submitReview('rejected', feedback);
    });
  }
  
  // Back to list button
  if (ReviewDOM.backToListBtn) {
    ReviewDOM.backToListBtn.addEventListener('click', () => {
      history.back();
    });
  }
}

/**
 * Submit an ethics review
 */
async function submitReview(decision, feedback) {
  if (!reviewCurrentForm) {
    alert('Form data not loaded');
    return;
  }
  
  try {
    // Create the review record
    const reviewData = {
      submission_id: reviewCurrentForm.id,
      reviewer_id: reviewCurrentUser.id,
      feedback,
      decision,
      decision_date: new Date().toISOString()
    };
    
    // Insert the review
    const { data: reviewResult, error: reviewError } = await reviewSupabaseClient
      .from('ethics_reviews')
      .insert(reviewData)
      .select()
      .single();
    
    if (reviewError) throw reviewError;
    
    // Update the submission status
    const { error: updateError } = await reviewSupabaseClient
      .from('ethics_submissions')
      .update({ status: decision })
      .eq('id', reviewCurrentForm.id);
    
    if (updateError) throw updateError;
    
    // Create notification for student
    await createNotification(
      reviewCurrentStudent.user_id,
      'Ethics Review Update',
      `Your ethics application "${reviewCurrentForm.title}" has been ${formatDecision(decision)}.`,
      'ethics_review',
      reviewCurrentForm.id
    );
    
    alert('Review submitted successfully');
// --- Form Review Initialization ---
async function initializeEthicsFormReview() {
    try {
        console.log('ethics-review.js: Initializing ethics form review...');
        
        // Get Supabase client
        reviewSupabaseClient = getSupabaseClient();
        
        // Check authentication
        const { data: { user }, error: authError } = await reviewSupabaseClient.auth.getUser();
        
        if (authError || !user) {
            console.error('ethics-review.js: Authentication error:', authError);
            window.location.href = PathConfig.LOGIN;
            return;
        }
        
        reviewCurrentUser = user;
        
        // Get user roles
        const userOrgData = await getUserOrganizationAndRoles();
        if (!userOrgData || !userOrgData.roles) {
            console.error('ethics-review.js: Unable to get user roles');
            window.location.href = PathConfig.LOGIN;
            return;
        }
        
        reviewUserRoles = userOrgData.roles.map(role => role.name);
        
        // Check if user has necessary role
        const canReview = reviewUserRoles.some(role => 
            role === 'supervisor' || role === 'admin' || role === 'ethics_committee');
            
        if (!canReview) {
            console.error('ethics-review.js: User does not have permission to review ethics submissions');
            window.location.href = PathConfig.LOGIN;
            return;
        }
        
        // Get submission ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        const submissionId = urlParams.get('id');
        const mode = urlParams.get('mode');
        
        if (!submissionId) {
            console.error('ethics-review.js: No submission ID provided');
            window.location.href = getAppropriateRedirectPath();
            return;
        }
        
        // Set review mode
        if (mode === 'view') {
            reviewMode = 'view';
        }
        
        // Cache DOM elements
        cacheReviewDOMElements();
        
        // Load submission data
        await loadSubmissionData(submissionId);
        
        console.log('ethics-review.js: Form review initialization complete');
        
    } catch (error) {
        console.error('ethics-review.js: Error initializing ethics form review:', error);
    }
}

// --- Cache DOM Elements ---
function cacheReviewDOMElements() {
    try {
        ReviewDOM.formTitleDisplay = document.getElementById('formTitleDisplay');
        ReviewDOM.studentNameDisplay = document.getElementById('studentNameDisplay');
        ReviewDOM.formStatusDisplay = document.getElementById('formStatusDisplay');
        ReviewDOM.formSubmittedDateDisplay = document.getElementById('formSubmittedDateDisplay');
        ReviewDOM.formContentContainer = document.getElementById('formContentContainer');
        ReviewDOM.attachmentsContainer = document.getElementById('attachmentsContainer');
        ReviewDOM.feedbackTextarea = document.getElementById('feedbackTextarea');
        ReviewDOM.commentFileUploadInput = document.getElementById('commentFileUpload');
        ReviewDOM.approveBtn = document.getElementById('approveBtn');
        ReviewDOM.requestChangesBtn = document.getElementById('requestChangesBtn');
        ReviewDOM.rejectBtn = document.getElementById('rejectBtn');
        ReviewDOM.backToListBtn = document.getElementById('backToListBtn');
        ReviewDOM.historyContainer = document.getElementById('historyContainer');
    } catch (error) {
        console.error('ethics-review.js: Error caching DOM elements:', error);
    }
}

// --- Load Submission Data ---
async function loadSubmissionData(submissionId) {
    try {
        // Fetch submission with related data
        const { data: submission, error: submissionError } = await reviewSupabaseClient
            .from('ethics_submissions')
            .select(`
                id, 
                title,
                description,
                risk_level,
                status,
                created_at,
                submitted_at,
                updated_at,
                student:student_id (id, name, email),
                supervisor:supervisor_id (id, name, email),
                department:department_id (name)
            `)
            .eq('id', submissionId)
            .single();
            
        if (submissionError || !submission) {
            console.error('ethics-review.js: Error loading submission:', submissionError);
            alert('Error loading submission. You may not have permission to review this submission.');
            window.location.href = getAppropriateRedirectPath();
            return;
        }
        
        reviewCurrentForm = submission;
        reviewCurrentStudent = submission.student;
        
        // Update UI with submission data
        updateReviewUIWithSubmission();
        
        // Load submission documents
        await loadSubmissionDocuments(submissionId);
        
        // Load review history
        await loadReviewHistory(submissionId);
        
        // Configure UI based on user role and submission status
        configureReviewUI();
        
    } catch (error) {
        console.error('ethics-review.js: Error in loadSubmissionData:', error);
    }
}

// --- Update Review UI With Submission ---
function updateReviewUIWithSubmission() {
    try {
        if (!reviewCurrentForm) return;
        
        // Set basic submission info
        if (ReviewDOM.formTitleDisplay) {
            ReviewDOM.formTitleDisplay.textContent = reviewCurrentForm.title;
        }
        
        if (ReviewDOM.studentNameDisplay && reviewCurrentStudent) {
            ReviewDOM.studentNameDisplay.textContent = reviewCurrentStudent.name;
        }
        
        if (ReviewDOM.formStatusDisplay) {
            const status = reviewCurrentForm.status.charAt(0).toUpperCase() + reviewCurrentForm.status.slice(1);
            ReviewDOM.formStatusDisplay.textContent = status;
            ReviewDOM.formStatusDisplay.className = `status-${reviewCurrentForm.status}`;
        }
        
        if (ReviewDOM.formSubmittedDateDisplay && reviewCurrentForm.submitted_at) {
            const submittedDate = new Date(reviewCurrentForm.submitted_at);
            ReviewDOM.formSubmittedDateDisplay.textContent = submittedDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
        
       }
       catch (error) {
        console.error('ethics-review.js: Error updating review UI with submission:', error);
    }
}
/**
 * Load submission documents
 */
async function loadSubmissionDocuments(submissionId) {
  try {
    if (!ReviewDOM.attachmentsContainer) return;

    // Fetch documents related to the submission
    const { data: documents, error: docError } = await reviewSupabaseClient
      .from('ethics_documents')
      .select('*')
      .eq('submission_id', submissionId);

    if (docError) throw docError;

    // Render document list
    renderDocumentList(documents);
  } catch (error) {
    console.error('Error loading submission documents:', error);
  }
}
/**
 * Submit an ethics review (continued)
 */
async function submitReview(decision, feedback) {
  // Previous code...
  
  // Create notification for student
  await createNotification(
    reviewCurrentStudent.user_id,
    'Ethics Review Update',
    `Your ethics application "${reviewCurrentForm.title}" has been ${formatDecision(decision)}.`,
    'ethics_review',
    reviewCurrentForm.id
  );
  
  alert('Review submitted successfully');
  
  // Reload the page to show updated status
  setTimeout(() => {
    window.location.reload();
  }, 1000);
  
} catch (error) {
  console.error('Error submitting review:', error);
  alert(`Failed to submit review: ${error.message}`);
}
}

/**
 * Create a notification for a user
 */
async function createNotification(userId, title, message, type, entityId) {
  try {
    const notification = {
      user_id: userId,
      title,
      message,
      type,
      related_entity_id: entityId,
      related_entity_type: 'ethics_submission',
      read: false
    };
    
    const { error } = await reviewSupabaseClient
      .from('notifications')
      .insert(notification);
    
    if (error) throw error;
    
    return true;
  } catch (error) {
    console.error('Error creating notification:', error);
    return false;
  }
}

/**
 * Cache DOM elements for the review page
 */
function cacheReviewDOMElements() {
  ReviewDOM.formTitleDisplay = document.getElementById('form-title');
  ReviewDOM.studentNameDisplay = document.getElementById('student-name');
  ReviewDOM.formStatusDisplay = document.getElementById('form-status');
  ReviewDOM.formSubmittedDateDisplay = document.getElementById('form-submitted-date');
  ReviewDOM.formContentContainer = document.getElementById('form-content');
  ReviewDOM.attachmentsContainer = document.getElementById('form-attachments');
  ReviewDOM.feedbackTextarea = document.getElementById('feedback-textarea');
  ReviewDOM.commentFileUploadInput = document.getElementById('comment-file-upload');
  ReviewDOM.approveBtn = document.getElementById('approve-btn');
  ReviewDOM.requestChangesBtn = document.getElementById('request-changes-btn');
  ReviewDOM.rejectBtn = document.getElementById('reject-btn');
  ReviewDOM.backToListBtn = document.getElementById('back-to-list-btn');
  ReviewDOM.historyContainer = document.getElementById('review-history');
}

/**
 * Format a section title for display
 */
function formatSectionTitle(section) {
  return section
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Format a field name for display
 */
function formatFieldName(fieldName) {
  return fieldName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Format a field value for display
 */
function formatFieldValue(value) {
  if (value === null || value === undefined) {
    return '<em>Not provided</em>';
  }
  
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  
  if (Array.isArray(value)) {
    return value.join(', ') || '<em>None</em>';
  }
  
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  
  return String(value) || '<em>Not provided</em>';
}

/**
 * Format a date for display
 */
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

/**
 * Format a decision for display
 */
function formatDecision(decision) {
  switch (decision) {
    case 'approved': return 'approved';
    case 'changes_requested': return 'returned with requested changes';
    case 'rejected': return 'rejected';
    default: return decision;
  }
}

/**
 * Capitalize first letter of a string
 */
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
}

/**
 * Display an error message
 */
function displayReviewError(message) {
  const errorContainer = document.createElement('div');
  errorContainer.className = 'error-message';
  errorContainer.textContent = message;
  
  document.body.insertBefore(errorContainer, document.body.firstChild);
  
  setTimeout(() => {
    errorContainer.remove();
  }, 5000);
}
