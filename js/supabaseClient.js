// Student_supevision_system/js/supabaseClient.js - Refactored with singleton pattern

// Global variables for Supabase configuration, ensure they are defined only once
if (typeof window.SUPABASE_URL_CONFIG === 'undefined') {
  window.SUPABASE_URL_CONFIG = 'https://clfnsthhfrjwqbeokckl.supabase.co';
}

if (typeof window.SUPABASE_ANON_KEY_CONFIG === 'undefined') {
  window.SUPABASE_ANON_KEY_CONFIG = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsZm5zdGhoZnJqd3FiZW9rY2tsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwMjM1MzYsImV4cCI6MjA2MjU5OTUzNn0.012pMCsog50ci3LZognLkugYE-cci1rPXV0ThbKXnGI';
}

let supabaseClientInstance = null;
let connectionVerified = false;
let initializing = false; // Flag to prevent multiple initialization attempts concurrently

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Get or create the Supabase client instance
 * @returns {Object|null} Supabase client instance or null if initialization failed
 */
function getSupabaseClient() {
  // Return existing instance if already created
  if (supabaseClientInstance) {
    return supabaseClientInstance;
  }
  
  // Check if already attempting initialization
  if (initializing) {
    console.warn('Supabase client initialization already in progress, waiting...');
    return null;
  }
  
  // Initialize client
  try {
    initializing = true;
    
    console.log('Initializing Supabase client...');
    
    // Check if supabase-js is loaded
    if (typeof supabase === 'undefined') {
      console.error('Supabase JS SDK not loaded');
      return null;
    }
    
    // Create client
    const url = window.SUPABASE_URL_CONFIG;
    const key = window.SUPABASE_ANON_KEY_CONFIG;
    
    if (!url || !key) {
      console.error('Supabase configuration missing');
      return null;
    }
    
    supabaseClientInstance = supabase.createClient(url, key);
    
    console.log('Supabase client initialized');
    
    // Emit event if available
    if (typeof window.emitEvent === 'function') {
      window.emitEvent(SystemEvents.SUPABASE_CLIENT_INITIALIZED, { client: supabaseClientInstance });
    }
    
    // Schedule connection verification
    setTimeout(() => {
      verifyConnection().catch(err => {
        console.error('Failed to verify Supabase connection:', err);
      });
    }, 0);
    
    return supabaseClientInstance;
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error);
    
    // Emit error event if available
    if (typeof window.emitEvent === 'function') {
      window.emitEvent(SystemEvents.SUPABASE_CLIENT_ERROR, { error });
    }
    
    return null;
  } finally {
    initializing = false;
  }
}

/**
 * Verify connection to Supabase by making a simple query
 * @returns {Promise<boolean>} Whether connection was successful
 */
async function verifyConnection() {
  if (connectionVerified) {
    return true;
  }
  
  if (!supabaseClientInstance) {
    throw new Error('Supabase client not initialized');
  }
  
  try {
    console.log('Verifying Supabase connection...');
    
    // Make a simple query to verify connection
    const { error } = await supabaseClientInstance
      .from('organizations')
      .select('id')
      .limit(1);
    
    if (error) {
      throw error;
    }
    
    console.log('Supabase connection verified');
    connectionVerified = true;
    return true;
  } catch (error) {
    console.error('Supabase connection verification failed:', error);
    connectionVerified = false;
    return false;
  }
}

/**
 * Initialize Supabase client with retries
 * @returns {Promise<Object|null>} Supabase client instance or null if initialization failed
 */
async function initializeWithRetries() {
  let retries = 0;
  
  while (retries < MAX_RETRIES) {
    const client = getSupabaseClient();
    
    if (client) {
      try {
        const isConnected = await verifyConnection();
        
        if (isConnected) {
          return client;
        }
      } catch (error) {
        console.warn(`Connection verification failed (attempt ${retries + 1}/${MAX_RETRIES}):`, error);
      }
    }
    
    console.warn(`Retrying Supabase initialization (${retries + 1}/${MAX_RETRIES})...`);
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    
    // Clear instance to force re-creation
    supabaseClientInstance = null;
    retries++;
  }
  
  console.error('Failed to initialize Supabase client after multiple attempts');
  return null;
}

// Make the function globally available
window.getSupabaseClient = getSupabaseClient;

// Auto-initialize with retries when this script loads
(async function autoInitialize() {
  await initializeWithRetries();
})();

// Export function for direct imports in other modules
export {
  getSupabaseClient,
  verifyConnection
};
