// Student_supevision_system/js/script.js - Common Configurations and Utility Functions

// --- Global Configurations ---
const PathConfig = {
  LOGIN: '/login.html', // Ensure this matches your file structure, e.g., could be just 'login.html' if in root
  RESET_PASSWORD_PAGE: '/reset-password.html',
  UNAUTHORIZED_PAGE: '/unauthorized.html', // You'll need to create this page
  ADMIN_DASHBOARD: '/admin.html',
  STUDENT_DASHBOARD: '/student.html',
  SUPERVISOR_DASHBOARD: '/supervisor.html',
  COMMITTEE_DASHBOARD: '/committee-dashboard.html', // Corrected from '/committee.html' if filename is 'committee-dashboard.html'
  THESIS_SUBMISSION: '/thesis-submission.html',
  THESIS_REVIEW: '/thesis-review.html', // Assuming this page exists
  THESIS_MARKING: '/thesis-marking.html',
  ETHICS_FORM: '/ethics-form.html',
  ETHICS_REVIEW: '/ethics-review.html',
  MARKERS: '/markers.html', // For Marker Dashboard
  INDEX: '/index.html',
  TERMS_OF_SERVICE: '/terms-of-service.html',
  PRIVACY_POLICY: '/privacy-policy.html',
  HELP_AND_CONTACT: '/help-and-contact.html',

  // Adding Filename properties for clearer path checking in app.js
  ADMIN_DASHBOARD_FILENAME: 'admin.html',
  STUDENT_DASHBOARD_FILENAME: 'student.html',
  SUPERVISOR_DASHBOARD_FILENAME: 'supervisor.html',
  COMMITTEE_DASHBOARD_FILENAME: 'committee-dashboard.html',
  MARKER_DASHBOARD_FILENAME: 'markers.html',
  THESIS_SUBMISSION_FILENAME: 'thesis-submission.html',
  ETHICS_FORM_FILENAME: 'ethics-form.html',
  ETHICS_REVIEW_FILENAME: 'ethics-review.html',
  THESIS_MARKING_FILENAME: 'thesis-marking.html',


  // API_BASE: '/api', // If you have a backend API
  // UPLOAD_ENDPOINT: '/api/upload', // If you have a backend API
};
window.PathConfig = PathConfig; // Make PathConfig globally available

const SystemConfig = {
  MAX_UPLOAD_SIZE_MB: 50,
  ALLOWED_FILE_TYPES: {
    document: ['.pdf', '.doc', '.docx', '.txt'],
    image: ['.jpg', '.jpeg', '.png', '.gif'],
    spreadsheet: ['.xls', '.xlsx', '.csv'],
    presentation: ['.ppt', '.pptx'],
    archive: ['.zip', '.rar'],
  },
  DATE_FORMAT: 'DD/MM/YYYY', // Consider using toLocaleDateString for localization
  TIME_FORMAT: 'HH:mm',   // Consider using toLocaleTimeString
  SESSION_TIMEOUT_MINS: 60, // This would typically be managed by Supabase session settings
  PAGINATION_ITEMS_PER_PAGE: 10,
  DEFAULT_ACADEMIC_YEAR: "2024-2025" // Example
};
window.SystemConfig = SystemConfig;

const RolePermissions = { // This is more for front-end UI hints, actual permissions are enforced by RLS.
  admin: {
    canCreateUsers: true,
    canDeleteUsers: true,
    canAssignRoles: true,
    canViewAllData: true,
    canModifySettings: true
  },
  supervisor: {
    canCreateStudents: false, // Admins usually create students
    canReviewThesis: true,
    canProvideEthicsApproval: true, // Or committee
    canAssignMarkers: false // Usually admin or committee lead
  },
  student: {
    canSubmitThesis: true,
    canSubmitEthicsForm: true,
    canViewFeedback: true
  },
  committee: { // Ethics committee or thesis committee
    canReviewThesis: true,
    canReviewEthics: true,
    canProvideFeedback: true
  },
  marker: {
    canMarkThesis: true,
    canProvideFeedback: true
  }
};
window.RolePermissions = RolePermissions;

const ErrorMessages = { // Consider if these are still needed if using toasts/specific error displays
  AUTH: {
    LOGIN_FAILED: 'Login failed. Please check your credentials and try again.',
    SESSION_EXPIRED: 'Your session has expired. Please log in again.',
    INVALID_CREDENTIALS: 'Invalid email or password.',
    AUTH_REQUIRED: 'Authentication required. Please log in.',
    ACCESS_DENIED: 'You do not have permission to access this resource.',
    INVALID_TOKEN: 'Invalid authentication token.'
  },
  DATABASE: { // Generic messages; specific errors often come from Supabase
    CONNECTION_FAILED: 'Database connection failed. Please try again later.',
    QUERY_FAILED: 'Error retrieving data from the database.',
    INSERT_FAILED: 'Failed to save data to the database.',
    UPDATE_FAILED: 'Failed to update data in the database.',
    DELETE_FAILED: 'Failed to delete data from the database.'
  },
  FORM: {
    VALIDATION_FAILED: 'Please fix the highlighted errors before submitting.',
    REQUIRED_FIELDS: 'Please fill in all required fields.',
    INVALID_FORMAT: 'One or more fields have an invalid format.',
    SUBMISSION_FAILED: 'Form submission failed. Please try again.'
  },
  FILE: {
    UPLOAD_FAILED: 'File upload failed. Please try again.',
    FILE_TOO_LARGE: `File exceeds the maximum size limit of ${SystemConfig.MAX_UPLOAD_SIZE_MB}MB.`,
    INVALID_TYPE: 'Invalid file type. Please upload a supported file format.',
    DOWNLOAD_FAILED: 'File download failed. Please try again.'
  },
  SYSTEM: {
    GENERAL_ERROR: 'An unexpected error occurred. Please try again later.',
    NOT_FOUND: 'The requested resource was not found.',
    SERVER_ERROR: 'Server error. Please contact technical support.', // Supabase provides its own server errors
    TIMEOUT: 'The request timed out. Please check your connection and try again.'
  }
};
window.ErrorMessages = ErrorMessages;


// --- Utility Functions ---

/**
 * Formats a date string into a more readable format.
 * @param {string | Date} dateString - The date string or Date object.
 * @param {object} options - Options for toLocaleDateString.
 * @returns {string} Formatted date string or 'N/A'.
 */
function formatDate(dateString, options = { year: 'numeric', month: 'short', day: 'numeric' }) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Invalid Date';
  return date.toLocaleDateString(undefined, options);
}
window.formatDate = formatDate;

/**
 * Formats a time string from a date object.
 * @param {string | Date} dateString - The date string or Date object.
 * @param {object} options - Options for toLocaleTimeString.
 * @returns {string} Formatted time string or 'N/A'.
 */
function formatTime(dateString, options = { hour: '2-digit', minute: '2-digit' }) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Invalid Time';
  return date.toLocaleTimeString(undefined, options);
}
window.formatTime = formatTime;

/**
 * Formats a date and time string.
 * @param {string | Date} dateString - The date string or Date object.
 * @returns {string} Formatted date and time string or 'N/A'.
 */
function formatDateTime(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Invalid Date/Time';
  return `${formatDate(date)} ${formatTime(date)}`;
}
window.formatDateTime = formatDateTime;

/**
 * Truncates text to a specified maximum length.
 * @param {string} text - The text to truncate.
 * @param {number} maxLength - The maximum length of the text.
 * @returns {string} Truncated text with ellipsis if over maxLength.
 */
function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
}
window.truncateText = truncateText;

/**
 * Capitalizes the first letter of a string.
 * @param {string} string - The string to capitalize.
 * @returns {string} String with the first letter capitalized.
 */
function capitalizeFirstLetter(string) {
  if (!string) return '';
  return string.charAt(0).toUpperCase() + string.slice(1);
}
window.capitalizeFirstLetter = capitalizeFirstLetter;

/**
 * Formats file size into a readable format (Bytes, KB, MB, GB, TB).
 * @param {number} bytes - File size in bytes.
 * @returns {string} Formatted file size string.
 */
function formatFileSize(bytes) {
  if (bytes === null || bytes === undefined || isNaN(bytes) || bytes < 0) return '0 Bytes';
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
window.formatFileSize = formatFileSize;


/**
 * Validates an email address format.
 * @param {string} email - The email address to validate.
 * @returns {boolean} True if the email format is valid.
 */
function validateEmail(email) {
  if (!email) return false;
  const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email).toLowerCase());
}
window.validateEmail = validateEmail;

/**
 * Validates if a value is provided (not null, undefined, or empty string).
 * @param {*} value - The value to check.
 * @returns {boolean} True if the value is considered "required" and present.
 */
function validateRequired(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return true;
}
window.validateRequired = validateRequired;

// --- DOM Utility Functions --- (These are also defined in app.js, consider centralizing or namespacing)

/**
 * Shows a global loading indicator.
 * @param {string} [message='Loading...'] - The message to display.
 */
function showGlobalLoading(message = 'Loading...') {
  let loadingOverlay = document.getElementById('loadingOverlay'); // ID from index.html
  if (!loadingOverlay) { // Create if not exists (e.g. on login page)
    loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'loadingOverlay';
    loadingOverlay.className = 'loading-overlay fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-[10000] text-white';
    loadingOverlay.innerHTML = `<div class="bg-gray-800 p-6 rounded-lg shadow-xl text-center">
                                   <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                                   <div id="loadingMessage" class="text-lg">${message}</div>
                                 </div>`;
    document.body.appendChild(loadingOverlay);
  }
  const msgElement = loadingOverlay.querySelector('#loadingMessage') || loadingOverlay.querySelector('.text-lg');
  if(msgElement) msgElement.textContent = message;
  loadingOverlay.style.display = 'flex';
  loadingOverlay.classList.remove('hidden');
}
window.showGlobalLoading = showGlobalLoading;

/**
 * Hides the global loading indicator.
 */
function hideGlobalLoading() {
  const loadingOverlay = document.getElementById('loadingOverlay');
  if (loadingOverlay) {
    loadingOverlay.style.display = 'none';
    loadingOverlay.classList.add('hidden');
  }
}
window.hideGlobalLoading = hideGlobalLoading;

/**
 * Displays a global error message overlay.
 * @param {string} message - The main error message.
 * @param {string} [details=''] - Additional details for the error.
 */
function showGlobalError(message, details = '') {
  let errorOverlay = document.getElementById('errorOverlay'); // ID from index.html
  if (!errorOverlay) { // Create if not exists
      errorOverlay = document.createElement('div');
      errorOverlay.id = 'errorOverlay';
      errorOverlay.className = 'loading-overlay fixed inset-0 bg-red-100 bg-opacity-90 flex items-center justify-center z-[10000] text-red-700';
      errorOverlay.innerHTML = `<div class="bg-white p-8 rounded-lg shadow-xl text-center max-w-md">
                                  <div class="text-red-500 mb-4"><i class="fas fa-exclamation-triangle fa-3x"></i></div>
                                  <h2 class="text-2xl font-bold text-red-700 mb-2">System Error</h2>
                                  <p id="errorMessage" class="text-lg mb-4"></p>
                                  <button id="errorDismissButton" class="bg-red-500 text-white px-6 py-2 rounded-lg hover:bg-red-600 transition">Dismiss</button>
                                </div>`;
      document.body.appendChild(errorOverlay);
      errorOverlay.querySelector('#errorDismissButton').addEventListener('click', () => {
          errorOverlay.style.display = 'none';
          errorOverlay.classList.add('hidden');
      });
  }
  const errorMessageElement = errorOverlay.querySelector('#errorMessage');
  if(errorMessageElement) errorMessageElement.innerHTML = `${message}${details ? `<br><small class="text-gray-600">${details}</small>` : ''}`;
  
  hideGlobalLoading(); // Hide general loading when showing an error
  errorOverlay.style.display = 'flex';
  errorOverlay.classList.remove('hidden');
}
window.showGlobalError = showGlobalError;


/**
 * Displays a toast notification.
 * @param {string} message - The message to display.
 * @param {string} [type='info'] - Type of toast: 'info', 'success', 'warning', 'danger'.
 * @param {number} [duration=3000] - Duration in milliseconds to show the toast.
 */
function showToastNotification(message, type = 'info', duration = 3000) {
  let toastContainer = document.getElementById('toast-notification-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-notification-container';
    // Apply Tailwind classes for positioning and styling
    toastContainer.className = 'fixed bottom-5 right-5 z-[10005] space-y-2';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  let bgColor, textColor, iconClass;

  switch (type) {
    case 'success':
      bgColor = 'bg-green-500'; textColor = 'text-white'; iconClass = 'fas fa-check-circle';
      break;
    case 'warning':
      bgColor = 'bg-yellow-500'; textColor = 'text-white'; iconClass = 'fas fa-exclamation-triangle';
      break;
    case 'danger':
    case 'error': // Alias for danger
      bgColor = 'bg-red-500'; textColor = 'text-white'; iconClass = 'fas fa-times-circle';
      break;
    case 'info':
    default:
      bgColor = 'bg-blue-500'; textColor = 'text-white'; iconClass = 'fas fa-info-circle';
      break;
  }

  toast.className = `${bgColor} ${textColor} p-4 rounded-lg shadow-md flex items-center space-x-3 transition-all duration-300 ease-in-out opacity-0 transform translate-x-full`;
  toast.innerHTML = `
    <i class="${iconClass} text-xl"></i>
    <span>${message}</span>
    <button class="toast-close-btn ml-auto -mr-1 -my-1 p-1 hover:bg-white hover:bg-opacity-20 rounded-md">&times;</button>
  `;

  toastContainer.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.classList.remove('opacity-0', 'translate-x-full');
    toast.classList.add('opacity-100', 'translate-x-0');
  });

  const removeToast = () => {
    toast.classList.remove('opacity-100', 'translate-x-0');
    toast.classList.add('opacity-0', 'translate-x-full');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300); // Wait for animation to finish
  };

  toast.querySelector('.toast-close-btn').addEventListener('click', removeToast);

  if (duration > 0) {
    setTimeout(removeToast, duration);
  }
}
window.showToastNotification = showToastNotification; // Expose globally


// --- Main ---
document.addEventListener('DOMContentLoaded', () => {
  console.log('script.js: DOMContentLoaded. Global configurations and utilities are set up.');
  // The main application initialization is now handled by app.js,
  // which should be loaded after this script.
  // Any general UI enhancements or global event listeners that are not part of
  // the core app initialization sequence can be added here.

  // Example: Set current year in footers (if elements exist on the page)
  const yearElements = document.querySelectorAll('.currentYear, #currentYear, #currentYearTos, #currentYearPp, #currentYearHelp, #currentYearEr1, #currentYearEr2');
  yearElements.forEach(el => {
    el.textContent = new Date().getFullYear();
  });

  // Example: Adding a global click listener for a common component
  // document.body.addEventListener('click', function(event) {
  //   if (event.target.matches('.some-common-button-class')) {
  //     // Handle click
  //   }
  // });
});

console.log('script.js loaded and has set up global configurations (PathConfig, etc.) and utility functions.');