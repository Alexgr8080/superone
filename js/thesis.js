// Module state
let thesisSupabaseClient = null;
let thesisCurrentUser = null;
let thesisUserOrgData = null;
let thesisStudentData = null;
let thesisFormData = {
  id: null,
  title: '',
  abstract: '',
  status: 'draft',
  files: []
};
let thesisFormMode = 'create'; // 'create' or 'edit'
let isProcessing = false; // Flag to prevent multiple submissions

// DOM Element Cache
const ThesisDOM = {
  formElement: null,
  titleInput: null,
  abstractTextarea: null,
  mainFileUploadInput: null,
  supportingFilesUploadInput: null,
  filesListContainer: null,
  submitBtn: null,
  saveAsDraftBtn: null,
  formStatusDisplay: null,
  formFeedbackDisplay: null,
  loadingIndicator: null,
  errorContainer: null
};

// Initialize the thesis submission module
document.addEventListener('DOMContentLoaded', () => {
  // Listen for auth module ready event
  window.addEventListener(AuthModuleEventsGlobal.AUTH_MODULE_READY, async (event) => {
    const { user, orgData } = event.detail;
    
    if (user && orgData) {
      await initializeThesisSubmission(user, orgData);
    }
  });
});

/**
 * Initialize the thesis submission module
 */
async function initializeThesisSubmission(user, orgData) {
  try {
    console.log("Initializing thesis submission module...");
    
    // Create loading indicator and error container if they don't exist
    createUIHelpers();
    
    // Show loading indicator
    showLoading("Loading thesis submission form...");
    
    // Get Supabase client
    thesisSupabaseClient = await getSupabaseClient();
    thesisCurrentUser = user;
    thesisUserOrgData = orgData;
    
    // Check if user is a student
    const isStudent = orgData.roles.some(role => role.name === 'student');
    
    if (!isStudent) {
      throw new Error("Only students can submit theses. Please log in with a student account.");
    }
    
    // Get student data
    await loadStudentData();
    
    // Cache DOM elements
    cacheThesisDOMElements();
    
    // Check if editing existing thesis or creating new one
    const urlParams = new URLSearchParams(window.location.search);
    const thesisId = urlParams.get('id');
    
    if (thesisId) {
      thesisFormMode = 'edit';
      await loadExistingThesis(thesisId);
    } else {
      thesisFormMode = 'create';
      initializeNewThesisForm();
    }
    
    // Setup event handlers
    setupThesisFormEventHandlers();
    
    // Hide loading indicator
    hideLoading();
    
    console.log("Thesis submission module initialized successfully");
  } catch (error) {
    console.error("Error initializing thesis submission:", error);
    hideLoading();
    showError(`Failed to initialize thesis submission: ${error.message}`);
  }
}

/**
 * Load student data
 */
async function loadStudentData() {
  try {
    const { data, error } = await thesisSupabaseClient
      .from('students')
      .select(`
        id,
        user_id,
        student_id,
        program_id,
        department_id,
        supervisor_id
      `)
      .eq('user_id', thesisCurrentUser.id)
      .single();
    
    if (error) throw error;
    
    if (!data) {
      throw new Error("Student record not found. Please contact support.");
    }
    
    thesisStudentData = data;
    return data;
  } catch (error) {
    console.error("Error loading student data:", error);
    throw error;
  }
}

/**
 * Load existing thesis data
 */
async function loadExistingThesis(thesisId) {
  try {
    const { data, error } = await thesisSupabaseClient
      .from('theses')
      .select('*')
      .eq('id', thesisId)
      .eq('student_id', thesisStudentData.id)
      .single();
    
    if (error) throw error;
    
    if (!data) {
      throw new Error("Thesis not found or you don't have permission to edit it.");
    }
    
    thesisFormData = data;
    
    // Update form UI with loaded data
    updateThesisFormUI();
    
    return data;
  } catch (error) {
    console.error("Error loading existing thesis:", error);
    throw error;
  }
}

/**
 * Initialize new thesis form
 */
function initializeNewThesisForm() {
  thesisFormData = {
    id: null,
    title: '',
    abstract: '',
    status: 'draft',
    files: []
  };
  
  updateThesisFormUI();
}

/**
 * Update thesis form UI based on current data
 */
function updateThesisFormUI() {
  // Set form title
  if (ThesisDOM.formStatusDisplay) {
    ThesisDOM.formStatusDisplay.textContent = thesisFormMode === 'create' ? 'New Submission' : capitalize(thesisFormData.status);
    ThesisDOM.formStatusDisplay.className = `status-badge status-${thesisFormData.status || 'draft'}`;
  }
  
  // Set form fields
  if (ThesisDOM.titleInput) {
    ThesisDOM.titleInput.value = thesisFormData.title || '';
  }
  
  if (ThesisDOM.abstractTextarea) {
    ThesisDOM.abstractTextarea.value = thesisFormData.abstract || '';
  }
  
  // Update files list
  updateFilesListUI();
  
  // Update button states
  if (thesisFormData.status === 'submitted' || thesisFormData.status === 'under_review' || thesisFormData.status === 'approved') {
    // Disable form editing if thesis has been submitted
    disableFormEditing();
  } else {
    enableFormEditing();
  }
}

/**
 * Update the files list UI
 */
function updateFilesListUI() {
  if (!ThesisDOM.filesListContainer) return;
  
  const files = thesisFormData.files || [];
  
  if (files.length === 0) {
    ThesisDOM.filesListContainer.innerHTML = '<p>No files uploaded yet.</p>';
    return;
  }
  
  let filesHtml = '<ul class="files-list">';
  
  files.forEach((file, index) => {
    filesHtml += `
      <li>
        <div class="file-info">
          <span class="file-name">${file.name}</span>
          <span class="file-size">${formatFileSize(file.size || 0)}</span>
          <span class="file-type">${file.type || 'Unknown type'}</span>
        </div>
        ${thesisFormData.status === 'draft' ? `
          <button type="button" class="remove-file-btn" data-index="${index}">
            <span class="sr-only">Remove</span>×
          </button>
        ` : ''}
      </li>
    `;
  });
  
  filesHtml += '</ul>';
  ThesisDOM.filesListContainer.innerHTML = filesHtml;
  
  // Add event listeners for file removal buttons
  document.querySelectorAll('.remove-file-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.getAttribute('data-index'), 10);
      removeFile(index);
    });
  });
}

/**
 * Remove file from the thesis
 */
function removeFile(index) {
  if (!thesisFormData.files || thesisFormData.status !== 'draft') return;
  
  thesisFormData.files = thesisFormData.files.filter((_, i) => i !== index);
  updateFilesListUI();
}

/**
 * Disable form editing
 */
function disableFormEditing() {
  if (ThesisDOM.titleInput) ThesisDOM.titleInput.disabled = true;
  if (ThesisDOM.abstractTextarea) ThesisDOM.abstractTextarea.disabled = true;
  if (ThesisDOM.mainFileUploadInput) ThesisDOM.mainFileUploadInput.disabled = true;
  if (ThesisDOM.supportingFilesUploadInput) ThesisDOM.supportingFilesUploadInput.disabled = true;
  if (ThesisDOM.submitBtn) ThesisDOM.submitBtn.style.display = 'none';
  if (ThesisDOM.saveAsDraftBtn) ThesisDOM.saveAsDraftBtn.style.display = 'none';
  
  // Add readonly notice
  const readonlyNotice = document.createElement('div');
  readonlyNotice.className = 'readonly-notice';
  readonlyNotice.textContent = 'This thesis submission cannot be edited anymore.';
  
  ThesisDOM.formElement.prepend(readonlyNotice);
}

/**
 * Enable form editing
 */
function enableFormEditing() {
  if (ThesisDOM.titleInput) ThesisDOM.titleInput.disabled = false;
  if (ThesisDOM.abstractTextarea) ThesisDOM.abstractTextarea.disabled = false;
  if (ThesisDOM.mainFileUploadInput) ThesisDOM.mainFileUploadInput.disabled = false;
  if (ThesisDOM.supportingFilesUploadInput) ThesisDOM.supportingFilesUploadInput.disabled = false;
  if (ThesisDOM.submitBtn) ThesisDOM.submitBtn.style.display = 'inline-block';
  if (ThesisDOM.saveAsDraftBtn) ThesisDOM.saveAsDraftBtn.style.display = 'inline-block';
  
  // Remove readonly notice if exists
  const readonlyNotice = ThesisDOM.formElement.querySelector('.readonly-notice');
  if (readonlyNotice) readonlyNotice.remove();
}

/**
 * Set up thesis form event handlers
 */
function setupThesisFormEventHandlers() {
  // Form submission
  if (ThesisDOM.formElement) {
    ThesisDOM.formElement.addEventListener('submit', handleThesisFormSubmit);
  }
  
  // Save as draft button
  if (ThesisDOM.saveAsDraftBtn) {
    ThesisDOM.saveAsDraftBtn.addEventListener('click', handleSaveAsDraft);
  }
  
  // File upload handling
  if (ThesisDOM.mainFileUploadInput) {
    ThesisDOM.mainFileUploadInput.addEventListener('change', handleMainFileUpload);
  }
  
  if (ThesisDOM.supportingFilesUploadInput) {
    ThesisDOM.supportingFilesUploadInput.addEventListener('change', handleSupportingFilesUpload);
  }
}

/**
 * Handle main thesis file upload
 */
async function handleMainFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    showLoading('Uploading main thesis file...');
    
    const fileData = await uploadFile(file, 'main');
    
    // Replace any existing main file
    thesisFormData.files = thesisFormData.files.filter(f => f.category !== 'main');
    thesisFormData.files.push({
      name: file.name,
      size: file.size,
      type: file.type,
      url: fileData.url,
      path: fileData.path,
      category: 'main'
    });
    
    updateFilesListUI();
    hideLoading();
  } catch (error) {
    console.error('Error uploading main file:', error);
    hideLoading();
    showError(`Failed to upload file: ${error.message}`);
  }
}

/**
 * Handle supporting files upload
 */
async function handleSupportingFilesUpload(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;
  
  try {
    showLoading(`Uploading ${files.length} supporting file(s)...`);
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileData = await uploadFile(file, 'supporting');
      
      thesisFormData.files.push({
        name: file.name,
        size: file.size,
        type: file.type,
        url: fileData.url,
        path: fileData.path,
        category: 'supporting'
      });
    }
    
    updateFilesListUI();
    hideLoading();
  } catch (error) {
    console.error('Error uploading supporting files:', error);
    hideLoading();
    showError(`Failed to upload file(s): ${error.message}`);
  }
}

/**
 * Upload a file to storage
 */
async function uploadFile(file, category) {
  try {
    const fileName = `${Date.now()}-${file.name}`;
    const filePath = `theses/${thesisStudentData.id}/${category}/${fileName}`;
    
    // Upload file to Supabase storage
    const { data, error } = await thesisSupabaseClient.storage
      .from('thesis-files')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });
    
    if (error) throw error;
    
    // Get public URL
    const { data: { publicUrl } } = thesisSupabaseClient.storage
      .from('thesis-files')
      .getPublicUrl(data.path);
    
    return {
      path: data.path,
      url: publicUrl
    };
  } catch (error) {
    console.error('Error in uploadFile:', error);
    throw error;
  }
}

/**
 * Handle thesis form submission
 */
async function handleThesisFormSubmit(event) {
  event.preventDefault();
  
  if (isProcessing) return;
  
  try {
    isProcessing = true;
    
    // Validate form
    const validationResult = validateThesisForm();
    
    if (!validationResult.valid) {
      showError(validationResult.message);
      isProcessing = false;
      return;
    }
    
    // Confirm submission
    if (!confirm('Are you sure you want to submit your thesis? After submission, you will not be able to edit it further.')) {
      isProcessing = false;
      return;
    }
    
    showLoading('Submitting thesis...');
    
    // Gather form data
    thesisFormData.title = ThesisDOM.titleInput.value.trim();
    thesisFormData.abstract = ThesisDOM.abstractTextarea.value.trim();
    thesisFormData.status = 'submitted';
    thesisFormData.submitted_at = new Date().toISOString();
    
    // Save to database
    await saveThesis();
    
    // Show success message
    hideLoading();
    showSuccess('Your thesis has been submitted successfully!');
    
    // Redirect to student dashboard after a short delay
    setTimeout(() => {
      window.location.href = PathConfig.STUDENT_DASHBOARD;
    }, 2000);
    
  } catch (error) {
    console.error('Error submitting thesis:', error);
    hideLoading();
    showError(`Failed to submit thesis: ${error.message}`);
    isProcessing = false;
  }
}

/**
 * Handle save as draft
 */
async function handleSaveAsDraft() {
  if (isProcessing) return;
  
  try {
    isProcessing = true;
    showLoading('Saving draft...');
    
    // Gather form data
    thesisFormData.title = ThesisDOM.titleInput.value.trim();
    thesisFormData.abstract = ThesisDOM.abstractTextarea.value.trim();
    thesisFormData.status = 'draft';
    
    // Save to database
    await saveThesis();
    
    // Show success message
    hideLoading();
    showSuccess('Your thesis draft has been saved successfully!');
    isProcessing = false;
    
  } catch (error) {
    console.error('Error saving thesis draft:', error);
    hideLoading();
    showError(`Failed to save draft: ${error.message}`);
    isProcessing = false;
  }
}

/**
 * Save thesis to database
 */
async function saveThesis() {
  try {
    // Prepare thesis data
    const thesisData = {
      student_id: thesisStudentData.id,
      title: thesisFormData.title,
      abstract: thesisFormData.abstract,
      status: thesisFormData.status,
      files: thesisFormData.files
    };
    
    if (thesisFormData.status === 'submitted') {
      thesisData.submitted_at = thesisFormData.submitted_at;
    }
    
    if (thesisFormMode === 'edit' && thesisFormData.id) {
      // Update existing thesis
      const { error } = await thesisSupabaseClient
        .from('theses')
        .update(thesisData)
        .eq('id', thesisFormData.id);
      
      if (error) throw error;
      
    } else {
      // Insert new thesis
      const { data, error } = await thesisSupabaseClient
        .from('theses')
        .insert(thesisData)
        .select();
      
      if (error) throw error;
      
      // Update form mode and ID
      thesisFormData.id = data[0].id;
      thesisFormMode = 'edit';
    }
    
    // Create notification for supervisor if thesis is submitted
    if (thesisFormData.status === 'submitted' && thesisStudentData.supervisor_id) {
      await createSupervisorNotification();
    }
    
    return true;
  } catch (error) {
    console.error('Error saving thesis:', error);
    throw error;
  }
}

/**
 * Create notification for supervisor
 */
async function createSupervisorNotification() {
  try {
    // Get supervisor user ID
    const { data: supervisor, error: supervisorError } = await thesisSupabaseClient
      .from('supervisors')
      .select('user_id')
      .eq('id', thesisStudentData.supervisor_id)
      .single();
    
    if (supervisorError) throw supervisorError;
    
    // Get student full name
    const { data: user, error: userError } = await thesisSupabaseClient
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', thesisCurrentUser.id)
      .single();
    
    if (userError) throw userError;
    
    const studentName = `${user?.first_name || ''} ${user?.last_name || ''}`.trim();
    const studentTitle = studentName || 'Your student';
    
    // Create notification
    const notification = {
      user_id: supervisor.user_id,
      title: 'New Thesis Submission',
      message: `${studentTitle} has submitted a thesis titled "${thesisFormData.title}" for your review.`,
      type: 'thesis_submission',
      related_entity_id: thesisFormData.id,
      related_entity_type: 'thesis',
      read: false
    };
    
    const { error: notificationError } = await thesisSupabaseClient
      .from('notifications')
      .insert(notification);
    
    if (notificationError) throw notificationError;
    
    return true;
  } catch (error) {
    console.error('Error creating supervisor notification:', error);
    // Don't throw error to prevent interrupting the main flow
    return false;
  }
}

/**
 * Validate thesis form
 */
function validateThesisForm() {
  // Check title
  if (!ThesisDOM.titleInput.value.trim()) {
    return { valid: false, message: 'Please enter a thesis title.' };
  }
  
  // Check abstract
  if (!ThesisDOM.abstractTextarea.value.trim()) {
    return { valid: false, message: 'Please enter a thesis abstract.' };
  }
  
  // Check main file
  const hasMainFile = thesisFormData.files && 
                    thesisFormData.files.some(file => file.category === 'main');
  
  if (!hasMainFile) {
    return { valid: false, message: 'Please upload a main thesis document.' };
  }
  
  return { valid: true };
}

/**
 * Cache thesis DOM elements
 */
function cacheThesisDOMElements() {
  ThesisDOM.formElement = document.getElementById('thesis-form');
  ThesisDOM.titleInput = document.getElementById('thesis-title');
  ThesisDOM.abstractTextarea = document.getElementById('thesis-abstract');
  ThesisDOM.mainFileUploadInput = document.getElementById('main-file-upload');
  ThesisDOM.supportingFilesUploadInput = document.getElementById('supporting-files-upload');
  ThesisDOM.filesListContainer = document.getElementById('files-list');
  ThesisDOM.submitBtn = document.getElementById('submit-thesis-btn');
  ThesisDOM.saveAsDraftBtn = document.getElementById('save-draft-btn');
  ThesisDOM.formStatusDisplay = document.getElementById('form-status');
  ThesisDOM.formFeedbackDisplay = document.getElementById('form-feedback');
  
  if (!ThesisDOM.loadingIndicator) {
    ThesisDOM.loadingIndicator = document.getElementById('loading-indicator');
  }
  
  if (!ThesisDOM.errorContainer) {
    ThesisDOM.errorContainer = document.getElementById('error-container');
  }
}

/**
 * Create UI helpers (loading indicator and error container)
 */
function createUIHelpers() {
  // Create loading indicator if it doesn't exist
  if (!document.getElementById('loading-indicator')) {
    const loadingIndicator = document.createElement('div');
    loadingIndicator.id = 'loading-indicator';
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.innerHTML = `
      <div class="spinner"></div>
      <div class="loading-text">Loading...</div>
    `;
    document.body.appendChild(loadingIndicator);
    ThesisDOM.loadingIndicator = loadingIndicator;
  }
  
  // Create error container if it doesn't exist
  if (!document.getElementById('error-container')) {
    const errorContainer = document.createElement('div');
    errorContainer.id = 'error-container';
    errorContainer.className = 'error-container';
    document.body.appendChild(errorContainer);
    ThesisDOM.errorContainer = errorContainer;
  }
}

/**
 * Show loading indicator
 */
function showLoading(message = 'Loading...') {
  if (!ThesisDOM.loadingIndicator) return;
  
  const loadingText = ThesisDOM.loadingIndicator.querySelector('.loading-text');
  if (loadingText) {
    loadingText.textContent = message;
  }
  
  ThesisDOM.loadingIndicator.style.display = 'flex';
}

/**
 * Hide loading indicator
 */
function hideLoading() {
  if (!ThesisDOM.loadingIndicator) return;
  ThesisDOM.loadingIndicator.style.display = 'none';
}

/**
 * Show error message
 */
function showError(message) {
  if (!ThesisDOM.errorContainer) return;
  
  ThesisDOM.errorContainer.textContent = message;
  ThesisDOM.errorContainer.style.display = 'block';
  
  // Auto hide after 5 seconds
  setTimeout(() => {
    hideError();
  }, 5000);
}

/**
 * Hide error message
 */
function hideError() {
  if (!ThesisDOM.errorContainer) return;
  ThesisDOM.errorContainer.style.display = 'none';
}

/**
 * Show success message
 */
function showSuccess(message) {
  const successElement = document.createElement('div');
  successElement.className = 'success-message';
  successElement.textContent = message;
  
  document.body.appendChild(successElement);
  
  // Auto hide after 5 seconds
  setTimeout(() => {
    successElement.remove();
  }, 5000);
}

/**
 * Format file size for display
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Capitalize first letter of a string
 */
function capitalize(str) {
  if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
}