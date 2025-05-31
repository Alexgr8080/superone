// js/api.js
class APIService {
  constructor() {
    this.baseUrl = ''; // Set this if your API is on a different domain
    this.authToken = document.querySelector('meta[name="auth-token"]')?.content;
  }

  async request(endpoint, options = {}) {
    UIHelper.showLoading(true);
    UIHelper.clearAlerts();

    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`
      }
    };

    const requestOptions = { ...defaultOptions, ...options };
    
    if (options.body && typeof options.body === 'object') {
      requestOptions.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, requestOptions);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `API error: ${response.status}`);
      }

      // Handle 204 No Content responses
      if (response.status === 204) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('API Request Error:', error);
      UIHelper.showError(`Request failed: ${error.message}`);
      throw error;
    } finally {
      UIHelper.showLoading(false);
    }
  }

  // Admin API endpoints
  async getUsers() {
    return this.request('/api/users?include=roles,organizations');
  }

  async getUser(userId) {
    return this.request(`/api/users/${userId}`);
  }

  async getRoles() {
    return this.request('/api/roles');
  }

  async getOrganizations() {
    return this.request('/api/organizations');
  }

  async assignUserRole(userId, organizationId, roleId) {
    return this.request('/api/user-roles', {
      method: 'POST',
      body: {
        user_id: userId,
        organization_id: organizationId,
        role_id: roleId
      }
    });
  }

  async removeUserRole(userId, organizationId, roleId) {
    return this.request('/api/user-roles', {
      method: 'DELETE',
      body: {
        user_id: userId,
        organization_id: organizationId,
        role_id: roleId
      }
    });
  }

  async updateUserRoles(userId, organizationId, roleIds) {
    return this.request(`/api/users/${userId}/roles`, {
      method: 'PUT',
      body: {
        organization_id: organizationId,
        role_ids: roleIds
      }
    });
  }

  // Supervisor API endpoints
  async getSupervisedStudents() {
    return this.request('/api/supervised-students?include=project,milestones');
  }

  async getUpcomingMeetings() {
    return this.request('/api/upcoming-meetings');
  }

  async getPendingTasks() {
    return this.request('/api/pending-tasks');
  }

  async updateTaskStatus(taskId, status, completionDate = null) {
    const body = { status };
    if (completionDate) {
      body.completion_date = completionDate;
    }
    return this.request(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      body
    });
  }

  async scheduleMeeting(data) {
    return this.request('/api/meetings', {
      method: 'POST',
      body: data
    });
  }

  async cancelMeeting(meetingId) {
    return this.request(`/api/meetings/${meetingId}`, {
      method: 'DELETE'
    });
  }
}

const API = new APIService();
