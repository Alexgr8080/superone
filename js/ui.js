// js/ui.js
class UIHelperService {
  constructor() {
    this.loadingIndicator = document.getElementById('loading-indicator');
    this.errorAlert = document.getElementById('error-alert');
    this.successAlert = document.getElementById('success-alert');
  }

  showLoading(isLoading) {
    if (this.loadingIndicator) {
      this.loadingIndicator.style.display = isLoading ? 'block' : 'none';
    }
  }

  showError(message, timeout = 5000) {
    if (this.errorAlert) {
      this.errorAlert.textContent = message;
      this.errorAlert.style.display = 'block';
      
      if (timeout) {
        setTimeout(() => {
          this.errorAlert.style.display = 'none';
        }, timeout);
      }
    }
  }

  showSuccess(message, timeout = 3000) {
    if (this.successAlert) {
      this.successAlert.textContent = message;
      this.successAlert.style.display = 'block';
      
      if (timeout) {
        setTimeout(() => {
          this.successAlert.style.display = 'none';
        }, timeout);
      }
    }
  }

  clearAlerts() {
    if (this.errorAlert) {
      this.errorAlert.style.display = 'none';
    }
    if (this.successAlert) {
      this.successAlert.style.display = 'none';
    }
  }

  // Modal handling
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
    }
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
    }
  }

  // Form validation
  validateForm(formElement) {
    let isValid = true;
    const requiredFields = formElement.querySelectorAll('[required]');
    
    requiredFields.forEach(field => {
      if (!field.value.trim()) {
        isValid = false;
        this.highlightInvalidField(field, 'This field is required');
      } else {
        this.clearFieldError(field);
      }
    });

    // Email validation
    const emailFields = formElement.querySelectorAll('input[type="email"]');
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    
    emailFields.forEach(field => {
      if (field.value.trim() && !emailRegex.test(field.value)) {
        isValid = false;
        this.highlightInvalidField(field, 'Please enter a valid email address');
      }
    });

    return isValid;
  }

  highlightInvalidField(field, message) {
    field.classList.add('invalid');
    
    // Create or update error message
    let errorMsg = field.nextElementSibling;
    if (!errorMsg || !errorMsg.classList.contains('field-error')) {
      errorMsg = document.createElement('div');
      errorMsg.classList.add('field-error');
      field.parentNode.insertBefore(errorMsg, field.nextSibling);
    }
    
    errorMsg.textContent = message;
  }

  clearFieldError(field) {
    field.classList.remove('invalid');
    
    const errorMsg = field.nextElementSibling;
    if (errorMsg && errorMsg.classList.contains('field-error')) {
      errorMsg.remove();
    }
  }
}

const UIHelper = new UIHelperService();
