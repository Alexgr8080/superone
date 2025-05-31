// ethics-form.js - Updated for document-based ethics submission

// Define required document types
const REQUIRED_ETHICS_DOCUMENTS = [
    { id: 'participant_information', name: 'Participant Information Sheet', required: true, template_url: '/documents/templates/participant_information_template.docx' },
    { id: 'consent_form', name: 'Consent Form', required: true, template_url: '/documents/templates/consent_form_template.docx' },
    { id: 'recruitment_material', name: 'Recruitment Materials', required: true, template_url: '/documents/templates/recruitment_materials_template.docx' },
    { id: 'data_collection_instruments', name: 'Data Collection Instruments', required: true, template_url: '/documents/templates/data_collection_instruments_template.docx' },
    { id: 'risk_assessment', name: 'Risk Assessment Form', required: true, template_url: '/documents/templates/risk_assessment_template.docx' },
    { id: 'data_management_plan', name: 'Data Management Plan', required: true, template_url: '/documents/templates/data_management_plan_template.docx' },
    { id: 'research_protocol', name: 'Research Protocol', required: true, template_url: '/documents/templates/research_protocol_template.docx' },
    { id: 'evidence_permissions', name: 'Evidence of External Permissions', required: false, template_url: '/documents/templates/external_permissions_template.docx' },
    { id: 'funding_information', name: 'Funding Information', required: false, template_url: '/documents/templates/funding_information_template.docx' },
    { id: 'other_documents', name: 'Other Supporting Documents', required: false }
];

// --- Module State ---
let ethicsSupabaseClient = null;
let ethicsCurrentUser = null;
let ethicsSubmissionData = {
    id: null,
    title: '',
    description: '',
    risk_level: 'low',
    status: 'draft',
    documents: [] // Will store {document_type_id, file_object, uploaded_file_id}
};
let ethicsFormMode = 'create'; // 'create' or 'edit'

// --- DOM Element Cache ---
const EthicsDOM = {
    formElement: null,
    titleInput: null,
    descriptionTextarea: null,
    riskLevelSelect: null,
    documentsContainer: null,
    submitBtn: null,
    saveAsDraftBtn: null,
    formStatusDisplay: null,
    formFeedbackDisplay: null
};

// --- Ethics Form Initialization ---
async function initializeEthicsForm() {
    try {
        console.log('ethics-form.js: Initializing ethics form...');
        
        // Get Supabase client
        ethicsSupabaseClient = getSupabaseClient();
        
        // Check authentication
        const { data: { user }, error } = await ethicsSupabaseClient.auth.getUser();
        
        if (error || !user) {
            console.error('ethics-form.js: Authentication error:', error);
            window.location.href = PathConfig.LOGIN;
            return;
        }
        
        ethicsCurrentUser = user;
        
        // Cache DOM elements
        cacheEthicsFormDOMElements();
        
        // Check if editing an existing submission
        const urlParams = new URLSearchParams(window.location.search);
        const submissionId = urlParams.get('id');
        
        if (submissionId) {
            ethicsFormMode = 'edit';
            await loadExistingSubmission(submissionId);
        }
        
        // Initialize the document templates section
        initializeDocumentTemplatesSection();
        
        // Set up form handlers
        setupFormHandlers();
        
        console.log('ethics-form.js: Form initialization complete');
        
    } catch (error) {
        console.error('ethics-form.js: Error initializing ethics form:', error);
    }
}

// --- Cache DOM Elements ---
function cacheEthicsFormDOMElements() {
    try {
        EthicsDOM.formElement = document.getElementById('ethicsSubmissionForm');
        EthicsDOM.titleInput = document.getElementById('ethicsTitle');
        EthicsDOM.descriptionTextarea = document.getElementById('ethicsDescription');
        EthicsDOM.riskLevelSelect = document.getElementById('ethicsRiskLevel');
        EthicsDOM.documentsContainer = document.getElementById('ethicsDocumentsContainer');
        EthicsDOM.submitBtn = document.getElementById('ethicsSubmitBtn');
        EthicsDOM.saveAsDraftBtn = document.getElementById('ethicsSaveAsDraftBtn');
        EthicsDOM.formStatusDisplay = document.getElementById('ethicsFormStatus');
        EthicsDOM.formFeedbackDisplay = document.getElementById('ethicsFormFeedback');
    } catch (error) {
        console.error('ethics-form.js: Error caching DOM elements:', error);
    }
}

// --- Load Existing Submission ---
async function loadExistingSubmission(submissionId) {
    try {
        // Fetch submission data
        const { data: submission, error: submissionError } = await ethicsSupabaseClient
            .from('ethics_submissions')
            .select('*')
            .eq('id', submissionId)
            .eq('student_id', ethicsCurrentUser.id)
            .single();
            
        if (submissionError || !submission) {
            console.error('ethics-form.js: Error loading submission:', submissionError);
            alert('Error loading submission. You may not have permission to edit this submission.');
            window.location.href = 'student.html';
            return;
        }
        
        // Store submission data
        ethicsSubmissionData = {
            id: submission.id,
            title: submission.title || '',
            description: submission.description || '',
            risk_level: submission.risk_level || 'low',
            status: submission.status || 'draft',
            documents: []
        };
        
        // Update form fields
        if (EthicsDOM.titleInput) EthicsDOM.titleInput.value = ethicsSubmissionData.title;
        if (EthicsDOM.descriptionTextarea) EthicsDOM.descriptionTextarea.value = ethicsSubmissionData.description;
        if (EthicsDOM.riskLevelSelect) EthicsDOM.riskLevelSelect.value = ethicsSubmissionData.risk_level;
        if (EthicsDOM.formStatusDisplay) EthicsDOM.formStatusDisplay.textContent = ethicsSubmissionData.status.charAt(0).toUpperCase() + ethicsSubmissionData.status.slice(1);
        
        // Fetch submitted documents
        const { data: documents, error: documentsError } = await ethicsSupabaseClient
            .from('ethics_documents')
            .select('*')
            .eq('submission_id', submissionId);
            
        if (!documentsError && documents) {
            ethicsSubmissionData.documents = documents.map(doc => ({
                document_type_id: doc.document_type,
                uploaded_file_id: doc.id,
                filename: doc.filename,
                file_url: doc.file_url
            }));
        }
        
        // Disable form if already submitted for review
        if (ethicsSubmissionData.status !== 'draft' && ethicsSubmissionData.status !== 'revisions_needed') {
            disableFormForSubmitted();
        }
        
    } catch (error) {
        console.error('ethics-form.js: Error in loadExistingSubmission:', error);
    }
}

// --- Initialize Document Templates Section ---
function initializeDocumentTemplatesSection() {
    try {
        if (!EthicsDOM.documentsContainer) return;
        
        // Clear container
        EthicsDOM.documentsContainer.innerHTML = '';
        
        // Create document templates UI
        const documentsTable = document.createElement('table');
        documentsTable.className = 'documents-table';
        
        // Add table header
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th>Document Type</th>
                <th>Required</th>
                <th>Template</th>
                <th>Your Upload</th>
                <th>Actions</th>
            </tr>
        `;
        documentsTable.appendChild(thead);
        
        // Add table body
        const tbody = document.createElement('tbody');
        
        REQUIRED_ETHICS_DOCUMENTS.forEach(docType => {
            const tr = document.createElement('tr');
            
            // Find existing upload if any
            const existingDoc = ethicsSubmissionData.documents.find(doc => doc.document_type_id === docType.id);
            
            tr.innerHTML = `
                <td>${docType.name}</td>
                <td>${docType.required ? 'Yes' : 'No'}</td>
                <td>
                    ${docType.template_url ? 
                        `<a href="${docType.template_url}" class="btn-link" download>Download Template</a>` : 
                        'No template available'}
                </td>
                <td class="file-status" id="fileStatus_${docType.id}">
                    ${existingDoc ? 
                        `<span class="upload-success">Uploaded: ${existingDoc.filename}</span>` : 
                        '<span class="upload-none">No file uploaded</span>'}
                </td>
                <td>
                    <input type="file" id="fileInput_${docType.id}" style="display:none;" accept=".doc,.docx,.pdf">
                    <button type="button" class="btn-secondary upload-btn" data-doctype="${docType.id}">
                        ${existingDoc ? 'Replace File' : 'Upload File'}
                    </button>
                    ${existingDoc ? 
                        `<button type="button" class="btn-link view-btn" data-fileurl="${existingDoc.file_url}">View</button>` : 
                        ''}
                </td>
            `;
            
            tbody.appendChild(tr);
        });
        
        documentsTable.appendChild(tbody);
        EthicsDOM.documentsContainer.appendChild(documentsTable);
        
        // Add event listeners to upload buttons
        document.querySelectorAll('.upload-btn').forEach(button => {
            button.addEventListener('click', function() {
                const docTypeId = this.getAttribute('data-doctype');
                document.getElementById(`fileInput_${docTypeId}`).click();
            });
        });
        
        // Add event listeners to file inputs
        document.querySelectorAll('input[type="file"]').forEach(input => {
            input.addEventListener('change', handleFileUpload);
        });
        
        // Add event listeners to view buttons
        document.querySelectorAll('.view-btn').forEach(button => {
            button.addEventListener('click', function() {
                const fileUrl = this.getAttribute('data-fileurl');
                window.open(fileUrl, '_blank');
            });
        });
        
    } catch (error) {
        console.error('ethics-form.js: Error initializing document templates section:', error);
    }
}

// --- Handle File Upload ---
async function handleFileUpload(event) {
    try {
        const fileInput = event.target;
        const docTypeId = fileInput.id.replace('fileInput_', '');
        const file = fileInput.files[0];
        
        if (!file) return;
        
        // Display "Uploading..." status
        const fileStatusEl = document.getElementById(`fileStatus_${docTypeId}`);
        if (fileStatusEl) {
            fileStatusEl.innerHTML = '<span class="upload-progress">Uploading...</span>';
        }
        
        // Upload file to Supabase storage
        const filePath = `ethics_documents/${ethicsCurrentUser.id}/${Date.now()}_${file.name}`;
        const { data, error } = await ethicsSupabaseClient.storage
            .from('student_submissions')
            .upload(filePath, file);
            
        if (error) {
            console.error('ethics-form.js: Error uploading file:', error);
            if (fileStatusEl) {
                fileStatusEl.innerHTML = '<span class="upload-error">Upload failed</span>';
            }
            return;
        }
        
        // Get public URL for the uploaded file
        const { data: publicUrlData } = ethicsSupabaseClient.storage
            .from('student_submissions')
            .getPublicUrl(filePath);
            
        const publicUrl = publicUrlData?.publicUrl;
        
        // Find and replace existing document in state if it exists
        const existingDocIndex = ethicsSubmissionData.documents.findIndex(doc => doc.document_type_id === docTypeId);
        
        if (existingDocIndex >= 0) {
            ethicsSubmissionData.documents[existingDocIndex] = {
                document_type_id: docTypeId,
                file_path: filePath,
                filename: file.name,
                file_url: publicUrl,
                uploaded_file_id: ethicsSubmissionData.documents[existingDocIndex].uploaded_file_id
            };
        } else {
            ethicsSubmissionData.documents.push({
                document_type_id: docTypeId,
                file_path: filePath,
                filename: file.name,
                file_url: publicUrl
            });
        }
        
        // Update UI to show success
        if (fileStatusEl) {
            fileStatusEl.innerHTML = `<span class="upload-success">Uploaded: ${file.name}</span>`;
        }
        
        // Add view button if it doesn't exist
        const actionCell = fileStatusEl.parentNode.nextElementSibling;
        if (actionCell) {
            if (!actionCell.querySelector('.view-btn')) {
                const viewBtn = document.createElement('button');
                viewBtn.type = 'button';
                viewBtn.className = 'btn-link view-btn';
                viewBtn.setAttribute('data-fileurl', publicUrl);
                viewBtn.innerText = 'View';
                viewBtn.addEventListener('click', function() {
                    window.open(publicUrl, '_blank');
                });
                
                actionCell.appendChild(viewBtn);
            } else {
                actionCell.querySelector('.view-btn').setAttribute('data-fileurl', publicUrl);
            }
        }
        
        // Save draft automatically after successful upload
        await saveDraft(true);
        
    } catch (error) {
        console.error('ethics-form.js: Error in handleFileUpload:', error);
    }
}

// --- Setup Form Handlers ---
function setupFormHandlers() {
    try {
        // Save draft button handler
        if (EthicsDOM.saveAsDraftBtn) {
            EthicsDOM.saveAsDraftBtn.addEventListener('click', function(event) {
                event.preventDefault();
                saveDraft();
            });
        }
        
        // Submit form handler
        if (EthicsDOM.formElement) {
            EthicsDOM.formElement.addEventListener('submit', async function(event) {
                event.preventDefault();
                await submitForm();
            });
        }
        
        // Form field change handlers
        if (EthicsDOM.titleInput) {
            EthicsDOM.titleInput.addEventListener('change', function() {
                ethicsSubmissionData.title = this.value;
            });
        }
        
        if (EthicsDOM.descriptionTextarea) {
            EthicsDOM.descriptionTextarea.addEventListener('change', function() {
                ethicsSubmissionData.description = this.value;
            });
        }
        
        if (EthicsDOM.riskLevelSelect) {
            EthicsDOM.riskLevelSelect.addEventListener('change', function() {
                ethicsSubmissionData.risk_level = this.value;
            });
        }
        
    } catch (error) {
        console.error('ethics-form.js: Error setting up form handlers:', error);
    }
}

// --- Save Draft ---
async function saveDraft(silent = false) {
    try {
        // Collect form data
        if (EthicsDOM.titleInput) ethicsSubmissionData.title = EthicsDOM.titleInput.value;
        if (EthicsDOM.descriptionTextarea) ethicsSubmissionData.description = EthicsDOM.descriptionTextarea.value;
        if (EthicsDOM.riskLevelSelect) ethicsSubmissionData.risk_level = EthicsDOM.riskLevelSelect.value;
        
        // Validate required fields for draft
        if (!ethicsSubmissionData.title) {
            if (!silent) alert('Please enter a title for your ethics submission.');
            return;
        }
        
        // If new submission
        if (ethicsFormMode === 'create') {
            // Insert new submission
            const { data: newSubmission, error: submissionError } = await ethicsSupabaseClient
                .from('ethics_submissions')
                .insert([{
                    title: ethicsSubmissionData.title,
                    description: ethicsSubmissionData.description,
                    risk_level: ethicsSubmissionData.risk_level,
                    student_id: ethicsCurrentUser.id,
                    status: 'draft'
                }])
                .select()
                .single();
                
            if (submissionError) {
                console.error('ethics-form.js: Error creating submission draft:', submissionError);
                if (!silent) alert('Error saving draft. Please try again.');
                return;
            }
            
            // Update state with new ID
            ethicsSubmissionData.id = newSubmission.id;
            ethicsFormMode = 'edit';
            
            // Update URL to include submission ID
            window.history.replaceState(null, '', `ethics-form.html?id=${newSubmission.id}`);
            
        } else {
            // Update existing submission
            const { error: updateError } = await ethicsSupabaseClient
                .from('ethics_submissions')
                .update({
                    title: ethicsSubmissionData.title,
                    description: ethicsSubmissionData.description,
                    risk_level: ethicsSubmissionData.risk_level
                })
                .eq('id', ethicsSubmissionData.id);
                
            if (updateError) {
                console.error('ethics-form.js: Error updating submission draft:', updateError);
                if (!silent) alert('Error saving draft. Please try again.');
                return;
            }
        }
        
        // Save each document that doesn't have an uploaded_file_id yet
        const documentsToSave = ethicsSubmissionData.documents.filter(doc => !doc.uploaded_file_id);
        
        if (documentsToSave.length > 0) {
            const documentInserts = documentsToSave.map(doc => ({
                submission_id: ethicsSubmissionData.id,
                document_type: doc.document_type_id,
                filename: doc.filename,
                file_path: doc.file_path,
                file_url: doc.file_url
            }));
            
            const { data: savedDocs, error: docsError } = await ethicsSupabaseClient
                .from('ethics_documents')
                .insert(documentInserts)
                .select();
                
            if (docsError) {
                console.error('ethics-form.js: Error saving documents:', docsError);
                if (!silent) alert('Error saving documents. Please try again.');
                return;
            }
            
            // Update document IDs in state
            savedDocs.forEach(savedDoc => {
                const docIndex = ethicsSubmissionData.documents.findIndex(
                    doc => doc.document_type_id === savedDoc.document_type && !doc.uploaded_file_id
                );
                
                if (docIndex >= 0) {
                    ethicsSubmissionData.documents[docIndex].uploaded_file_id = savedDoc.id;
                }
            });
        }
        
        if (!silent) {
            // Show success message
            if (EthicsDOM.formFeedbackDisplay) {
                EthicsDOM.formFeedbackDisplay.innerHTML = '<div class="success-message">Draft saved successfully!</div>';
                setTimeout(() => {
                    EthicsDOM.formFeedbackDisplay.innerHTML = '';
                }, 3000);
            }
        }
        
    } catch (error) {
        console.error('ethics-form.js: Error saving draft:', error);
        if (!silent) alert('An unexpected error occurred while saving draft.');
    }
}

// --- Submit Form ---
async function submitForm() {
    try {
        // First save as draft
        await saveDraft(true);
        
        // Collect form data
        if (EthicsDOM.titleInput) ethicsSubmissionData.title = EthicsDOM.titleInput.value;
        if (EthicsDOM.descriptionTextarea) ethicsSubmissionData.description = EthicsDOM.descriptionTextarea.value;
        if (EthicsDOM.riskLevelSelect) ethicsSubmissionData.risk_level = EthicsDOM.riskLevelSelect.value;
        
        // Validate required fields
        if (!ethicsSubmissionData.title) {
            alert('Please enter a title for your ethics submission.');
            return;
        }
        
        if (!ethicsSubmissionData.description) {
            alert('Please enter a description for your ethics submission.');
            return;
        }
        
        // Check that all required documents are uploaded
        const missingRequiredDocs = REQUIRED_ETHICS_DOCUMENTS
            .filter(docType => docType.required)
            .filter(docType => !ethicsSubmissionData.documents.some(doc => doc.document_type_id === docType.id));
            
        if (missingRequiredDocs.length > 0) {
            alert(`Please upload the following required document(s):\n${missingRequiredDocs.map(doc => doc.name).join('\n')}`);
            return;
        }
        
        // Update submission status
        const { error: updateError } = await ethicsSupabaseClient
            .from('ethics_submissions')
            .update({
                title: ethicsSubmissionData.title,
                description: ethicsSubmissionData.description,
                risk_level: ethicsSubmissionData.risk_level,
                status: 'submitted',
                submitted_at: new Date().toISOString()
            })
            .eq('id', ethicsSubmissionData.id);
            
        if (updateError) {
            console.error('ethics-form.js: Error submitting ethics form:', updateError);
            alert('Error submitting your ethics application. Please try again.');
            return;
        }
        
        // Show success message
        alert('Your ethics application has been submitted successfully!');
        
        // Disable form
        disableFormForSubmitted();
        
        // Update status display
        if (EthicsDOM.formStatusDisplay) {
            EthicsDOM.formStatusDisplay.textContent = 'Submitted';
        }
        
        ethicsSubmissionData.status = 'submitted';
        
    } catch (error) {
        console.error('ethics-form.js: Error in submitForm:', error);
        alert('An unexpected error occurred while submitting your ethics application.');
    }
}

// --- Disable Form For Submitted ---
function disableFormForSubmitted() {
    try {
        // Disable form inputs
        if (EthicsDOM.titleInput) EthicsDOM.titleInput.disabled = true;
        if (EthicsDOM.descriptionTextarea) EthicsDOM.descriptionTextarea.disabled = true;
        if (EthicsDOM.riskLevelSelect) EthicsDOM.riskLevelSelect.disabled = true;
        
        // Hide submit and save buttons
        if (EthicsDOM.submitBtn) EthicsDOM.submitBtn.style.display = 'none';
        if (EthicsDOM.saveAsDraftBtn) EthicsDOM.saveAsDraftBtn.style.display = 'none';
        
        // Disable upload buttons
        document.querySelectorAll('.upload-btn').forEach(button => {
            button.disabled = true;
        });
        
    } catch (error) {
        console.error('ethics-form.js: Error in disableFormForSubmitted:', error);
    }
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    // Check if we're on the ethics form page
    const isEthicsForm = window.location.pathname.includes('ethics-form.html');
    if (isEthicsForm) {
        initializeEthicsForm();
    }
});
