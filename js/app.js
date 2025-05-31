// Student_supevision_system/js/app.js

// Main application initialization sequence.
// This function coordinates the loading of essential modules and user redirection.
async function initializeApp() {
  // Check for required dependencies
  if (typeof window.SystemEvents === 'undefined') {
    console.error('App.js: SystemEvents is not defined. Ensure events.js is loaded before app.js.');
    showErrorMessage('Critical system file (events.js) missing. Please contact support.');
    return;
  }
  
  if (typeof window.PathConfig === 'undefined') {
    console.error('App.js: PathConfig is not defined. Ensure script.js is loaded before app.js.');
    showErrorMessage('Critical system file (PathConfig) missing. Please contact support.');
    return;
  }

  // Signal that app initialization has started
  window.emitEvent(SystemEvents.APP_INIT_STARTED);
  
  showLoadingIndicator('Initializing system...');
  
  try {
    // Initialize Supabase client
    const supabaseClient = getSupabaseClient();
    if (!supabaseClient) {
      throw new Error('Failed to initialize Supabase client');
    }
    
    // Wait for auth module to be ready
    let authInitialized = false;
    
    // Check if auth module is already initialized
    if (window.authModule && window.authModule.isInitialized()) {
      authInitialized = true;
    } else {
      // Wait for auth module to be ready with timeout
      authInitialized = await new Promise((resolve) => {
        // Set a timeout in case the event never fires
        const timeoutId = setTimeout(() => {
          console.warn('Auth module initialization timed out');
          resolve(false);
        }, 5000);
        
        // Listen for auth module ready event
        window.addEventListener(SystemEvents.AUTH_MODULE_READY, () => {
          clearTimeout(timeoutId);
          resolve(true);
        }, { once: true });
        
        // Try to manually initialize if function is available
        if (window.authModule && typeof window.authModule.initialize === 'function') {
          window.authModule.initialize().catch(err => {
            console.error('Manual auth initialization failed:', err);
          });
        }
      });
    }
    
    if (!authInitialized) {
      console.warn('Proceeding with app initialization despite auth module not being ready');
    }
    
    // Get current auth state
    const isAuthenticated = window.authModule?.isAuthenticated() || false;
    const currentUser = window.authModule?.getCurrentUser() || null;
    const orgData = window.authModule?.getUserOrganizationData() || null;
    
    console.log('App initialization - Auth state:', { isAuthenticated, currentUser });
    
    // Handle routing based on authentication state
    const currentPath = window.location.pathname;
    
    // Check if we're on the login page
    const isLoginPage = currentPath === PathConfig.LOGIN || 
                        currentPath === '/' + PathConfig.LOGIN;  // Account for different path formats
    
    // Check if we're on the reset password page
    const isResetPasswordPage = currentPath === PathConfig.RESET_PASSWORD_PAGE || 
                               currentPath === '/' + PathConfig.RESET_PASSWORD_PAGE;
    
    if (isAuthenticated) {
      // User is authenticated
      if (isLoginPage || isResetPasswordPage || currentPath === '/' || currentPath === '/index.html') {
        // Redirect to appropriate dashboard based on user role
        await routeUserToDashboard(orgData);
      } else {
        // User is on a content page, check if they have access
        const hasAccess = await checkPageAccess(currentPath, orgData);
        if (!hasAccess) {
          console.warn('User does not have access to this page, redirecting...');
          await routeUserToDashboard(orgData);
        } else {
          // User has access, initialize the current page
          await initializeCurrentPage(currentPath);
        }
      }
    } else {
      // User is not authenticated
      if (!isLoginPage && !isResetPasswordPage) {
        // Redirect to login page
        console.log('User not authenticated, redirecting to login page');
        window.location.href = PathConfig.LOGIN;
      } else {
        // User is already on login or reset password page, just initialize it
        await initializeCurrentPage(currentPath);
      }
    }
    
    // Signal that app initialization is complete
    window.emitEvent(SystemEvents.APP_INIT_COMPLETE);
    hideLoadingIndicator();
    
  } catch (error) {
    console.error('App initialization failed:', error);
    showErrorMessage('Failed to initialize application. Please try refreshing the page.');
    hideLoadingIndicator();
  }
}

/**
 * Route authenticated user to the appropriate dashboard based on their role
 * @param {Object} orgData - User organization data
 */
async function routeUserToDashboard(orgData) {
  // Default to student dashboard if role detection fails
  let targetDashboard = PathConfig.STUDENT_DASHBOARD;
  
  if (orgData && orgData.roles && orgData.roles.length > 0) {
    // Check user roles and route accordingly
    const roles = orgData.roles.map(role => role.name ? role.name.toLowerCase() : '');
    
    if (roles.includes('administrator')) {
      targetDashboard = PathConfig.ADMIN_DASHBOARD;
    } else if (roles.includes('supervisor')) {
      targetDashboard = PathConfig.SUPERVISOR_DASHBOARD;
    } else if (roles.includes('committee member')) {
      targetDashboard = PathConfig.COMMITTEE_DASHBOARD;
    } else if (roles.includes('marker')) {
      targetDashboard = PathConfig.MARKERS;
    }
  }
  
  // Redirect to dashboard
  console.log('Routing user to dashboard:', targetDashboard);
  window.location.href = targetDashboard;
}

/**
 * Check if the user has access to the current page based on their roles
 * @param {string} path - Current page path
 * @param {Object} orgData - User organization data
 * @returns {boolean} Whether the user has access
 */
async function checkPageAccess(path, orgData) {
  // If no org data, deny access to most pages
  if (!orgData || !orgData.roles || orgData.roles.length === 0) {
    // Only allow access to public pages
    const publicPages = [PathConfig.LOGIN, PathConfig.RESET_PASSWORD_PAGE];
    return publicPages.some(page => path.includes(page));
  }
  
  const roles = orgData.roles.map(role => role.name ? role.name.toLowerCase() : '');
  
  // Map pages to required roles
  const pageAccessMap = {
    [PathConfig.ADMIN_DASHBOARD]: ['administrator'],
    [PathConfig.SUPERVISOR_DASHBOARD]: ['supervisor'],
    [PathConfig.STUDENT_DASHBOARD]: ['student'],
    [PathConfig.COMMITTEE_DASHBOARD]: ['committee member', 'administrator'],
    [PathConfig.MARKERS]: ['marker', 'supervisor', 'administrator'],
    [PathConfig.THESIS_SUBMISSION]: ['student'],
    [PathConfig.THESIS_REVIEW]: ['supervisor', 'committee member', 'administrator'],
    [PathConfig.THESIS_MARKING]: ['marker', 'supervisor', 'administrator'],
    [PathConfig.ETHICS_FORM]: ['student'],
    [PathConfig.ETHICS_REVIEW]: ['supervisor', 'committee member', 'administrator']
  };
  
  // Check if the current path matches any restricted page
  for (const [pagePath, requiredRoles] of Object.entries(pageAccessMap)) {
    if (path.includes(pagePath)) {
      // Check if user has any of the required roles
      return roles.some(role => requiredRoles.includes(role));
    }
  }
  
  // If page is not in the map, allow access by default
  return true;
}

/**
 * Initialize the current page based on the path
 * @param {string} path - Current page path
 */
async function initializeCurrentPage(path) {
  console.log('Initializing page:', path);
  
  // Initialize page-specific JavaScript based on the current path
  if (path.includes(PathConfig.ADMIN_DASHBOARD)) {
    if (typeof initializeAdminDashboard === 'function') {
      await initializeAdminDashboard();
    }
  } else if (path.includes(PathConfig.SUPERVISOR_DASHBOARD)) {
    if (typeof initializeSupervisorDashboard === 'function') {
      await initializeSupervisorDashboard();
    }
  } else if (path.includes(PathConfig.STUDENT_DASHBOARD)) {
    if (typeof initializeStudentDashboard === 'function') {
      await initializeStudentDashboard();
    }
  } else if (path.includes(PathConfig.COMMITTEE_DASHBOARD)) {
    if (typeof initializeCommittee === 'function') {
      await initializeCommittee();
    }
  } else if (path.includes(PathConfig.MARKERS)) {
    if (typeof initializeMarkers === 'function') {
      await initializeMarkers();
    }
  } else if (path.includes(PathConfig.THESIS_SUBMISSION)) {
    if (typeof initializeThesisSubmission === 'function') {
      await initializeThesisSubmission();
    }
  } else if (path.includes(PathConfig.THESIS_REVIEW)) {
    if (typeof initializeThesisReview === 'function') {
      await initializeThesisReview();
    }
  } else if (path.includes(PathConfig.THESIS_MARKING)) {
    if (typeof initializeThesisMarking === 'function') {
      await initializeThesisMarking();
    }
  } else if (path.includes(PathConfig.ETHICS_FORM)) {
  else if (path.includes(PathConfig.ETHICS_FORM)) {
    if (typeof initializeEthicsForm === 'function') {
      await initializeEthicsForm();
    }
  } else if (path.includes(PathConfig.ETHICS_REVIEW)) {
    if (typeof initializeEthicsReview === 'function') {
      await initializeEthicsReview();
    }
  } else if (path.includes(PathConfig.LOGIN)) {
    // Initialize login page components
    setupLoginForm();
  } else if (path.includes(PathConfig.RESET_PASSWORD_PAGE)) {
    // Initialize password reset page
    setupPasswordResetForm();
  }
}

/**
 * Set up the login form event handlers
 */
function setupLoginForm() {
  const loginForm = document.getElementById('login-form');
  const emailInput = document.getElementById('email-input');
  const passwordInput = document.getElementById('password-input');
  const loginButton = document.getElementById('login-button');
  const forgotPasswordLink = document.getElementById('forgot-password-link');
  const loginError = document.getElementById('login-error');
  
  if (!loginForm) return;
  
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Clear previous errors
    loginError.textContent = '';
    loginError.style.display = 'none';
    
    // Disable form elements during login
    emailInput.disabled = true;
    passwordInput.disabled = true;
    loginButton.disabled = true;
    loginButton.textContent = 'Signing in...';
    
    try {
      // Get auth module
      if (!window.authModule || typeof window.authModule.loginWithEmailPassword !== 'function') {
        throw new Error('Auth module not available');
      }
      
      const email = emailInput.value.trim();
      const password = passwordInput.value;
      
      if (!email || !password) {
        throw new Error('Please enter both email and password');
      }
      
      // Attempt login
      const result = await window.authModule.loginWithEmailPassword(email, password);
      
      if (result.success && result.user) {
        // Login successful, user will be redirected in the auth state change handler
        console.log('Login successful, redirecting...');
      } else {
        // Show error
        loginError.textContent = result.error || 'Login failed. Please try again.';
        loginError.style.display = 'block';
      }
    } catch (error) {
      console.error('Login error:', error);
      loginError.textContent = error.message || 'An error occurred. Please try again.';
      loginError.style.display = 'block';
    } finally {
      // Re-enable form elements
      emailInput.disabled = false;
      passwordInput.disabled = false;
      loginButton.disabled = false;
      loginButton.textContent = 'Sign In';
    }
  });
  
  // Set up forgot password link
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Simple implementation - show password reset form
      const loginContainer = document.querySelector('.login-container');
      const resetContainer = document.querySelector('.reset-container');
      
      if (loginContainer && resetContainer) {
        loginContainer.style.display = 'none';
        resetContainer.style.display = 'block';
      }
    });
  }
  
  // Set up password reset request form if it exists
  const resetForm = document.getElementById('reset-form');
  const resetEmailInput = document.getElementById('reset-email-input');
  const resetButton = document.getElementById('reset-button');
  const resetError = document.getElementById('reset-error');
  const resetSuccess = document.getElementById('reset-success');
  const backToLoginLink = document.getElementById('back-to-login-link');
  
  if (resetForm) {
    resetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      // Clear previous messages
      resetError.textContent = '';
      resetError.style.display = 'none';
      resetSuccess.textContent = '';
      resetSuccess.style.display = 'none';
      
      // Disable form elements during request
      resetEmailInput.disabled = true;
      resetButton.disabled = true;
      resetButton.textContent = 'Sending...';
      
      try {
        // Get auth module
        if (!window.authModule || typeof window.authModule.sendPasswordResetEmail !== 'function') {
          throw new Error('Auth module not available');
        }
        
        const email = resetEmailInput.value.trim();
        
        if (!email) {
          throw new Error('Please enter your email address');
        }
        
        // Attempt to send reset email
        const result = await window.authModule.sendPasswordResetEmail(email);
        
        if (result.success) {
          // Show success message
          resetSuccess.textContent = `Password reset instructions have been sent to ${email}`;
          resetSuccess.style.display = 'block';
          resetEmailInput.value = '';
        } else {
          // Show error
          resetError.textContent = result.error || 'Failed to send reset email. Please try again.';
          resetError.style.display = 'block';
        }
      } catch (error) {
        console.error('Password reset error:', error);
        resetError.textContent = error.message || 'An error occurred. Please try again.';
        resetError.style.display = 'block';
      } finally {
        // Re-enable form elements
        resetEmailInput.disabled = false;
        resetButton.disabled = false;
        resetButton.textContent = 'Send Reset Link';
      }
    });
  }
  
  // Set up back to login link
  if (backToLoginLink) {
    backToLoginLink.addEventListener('click', (e) => {
      e.preventDefault();
      
      const loginContainer = document.querySelector('.login-container');
      const resetContainer = document.querySelector('.reset-container');
      
      if (loginContainer && resetContainer) {
        resetContainer.style.display = 'none';
        loginContainer.style.display = 'block';
      }
    });
  }
}

/**
 * Set up the password reset form event handlers
 */
function setupPasswordResetForm() {
  const resetForm = document.getElementById('password-reset-form');
  const passwordInput = document.getElementById('new-password-input');
  const confirmPasswordInput = document.getElementById('confirm-password-input');
  const resetButton = document.getElementById('reset-button');
  const resetError = document.getElementById('reset-error');
  const resetSuccess = document.getElementById('reset-success');
  
  if (!resetForm) return;
  
  resetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Clear previous messages
    resetError.textContent = '';
    resetError.style.display = 'none';
    resetSuccess.textContent = '';
    resetSuccess.style.display = 'none';
    
    // Disable form elements during reset
    passwordInput.disabled = true;
    confirmPasswordInput.disabled = true;
    resetButton.disabled = true;
    resetButton.textContent = 'Updating password...';
    
    try {
      // Get auth module
      if (!window.authModule || typeof window.authModule.updatePassword !== 'function') {
        throw new Error('Auth module not available');
      }
      
      const password = passwordInput.value;
      const confirmPassword = confirmPasswordInput.value;
      
      if (!password || !confirmPassword) {
        throw new Error('Please enter both password fields');
      }
      
      if (password !== confirmPassword) {
        throw new Error('Passwords do not match');
      }
      
      if (password.length < 8) {
        throw new Error('Password must be at least 8 characters long');
      }
      
      // Attempt to update password
      const result = await window.authModule.updatePassword(password);
      
      if (result.success) {
        // Show success message
        resetSuccess.textContent = 'Password has been updated successfully. Redirecting to login...';
        resetSuccess.style.display = 'block';
        
        // Redirect to login after a delay
        setTimeout(() => {
          window.location.href = PathConfig.LOGIN;
        }, 2000);
      } else {
        // Show error
        resetError.textContent = result.error || 'Failed to update password. Please try again.';
        resetError.style.display = 'block';
      }
    } catch (error) {
      console.error('Password update error:', error);
      resetError.textContent = error.message || 'An error occurred. Please try again.';
      resetError.style.display = 'block';
    } finally {
      // Re-enable form elements
      passwordInput.disabled = false;
      confirmPasswordInput.disabled = false;
      resetButton.disabled = false;
      resetButton.textContent = 'Reset Password';
    }
  });
}

/**
 * Show loading indicator
 * @param {string} message - Loading message to display
 */
function showLoadingIndicator(message = 'Loading...') {
  let loadingIndicator = document.getElementById('loading-indicator');
  
  if (!loadingIndicator) {
    // Create loading indicator if it doesn't exist
    loadingIndicator = document.createElement('div');
    loadingIndicator.id = 'loading-indicator';
    loadingIndicator.className = 'loading-indicator';
    
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    
    const messageElement = document.createElement('div');
    messageElement.className = 'loading-message';
    
    loadingIndicator.appendChild(spinner);
    loadingIndicator.appendChild(messageElement);
    document.body.appendChild(loadingIndicator);
  }
  
  // Update message
  const messageElement = loadingIndicator.querySelector('.loading-message');
  if (messageElement) {
    messageElement.textContent = message;
  }
  
  // Show loading indicator
  loadingIndicator.style.display = 'flex';
}

/**
 * Hide loading indicator
 */
function hideLoadingIndicator() {
  const loadingIndicator = document.getElementById('loading-indicator');
  if (loadingIndicator) {
    loadingIndicator.style.display = 'none';
  }
}

/**
 * Show error message
 * @param {string} message - Error message to display
 */
function showErrorMessage(message) {
  let errorContainer = document.getElementById('error-container');
  
  if (!errorContainer) {
    // Create error container if it doesn't exist
    errorContainer = document.createElement('div');
    errorContainer.id = 'error-container';
    errorContainer.className = 'error-container';
    
    const errorIcon = document.createElement('div');
    errorIcon.className = 'error-icon';
    errorIcon.innerHTML = '❌';
    
    const errorMessage = document.createElement('div');
    errorMessage.className = 'error-message';
    
    const closeButton = document.createElement('button');
    closeButton.className = 'close-button';
    closeButton.innerHTML = '×';
    closeButton.addEventListener('click', () => {
      errorContainer.style.display = 'none';
    });
    
    errorContainer.appendChild(errorIcon);
    errorContainer.appendChild(errorMessage);
    errorContainer.appendChild(closeButton);
    document.body.appendChild(errorContainer);
  }
  
  // Update message
  const errorMessage = errorContainer.querySelector('.error-message');
  if (errorMessage) {
    errorMessage.textContent = message;
  }
  
  // Show error container
  errorContainer.style.display = 'flex';
}

// Initialize the app when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initializeApp);

// Export functions for direct imports in other modules
export {
  initializeApp,
  showLoadingIndicator,
  hideLoadingIndicator,
  showErrorMessage
};