// Field Worker Portal UI & Task Lifecycle
const WorkerPortal = {
  init() {
    this.renderTasks();
  },

  async renderTasks() {
    const container = document.getElementById("main-view");
    container.innerHTML = `
      <div class="text-center py-5">
        <div class="spinner-border text-success" role="status"></div>
        <p class="text-muted mt-2">Loading field worker tasks...</p>
      </div>
    `;

    try {
      const res = await API.getTasks();
      const tasks = res.tasks || [];
      const activeTasks = tasks.filter(t => !["COMPLETED"].includes(t.status));
      const completedTasks = tasks.filter(t => t.status === "COMPLETED");

      container.innerHTML = `
        <div class="worker-portal" style="max-width: 780px; margin: 0 auto;">
          <!-- Header Banner -->
          <div class="sw-card worker-hero-card p-4 rounded-4 mb-4 text-white">
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div>
                <div class="d-flex align-items-center gap-2 mb-1">
                  <span class="badge bg-light text-dark fw-bold px-3 py-1">Field Sanitation Worker</span>
                  <span class="badge bg-success bg-opacity-25 text-white border border-success border-opacity-50 px-2 py-0.5 rounded-pill d-flex align-items-center gap-1">
                    <span class="status-pulse-dot"></span> On Duty • Chirala
                  </span>
                </div>
                <h3 class="fw-bold mb-1">Sanitation Operations & Tasks</h3>
                <p class="small text-white-50 mb-0">Ward 5 Central Sanitation Rapid Response Crew</p>
              </div>
              <div class="text-end bg-white bg-opacity-10 p-3 rounded-3 border border-white border-opacity-20" style="backdrop-filter: blur(8px);">
                <div class="fs-2 fw-bold text-success">${activeTasks.length}</div>
                <div class="small text-white-50" style="font-size: 0.75rem;">Active Assigned Tasks</div>
              </div>
            </div>
          </div>

          <!-- Tasks List -->
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h5 class="fw-bold mb-0">Assigned Tasks (${tasks.length})</h5>
            <div class="d-flex gap-2">
              <button class="btn btn-sm btn-outline-success" onclick="WorkerPortal.syncLocation()">📍 Update Location</button>
              <button class="btn btn-sm btn-outline-secondary" onclick="WorkerPortal.renderTasks()">↻ Refresh</button>
            </div>
          </div>

          ${tasks.length === 0 ? `
            <div class="sw-card text-center py-5">
              <div class="fs-1 mb-2">🎉</div>
              <h5 class="fw-bold">No tasks assigned</h5>
              <p class="text-muted small">You currently have no pending waste collection duties.</p>
            </div>
          ` : `
            <div class="d-flex flex-column gap-3">
              ${tasks.map(t => {
                const rep = t.report || {};
                const isUrgent = ["HIGH", "CRITICAL"].includes(rep.priority);
                const isRecleaning = t.status === "RE_CLEANING_REQUIRED" || rep.status === "RE_CLEANING_REQUIRED";

                return `
                  <div class="sw-card p-3 border-start border-4 ${isRecleaning ? 'border-danger' : (isUrgent ? 'border-warning' : 'border-primary')}">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                      <div>
                        <span class="badge-priority ${rep.priority || 'MEDIUM'}">${rep.priority || 'MEDIUM'}</span>
                        <span class="badge-status badge-${rep.status || t.status} ms-1">${(rep.status || t.status).replace(/_/g, ' ')}</span>
                      </div>
                      <strong class="text-primary">${rep.id || ('Task #' + t.id)}</strong>
                    </div>

                    ${isRecleaning ? `
                      <div class="alert alert-danger py-2 small my-2">
                        <strong>⚠️ Re-Cleaning Requested by Officer:</strong>
                        <div>"${t.recleaning_notes || 'Clean residues thoroughly.'}"</div>
                      </div>
                    ` : ''}

                    <div class="row g-2 align-items-center my-2">
                      <div class="col-3 col-sm-2">
                        <img src="${window.resolveImageUrl(rep.before_image)}" onerror="window.handleImageError(this)" class="rounded w-100" style="height: 65px; object-fit: cover;">
                      </div>
                      <div class="col-9 col-sm-10">
                        <h6 class="fw-bold mb-1">${rep.category || 'Waste Task'}</h6>
                        <p class="small text-muted mb-1">📍 ${rep.location_name || 'Ward 1 - Chirala Clock Tower'}${t.distance_km !== null && t.distance_km !== undefined ? ` • <strong class="text-dark">${t.distance_km} km away</strong>` : ''}</p>
                        <p class="small text-secondary mb-0 text-truncate">${rep.description || rep.ai_summary || ''}</p>
                      </div>
                    </div>

                    <!-- Worker State Actions -->
                    <div class="pt-2 mt-2 border-top d-flex justify-content-between align-items-center flex-wrap gap-2">
                      <small class="text-muted">Assigned: ${new Date(t.assigned_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</small>

                      <div class="d-flex gap-2">
                        ${t.status === "ASSIGNED" || rep.status === "ASSIGNED" ? `
                          <button class="btn btn-sm btn-primary fw-bold" onclick="WorkerPortal.acceptTask(${t.id})">
                            ACCEPT TASK
                          </button>
                        ` : ''}

                        ${["ACCEPTED", "RE_CLEANING_REQUIRED"].includes(t.status) || ["ACCEPTED", "RE_CLEANING_REQUIRED"].includes(rep.status) ? `
                          <button class="btn btn-sm btn-warning fw-bold text-dark" onclick="WorkerPortal.startCleaning(${t.id})">
                            🚛 START CLEANING
                          </button>
                        ` : ''}

                        ${t.status === "IN_PROGRESS" || rep.status === "IN_PROGRESS" ? `
                          <button class="btn btn-sm btn-success fw-bold" onclick="WorkerPortal.openProofModal(${t.id}, '${rep.id}')">
                            📸 SUBMIT PROOF
                          </button>
                        ` : ''}

                        ${rep.status === "AWAITING_VERIFICATION" ? `
                          <span class="badge bg-warning text-dark py-2 px-3">⏳ Awaiting Officer Verification</span>
                        ` : ''}

                        ${rep.status === "COMPLETED" ? `
                          <span class="badge bg-success py-2 px-3">✓ Cleared & Verified</span>
                        ` : ''}
                      </div>
                    </div>
                  </div>
                `;
              }).join("")}
            </div>
          `}
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`;
    }
  },

  async syncLocation() {
    if ("geolocation" in navigator) {
      SWNotice.showLoading("Detecting current coordinates...");
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            await API.updateWorkerLocation(null, position.coords.latitude, position.coords.longitude);
            SWNotice.hideLoading();
            SWNotice.success(`Location updated to ${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`);
            this.renderTasks();
          } catch (err) {
            SWNotice.hideLoading();
            SWNotice.error("Failed to update location: " + err.message);
          }
        },
        (err) => {
          SWNotice.hideLoading();
          SWNotice.info("GPS unavailable: keeping current assigned location.");
        },
        { timeout: 5000 }
      );
    } else {
      SWNotice.info("Geolocation is not supported by your browser.");
    }
  },

  async acceptTask(taskId) {
    try {
      await API.acceptTask(taskId);
      SWNotice.success("Task accepted! Prepare equipment and proceed to location.");
      this.renderTasks();
    } catch (err) {
      SWNotice.error("Error: " + err.message);
    }
  },

  async startCleaning(taskId) {
    try {
      await API.startCleaning(taskId);
      SWNotice.info("Status updated: Cleaning in progress. The citizen and municipal office have been notified.");
      this.renderTasks();
    } catch (err) {
      SWNotice.error("Error: " + err.message);
    }
  },

  // PROOF SUBMISSION MODAL
  openProofModal(taskId, reportId) {
    const modalContainer = document.getElementById("modal-container");
    modalContainer.innerHTML = `
      <div class="sw-modal-backdrop">
        <div class="sw-modal">
          <div class="sw-modal-header bg-success text-white">
            <h5 class="fw-bold mb-0">Submit Completion Proof • ${reportId}</h5>
            <button class="btn-close btn-close-white" onclick="WorkerPortal.closeModal()"></button>
          </div>
          <div class="sw-modal-body">
            <div class="alert alert-info py-2 small mb-3">
              📸 Upload a photo of the cleared area or select simulated demo proof.
            </div>

            <div class="text-center mb-3">
              <img id="worker-proof-preview" src="./uploads/sample_cleaned_after.jpg" onerror="window.handleImageError(this)" class="img-fluid rounded border shadow-sm" style="max-height: 220px; width: 100%; object-fit: cover;">
            </div>

            <div class="mb-3">
              <label class="form-label small fw-bold">1. Upload Real After Photo</label>
              <input type="file" id="worker-proof-file" class="form-control form-control-sm" accept="image/*">
            </div>

            <div class="mb-3">
              <label class="form-label small fw-bold">Or Select Demo Cleaned Photo Proof:</label>
              <div class="d-flex gap-2 flex-wrap">
                <button type="button" class="btn btn-sm btn-outline-success" onclick="WorkerPortal.selectSampleProof('./uploads/sample_cleaned_after.jpg')">
                  🌿 Roadside Cleared
                </button>
                <button type="button" class="btn btn-sm btn-outline-success" onclick="WorkerPortal.selectSampleProof('./uploads/sample_cleaned_market.jpg')">
                  🏪 Market Area Cleared
                </button>
              </div>
            </div>

            <div class="mb-3">
              <label class="form-label small fw-bold">Cleaning Notes & Action Taken</label>
              <textarea id="worker-notes" class="form-control form-control-sm" rows="2" placeholder="e.g. Cleared 2 bags of wet waste, disinfected the curb.">Waste cleared, segregated into municipal tipper, and disinfected.</textarea>
            </div>
          </div>
          <div class="sw-modal-footer">
            <button class="btn btn-secondary btn-sm" onclick="WorkerPortal.closeModal()">Cancel</button>
            <button class="btn btn-success fw-bold px-4" id="submit-proof-btn" onclick="WorkerPortal.submitProof(${taskId})">
              SUBMIT FOR VERIFICATION 🚀
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById("worker-proof-file").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        this.selectedFile = file;
        const reader = new FileReader();
        reader.onload = (event) => {
          document.getElementById("worker-proof-preview").src = event.target.result;
        };
        reader.readAsDataURL(file);
      }
    });
  },

  selectedFile: null,
  selectedProofUrl: "./uploads/sample_cleaned_after.jpg",

  selectSampleProof(url) {
    this.selectedFile = null;
    this.selectedProofUrl = url;
    document.getElementById("worker-proof-preview").src = window.resolveImageUrl(url);
  },

  async submitProof(taskId) {
    const btn = document.getElementById("submit-proof-btn");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Submitting Proof...`;

    SWNotice.showLoading("Submitting completion proof for municipal verification...");

    try {
      const notes = document.getElementById("worker-notes").value;
      const fd = new FormData();
      if (this.selectedFile) {
        fd.append("image", this.selectedFile);
      } else {
        fd.append("image_url", window.resolveImageUrl(this.selectedProofUrl));
      }
      fd.append("notes", notes);

      await API.submitTaskProof(taskId, fd);
      SWNotice.hideLoading();
      SWNotice.success("Completion proof submitted! Municipal Officer has been alerted for verification.");
      this.closeModal();
      this.renderTasks();
    } catch (err) {
      SWNotice.hideLoading();
      SWNotice.error("Error: " + err.message);
      btn.disabled = false;
      btn.innerText = "SUBMIT FOR VERIFICATION 🚀";
    }
  },

  closeModal() {
    document.getElementById("modal-container").innerHTML = "";
  }
};
