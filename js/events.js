// Student_supevision_system/js/events.js

/** 
 * SystemEvents - Centralized definitions for custom events used throughout the application.
 * This ensures consistency in event naming and usage.
 */
const SystemEvents = {
  // Supabase Client Events
  SUPABASE_CLIENT_INITIALIZED: 'supabase:client:initialized',
  SUPABASE_CLIENT_ERROR: 'supabase:client:error',
  
  // Authentication Events
  AUTH_MODULE_READY: 'auth:module:ready', // Fired when auth.js has completed its initial setup
  AUTH_STATE_CHANGED: 'auth:state:changed', // Fired on Supabase onAuthStateChange
  AUTH_LOGIN_SUCCESS: 'auth:login:success',
  AUTH_LOGIN_FAILED: 'auth:login:failed',
  AUTH_LOGOUT_SUCCESS: 'auth:logout:success',
  AUTH_LOGOUT_FAILED: 'auth:logout:failed',
  AUTH_PASSWORD_RESET_SENT: 'auth:password:reset:sent',
  AUTH_PASSWORD_UPDATED: 'auth:password:updated',
  AUTH_ERROR: 'auth:error', // General auth errors
  
  // Application Events
  APP_INIT_STARTED: 'app:init:started',
  APP_INIT_COMPLETE: 'app:init:complete',
  APP_LOADING: 'app:loading',
  APP_ERROR: 'app:error',
  
  // Navigation Events
  NAV_BEFORE_CHANGE: 'nav:before:change',
  NAV_AFTER_CHANGE: 'nav:after:change',
  
  // User Profile Events
  USER_PROFILE_LOADED: 'user:profile:loaded',
  
  // Project Events
  PROJECT_LOADED: 'project:loaded',
  PROJECT_UPDATED: 'project:updated',
  
  // Supervisor Events
  SUPERVISOR_DATA_LOADED: 'supervisor:data:loaded',
  
  // Student Events
  STUDENT_DATA_LOADED: 'student:data:loaded',
  
  // Notification Events
  NOTIFICATIONS_LOADED: 'notifications:loaded',
  NOTIFICATION_NEW: 'notification:new',
  
  // Meeting Events
  MEETINGS_LOADED: 'meetings:loaded',
  MEETING_SCHEDULED: 'meeting:scheduled',
  MEETING_UPDATED: 'meeting:updated',
  MEETING_CANCELLED: 'meeting:cancelled',
  
  // Submission Events
  SUBMISSIONS_LOADED: 'submissions:loaded',
  SUBMISSION_CREATED: 'submission:created',
  SUBMISSION_UPDATED: 'submission:updated',
  
  // Ethics Events
  ETHICS_FORM_SUBMITTED: 'ethics:form:submitted',
  ETHICS_REVIEW_COMPLETED: 'ethics:review:completed',
  
  // Thesis Events
  THESIS_SUBMITTED: 'thesis:submitted',
  THESIS_MARKED: 'thesis:marked',
  
  // Admin Events
  ADMIN_DATA_LOADED: 'admin:data:loaded'
};

// Make SystemEvents globally available
window.SystemEvents = SystemEvents;

/**
 * Global event emitter function
 * Allows any component to emit events that others can listen for
 * @param {string} eventName - Name of the event to emit
 * @param {any} data - Optional data to pass with the event
 */
window.emitEvent = function(eventName, data = null) {
  console.log(`Emitting event: ${eventName}`, data);
  const event = new CustomEvent(eventName, { 
    detail: data,
    bubbles: true,
    cancelable: true
  });
  window.dispatchEvent(event);
};

/**
 * Helper function to listen for events
 * @param {string} eventName - Name of the event to listen for
 * @param {function} callback - Function to call when event is triggered
 * @param {boolean} once - Whether to remove listener after first trigger
 */
window.onEvent = function(eventName, callback, once = false) {
  const handler = (e) => callback(e.detail);
  if (once) {
    window.addEventListener(eventName, function oneTimeHandler(e) {
      handler(e);
      window.removeEventListener(eventName, oneTimeHandler);
    });
  } else {
    window.addEventListener(eventName, handler);
  }
};

// Make event helpers globally available
if (typeof window !== 'undefined') {
  // These are already defined above but we're being explicit here
  window.SystemEvents = SystemEvents;
  // window.emitEvent is already defined above
  // window.onEvent is already defined above
  
  console.log('Events module initialized');
}
