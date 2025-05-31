// Student_supevision_system/js/auth.js

// Ensure SystemEvents and AuthModuleEventsGlobal are available (from events.js)
if (typeof window.SystemEvents === 'undefined' || typeof window.AuthModuleEventsGlobal === 'undefined') {
  console.error('auth.js: SystemEvents or AuthModuleEventsGlobal is not defined. Ensure events.js is loaded before auth.js.');
  // Define fallbacks if necessary, though it's better to ensure proper loading order
  window.SystemEvents = window.SystemEvents || {
    AUTH_MODULE_READY: 'auth:module:ready',
    AUTH_STATE_CHANGED: 'auth:state:changed',
    AUTH_ERROR: 'auth:error',
    APP_LOADING: 'app:loading',
    AUTH_LOGIN_SUCCESS: 'auth:login:success',
    AUTH_LOGIN_FAILED: 'auth:login:failed',
    AUTH_LOGOUT_SUCCESS: 'auth:logout:success',
    AUTH_PASSWORD_RESET_SENT: 'auth:password:reset:sent',
    AUTH_PASSWORD_UPDATED: 'auth:password:updated'
  };
  window.AuthModuleEventsGlobal = window.AuthModuleEventsGlobal || window.SystemEvents;
}


// Global state for the auth module
let authSupabaseClient = null;
let authCurrentUser = null;
let authUserOrganizationData = null; // Stores { organization: {id, name}, roles: [{id, name, permissions}] }
let authInitialized = false;
let authInitializing = false; // To prevent multiple concurrent initializations
let authRetryCount = 0;
const AUTH_MAX_RETRIES = 3;

const authLoadingState = {
  login: false,
  logout: false,
  passwordReset: false,
  userProfile: false // Though profile loading might be part of page-specific JS
};

const AUTH_ERRORS = {
  NOT_INITIALIZED: 'Auth module not initialized',
  SUPABASE_NOT_AVAILABLE: 'Supabase client not available',
  USER_NOT_FOUND: 'User not found',
  INVALID_CREDENTIALS: 'Invalid credentials',
  NETWORK_ERROR: 'Network error',
  SERVER_ERROR: 'Server error',
  UNKNOWN_ERROR: 'Unknown error',
  NO_ROLE: 'User has no assigned role or organization.'
};

/**
 * Initialize the authentication module
 */
async function initializeAuthModule() {
  if (authInitialized) {
    console.log('Auth module: Already initialized.');
    window.emitEvent(SystemEvents.AUTH_MODULE_READY, {
        initialized: true,
        user: authCurrentUser,
        organization: authUserOrganizationData
    });
    return { user: authCurrentUser, organization: authUserOrganizationData };
  }
  if (authInitializing) {
    console.log('Auth module: Initialization already in progress. Waiting...');
    return new Promise((resolve) => {
        window.addEventListener(SystemEvents.AUTH_MODULE_READY, function onReady(event) {
            window.removeEventListener(SystemEvents.AUTH_MODULE_READY, onReady);
            resolve(event.detail);
        }, { once: true });
    });
  }

  authInitializing = true;
  console.log('Auth module: Initializing...');

  try {
    if (typeof getSupabaseClient !== 'function') {
      throw new Error('getSupabaseClient function not available. Ensure supabaseClient.js is loaded.');
    }
    authSupabaseClient = await getSupabaseClient(); // getSupabaseClient now returns a promise
    if (!authSupabaseClient) {
      throw new Error('Failed to get Supabase client in auth module.');
    }
    console.log('Auth module: Supabase client obtained.');

    authSupabaseClient.auth.onAuthStateChange(async (event, session) => {
      console.log(`Auth module: Auth state changed - Event: ${event}`, session);
      authCurrentUser = session?.user || null;

      if (authCurrentUser) {
        await fetchUserOrganizationRoles();
        if (event === 'SIGNED_IN') {
             window.emitEvent(SystemEvents.AUTH_LOGIN_SUCCESS, { user: authCurrentUser, organization: authUserOrganizationData });
             handleRedirect(authCurrentUser, authUserOrganizationData);
        }
      } else {
        authUserOrganizationData = null;
        if (event === 'SIGNED_OUT') {
            // Only redirect to login on explicit sign-out or if not on login page
            if (window.PathConfig && window.location.pathname !== PathConfig.LOGIN && !window.location.pathname.endsWith(PathConfig.LOGIN)) {
                console.log('Auth module: User signed out or no session, redirecting to login.');
                window.location.href = PathConfig.LOGIN;
            }
        }
      }
      window.emitEvent(SystemEvents.AUTH_STATE_CHANGED, { event, user: authCurrentUser, organization: authUserOrganizationData });
    });

    // Check initial session
    const { data: { session } } = await authSupabaseClient.auth.getSession();
    authCurrentUser = session?.user || null;
    console.log('Auth module: Initial session check, user:', authCurrentUser ? authCurrentUser.email : 'None');

    if (authCurrentUser) {
      await fetchUserOrganizationRoles();
    }

    authInitialized = true;
    authInitializing = false;
    window.emitEvent(SystemEvents.AUTH_MODULE_READY, { initialized: true, user: authCurrentUser, organization: authUserOrganizationData });
    console.log('Auth module: Initialization complete.');
    return { initialized: true, user: authCurrentUser, organization: authUserOrganizationData };

  } catch (error) {
    authInitializing = false;
    authInitialized = false; // Ensure it's false on error
    console.error('Auth module: Initialization failed:', error);
    window.emitEvent(SystemEvents.AUTH_ERROR, { context: 'initialization', error: error.message });
    // Do not throw error here to allow app to potentially load public parts or show error message
    return { initialized: false, user: null, organization: null, error: error.message };
  }
}

async function fetchUserOrganizationRoles() {
  if (!authSupabaseClient || !authCurrentUser) {
    console.warn('Auth module: Cannot fetch roles, Supabase client or user not available.');
    authUserOrganizationData = { organization: null, roles: [] };
    return authUserOrganizationData;
  }

  console.log(`Auth module: Fetching organization and roles for user ${authCurrentUser.id}...`);
  authLoadingState.userProfile = true;

  try {
    // Fetch organization_members to get the primary organization_id and member_id
    // Assuming a user belongs to one primary organization for simplicity in this system.
    const { data: orgMember, error: memberError } = await authSupabaseClient
        .from('organization_members')
        .select('id, organization_id, organizations (id, name)')
        .eq('user_id', authCurrentUser.id)
        .maybeSingle(); // Use maybeSingle if a user might not be in any org or to handle errors gracefully

    if (memberError) {
        console.error('Auth module: Error fetching organization membership:', memberError);
        throw new Error(`Failed to fetch organization membership: ${memberError.message}`);
    }

    if (!orgMember || !orgMember.organization_id) {
        console.warn(`Auth module: User ${authCurrentUser.id} is not actively associated with any organization or org data missing.`);
        authUserOrganizationData = { organization: null, roles: [] };
        authLoadingState.userProfile = false;
        return authUserOrganizationData;
    }
    
    const organization = orgMember.organizations; // This is the joined organization record
    const memberId = orgMember.id; // This is the id from organization_members, used in member_roles

    // Fetch roles associated with this membership
    const { data: memberRoles, error: rolesError } = await authSupabaseClient
        .from('member_roles')
        .select('roles (id, name, permissions)') // Assuming 'roles' table has 'name' and 'permissions'
        .eq('member_id', memberId);

    if (rolesError) {
        console.error('Auth module: Error fetching member roles:', rolesError);
        throw new Error(`Failed to fetch member roles: ${rolesError.message}`);
    }

    const roles = memberRoles ? memberRoles.map(mr => mr.roles).filter(role => role != null) : [];

    authUserOrganizationData = {
      organization: organization,
      roles: roles
    };

    console.log('Auth module: User organization and roles loaded:', JSON.stringify(authUserOrganizationData));
    authLoadingState.userProfile = false;
    return authUserOrganizationData;

  } catch (error) {
    console.error('Auth module: Critical error in fetchUserOrganizationRoles:', error);
    authUserOrganizationData = { organization: null, roles: [], error: error.message };
    authLoadingState.userProfile = false;
    window.emitEvent(SystemEvents.AUTH_ERROR, { context: 'fetch_user_organization_roles', error: error.message });
    return authUserOrganizationData;
  }
}


function handleRedirect(user, orgData) {
  if (!window.PathConfig) {
    console.error("Auth module: PathConfig not found. Cannot redirect.");
    return;
  }

  const currentPath = window.location.pathname.endsWith('/') ? window.location.pathname : window.location.pathname + '/';
  const loginPath = PathConfig.LOGIN.endsWith('/') ? PathConfig.LOGIN : PathConfig.LOGIN + '/';
  
  // Only redirect if currently on the login page or at the root
  if (currentPath !== loginPath && currentPath !== "/" && currentPath !== "/index.html/") {
      console.log("Auth module: User already on a content page, no automatic redirect from auth state change.", currentPath);
      // Potentially check if the current page is allowed for the role, or let app.js handle this
      return;
  }

  if (!user) {
    console.log("Auth module: No user, should be handled by SIGNED_OUT or initial check.");
    if (currentPath !== loginPath) {
        window.location.href = PathConfig.LOGIN;
    }
    return;
  }

  if (!orgData || !orgData.roles || orgData.roles.length === 0) {
    console.warn("Auth module: User has no roles or organization data. Redirecting to login with error.");
    window.location.href = `${PathConfig.LOGIN}?error=${encodeURIComponent(AUTH_ERRORS.NO_ROLE)}`;
    return;
  }

  const roles = orgData.roles.map(role => role.name.toLowerCase());
  console.log("Auth module: User roles for redirection:", roles);

  if (roles.includes('admin') || roles.includes('administrator')) {
    window.location.href = PathConfig.ADMIN_DASHBOARD;
  } else if (roles.includes('supervisor')) {
    window.location.href = PathConfig.SUPERVISOR_DASHBOARD;
  } else if (roles.includes('student')) {
    window.location.href = PathConfig.STUDENT_DASHBOARD;
  } else if (roles.includes('committee') || roles.includes('committee member')) {
    window.location.href = PathConfig.COMMITTEE_DASHBOARD;
  } else if (roles.includes('marker')) {
    window.location.href = PathConfig.MARKERS;
  } else {
    console.warn(`Auth module: User role not recognized for dashboard redirection. Roles: ${roles.join(', ')}`);
    // Default redirect or error page if no role matches a dashboard
    window.location.href = `${PathConfig.LOGIN}?error=${encodeURIComponent("Your role does not have an assigned dashboard.")}`;
  }
}


async function loginWithEmailPassword(email, password) {
  if (!authSupabaseClient) {
    console.error('Auth module: Supabase client not ready for login.');
    return { success: false, error: AUTH_ERRORS.SUPABASE_NOT_AVAILABLE };
  }
  authLoadingState.login = true;
  window.emitEvent(SystemEvents.APP_LOADING, { context: 'login', loading: true });
  console.log(`Auth module: Attempting login for ${email}`);

  try {
    const { data, error } = await authSupabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
      console.error('Auth module: Login API error:', error);
      throw error; // Let the catch block handle it
    }

    // onAuthStateChange will handle setting user and fetching roles, then redirecting.
    // We don't need to call fetchUserOrganizationRoles or handleRedirect here directly
    // as SIGNED_IN event will trigger them.
    console.log('Auth module: signInWithPassword successful for user:', data.user?.id);
    // The event for actual success (AUTH_LOGIN_SUCCESS) will be emitted from onAuthStateChange
    return { success: true, user: data.user };

  } catch (error) {
    console.error('Auth module: Login failed catch block:', error.message);
    window.emitEvent(SystemEvents.AUTH_LOGIN_FAILED, { error: error.message });
    return { success: false, error: error.message || AUTH_ERRORS.INVALID_CREDENTIALS };
  } finally {
    authLoadingState.login = false;
    window.emitEvent(SystemEvents.APP_LOADING, { context: 'login', loading: false });
  }
}

async function logout() {
  if (!authSupabaseClient) {
     console.error('Auth module: Supabase client not ready for logout.');
    return { success: false, error: AUTH_ERRORS.SUPABASE_NOT_AVAILABLE };
  }
  authLoadingState.logout = true;
  window.emitEvent(SystemEvents.APP_LOADING, { context: 'logout', loading: true });
  console.log('Auth module: Logging out...');

  try {
    const { error } = await authSupabaseClient.auth.signOut();
    if (error) throw error;

    // onAuthStateChange will handle clearing user data and redirecting.
    // window.emitEvent(SystemEvents.AUTH_LOGOUT_SUCCESS, {}); // Emitted from onAuthStateChange for SIGNED_OUT
    console.log('Auth module: Logout successful.');
    return { success: true };
  } catch (error) {
    console.error('Auth module: Logout failed:', error);
    window.emitEvent(SystemEvents.AUTH_ERROR, { context: 'logout', error: error.message }); // More generic error
    return { success: false, error: error.message };
  } finally {
    authLoadingState.logout = false;
    window.emitEvent(SystemEvents.APP_LOADING, { context: 'logout', loading: false });
  }
}

async function sendPasswordResetEmail(email) {
  if (!authSupabaseClient) {
    return { success: false, error: AUTH_ERRORS.SUPABASE_NOT_AVAILABLE };
  }
  authLoadingState.passwordReset = true;
  window.emitEvent(SystemEvents.APP_LOADING, { context: 'passwordReset', loading: true });
  console.log(`Auth module: Sending password reset for ${email}`);

  try {
    // Ensure PathConfig and PathConfig.RESET_PASSWORD_PAGE are defined
    let redirectTo = window.location.origin;
    if (window.PathConfig && PathConfig.RESET_PASSWORD_PAGE) {
        redirectTo += PathConfig.RESET_PASSWORD_PAGE;
    } else {
        console.warn('Auth module: PathConfig.RESET_PASSWORD_PAGE is not defined. Using root path for redirect.');
        redirectTo += '/reset-password.html'; // Fallback
    }

    const { error } = await authSupabaseClient.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;

    window.emitEvent(SystemEvents.AUTH_PASSWORD_RESET_SENT, { email });
    console.log('Auth module: Password reset email sent.');
    return { success: true };
  } catch (error) {
    console.error('Auth module: Password reset email sending failed:', error);
    window.emitEvent(SystemEvents.AUTH_ERROR, { context: 'send_password_reset', error: error.message });
    return { success: false, error: error.message };
  } finally {
    authLoadingState.passwordReset = false;
    window.emitEvent(SystemEvents.APP_LOADING, { context: 'passwordReset', loading: false });
  }
}

async function updatePassword(newPassword) {
  if (!authSupabaseClient) {
    return { success: false, error: AUTH_ERRORS.SUPABASE_NOT_AVAILABLE };
  }
  authLoadingState.passwordReset = true; // Reuse loading state or create a new one
  window.emitEvent(SystemEvents.APP_LOADING, { context: 'passwordUpdate', loading: true });

  try {
    const { data, error } = await authSupabaseClient.auth.updateUser({ password: newPassword });
    if (error) throw error;

    window.emitEvent(SystemEvents.AUTH_PASSWORD_UPDATED, { user: data.user });
    console.log('Auth module: Password updated successfully.');
    return { success: true };
  } catch (error) {
    console.error('Auth module: Password update failed:', error);
    window.emitEvent(SystemEvents.AUTH_ERROR, { context: 'update_password', error: error.message });
    return { success: false, error: error.message };
  } finally {
    authLoadingState.passwordReset = false;
    window.emitEvent(SystemEvents.APP_LOADING, { context: 'passwordUpdate', loading: false });
  }
}

function getCurrentUser() {
  return authCurrentUser;
}

function getUserOrganizationData() {
  return authUserOrganizationData;
}

function hasRole(roleName) {
  if (!authUserOrganizationData || !authUserOrganizationData.roles) {
    return false;
  }
  return authUserOrganizationData.roles.some(role => role.name && role.name.toLowerCase() === roleName.toLowerCase());
}
function hasAnyRole(...roleNames) {
    if (!authUserOrganizationData || !authUserOrganizationData.roles) {
        return false;
    }
    const lowerCaseRoleNames = roleNames.map(name => name.toLowerCase());
    return authUserOrganizationData.roles.some(role => role.name && lowerCaseRoleNames.includes(role.name.toLowerCase()));
}


function isInitialized() {
  return authInitialized;
}

function isAuthenticated() {
  return !!authCurrentUser;
}

function getLoadingState() {
  return { ...authLoadingState }; // Return a copy
}

// Attempt to execute a function with retries - useful for initialization
async function attempt(fn, maxRetries = AUTH_MAX_RETRIES, delay = 1000) {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      return await fn();
    } catch (error) {
      retries++;
      console.warn(`Auth module: Attempt ${retries}/${maxRetries} failed for ${fn.name || 'anonymous function'}. Error: ${error.message}`);
      if (retries >= maxRetries) {
        console.error(`Auth module: Max retries reached for ${fn.name || 'anonymous function'}.`);
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, delay * retries)); // Exponential backoff could be better
    }
  }
}

// Expose the auth module on the window object
window.authModule = {
  initialize: () => attempt(initializeAuthModule), // Wrapped in attempt for resilience
  loginWithEmailPassword,
  logout,
  sendPasswordResetEmail,
  updatePassword,
  getCurrentUser,
  getUserOrganizationData,
  hasRole,
  hasAnyRole,
  isInitialized,
  isAuthenticated,
  getLoadingState
};

// Auto-initialize the module when the script loads
// This ensures that onAuthStateChange listener is set up early.
if (!authInitialized && !authInitializing) {
    console.log("Auth module: Auto-initializing on script load.");
    // Don't await here to prevent blocking script execution,
    // other parts of the app should listen for AUTH_MODULE_READY
    // or use authModule.initialize() which handles the promise.
    initializeAuthModule().catch(err => {
        console.error("Auth module: Auto-initialization failed silently:", err.message);
        // Potentially emit an event that app.js can catch to display a global error
        window.emitEvent(SystemEvents.AUTH_ERROR, { context: 'auto-initialization', error: "Critical authentication system failure." });
    });
}

console.log('auth.js loaded. window.authModule is available.');

// Removed export statements as this script is not treated as an ES module.