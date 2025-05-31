// Student_supevision_system/js/admin.js

// Global variables (assuming these are defined and managed as per your existing setup)
let adminCurrentUser = null;
let adminUserOrgData = null;
let adminCurrentOrganization = null;
let adminModuleInitialized = false;
let adminSelectedSupervisor = null; // Stores the ID of the supervisor record being edited/viewed
let adminSelectedStudent = null;   // Stores the ID of the student record being edited/viewed
let adminLoadingState = false;

let availableRoles = [];
let availableDepartments = [
  { id: '1', name: 'Computer Science' },
  { id: '2', name: 'Engineering' },
  { id: '3', name: 'Business' },
  { id: '4', name: 'Arts & Humanities' },
  { id: '5', name: 'Sciences' }
];
let availableProgramTemplates = [];
let availableSupervisorsForSelect = []; // Used to populate dropdowns

let adminProjectStatusChartInstance = null;
let adminProgressTrendChartInstance = null;

let eventListenersInitialized = false;

// Cache DOM elements for better performance
const AdminDOM = {
  // Dashboard sections
  supervisorSection: null,
  studentSection: null,
  dashboardSection: null,
  
  // Dashboard metrics
  supervisorCountDisplay: null,
  studentCountDisplay: null,
  attentionCountDisplay: null,
  meetingsCountDisplay: null,
  
  // Supervisor table elements
  supervisorTableBody: null,
  supervisorSearchInput: null,
  supervisorDepartmentFilter: null,
  supervisorPagination: null,
  
  // Student table elements
  studentTableBody: null,
  studentSearchInput: null,
  studentDepartmentFilter: null,
  studentPagination: null,
  
  // Forms
  supervisorFormContainer: null,
  supervisorForm: null,
  studentFormContainer: null,
  studentForm: null,
  
  // Charts
  projectStatusChart: null,
  progressTrendChart: null
};

/**
 * Initialize the admin dashboard
 * This is the main entry point for the admin page
 */
async function initializeAdminDashboard() {
  try {
    console.log('admin.js: Initializing admin dashboard...');
    
    // Check if already initialized to prevent duplicate initialization
    if (adminModuleInitialized) {
      console.log('admin.js: Admin dashboard already initialized');
      return;
    }
    
    // Show loading state
    showLoadingState('Loading admin dashboard...');
    
    // Get Supabase client
    const adminSupabaseClient = getSupabaseClient();
    if (!adminSupabaseClient) {
      throw new Error('Failed to get Supabase client');
    }
    
    // Check authentication
    const { data: { user }, error } = await adminSupabaseClient.auth.getUser();
    
    if (error || !user) {
      console.error('admin.js: Authentication error:', error);
      window.location.href = PathConfig.LOGIN;
      return;
    }
    
    adminCurrentUser = user;
    
    // Check if user has admin privileges
    if (!window.authModule || !window.authModule.hasRole) {
      throw new Error('Auth module not available');
    }
    
    const isAdmin = window.authModule.hasRole('administrator');
    if (!isAdmin) {
      console.error('admin.js: User does not have administrator privileges');
      window.location.href = '/unauthorized.html';
      return;
    }
    
    adminUserOrgData = window.authModule.getUserOrganizationData();
    adminCurrentOrganization = adminUserOrgData?.organization || null;
    
    if (!adminCurrentOrganization) {
      throw new Error('No organization found for current user');
    }
    
    // Cache DOM elements
    cacheAdminDOMElements();
    
    // Initialize event listeners
    initializeEventListeners();
    
    // Fetch available roles for the organization
    await fetchAvailableRoles();
    
    // Fetch program templates
    await fetchProgramTemplates();
    
    // Load initial data
    await Promise.all([
      loadDashboardMetrics(),
      loadSupervisors(),
      loadStudents()
    ]);
    
    // Initialize charts
    initializeDashboardCharts();
    
    // Set up navigation
    setupTabNavigation();
    
    // Mark as initialized
    adminModuleInitialized = true;
    
    // Hide loading state
    hideLoadingState();
    
    console.log('admin.js: Admin dashboard initialization complete');
  } catch (error) {
    console.error('admin.js: Initialization failed:', error);
    showErrorNotification(`Admin dashboard initialization failed: ${error.message}`);
    hideLoadingState();
  }
}

/**
 * Cache DOM elements for better performance
 */
function cacheAdminDOMElements() {
  // Dashboard sections
  AdminDOM.supervisorSection = document.getElementById('supervisor-section');
  AdminDOM.studentSection = document.getElementById('student-section');
  AdminDOM.dashboardSection = document.getElementById('dashboard-section');
  
  // Dashboard metrics
  AdminDOM.supervisorCountDisplay = document.getElementById('supervisor-count');
  AdminDOM.studentCountDisplay = document.getElementById('student-count');
  AdminDOM.attentionCountDisplay = document.getElementById('attention-count');
  AdminDOM.meetingsCountDisplay = document.getElementById('meetings-count');
  
  // Supervisor table elements
  AdminDOM.supervisorTableBody = document.getElementById('supervisor-table-body');
  AdminDOM.supervisorSearchInput = document.getElementById('supervisor-search-input');
  AdminDOM.supervisorDepartmentFilter = document.getElementById('supervisor-department-filter');
  AdminDOM.supervisorPagination = document.getElementById('supervisor-pagination');
  
  // Student table elements
  AdminDOM.studentTableBody = document.getElementById('student-table-body');
  AdminDOM.studentSearchInput = document.getElementById('student-search-input');
  AdminDOM.studentDepartmentFilter = document.getElementById('student-department-filter');
  AdminDOM.studentPagination = document.getElementById('student-pagination');
  
  // Forms
  AdminDOM.supervisorFormContainer = document.getElementById('supervisor-form-container');
  AdminDOM.supervisorForm = document.getElementById('supervisor-form');
  AdminDOM.studentFormContainer = document.getElementById('student-form-container');
  AdminDOM.studentForm = document.getElementById('student-form');
  
  // Charts
  AdminDOM.projectStatusChart = document.getElementById('project-status-chart');
  AdminDOM.progressTrendChart = document.getElementById('progress-trend-chart');
}

/**
 * Initialize event listeners
 */
function initializeEventListeners() {
  if (eventListenersInitialized) {
    return;
  }
  
  // Supervisor search
  if (AdminDOM.supervisorSearchInput) {
    AdminDOM.supervisorSearchInput.addEventListener('input', debounce(function() {
      loadSupervisors();
    }, 300));
  }
  
  // Supervisor department filter
  if (AdminDOM.supervisorDepartmentFilter) {
    AdminDOM.supervisorDepartmentFilter.addEventListener('change', function() {
      loadSupervisors();
    });
  }
  
  // Student search
  if (AdminDOM.studentSearchInput) {
    AdminDOM.studentSearchInput.addEventListener('input', debounce(function() {
      loadStudents();
    }, 300));
  }
  
  // Student department filter
  if (AdminDOM.studentDepartmentFilter) {
    AdminDOM.studentDepartmentFilter.addEventListener('change', function() {
      loadStudents();
    });
  }
  
  // Supervisor form submit
  if (AdminDOM.supervisorForm) {
    AdminDOM.supervisorForm.addEventListener('submit', function(e) {
      e.preventDefault();
      handleSupervisorFormSubmit();
    });
  }
  
  // Student form submit
  if (AdminDOM.studentForm) {
    AdminDOM.studentForm.addEventListener('submit', function(e) {
      e.preventDefault();
      handleStudentFormSubmit();
    });
  }
  
  // Add Supervisor button
  const addSupervisorBtn = document.getElementById('add-supervisor-btn');
  if (addSupervisorBtn) {
    addSupervisorBtn.addEventListener('click', function() {
      showSupervisorForm();
    });
  }
  
  // Add Student button
  const addStudentBtn = document.getElementById('add-student-btn');
  if (addStudentBtn) {
    addStudentBtn.addEventListener('click', function() {
      showStudentForm();
    });
  }
  
  // Form close buttons
  const closeFormButtons = document.querySelectorAll('.close-form-btn');
  closeFormButtons.forEach(button => {
    button.addEventListener('click', function() {
      const formContainer = this.closest('.form-container');
      if (formContainer) {
        formContainer.style.display = 'none';
      }
    });
  });
  
  // Logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
      handleLogout();
    });
  }
  
  eventListenersInitialized = true;
}

/**
 * Load dashboard metrics
 */
async function loadDashboardMetrics() {
  try {
    const adminSupabaseClient = getSupabaseClient();
    if (!adminSupabaseClient) {
      throw new Error('Supabase client not available');
    }
    
    if (!adminCurrentOrganization) {
      throw new Error('No organization selected');
    }
    
    // Get supervisor count
    const { data: supervisors, error: supervisorError } = await adminSupabaseClient
      .from('supervisors')
      .select('id')
      .eq('organization_id', adminCurrentOrganization.id);
    
    if (supervisorError) {
      throw supervisorError;
    }
    
    // Get student count
    const { data: students, error: studentError } = await adminSupabaseClient
      .from('students')
      .select('id')
      .eq('organization_id', adminCurrentOrganization.id);
    
    if (studentError) {
      throw studentError;
    }
    
    // Get projects that need attention
    const { data: attentionProjects, error: attentionError } = await adminSupabaseClient
      .from('projects')
      .select('id')
      .eq('organization_id', adminCurrentOrganization.id)
      .eq('needs_attention', true);
    
    if (attentionError) {
      throw attentionError;
    }
    
    // Get upcoming meetings
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    
    const { data: meetings, error: meetingsError } = await adminSupabaseClient
      .from('meetings')
      .select('id')
      .eq('organization_id', adminCurrentOrganization.id)
      .gte('scheduled_date', today.toISOString())
      .lt('scheduled_date', nextWeek.toISOString());
    
    if (meetingsError) {
      throw meetingsError;
    }
    
    // Update dashboard metrics
    if (AdminDOM.supervisorCountDisplay) {
      AdminDOM.supervisorCountDisplay.textContent = supervisors.length;
    }
    
    if (AdminDOM.studentCountDisplay) {
      AdminDOM.studentCountDisplay.textContent = students.length;
    }
    
    if (AdminDOM.attentionCountDisplay) {
      AdminDOM.attentionCountDisplay.textContent = attentionProjects.length;
    }
    
    if (AdminDOM.meetingsCountDisplay) {
      AdminDOM.meetingsCountDisplay.textContent = meetings.length;
    }
  } catch (error) {
    console.error('Failed to load dashboard metrics:', error);
    showErrorNotification('Failed to load dashboard metrics');
  }
}

/**
 * Initialize dashboard charts
 */
function initializeDashboardCharts() {
  // Project Status Distribution chart
  if (AdminDOM.projectStatusChart) {
    if (adminProjectStatusChartInstance) {
      adminProjectStatusChartInstance.destroy();
    }
    
    const ctx = AdminDOM.projectStatusChart.getContext('2d');
    adminProjectStatusChartInstance = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: ['On Track', 'Behind Schedule', 'At Risk', 'Complete'],
        datasets: [{
          data: [65, 15, 12, 8],
          backgroundColor: [
            '#28a745',
            '#ffc107',
            '#dc3545',
            '#007bff'
          ]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom'
          }
        }
      }
    });
  }
  
  // Student Progress Trends chart
  if (AdminDOM.progressTrendChart) {
    if (adminProgressTrendChartInstance) {
      adminProgressTrendChartInstance.destroy();
    }
    
    const ctx = AdminDOM.progressTrendChart.getContext('2d');
    adminProgressTrendChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['January', 'February', 'March', 'April', 'May'],
        datasets: [{
          label: 'Average Progress (%)',
          data: [15, 30, 42, 55, 68],
          borderColor: '#007bff',
          tension: 0.1,
          fill: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            begin
                  options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 100
          }
        },
        plugins: {
          legend: {
            position: 'bottom'
          }
        }
      }
    });
  }
}

/**
 * Set up tab navigation for different sections of the admin dashboard
 */
function setupTabNavigation() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      const target = this.getAttribute('data-target');
      
      // Hide all tab contents
      tabContents.forEach(content => {
        content.style.display = 'none';
      });
      
      // Deactivate all tab buttons
      tabButtons.forEach(btn => {
        btn.classList.remove('active');
      });
      
      // Show the target tab content
      const targetContent = document.getElementById(target);
      if (targetContent) {
        targetContent.style.display = 'block';
      }
      
      // Activate the clicked button
      this.classList.add('active');
    });
  });
  
  // Activate the first tab by default
  if (tabButtons.length > 0) {
    tabButtons[0].click();
  }
}

/**
 * Fetch available roles for the organization
 */
async function fetchAvailableRoles() {
  try {
    const adminSupabaseClient = getSupabaseClient();
    if (!adminSupabaseClient) {
      throw new Error('Supabase client not available');
    }
    
    if (!adminCurrentOrganization) {
      throw new Error('No organization selected');
    }
    
    // Fetch roles
    const { data, error } = await adminSupabaseClient
      .from('roles')
      .select('*')
      .eq('organization_id', adminCurrentOrganization.id);
    
    if (error) {
      throw error;
    }
    
    availableRoles = data || [];
    
    // Populate role dropdowns if they exist
    const roleDropdowns = document.querySelectorAll('.role-select');
    
    roleDropdowns.forEach(dropdown => {
      // Clear existing options except the first one (if it's a placeholder)
      const firstOption = dropdown.querySelector('option:first-child');
      dropdown.innerHTML = '';
      
      if (firstOption && firstOption.value === '') {
        dropdown.appendChild(firstOption);
      }
      
      // Add role options
      availableRoles.forEach(role => {
        const option = document.createElement('option');
        option.value = role.id;
        option.textContent = role.name;
        dropdown.appendChild(option);
      });
    });
  } catch (error) {
    console.error('Failed to fetch available roles:', error);
    showErrorNotification('Failed to load roles');
  }
}

/**
 * Fetch program templates for student assignments
 */
async function fetchProgramTemplates() {
  try {
    const adminSupabaseClient = getSupabaseClient();
    if (!adminSupabaseClient) {
      throw new Error('Supabase client not available');
    }
    
    if (!adminCurrentOrganization) {
      throw new Error('No organization selected');
    }
    
    // Fetch program templates
    const { data, error } = await adminSupabaseClient
      .from('program_templates')
      .select('*')
      .eq('organization_id', adminCurrentOrganization.id);
    
    if (error) {
      throw error;
    }
    
    availableProgramTemplates = data || [];
    
    // Populate program template dropdowns if they exist
    const templateDropdowns = document.querySelectorAll('.program-template-select');
    
    templateDropdowns.forEach(dropdown => {
      // Clear existing options except the first one (if it's a placeholder)
      const firstOption = dropdown.querySelector('option:first-child');
      dropdown.innerHTML = '';
      
      if (firstOption && firstOption.value === '') {
        dropdown.appendChild(firstOption);
      }
      
      // Add template options
      availableProgramTemplates.forEach(template => {
        const option = document.createElement('option');
        option.value = template.id;
        option.textContent = template.name;
        dropdown.appendChild(option);
      });
    });
  } catch (error) {
    console.error('Failed to fetch program templates:', error);
    showErrorNotification('Failed to load program templates');
  }
}

/**
 * Load supervisors for the supervisor management table
 */
async function loadSupervisors() {
  try {
    const adminSupabaseClient = getSupabaseClient();
    if (!adminSupabaseClient) {
      throw new Error('Supabase client not available');
    }
    
    if (!adminCurrentOrganization) {
      throw new Error('No organization selected');
    }
    
    if (!AdminDOM.supervisorTableBody) {
      throw new Error('Supervisor table body element not found');
    }
    
    // Show loading state
    AdminDOM.supervisorTableBody.innerHTML = '<tr><td colspan="7" class="text-center">Loading supervisors...</td></tr>';
    
    // Build query based on filters
    let query = adminSupabaseClient
      .from('supervisors')
      .select('*, users(*)')
      .eq('organization_id', adminCurrentOrganization.id);
    
    // Add search filter if search input has value
    const searchTerm = AdminDOM.supervisorSearchInput ? AdminDOM.supervisorSearchInput.value.trim() : '';
    if (searchTerm) {
      query = query.or(`users.first_name.ilike.%${searchTerm}%,users.last_name.ilike.%${searchTerm}%,users.email.ilike.%${searchTerm}%`);
    }
    
    // Add department filter if selected
    const departmentFilter = AdminDOM.supervisorDepartmentFilter ? AdminDOM.supervisorDepartmentFilter.value : '';
    if (departmentFilter) {
      query = query.eq('department', departmentFilter);
    }
    
    // Execute query
    const { data, error } = await query;
    
    if (error) {
      throw error;
    }
    
    // Update available supervisors for select dropdowns
    availableSupervisorsForSelect = data || [];
    
    // Clear table and add rows
    AdminDOM.supervisorTableBody.innerHTML = '';
    
    if (!data || data.length === 0) {
      AdminDOM.supervisorTableBody.innerHTML = '<tr><td colspan="7" class="text-center">No supervisors found</td></tr>';
      return;
    }
    
    // Populate table with supervisor data
    data.forEach(supervisor => {
      const user = supervisor.users;
      
      const row = document.createElement('tr');
      
      // Supervisor name and ID
      const nameCell = document.createElement('td');
      nameCell.innerHTML = `
        <div>${user?.first_name || ''} ${user?.last_name || ''}</div>
        <small class="text-muted">Faculty ID: ${supervisor.faculty_id || 'N/A'}</small>
      `;
      row.appendChild(nameCell);
      
      // Email
      const emailCell = document.createElement('td');
      emailCell.textContent = user?.email || 'N/A';
      row.appendChild(emailCell);
      
      // Department
      const departmentCell = document.createElement('td');
      departmentCell.textContent = supervisor.department || 'N/A';
      row.appendChild(departmentCell);
      
      // Roles
      const rolesCell = document.createElement('td');
      rolesCell.textContent = supervisor.roles?.join(', ') || 'Supervisor';
      row.appendChild(rolesCell);
      
      // Student count
      const studentCountCell = document.createElement('td');
      studentCountCell.textContent = supervisor.student_count || '0';
      row.appendChild(studentCountCell);
      
      // Status
      const statusCell = document.createElement('td');
      const isActive = supervisor.status === 'active';
      statusCell.innerHTML = `
        <span class="badge ${isActive ? 'badge-success' : 'badge-danger'}">
          ${isActive ? 'Active' : 'Inactive'}
        </span>
      `;
      row.appendChild(statusCell);
      
      // Actions
      const actionsCell = document.createElement('td');
      actionsCell.innerHTML = `
        <button class="btn btn-sm btn-primary edit-supervisor-btn" data-id="${supervisor.id}">
          <i class="fas fa-edit"></i>
        </button>
        <button class="btn btn-sm btn-danger delete-supervisor-btn" data-id="${supervisor.id}">
          <i class="fas fa-trash"></i>
        </button>
      `;
      row.appendChild(actionsCell);
      
      // Add row to table
      AdminDOM.supervisorTableBody.appendChild(row);
    });
    
    // Add event listeners to action buttons
    const editButtons = AdminDOM.supervisorTableBody.querySelectorAll('.edit-supervisor-btn');
    const deleteButtons = AdminDOM.supervisorTableBody.querySelectorAll('.delete-supervisor-btn');
    
    editButtons.forEach(button => {
      button.addEventListener('click', function() {
        const supervisorId = this.getAttribute('data-id');
        editSupervisor(supervisorId);
      });
    });
    
    deleteButtons.forEach(button => {
      button.addEventListener('click', function() {
        const supervisorId = this.getAttribute('data-id');
        deleteSupervisor(supervisorId);
      });
    });
  } catch (error) {
    console.error('Failed to load supervisors:', error);
    showErrorNotification('Failed to load supervisors');
    
    // Show error in table
    if (AdminDOM.supervisorTableBody) {
      AdminDOM.supervisorTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center text-danger">
            Error loading supervisors: ${error.message}
          </td>
        </tr>
      `;
    }
  }
}

/**
 * Load students for the student management table
 */
async function loadStudents() {
  try {
    const adminSupabaseClient = getSupabaseClient();
    if (!adminSupabaseClient) {
      throw new Error('Supabase client not available');
    }
    
    if (!adminCurrentOrganization) {
      throw new Error('No organization selected');
    }
    
    if (!AdminDOM.studentTableBody) {
      throw new Error('Student table body element not found');
    }
    
    // Show loading state
    AdminDOM.studentTableBody.innerHTML = '<tr><td colspan="8" class="text-center">Loading students...</td></tr>';
    
    // Build query based on filters
    let query = adminSupabaseClient
      .from('students')
      .select('*, users(*), supervisors(*, users(*))')
      .eq('organization_id', adminCurrentOrganization.id);
    
    // Add search filter if search input has value
    const searchTerm = AdminDOM.studentSearchInput ? AdminDOM.studentSearchInput.value.trim() : '';
    if (searchTerm) {
      query = query.or(`users.first_name.ilike.%${searchTerm}%,users.last_name.ilike.%${searchTerm}%,users.email.ilike.%${searchTerm}%,student_id.ilike.%${searchTerm}%`);
    }
    
    // Add department filter if selected
    const departmentFilter = AdminDOM.studentDepartmentFilter ? AdminDOM.studentDepartmentFilter.value : '';
    if (departmentFilter) {
      query = query.eq('department', departmentFilter);
    }
    
    // Execute query
    const { data, error } = await query;
    
    if (error) {
      throw error;
    }
    
    // Clear table and add rows
    AdminDOM.studentTableBody.innerHTML = '';
    
    if (!data || data.length === 0) {
      AdminDOM.studentTableBody.innerHTML = '<tr><td colspan="8" class="text-center">No students found</td></tr>';
      return;
    }
    
    // Populate table with student data
    data.forEach(student => {
      const user = student.users;
      const supervisor = student.supervisors;
      const supervisorUser = supervisor?.users;
      
      const row = document.createElement('tr');
      
      // Student name and ID
      const nameCell = document.createElement('td');
      nameCell.innerHTML = `
        <div>${user?.first_name || ''} ${user?.last_name || ''}</div>
        <small class="text-muted">Student ID: ${student.student_id || 'N/A'}</small>
      `;
      row.appendChild(nameCell);
      
      // Email
      const emailCell = document.createElement('td');
      emailCell.textContent = user?.email || 'N/A';
      row.appendChild(emailCell);
      
      // Department
      const departmentCell = document.createElement('td');
      departmentCell.textContent = student.department || 'N/A';
      row.appendChild(departmentCell);
      
      // Program
      const programCell = document.createElement('td');
      programCell.textContent = student.program || 'N/A';
      row.appendChild(programCell);
      
      // Supervisor
      const supervisorCell = document.createElement('td');
      if (supervisor) {
        supervisorCell.textContent = `${supervisorUser?.first_name || ''} ${supervisorUser?.last_name || ''}`;
      } else {
        supervisorCell.textContent = 'Not assigned';
      }
      row.appendChild(supervisorCell);
      
      // Enrollment date
      const enrollmentCell = document.createElement('td');
      if (student.enrollment_date) {
        const date = new Date(student.enrollment_date);
        enrollmentCell.textContent = date.toLocaleDateString();
      } else {
        enrollmentCell.textContent = 'N/A';
      }
      row.appendChild(enrollmentCell);
      
      // Status
      const statusCell = document.createElement('td');
      const isActive = student.status === 'active';
      statusCell.innerHTML = `
        <span class="badge ${isActive ? 'badge-success' : 'badge-danger'}">
          ${isActive ? 'Active' : 'Inactive'}
        </span>
      `;
      row.appendChild(statusCell);
      
      // Actions
      const actionsCell = document.createElement('td');
      actionsCell.innerHTML = `
        <button class="btn btn-sm btn-primary edit-student-btn" data-id="${student.id}">
          <i class="fas fa-edit"></i>
        </button>
        <button class="btn btn-sm btn-danger delete-student-btn" data-id="${student.id}">
          <i class="fas fa-trash"></i>
        </button>
      `;
      row.appendChild(actionsCell);
      
      // Add row to table
      AdminDOM.studentTableBody.appendChild(row);
    });
    
    // Add event listeners to action buttons
    const editButtons = AdminDOM.studentTableBody.querySelectorAll('.edit-student-btn');
    const deleteButtons = AdminDOM.studentTableBody.querySelectorAll('.delete-student-btn');
    
    editButtons.forEach(button => {
      button.addEventListener('click', function() {
        const studentId = this.getAttribute('data-id');
        editStudent(studentId);
      });
    });
    
    deleteButtons.forEach(button => {
      button.addEventListener('click', function() {
        const studentId = this.getAttribute('data-id');
        deleteStudent(studentId);
      });
    });
  } catch (error) {
    console.error('Failed to load students:', error);
    showErrorNotification('Failed to load students');
    
    // Show error in table
    if (AdminDOM.studentTableBody) {
      AdminDOM.studentTableBody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center text-danger">
            Error loading students: ${error.message}
          </td>
        </tr>
      `;
    }
  }
}

/**
 * Show the supervisor form for creating or editing a supervisor
 * @param {string} supervisorId - Supervisor ID for editing, or null for creating
 */
async function showSupervisorForm(supervisorId = null) {
  try {
    if (!AdminDOM.supervisorFormContainer || !AdminDOM.supervisorForm) {
      throw new Error('Supervisor form elements not found');
    }
    
    // Reset form
    AdminDOM.supervisorForm.reset();
    
    // Set form title and button text based on mode (create or edit)
    const formTitle = document.getElementById('supervisor-form-title');
    const submitButton = AdminDOM.supervisorForm.querySelector('button[type="submit"]');
    
    if (supervisorId) {
      // Edit mode
      if (formTitle) formTitle.textContent = 'Edit Supervisor';
      if (submitButton) submitButton.textContent = 'Update Supervisor';
      
      // Set form action
      AdminDOM.supervisorForm.setAttribute('data-action', 'edit');
      AdminDOM.supervisorForm.setAttribute('data-id', supervisorId);
      
      // Load supervisor data
      await loadSupervisorData(supervisorId);
    } else {
      // Create mode
      if (formTitle) formTitle.textContent = 'Add New Supervisor';
      if (submitButton) submitButton.textContent = 'Create Supervisor';
      
      // Set form action
      AdminDOM.supervisorForm.setAttribute('data-action', 'create');
      AdminDOM.supervisorForm.removeAttribute('data-id');
    }
    
    // Show form
    AdminDOM.supervisorFormContainer.style.display = 'block';
  } catch (error) {
    console.error('Failed to show supervisor form:', error);
    showErrorNotification(`Failed to show supervisor form: ${error.message}`);
  }
}

/**
 * Load supervisor data into the form for editing
 * @param {string} supervisorId - Supervisor ID to load
 */
async function loadSupervisorData(supervisorId) {
  try {
    const adminSupabaseClient = getSupabaseClient();
    if (!adminSupabaseClient) {
      throw new Error('Supabase client not available');
    }
    
    // Fetch supervisor data
    const { data, error } = await adminSupabaseClient
      .from('supervisors')
      .select('*, users(*)') // Joining with users table to get user details
      .eq('id', supervisorId)
      .single();
    
    if (error) {
      throw error;
    }
    
    if (!data) {
      throw new Error('Supervisor not found');
    }
    
    // Store selected supervisor
    adminSelectedSupervisor = data;
    
    // Populate form fields
    const user = data.users;
    
    // User fields
    const firstNameInput = document.getElementById('supervisor-first-name');
    const lastNameInput = document.getElementById('supervisor-last-name');
    const emailInput = document.getElementById('supervisor-email');
    
    if (firstNameInput) firstNameInput.value = user?.first_name || '';
    if (lastNameInput) lastNameInput.value = user?.last_name || '';
    if (emailInput) emailInput.value = user?.email || '';
    
    // Supervisor fields
    const facultyIdInput = document.getElementById('supervisor-faculty-id');
    const departmentSelect = document.getElementById('supervisor-department');
    const rolesSelect = document.getElementById('supervisor-roles');
    const statusSelect = document.getElementById('supervisor-status');
    
    if (facultyIdInput) facultyIdInput.value = data.faculty_id || '';
    
    if (departmentSelect) {
      const departmentOption = Array.from(departmentSelect.options).find(option => option.value === data.department);
      if (departmentOption) {
        departmentOption.selected = true;
      }
    }
    
    if (rolesSelect) {
      // Reset selections
      Array.from(rolesSelect.options).forEach(option => {
        option.selected = false;
      });
      
      // Select roles
      if (data.roles && Array.isArray(data.roles)) {
        data.roles.forEach(role => {
          const roleOption = Array.from(rolesSelect.options).find(option => option.value === role);
          if (roleOption) {
            roleOption.selected = true;
          }
        });
      }
    }
    
    if (statusSelect) {
      const statusOption = Array.from(statusSelect.options).find(option => option.value === data.status);
      if (statusOption) {
        statusOption.selected = true;
      }
    }
  } catch (error) {
    console.error('Failed to load supervisor data:', error);
    showErrorNotification(`Failed to load supervisor data: ${error.message}`);
  }
}

/**
 * Handle supervisor form submission (create or update)
 */
async function handleSupervisorFormSubmit() {
  try {
    if (!AdminDOM.supervisorForm) {
      throw new Error('Supervisor form element not found');
    }
    
    // Get form action and ID
    const action = AdminDOM.supervisorForm.getAttribute('data-action');
    const supervisorId = AdminDOM.supervisorForm.getAttribute('data-id');
    
    // Validate form
    if (!validateSupervisorForm()) {
      return;
    }
    
    // Show loading state
    const submitButton = AdminDOM.supervisorForm.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = action === 'edit' ? 'Updating...' : 'Creating...';
    
    // Get form data
    const formData = getSupervisorFormData();
    
    const adminSupabaseClient = getSupabaseClient();
    if (!adminSupabaseClient) {
      throw new Error('Supabase client not available');
    }
    
    if (action === 'create') {
      // Create new user first
      const { data: userData, error: userError } = await adminSupabaseClient.auth.admin.createUser({
        email: formData.email,
        password: generateTempPassword(),
        email_confirm: true
      });
      
      if (userError) {
        throw userError;
      }
      
      // Now create supervisor record
      const { data: supervisorData, error: supervisorError } = await adminSupabaseClient
        .from('supervisors')
        .insert({
          user_id: userData.id,
          organization_id: adminCurrentOrganization.id,
          faculty_id: formData.facultyId,
          department: formData.department,
          roles: formData.roles,
          status: formData.status,
          created_at: new Date().toISOString(),
          created_by: adminCurrentUser.id
        })
        .select()
        .single();
      
      if (supervisorError) {
        throw supervisorError;
      }
      
      // Also update the user's profile
      await adminSupabaseClient
        .from('users')
        .update({
          first_name: formData.firstName,
          last_name: formData.lastName,
          updated_at: new Date().toISOString()
        })
        .eq('id', userData.id);
      
      showSuccessNotification('Supervisor created successfully');
    } else if (action === 'edit') {
      // Update supervisor record
      const { error: supervisorError } = await adminSupabaseClient
        .from('supervisors')
        .update({
          faculty_id: formData.facultyId,
          department: formData.department,
          roles: formData.roles,
          status: formData.status,
          updated_at: new Date().toISOString(),
          updated_by: adminCurrentUser.id
        })
        .eq('id', supervisorId);
      
      if (supervisorError) {
        throw supervisorError;
      }
      
      // Update user record
      const { error: userError } = await adminSupabaseClient
        .from('users')
        .update({
          first_name: formData.firstName,
          last_name: formData.lastName,
          updated_at: new Date().toISOString()
        })
        .eq('id', adminSelectedSupervisor.user_id);
      
      if (userError) {
        throw userError;
      }
      
      showSuccessNotification('Supervisor updated successfully');
    }
    
    // Hide form
    AdminDOM.supervisorFormContainer.style.display = 'none';
    
    // Reload supervisors
    await loadSupervisors();
    
    // Update dashboard metrics
    await loadDashboardMetrics();
    
  } catch (error) {
    console.error('Failed to submit supervisor form:', error);
    showErrorNotification(`Failed to ${action === 'edit' ? 'update' : 'create'} supervisor: ${error.message}`);
  } finally {
    // Reset button state
    const submitButton = AdminDOM.supervisorForm.querySelector('button[type="submit"]');
    submitButton.disabled = false;
    submitButton.textContent = action === 'edit' ? 'Update Supervisor' : 'Create Supervisor';
  }
}

/**
 * Validate the supervisor form
 * @returns {boolean} Whether the form is valid
 */
function validateSupervisorForm() {
  const firstNameInput = document.getElementById('supervisor-first-name');
  const lastNameInput = document.getElementById('supervisor-last-name');
  const emailInput = document.getElementById('supervisor-email');
  const facultyIdInput = document.getElementById('supervisor-faculty-id');
  const departmentSelect = document.getElementById('supervisor-department');
  
  // Reset error states
  [firstNameInput, lastNameInput, emailInput, facultyIdInput, departmentSelect].forEach(input => {
    if (input) {
      input.classList.remove('is-invalid');
      const errorElement = input.nextElementSibling;
      if (errorElement && errorElement.classList.contains('invalid-feedback')) {
        errorElement.textContent = '';
      }
    }
  });
  
  let isValid = true;
  
  // Validate first name
  if (!firstNameInput.value.trim()) {
    firstNameInput.classList.add('is-invalid');
    const errorElement = firstNameInput.nextElementSibling;
    if (errorElement && errorElement.classList.contains('invalid-feedback')) {
      errorElement.textContent = 'First name is required';
    }
    isValid = false;
  }
  
  // Validate last name
  if (!lastNameInput.value.trim()) {
    lastNameInput.classList.add('is-invalid');
    const errorElement = lastNameInput.nextElementSibling;
    if (errorElement && errorElement.classList.contains('invalid-feedback')) {
      errorElement.textContent = 'Last name is required';
    }
    isValid = false;
  }
  
  // Validate email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailInput.value.trim() || !emailRegex.test(emailInput.value.trim())) {
    emailInput.classList.add('is-invalid');
    const errorElement = emailInput.nextElementSibling;
    if (errorElement && errorElement.classList.contains('invalid-feedback')) {
      errorElement.textContent = 'Please enter a valid email address';
    }
    isValid = false;
  }
  
  // Validate faculty ID
  if (!facultyIdInput.value.trim()) {
    facultyIdInput.classList.add('is-invalid');
    const errorElement = facultyIdInput.nextElementSibling;
    if (errorElement && errorElement.classList.contains('invalid-feedback')) {
      errorElement.textContent = 'Faculty ID is required';
    }
    isValid = false;
  }
  
  // Validate department
  if (!departmentSelect.value) {
    departmentSelect.classList.add('is-invalid');
    const errorElement = departmentSelect.nextElementSibling;
    if (errorElement && errorElement.classList.contains('invalid-feedback')) {
      errorElement.textContent = 'Please select a department';
    }
    isValid = false;
  }
  
  return isValid;
}

/**
 * Get supervisor form data
 * @returns {Object} Form data
 */
function getSupervisorFormData() {
  const firstNameInput = document.getElementById('supervisor-first-name');
  const lastNameInput = document.getElementById('supervisor-last-name');
  const emailInput = document.getElementById('supervisor-email');
  const facultyIdInput = document.getElementById('supervisor-faculty-id');
  const departmentSelect = document.getElementById('supervisor-department');
  const rolesSelect = document.getElementById('supervisor-roles');
  const statusSelect = document.getElementById('supervisor-status');
  
  // Get selected roles
  const selectedRoles = Array.from(rolesSelect.selectedOptions).map(option => option.value);
  
  return {
    firstName: firstNameInput.value.trim(),
    lastName: lastNameInput.value.trim(),
    email: emailInput.value.trim(),
    facultyId: facultyIdInput.value.trim(),
    department: departmentSelect.value,
    roles: selectedRoles,
    status: statusSelect.value
  };
}

/**
 * Generate a temporary password for new users
 * @returns {string} Temporary password
 */
function generateTempPassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
  let password = '';
  
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return password;
}

/**
 * Delete a supervisor
 * @param {string} supervisorId - Supervisor ID to delete
 */
async function deleteSupervisor(supervisorId) {
  try {
    // Confirm deletion
    if (!confirm('Are you sure you want to delete this supervisor? This action cannot be undone.')) {
      return;
    }
    
    const adminSupabaseClient = getSupabaseClient();
    if (!adminSupabaseClient) {
      throw new Error('Supabase client not available');
    }
    
    // Get supervisor data to find user ID
    const { data: supervisor, error: fetchError } = await adminSupabaseClient
      .from('supervisors')
      .select('user_id')
      .eq('id', supervisorId)
      .single();
    
    if (fetchError) {
      throw fetchError;
    }
    
    if (!supervisor) {
      throw new Error('Supervisor not found');
    }
    
    // Check if supervisor has students assigned
    const { data: students, error: studentsError } = await adminSupabaseClient
      .from('students')
      .select('id')
      .eq('supervisor_id', supervisorId);
    
    if (studentsError) {
      throw studentsError;
    }
    
    if (students && students.length > 0) {
      throw new Error('This supervisor has students assigned. Please reassign these students before deleting the supervisor.');
    }
    
    // Delete supervisor
    const { error: deleteError } = await adminSupabaseClient
      .from('supervisors')
      .delete()
      .eq('id', supervisorId);
    
    if (deleteError) {
      throw deleteError;
    }
    
       // Optionally deactivate user account instead of deleting it
    const { error: userError } = await adminSupabaseClient.auth.admin.updateUserById(
      supervisor.user_id,
      { 
        user_metadata: { 
          status: 'inactive',
          deactivated_at: new Date().toISOString(),
          deactivated_by: adminCurrentUser.id
        }
      }
    );
    
    if (userError) {
      console.warn('Failed to update user status:', userError);
      // Continue execution even if this fails
    }
    
    showSuccessNotification('Supervisor deleted successfully');
    
    // Reload supervisors
    await loadSupervisors();
    
    // Update dashboard metrics
    await loadDashboardMetrics();
    
  } catch (error) {
    console.error('Failed to delete supervisor:', error);
    showErrorNotification(`Failed to delete supervisor: ${error.message}`);
  }
}

/**
 * Show the student form for creating or editing a student
 * @param {string} studentId - Student ID for editing, or null for creating
 */
async function showStudentForm(studentId = null) {
  try {
    if (!AdminDOM.studentFormContainer || !AdminDOM.studentForm) {
      throw new Error('Student form elements not found');
    }
    
    // Reset form
    AdminDOM.studentForm.reset();
    
    // Set form title and button text based on mode (create or edit)
    const formTitle = document.getElementById('student-form-title');
    const submitButton = AdminDOM.studentForm.querySelector('button[type="submit"]');
    
    if (studentId) {
      // Edit mode
      if (formTitle) formTitle.textContent = 'Edit Student';
      if (submitButton) submitButton.textContent = 'Update Student';
      
      // Set form action
      AdminDOM.studentForm.setAttribute('data-action', 'edit');
      AdminDOM.studentForm.setAttribute('data-id', studentId);
      
      // Load student data
      await loadStudentData(studentId);
    } else {
      // Create mode
      if (formTitle) formTitle.textContent = 'Add New Student';
      if (submitButton) submitButton.textContent = 'Create Student';
      
      // Set form action
      AdminDOM.studentForm.setAttribute('data-action', 'create');
      AdminDOM.studentForm.removeAttribute('data-id');
      
      // Set default enrollment date to today
      const enrollmentDateInput = document.getElementById('student-enrollment-date');
      if (enrollmentDateInput) {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        enrollmentDateInput.value = `${year}-${month}-${day}`;
      }
    }
    
    // Populate supervisor dropdown
    await populateSupervisorDropdown();
    
    // Show form
    AdminDOM.studentFormContainer.style.display = 'block';
  } catch (error) {
    console.error('Failed to show student form:', error);
    showErrorNotification(`Failed to show student form: ${error.message}`);
  }
}

/**
 * Populate supervisor dropdown for student form
 */
async function populateSupervisorDropdown() {
  try {
    const supervisorSelect = document.getElementById('student-supervisor');
    if (!supervisorSelect) return;
    
    // Clear existing options except the first one (if it's a placeholder)
    const firstOption = supervisorSelect.querySelector('option:first-child');
    supervisorSelect.innerHTML = '';
    
    if (firstOption && firstOption.value === '') {
      supervisorSelect.appendChild(firstOption);
    }
    
    // Check if we already have supervisors loaded
    if (!availableSupervisorsForSelect || availableSupervisorsForSelect.length === 0) {
      // If not, fetch them
      const adminSupabaseClient = getSupabaseClient();
      if (!adminSupabaseClient) {
        throw new Error('Supabase client not available');
      }
      
      const { data, error } = await adminSupabaseClient
        .from('supervisors')
        .select('*, users(*)')
        .eq('organization_id', adminCurrentOrganization.id)
        .eq('status', 'active');
      
      if (error) {
        throw error;
      }
      
      availableSupervisorsForSelect = data || [];
    }
    
    // Add supervisor options
    availableSupervisorsForSelect.forEach(supervisor => {
      const user = supervisor.users;
      const fullName = `${user?.first_name || ''} ${user?.last_name || ''}`.trim();
      const department = supervisor.department ? ` (${supervisor.department})` : '';
      
      const option = document.createElement('option');
      option.value = supervisor.id;
      option.textContent = `${fullName}${department}`;
      supervisorSelect.appendChild(option);
    });
  } catch (error) {
    console.error('Failed to populate supervisor dropdown:', error);
    showErrorNotification('Failed to load supervisor options');
  }
}

/**
 * Load student data into the form for editing
 * @param {string} studentId - Student ID to load
 */
async function loadStudentData(studentId) {
  try {
    const adminSupabaseClient = getSupabaseClient();
    if (!adminSupabaseClient) {
      throw new Error('Supabase client not available');
    }
    
    // Fetch student data
    const { data, error } = await adminSupabaseClient
      .from('students')
      .select('*, users(*), projects(*)') // Joining with users table to get user details
      .eq('id', studentId)
      .single();
    
    if (error) {
      throw error;
    }
    
    if (!data) {
      throw new Error('Student not found');
    }
    
    // Store selected student
    adminSelectedStudent = data;
    
    // Populate form fields
    const user = data.users;
    
    // User fields
    const firstNameInput = document.getElementById('student-first-name');
    const lastNameInput = document.getElementById('student-last-name');
    const emailInput = document.getElementById('student-email');
    
    if (firstNameInput) firstNameInput.value = user?.first_name || '';
    if (lastNameInput) lastNameInput.value = user?.last_name || '';
    if (emailInput) emailInput.value = user?.email || '';
    
    // Student fields
    const studentIdInput = document.getElementById('student-id-number');
    const departmentSelect = document.getElementById('student-department');
    const programInput = document.getElementById('student-program');
    const supervisorSelect = document.getElementById('student-supervisor');
    const enrollmentDateInput = document.getElementById('student-enrollment-date');
    const expectedEndDateInput = document.getElementById('student-expected-end-date');
    const statusSelect = document.getElementById('student-status');
    
    if (studentIdInput) studentIdInput.value = data.student_id || '';
    
    if (departmentSelect) {
      const departmentOption = Array.from(departmentSelect.options).find(option => option.value === data.department);
      if (departmentOption) {
        departmentOption.selected = true;
      }
    }
    
    if (programInput) programInput.value = data.program || '';
    
    if (supervisorSelect && data.supervisor_id) {
      const supervisorOption = Array.from(supervisorSelect.options).find(option => option.value === data.supervisor_id);
      if (supervisorOption) {
        supervisorOption.selected = true;
      }
    }
    
    if (enrollmentDateInput && data.enrollment_date) {
      const date = new Date(data.enrollment_date);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      enrollmentDateInput.value = `${year}-${month}-${day}`;
    }
    
    if (expectedEndDateInput && data.expected_end_date) {
      const date = new Date(data.expected_end_date);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      expectedEndDateInput.value = `${year}-${month}-${day}`;
    }
    
    if (statusSelect) {
      const statusOption = Array.from(statusSelect.options).find(option => option.value === data.status);
      if (statusOption) {
        statusOption.selected = true;
      }
    }
  } catch (error) {
    console.error('Failed to load student data:', error);
    showErrorNotification(`Failed to load student data: ${error.message}`);
  }
}

/**
 * Handle student form submission (create or update)
 */
async function handleStudentFormSubmit() {
  try {
    if (!AdminDOM.studentForm) {
      throw new Error('Student form element not found');
    }
    
    // Get form action and ID
    const action = AdminDOM.studentForm.getAttribute('data-action');
    const studentId = AdminDOM.studentForm.getAttribute('data-id');
    
    // Validate form
    if (!validateStudentForm()) {
      return;
    }
    
    // Show loading state
    const submitButton = AdminDOM.studentForm.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = action === 'edit' ? 'Updating...' : 'Creating...';
    
    // Get form data
    const formData = getStudentFormData();
    
    const adminSupabaseClient = getSupabaseClient();
    if (!adminSupabaseClient) {
      throw new Error('Supabase client not available');
    }
    
    if (action === 'create') {
      // Create new user first
      const { data: userData, error: userError } = await adminSupabaseClient.auth.admin.createUser({
        email: formData.email,
        password: generateTempPassword(),
        email_confirm: true
      });
      
      if (userError) {
        throw userError;
      }
      
      // Now create student record
      const { data: studentData, error: studentError } = await adminSupabaseClient
        .from('students')
        .insert({
          user_id: userData.id,
          organization_id: adminCurrentOrganization.id,
          student_id: formData.studentId,
          department: formData.department,
          program: formData.program,
          supervisor_id: formData.supervisorId || null,
          enrollment_date: formData.enrollmentDate,
          expected_end_date: formData.expectedEndDate,
          status: formData.status,
          created_at: new Date().toISOString(),
          created_by: adminCurrentUser.id
        })
        .select()
        .single();
      
      if (studentError) {
        throw studentError;
      }
      
      // Also update the user's profile
      await adminSupabaseClient
        .from('users')
        .update({
          first_name: formData.firstName,
          last_name: formData.lastName,
          updated_at: new Date().toISOString()
        })
        .eq('id', userData.id);
      
      // Create a default project for the student
      const { error: projectError } = await adminSupabaseClient
        .from('projects')
        .insert({
          student_id: studentData.id,
          organization_id: adminCurrentOrganization.id,
          title: 'New Research Project',
          description: 'Default project created for student',
          status: 'planning',
          created_at: new Date().toISOString(),
          created_by: adminCurrentUser.id
        });
      
      if (projectError) {
        console.warn('Failed to create default project:', projectError);
        // Continue execution even if this fails
      }
      
      showSuccessNotification('Student created successfully');
    } else if (action === 'edit') {
      // Update student record
      const { error: studentError } = await adminSupabaseClient
        .from('students')
        .update({
          student_id: formData.studentId,
          department: formData.department,
          program: formData.program,
          supervisor_id: formData.supervisorId || null,
          enrollment_date: formData.enrollmentDate,
          expected_end_date: formData.expectedEndDate,
          status: formData.status,
          updated_at: new Date().toISOString(),
          updated_by: adminCurrentUser.id
        })
        .eq('id', studentId);
      
      if (studentError) {
        throw studentError;
      }
      
      // Update user record
      const { error: userError } = await adminSupabaseClient
        .from('users')
        .update({
          first_name: formData.firstName,
          last_name: formData.lastName,
          updated_at: new Date().toISOString()
        })
        .eq('id', adminSelectedStudent.user_id);
      
      if (userError) {
        throw userError;
      }
      
      showSuccessNotification('Student updated successfully');
    }
    
    // Hide form
    AdminDOM.studentFormContainer.style.display = 'none';
    
    // Reload students
    await loadStudents();
    
    // Update dashboard metrics
    await loadDashboardMetrics();
    
  } catch (error) {
    console.error('Failed to submit student form:', error);
    showErrorNotification(`Failed to ${action === 'edit' ? 'update' : 'create'} student: ${error.message}`);
  } finally {
    // Reset button state
    const submitButton = AdminDOM.studentForm.querySelector('button[type="submit"]');
    submitButton.disabled = false;
    submitButton.textContent = action === 'edit' ? 'Update Student' : 'Create Student';
  }
}

/**
 * Validate the student form
 * @returns {boolean} Whether the form is valid
 */
function validateStudentForm() {
  const firstNameInput = document.getElementById('student-first-name');
  const lastNameInput = document.getElementById('student-last-name');
  const emailInput = document.getElementById('student-email');
  const studentIdInput = document.getElementById('student-id-number');
  const departmentSelect = document.getElementById('student-department');
  const programInput = document.getElementById('student-program');
  const enrollmentDateInput = document.getElementById('student-enrollment-date');
  
  // Reset error states
  [firstNameInput, lastNameInput, emailInput, studentIdInput, departmentSelect, programInput, enrollmentDateInput].forEach(input => {
    if (input) {
      input.classList.remove('is-invalid');
      const errorElement = input.nextElementSibling;
      if (errorElement && errorElement.classList.contains('invalid-feedback')) {
        errorElement.textContent = '';
      }
    }
  });
  
  let isValid = true;
  
  // Validate first name
  if (!firstNameInput.value.trim()) {
    firstNameInput.classList.add('is-invalid');
    const errorElement = firstNameInput.nextElementSibling;
    if (errorElement && errorElement.classList.contains('invalid-feedback')) {
      errorElement.textContent = 'First name is required';
    }
    isValid = false;
  }
  
  // Validate last name
  if (!lastNameInput.value.trim()) {
    lastNameInput.classList.add('is-invalid');
    const errorElement = lastNameInput.nextElementSibling;
    if (errorElement && errorElement.classList.contains('invalid-feedback')) {
      errorElement.textContent = 'Last name is required';
    }
    isValid = false;
  }
  
  // Validate email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailInput.value.trim() || !emailRegex.test(emailInput.value.trim())) {
    emailInput.classList.add('is-invalid');
    const errorElement = emailInput.nextElementSibling;
    if (errorElement && errorElement.classList.contains('invalid-feedback')) {
      errorElement.textContent = 'Please enter a valid email address';
    }
    isValid = false;
  }
  
  // Validate student ID
  if (!studentIdInput.value.trim()) {
    studentIdInput.classList.add('is-invalid');
    const errorElement = studentIdInput.nextElementSibling;
    if (errorElement && errorElement.classList.contains('invalid-feedback')) {
      errorElement.textContent = 'Student ID is required';
    }
    isValid = false;
  }
  
  // Validate department
  if (!departmentSelect.value) {
    departmentSelect.classList.add('is-invalid');
    const errorElement = departmentSelect.nextElementSibling;
    if (errorElement && errorElement.classList.contains('invalid-feedback')) {
      errorElement.textContent = 'Please select a department';
    }
    isValid = false;
  }
  
  // Validate program
  if (!programInput.value.trim()) {
    programInput.classList.add('is-invalid');
    const errorElement = programInput.nextElementSibling;
    if (errorElement && errorElement.classList.contains('invalid-feedback')) {
      errorElement.textContent = 'Program is required';
    }
    isValid = false;
  }
  
  // Validate enrollment date
  if (!enrollmentDateInput.value) {
    enrollmentDateInput.classList.add('is-invalid');
    const errorElement = enrollmentDateInput.nextElementSibling;
    if (errorElement && errorElement.classList.contains('invalid-feedback')) {
      errorElement.textContent = 'Enrollment date is required';
    }
    isValid = false;
  }
  
  return isValid;
}

/**
 * Get student form data
 * @returns {Object} Form data
 */
function getStudentFormData() {
  const firstNameInput = document.getElementById('student-first-name');
  const lastNameInput = document.getElementById('student-last-name');
  const emailInput = document.getElementById('student-email');
  const studentIdInput = document.getElementById('student-id-number');
  const departmentSelect = document.getElementById('student-department');
  const programInput = document.getElementById('student-program');
  const supervisorSelect = document.getElementById('student-supervisor');
  const enrollmentDateInput = document.getElementById('student-enrollment-date');
  const expectedEndDateInput = document.getElementById('student-expected-end-date');
  const statusSelect = document.getElementById('student-status');
  
  return {
    firstName: firstNameInput.value.trim(),
    lastName: lastNameInput.value.trim(),
    email: emailInput.value.trim(),
    studentId: studentIdInput.value.trim(),
    department: departmentSelect.value,
    program: programInput.value.trim(),
    supervisorId: supervisorSelect.value || null,
    enrollmentDate: enrollmentDateInput.value,
    expectedEndDate: expectedEndDateInput.value || null,
    status: statusSelect.value
  };
}

/**
 * Delete a student
 * @param {string} studentId - Student ID to delete
 */
async function deleteStudent(studentId) {
  try {
    // Confirm deletion
    if (!confirm('Are you sure you want to delete this student? This will also delete all associated projects and submissions.')) {
      return;
    }
    
    const adminSupabaseClient = getSupabaseClient();
    if (!adminSupabaseClient) {
      throw new Error('Supabase client not available');
    }
    
    // Get student data to find user ID
    const { data: student, error: fetchError } = await adminSupabaseClient
      .from('students')
      .select('user_id')
      .eq('id', studentId)
      .single();
    
    if (fetchError) {
      throw fetchError;
    }
    
    if (!student) {
      throw new Error('Student not found');
    }
    
    // Delete related records first (projects, submissions, etc.)
    // Delete projects
    const { error: projectsError } = await adminSupabaseClient
      .from('projects')
      .delete()
      .eq('student_id', studentId);
    
    if (projectsError) {
      console.warn('Failed to delete projects:', projectsError);
      // Continue execution even if this fails
    }
    
    // Delete submissions
    const { error: submissionsError } = await adminSupabaseClient
      .from('submissions')
      .delete()
      .eq('student_id', studentId);
    
    if (submissionsError) {
      console.warn('Failed to delete submissions:', submissionsError);
      // Continue execution even if this fails
    }
    
    // Delete meetings
    const { error: meetingsError } = await adminSupabaseClient
      .from('meetings')
      .delete()
      .eq('student_id', studentId);
    
    if (meetingsError) {
      console.warn('Failed to delete meetings:', meetingsError);
      // Continue execution even if this fails
    }
    
    // Delete student
    const { error: deleteError } = await adminSupabaseClient
      .from('students')
      .delete()
      .eq('id', studentId);
    
    if (deleteError) {
      throw deleteError;
    }
    
    // Optionally deactivate user account instead of deleting it
    const { error: userError } = await adminSupabaseClient.auth.admin.updateUserById(
      student.user_id,
      { 
        user_metadata: { 
          status: 'inactive',
          deactivated_at: new Date().toISOString(),
          deactivated_by: adminCurrentUser.id
        }
      }
    );
    
    if (userError) {
      console.warn('Failed to update user status:', userError);
      // Continue execution even if this fails
    }
    
    showSuccessNotification('Student deleted successfully');
    
    // Reload students
    await loadStudents();
    
    // Update dashboard metrics
    await loadDashboardMetrics();
    
  } catch (error) {
    console.error('Failed to delete student:', error);
    showErrorNotification(`Failed to delete student: ${error.message}`);
  }
}

/**
 * Handle logout
 */
async function handleLogout() {
  try {
    if (!window.authModule || typeof window.authModule.logout !== 'function') {
      throw new Error('Auth module not available');
    }
    
    const result = await window.authModule.logout();
    
    if (result.success) {
      window.location.href = PathConfig.LOGIN;
    } else {
      throw new Error(result.error || 'Logout failed');
    }
  } catch (error) {
    console.error('Logout error:', error);
    showErrorNotification(`Logout failed: ${error.message}`);
  }
}

/**
 * Show loading state
 * @param {string} message - Message to display
 */
function showLoadingState(message = 'Loading...') {
  adminLoadingState = true;
  
  // Show loading indicator
  if (typeof window.showLoadingIndicator === 'function') {
    window.showLoadingIndicator(message);
  } else {
    console.log('Loading:', message);
  }
}

/**
 * Hide loading state
 */
function hideLoadingState() {
  adminLoadingState = false;
  
  // Hide loading indicator
  if (typeof window.hideLoadingIndicator === 'function') {
    window.hideLoadingIndicator();
  } else {
    console.log('Loading complete');
  }
}

/**
 * Show success notification
 * @param {string} message - Success message
 */
function showSuccessNotification(message) {
  // Check if custom notification function exists
  if (typeof window.showSuccessAlert === 'function') {
    window.showSuccessAlert(message);
    return;
  }
  
  // Fallback to alert
  alert(message);
}

/**
 * Show error notification
 * @param {string} message - Error message
 */
function showErrorNotification(message) {
  // Check if custom notification function exists
  if (typeof window.showErrorAlert === 'function') {
    window.showErrorAlert(message);
    return;
  }
  
  // Fallback to console.error and alert
  console.error(message);
  alert(`Error: ${message}`);
}

/**
 * Utility function to debounce function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
  let timeout;
  
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Initialize when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  // Add this event listener to wait for auth module to be ready
  window.addEventListener(SystemEvents.AUTH_MODULE_READY, initializeAdminDashboard);
  
  // Also attempt to initialize directly in case the event has already been fired
  if (window.authModule && window.authModule.isInitialized()) {
    initializeAdminDashboard();
  }
});

// Make initializeAdminDashboard available globally
window.initializeAdminDashboard = initializeAdminDashboard;

// Export functions for direct imports in other modules
export {
  initializeAdminDashboard
};
