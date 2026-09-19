// Municipal Console UI & Operations - SmartWaste AI
const MunicipalConsole = {
  currentTab: "dashboard",

  init() {
    this.renderDashboard();
  },

  async renderDashboard() {
    this.currentTab = "dashboard";
    const container = document.getElementById("main-view");
    if (!container) return;

    container.innerHTML = `
      <div class="text-center py-5">
        <div class="spinner-border text-primary" role="status"></div>
        <p class="text-muted mt-2">Loading municipal operations console...</p>
      </div>
    `;

    try {
      const [analyticsRes, reportsRes] = await Promise.all([
        API.getAnalytics().catch(err => {
          console.error("Analytics fetch error:", err);
          return { metrics: {}, by_category: {}, by_priority: {}, by_status: {} };
        }),
        API.getReports().catch(err => {
          console.error("Reports fetch error:", err);
          return { reports: [] };
        })
      ]);

      const m = (analyticsRes && analyticsRes.metrics) ? analyticsRes.metrics : {};
      const reports = (reportsRes && reportsRes.reports) ? reportsRes.reports : [];
      const byCategory = (analyticsRes && analyticsRes.by_category) ? analyticsRes.by_category : {};
      const byPriority = (analyticsRes && analyticsRes.by_priority) ? analyticsRes.by_priority : {};
      const byStatus = (analyticsRes && analyticsRes.by_status) ? analyticsRes.by_status : {};

      // Pending action reports
      const pendingVerif = reports.filter(r => r.status === "AWAITING_VERIFICATION");

      container.innerHTML = `
        <div class="municipal-console">
          <!-- Municipal Header -->
          <div class="sw-card municipal-hero-card p-4 rounded-4 mb-4 text-white">
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-3">
              <div>
                <div class="d-flex align-items-center gap-2 mb-1">
                  <span class="badge bg-light text-dark fw-bold px-3 py-1">Municipal Operations Console</span>
                  <span class="badge bg-success bg-opacity-25 text-white border border-success border-opacity-50 px-2 py-0.5 rounded-pill d-flex align-items-center gap-1">
                    <span class="status-pulse-dot"></span> Live Telemetry Active
                  </span>
                </div>
                <h3 class="fw-bold mb-1">Chirala Sanitation Command Center</h3>
                <p class="text-white-50 small mb-0">Municipal Corporation of Chirala • Central AI Monitoring & Logistics Grid</p>
              </div>
              <div class="d-flex gap-2 flex-wrap">
                <button class="btn btn-sm btn-light fw-bold shadow-sm" onclick="MunicipalConsole.renderVerificationQueue()">
                  🔍 Verification Queue <span class="badge bg-warning text-dark ms-1">${pendingVerif.length}</span>
                </button>
                <button class="btn btn-sm btn-outline-light fw-bold" onclick="MunicipalConsole.renderHeatmap()">
                  🗺️ Ward Heatmap
                </button>
                <button class="btn btn-sm btn-outline-light fw-bold" onclick="MunicipalConsole.renderWorkerWorkload()">
                  👷 Worker Workload
                </button>
                <button class="btn btn-sm btn-outline-light fw-bold" onclick="MunicipalConsole.renderAnnouncementsManager()">
                  📢 Announcements
                </button>
                <button class="btn btn-sm btn-outline-light" onclick="MunicipalConsole.renderRoutePlanner()">
                  🚚 Route Planner
                </button>
                <button class="btn btn-sm btn-outline-light" onclick="MunicipalConsole.renderCollectionPoints()">
                  ♻ Collection Points
                </button>
              </div>
            </div>
          </div>

          <!-- KPI Metric Cards Grid -->
          <div class="row g-3 mb-4">
            <div class="col-6 col-md-3">
              <div class="sw-card p-3 h-100 border-start border-4 border-primary">
                <div class="text-muted small fw-bold">TOTAL REPORTS</div>
                <div class="fs-3 fw-bold">${m.total_reports !== undefined ? m.total_reports : reports.length}</div>
                <small class="text-muted">${m.open_reports || 0} active in system</small>
              </div>
            </div>

            <div class="col-6 col-md-3">
              <div class="sw-card p-3 h-100 border-start border-4 border-warning">
                <div class="text-muted small fw-bold">AWAITING VERIFICATION</div>
                <div class="fs-3 fw-bold text-warning">${m.awaiting_verification !== undefined ? m.awaiting_verification : pendingVerif.length}</div>
                <small class="text-muted">Requires officer inspection</small>
              </div>
            </div>

            <div class="col-6 col-md-3">
              <div class="sw-card p-3 h-100 border-start border-4 border-info">
                <div class="text-muted small fw-bold">IN-PROGRESS CLEANUPS</div>
                <div class="fs-3 fw-bold text-info">${m.in_progress || 0}</div>
                <small class="text-muted">${m.available_workers || 0} workers available</small>
              </div>
            </div>

            <div class="col-6 col-md-3">
              <div class="sw-card p-3 h-100 border-start border-4 border-success">
                <div class="text-muted small fw-bold">RESOLVED & VERIFIED</div>
                <div class="fs-3 fw-bold text-success">${m.completed || 0}</div>
                <small class="text-muted">⭐ ${m.avg_rating || '4.8'} Avg. Citizen Rating</small>
              </div>
            </div>
          </div>

          <!-- Pending Verification Urgent Banner -->
          ${pendingVerif.length > 0 ? `
            <div class="alert alert-warning d-flex justify-content-between align-items-center mb-4 shadow-sm">
              <div>
                <strong>⚠️ ${pendingVerif.length} Task(s) Awaiting Municipal Verification:</strong>
                <div class="small">Sanitation workers have submitted after-cleaning photo proof for inspection.</div>
              </div>
              <button class="btn btn-warning fw-bold btn-sm px-3" onclick="MunicipalConsole.renderVerificationQueue()">
                Inspect Proofs →
              </button>
            </div>
          ` : ''}

          <!-- Analytics Quick Summary Strip -->
          <div class="row g-3 mb-4">
            <div class="col-md-4">
              <div class="sw-card p-3 h-100">
                <h6 class="fw-bold text-muted small mb-2">CATEGORY DISTRIBUTION</h6>
                <div class="d-flex flex-column gap-1">
                  ${Object.entries(byCategory).filter(([_, cnt]) => cnt > 0).slice(0, 4).map(([cat, cnt]) => `
                    <div class="d-flex justify-content-between align-items-center small">
                      <span class="text-truncate" style="max-width: 180px;">${cat}</span>
                      <span class="badge bg-light text-dark border">${cnt}</span>
                    </div>
                  `).join("") || '<div class="text-muted small">No category data yet</div>'}
                </div>
              </div>
            </div>
            <div class="col-md-4">
              <div class="sw-card p-3 h-100">
                <h6 class="fw-bold text-muted small mb-2">PRIORITY BREAKDOWN</h6>
                <div class="d-flex flex-column gap-1">
                  ${Object.entries(byPriority).map(([pri, cnt]) => `
                    <div class="d-flex justify-content-between align-items-center small">
                      <span class="badge-priority ${pri}">${pri}</span>
                      <span class="fw-bold">${cnt}</span>
                    </div>
                  `).join("") || '<div class="text-muted small">No priority data yet</div>'}
                </div>
              </div>
            </div>
            <div class="col-md-4">
              <div class="sw-card p-3 h-100">
                <h6 class="fw-bold text-muted small mb-2">STATUS OVERVIEW</h6>
                <div class="d-flex flex-column gap-1">
                  ${Object.entries(byStatus).filter(([_, cnt]) => cnt > 0).slice(0, 4).map(([st, cnt]) => `
                    <div class="d-flex justify-content-between align-items-center small">
                      <span class="badge-status badge-${st}">${st.replace(/_/g, ' ')}</span>
                      <span class="fw-bold">${cnt}</span>
                    </div>
                  `).join("") || '<div class="text-muted small">No status data yet</div>'}
                </div>
              </div>
            </div>
          </div>

          <!-- Reports Table with Advanced Multi-Facet Filters -->
          <div class="sw-card">
            <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
              <h5 class="fw-bold mb-0">All Waste Complaints</h5>
              <button class="btn btn-sm btn-outline-secondary" onclick="MunicipalConsole.resetFilters()">↺ Reset Filters</button>
            </div>

            <!-- Filter Toolbar -->
            <div class="row g-2 mb-3 p-2 bg-light rounded border align-items-center">
              <div class="col-12 col-md-3">
                <input type="text" id="muni-search-input" class="form-control form-control-sm" placeholder="🔎 Search by ID, location..." oninput="MunicipalConsole.filterReports()">
              </div>
              <div class="col-6 col-md-2">
                <select id="muni-ward-filter" class="form-select form-select-sm" onchange="MunicipalConsole.filterReports()">
                  <option value="">All Wards</option>
                  <option value="Ward 1">Ward 1</option>
                  <option value="Ward 2">Ward 2</option>
                  <option value="Ward 3">Ward 3</option>
                  <option value="Ward 4">Ward 4</option>
                  <option value="Ward 5">Ward 5</option>
                  <option value="Ward 6">Ward 6</option>
                  <option value="Ward 7">Ward 7</option>
                  <option value="Ward 8">Ward 8</option>
                  <option value="Ward 9">Ward 9</option>
                  <option value="Ward 10">Ward 10</option>
                </select>
              </div>
              <div class="col-6 col-md-2">
                <select id="muni-category-filter" class="form-select form-select-sm" onchange="MunicipalConsole.filterReports()">
                  <option value="">All Categories</option>
                  <option value="Mixed Waste">Mixed Waste</option>
                  <option value="Plastic">Plastic</option>
                  <option value="Organic / Wet Waste">Organic / Wet Waste</option>
                  <option value="Hazardous Waste">Hazardous Waste</option>
                  <option value="E-Waste">E-Waste</option>
                  <option value="Construction Debris">Construction Debris</option>
                </select>
              </div>
              <div class="col-6 col-md-2">
                <select id="muni-priority-filter" class="form-select form-select-sm" onchange="MunicipalConsole.filterReports()">
                  <option value="">All Priorities</option>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
              <div class="col-6 col-md-2">
                <select id="muni-status-filter" class="form-select form-select-sm" onchange="MunicipalConsole.filterReports()">
                  <option value="">All Statuses</option>
                  <option value="SUBMITTED">Submitted</option>
                  <option value="UNDER_REVIEW">Under Review</option>
                  <option value="INFORMATION_REQUESTED">Info Requested</option>
                  <option value="ASSIGNED">Assigned</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="AWAITING_VERIFICATION">Awaiting Verification</option>
                  <option value="RE_CLEANING_REQUIRED">Re-Cleaning Req.</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
              <div class="col-12 col-md-1">
                <div class="form-check form-switch pt-1">
                  <input class="form-check-input" type="checkbox" id="muni-emergency-filter" onchange="MunicipalConsole.filterReports()">
                  <label class="form-check-label small fw-bold text-danger" for="muni-emergency-filter" title="Show only public hazard emergencies">🚨 Hazard</label>
                </div>
              </div>
            </div>

            <div class="table-responsive">
              <table class="table table-hover align-middle mb-0" style="font-size: 0.88rem;">
                <thead class="table-light">
                  <tr>
                    <th>Complaint ID</th>
                    <th>Category</th>
                    <th>Location / Ward</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th class="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody id="muni-reports-tbody">
                  ${reports.map(r => `
                    <tr>
                      <td class="fw-bold text-primary">
                        ${r.id}
                        ${r.is_emergency ? '<span class="badge bg-danger ms-1">🚨 EMERGENCY</span>' : ''}
                      </td>
                      <td>${r.category}</td>
                      <td class="text-truncate" style="max-width: 200px;" title="${r.location_name}">
                        <div>${r.location_name}</div>
                        ${r.ward ? `<span class="badge bg-secondary-subtle text-secondary small">${r.ward}</span>` : ''}
                      </td>
                      <td><span class="badge-priority ${r.priority}">${r.priority}</span></td>
                      <td><span class="badge-status badge-${r.status}">${r.status.replace(/_/g, ' ')}</span></td>
                      <td class="text-muted small">${new Date(r.created_at).toLocaleDateString([], {month:'short', day:'numeric'})}</td>
                      <td class="text-end">
                        <div class="btn-group btn-group-sm">
                          <button class="btn btn-outline-primary" onclick="MunicipalConsole.openReportModal('${r.id}')">View</button>
                          ${r.status === "SUBMITTED" ? `
                            <button class="btn btn-outline-success" onclick="MunicipalConsole.reviewReport('${r.id}')">Review</button>
                          ` : ''}
                          ${["SUBMITTED", "UNDER_REVIEW"].includes(r.status) ? `
                            <button class="btn btn-success text-white" onclick="MunicipalConsole.openAssignModal('${r.id}')">Assign Worker</button>
                          ` : ''}
                          ${r.status === "AWAITING_VERIFICATION" ? `
                            <button class="btn btn-warning fw-bold" onclick="MunicipalConsole.openVerificationModal('${r.id}')">Verify</button>
                          ` : ''}
                        </div>
                      </td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="alert alert-danger">Error loading municipal dashboard: ${err.message}</div>`;
    }
  },

  resetFilters() {
    const q = document.getElementById("muni-search-input");
    const ward = document.getElementById("muni-ward-filter");
    const cat = document.getElementById("muni-category-filter");
    const pri = document.getElementById("muni-priority-filter");
    const st = document.getElementById("muni-status-filter");
    const em = document.getElementById("muni-emergency-filter");
    if (q) q.value = "";
    if (ward) ward.value = "";
    if (cat) cat.value = "";
    if (pri) pri.value = "";
    if (st) st.value = "";
    if (em) em.checked = false;
    this.filterReports();
  },

  async filterReports() {
    const q = document.getElementById("muni-search-input")?.value?.trim() || "";
    const ward = document.getElementById("muni-ward-filter")?.value || "";
    const category = document.getElementById("muni-category-filter")?.value || "";
    const priority = document.getElementById("muni-priority-filter")?.value || "";
    const status = document.getElementById("muni-status-filter")?.value || "";
    const isEmergency = document.getElementById("muni-emergency-filter")?.checked;

    const params = {};
    if (q) params.q = q;
    if (ward) params.ward = ward;
    if (category) params.category = category;
    if (priority) params.priority = priority;
    if (status) params.status = status;
    if (isEmergency) params.is_emergency = "true";

    try {
      const res = await API.getReports(params);
      const reports = res.reports || [];
      const tbody = document.getElementById("muni-reports-tbody");
      if (!tbody) return;

      if (reports.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" class="text-center py-4 text-muted">
              No waste complaints match the selected filter criteria.
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = reports.map(r => `
        <tr>
          <td class="fw-bold text-primary">
            ${r.id}
            ${r.is_emergency ? '<span class="badge bg-danger ms-1">🚨 EMERGENCY</span>' : ''}
          </td>
          <td>${r.category}</td>
          <td class="text-truncate" style="max-width: 200px;" title="${r.location_name}">
            <div>${r.location_name}</div>
            ${r.ward ? `<span class="badge bg-secondary-subtle text-secondary small">${r.ward}</span>` : ''}
          </td>
          <td><span class="badge-priority ${r.priority}">${r.priority}</span></td>
          <td><span class="badge-status badge-${r.status}">${r.status.replace(/_/g, ' ')}</span></td>
          <td class="text-muted small">${new Date(r.created_at).toLocaleDateString([], {month:'short', day:'numeric'})}</td>
          <td class="text-end">
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-primary" onclick="MunicipalConsole.openReportModal('${r.id}')">View</button>
              ${r.status === "SUBMITTED" ? `
                <button class="btn btn-outline-success" onclick="MunicipalConsole.reviewReport('${r.id}')">Review</button>
              ` : ''}
              ${["SUBMITTED", "UNDER_REVIEW"].includes(r.status) ? `
                <button class="btn btn-success text-white" onclick="MunicipalConsole.openAssignModal('${r.id}')">Assign Worker</button>
              ` : ''}
              ${r.status === "AWAITING_VERIFICATION" ? `
                <button class="btn btn-warning fw-bold" onclick="MunicipalConsole.openVerificationModal('${r.id}')">Verify</button>
              ` : ''}
            </div>
          </td>
        </tr>
      `).join("");
    } catch (err) {
      SWNotice.error("Filter error: " + err.message);
    }
  },

  async reviewReport(reportId) {
    try {
      await API.reviewReport(reportId);
      SWNotice.info(`Report #${reportId} marked as UNDER REVIEW.`);
      this.renderDashboard();
    } catch (err) {
      SWNotice.error("Review error: " + err.message);
    }
  },

  // ASSIGN WORKER MODAL (WITH SMART RECOMMENDATION ENGINE)
  async openAssignModal(reportId) {
    const modalContainer = document.getElementById("modal-container");
    modalContainer.innerHTML = `
      <div class="sw-modal-backdrop">
        <div class="sw-modal">
          <div class="sw-modal-header">
            <h5 class="fw-bold mb-0">Assign Sanitation Worker • ${reportId}</h5>
            <button class="btn-close" onclick="MunicipalConsole.closeModal()"></button>
          </div>
          <div class="sw-modal-body" id="assign-modal-body">
            <div class="text-center py-4">
              <div class="spinner-border text-primary"></div>
              <p class="text-muted small mt-2">Computing worker distance & availability rankings...</p>
            </div>
          </div>
        </div>
      </div>
    `;

    try {
      const res = await API.getRecommendedWorkers(reportId);
      const workers = res.recommended_workers || [];
      const body = document.getElementById("assign-modal-body");

      body.innerHTML = `
        <div class="alert alert-info py-2 small mb-3">
          💡 <strong>Smart Worker Recommendation:</strong> Workers are scored dynamically based on proximity to complaint site, active workload capacity, and assigned ward.
        </div>

        <div class="list-group">
          ${workers.map((w, idx) => `
            <div class="list-group-item list-group-item-action d-flex justify-content-between align-items-center p-3">
              <div>
                <div class="d-flex align-items-center gap-2">
                  <strong class="text-dark">${w.name}</strong>
                  ${idx === 0 ? '<span class="badge bg-success">Top Match</span>' : ''}
                  <span class="badge bg-light text-dark border">${w.status}</span>
                </div>
                <div class="small text-muted mt-1">
                  Zone: <strong>${w.zone || 'N/A'}</strong> • Distance: <strong>${w.distance_km !== null && w.distance_km !== undefined ? `${w.distance_km} km` : 'Location unavailable'}</strong> • Current Active Tasks: <strong>${w.active_tasks}</strong>
                </div>
                <div class="small text-secondary mt-1 fst-italic">
                  Reason: ${w.reason}
                </div>
              </div>
              <button class="btn btn-sm btn-primary px-3 fw-bold" onclick="MunicipalConsole.executeAssign('${reportId}', ${w.worker_id})">
                Assign
              </button>
            </div>
          `).join("")}
        </div>
      `;
    } catch (err) {
      document.getElementById("assign-modal-body").innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`;
    }
  },

  async executeAssign(reportId, workerId) {
    SWNotice.showLoading(`Assigning sanitation worker to #${reportId}...`);
    try {
      const res = await API.assignWorker(reportId, workerId);
      SWNotice.hideLoading();
      SWNotice.success(res.message || "Worker assigned successfully.");
      this.closeModal();
      this.renderDashboard();
    } catch (err) {
      SWNotice.hideLoading();
      SWNotice.error("Assignment error: " + err.message);
    }
  },

  // MUNICIPAL VERIFICATION QUEUE PAGE
  async renderVerificationQueue() {
    this.currentTab = "verification_queue";
    const container = document.getElementById("main-view");
    container.innerHTML = `
      <div class="text-center py-5">
        <div class="spinner-border text-primary" role="status"></div>
        <p class="text-muted mt-2">Loading municipal verification queue...</p>
      </div>
    `;

    try {
      const res = await API.getReports();
      const allReports = res.reports || [];
      const queue = allReports.filter(r => r.status === "AWAITING_VERIFICATION");

      container.innerHTML = `
        <div class="municipal-verification-queue">
          <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
            <div>
              <div class="d-flex align-items-center gap-2">
                <span class="fs-4">🔍</span>
                <h3 class="fw-bold mb-0">Municipal Verification Queue</h3>
                <span class="badge bg-warning text-dark px-3 py-1 fs-6">${queue.length} Pending Inspection</span>
              </div>
              <p class="text-muted small mb-0">Inspect before and after photographic evidence submitted by field sanitation crews</p>
            </div>
            <div class="d-flex gap-2">
              <button class="btn btn-outline-secondary btn-sm" onclick="MunicipalConsole.renderDashboard()">← Back to Dashboard</button>
              <button class="btn btn-primary btn-sm" onclick="MunicipalConsole.renderVerificationQueue()">↻ Refresh Queue</button>
            </div>
          </div>

          ${queue.length === 0 ? `
            <div class="sw-card text-center py-5">
              <div class="display-3 mb-3">✅</div>
              <h4 class="fw-bold text-dark mb-1">All Tasks Verified!</h4>
              <p class="text-muted small mb-4">There are no tasks currently awaiting officer inspection. Cleanups submitted by workers will appear here instantly.</p>
              <button class="btn btn-outline-primary btn-sm px-4" onclick="MunicipalConsole.renderDashboard()">Return to Operations Dashboard</button>
            </div>
          ` : `
            <div class="row g-4">
              ${queue.map(rep => {
                const task = rep.task || {};
                const inputId = `verif-notes-${task.id || rep.id}`;
                return `
                  <div class="col-12" id="verif-card-${rep.id}">
                    <div class="sw-card p-4 shadow-sm border-start border-4 border-warning">
                      <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
                        <div>
                          <div class="d-flex align-items-center gap-2 mb-1 flex-wrap">
                            <h5 class="fw-bold mb-0 text-primary">#${rep.id}</h5>
                            <span class="badge bg-light text-dark border">${rep.category}</span>
                            <span class="badge-priority ${rep.priority}">${rep.priority} PRIORITY</span>
                            <span class="badge bg-warning text-dark">AWAITING VERIFICATION</span>
                            ${rep.is_emergency ? '<span class="badge bg-danger">🚨 EMERGENCY</span>' : ''}
                          </div>
                          <div class="small text-muted">
                            📍 <strong>${rep.location_name}</strong> • Citizen: <strong>${rep.citizen ? rep.citizen.name : 'Citizen'}</strong>
                          </div>
                        </div>
                        <button class="btn btn-sm btn-outline-dark" onclick="MunicipalConsole.openReportModal('${rep.id}')">
                          Full Audit History →
                        </button>
                      </div>

                      <!-- Side by Side Before / After Inspection Images -->
                      <div class="verification-compare mb-3">
                        <div class="compare-card">
                          <div class="compare-card-header bg-danger text-white d-flex justify-content-between">
                            <span>📷 BEFORE (Reported Evidence)</span>
                            <span class="badge bg-light text-dark">${rep.category}</span>
                          </div>
                          <img src="${rep.before_image || '/uploads/sample_mixed_waste.jpg'}" class="compare-img" alt="Before Evidence" style="cursor: pointer;" onclick="window.open('${rep.before_image || '/uploads/sample_mixed_waste.jpg'}', '_blank')" title="Click to view full photo">
                        </div>

                        <div class="compare-card">
                          <div class="compare-card-header bg-success text-white d-flex justify-content-between">
                            <span>✨ AFTER (Worker Completion Proof)</span>
                            <span class="badge bg-light text-dark">Worker Proof</span>
                          </div>
                          <img src="${rep.after_image || task.proof_image_url || '/uploads/sample_cleaned_after.jpg'}" class="compare-img" alt="After Proof" style="cursor: pointer;" onclick="window.open('${rep.after_image || task.proof_image_url || '/uploads/sample_cleaned_after.jpg'}', '_blank')" title="Click to view full photo">
                        </div>
                      </div>

                      <!-- Worker Completion Details Box -->
                      <div class="p-3 bg-light rounded mb-3 small border">
                        <div class="row g-2">
                          <div class="col-md-6">
                            <strong>👷 Assigned Field Worker:</strong> ${task.worker_name || 'Sanitation Crew'}<br>
                            <strong>📅 Submitted Proof At:</strong> ${task.submitted_proof_at ? new Date(task.submitted_proof_at).toLocaleString() : 'Recently'}
                          </div>
                          <div class="col-md-6">
                            <strong>📝 Worker Notes:</strong>
                            <div class="text-secondary fst-italic">"${task.worker_notes || 'Cleaned and sanitized site.'}"</div>
                          </div>
                        </div>
                      </div>

                      <!-- Inspection Notes Input -->
                      <div class="mb-3">
                        <label class="form-label small fw-bold text-dark mb-1">Officer Inspection Notes / Hygiene Confirmation:</label>
                        <input type="text" id="${inputId}" class="form-control form-control-sm" value="Inspected site proof; clearance meets municipal hygiene standards.">
                      </div>

                      <!-- Verification Actions -->
                      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 pt-2 border-top">
                        <div class="d-flex gap-2">
                          <button class="btn btn-outline-danger btn-sm fw-semibold" onclick="MunicipalConsole.promptRecleaning(${task.id || 0}, '${rep.id}')">
                            ⚠️ Request Re-Cleaning
                          </button>
                          <button class="btn btn-outline-secondary btn-sm" onclick="MunicipalConsole.promptReject('${rep.id}')">
                            ✕ Reject Complaint
                          </button>
                        </div>
                        <button class="btn btn-success fw-bold px-4 shadow-sm" onclick="MunicipalConsole.executeApproveVerification(${task.id || 0}, '${rep.id}', '${inputId}')">
                          ✓ APPROVE COMPLETION
                        </button>
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
      container.innerHTML = `<div class="alert alert-danger m-4">Error loading verification queue: ${err.message}</div>`;
    }
  },

  // SIDE-BY-SIDE VERIFICATION MODAL
  async openVerificationModal(reportId) {
    const modalContainer = document.getElementById("modal-container");
    modalContainer.innerHTML = `
      <div class="sw-modal-backdrop">
        <div class="sw-modal" style="max-width: 820px;">
          <div class="sw-modal-header bg-light">
            <div>
              <h5 class="fw-bold mb-0">Municipal Completion Verification • ${reportId}</h5>
              <small class="text-muted">Inspect before and after photographic proof</small>
            </div>
            <button class="btn-close" onclick="MunicipalConsole.closeModal()"></button>
          </div>
          <div class="sw-modal-body" id="verif-modal-body">
            <div class="text-center py-4"><div class="spinner-border text-primary"></div></div>
          </div>
        </div>
      </div>
    `;

    try {
      const res = await API.getReport(reportId);
      const rep = res.report;
      const task = rep.task;
      const body = document.getElementById("verif-modal-body");

      body.innerHTML = `
        <div class="verification-compare mb-3">
          <div class="compare-card">
            <div class="compare-card-header bg-danger text-white">
              📷 BEFORE (Reported Evidence)
            </div>
            <img src="${rep.before_image || '/uploads/sample_mixed_waste.jpg'}" class="compare-img" alt="Before Evidence">
          </div>
          <div class="compare-card">
            <div class="compare-card-header bg-success text-white">
              ✨ AFTER (Worker Proof)
            </div>
            <img src="${rep.after_image || (task && task.proof_image_url) || '/uploads/sample_cleaned_after.jpg'}" class="compare-img" alt="After Proof">
          </div>
        </div>

        <div class="p-3 bg-light rounded mb-3 small">
          <strong>Worker Notes:</strong> ${task && task.worker_notes ? task.worker_notes : 'Area cleared thoroughly.'}<br>
          <strong>Submitted At:</strong> ${task && task.submitted_proof_at ? new Date(task.submitted_proof_at).toLocaleString() : 'Recently'}
        </div>

        <div class="mb-3">
          <label class="form-label small fw-bold">Officer Inspection Notes:</label>
          <input type="text" id="modal-verif-notes" class="form-control form-control-sm" value="Cleared to municipal hygiene standards. Verified.">
        </div>

        <div class="d-flex justify-content-between pt-2 border-top">
          <div class="d-flex gap-2">
            <button class="btn btn-outline-danger btn-sm" onclick="MunicipalConsole.promptRecleaning(${task ? task.id : 0}, '${rep.id}')">
              Request Re-Cleaning
            </button>
            <button class="btn btn-outline-secondary btn-sm" onclick="MunicipalConsole.promptReject('${rep.id}')">
              Reject Complaint
            </button>
          </div>
          <button class="btn btn-success fw-bold px-4" onclick="MunicipalConsole.executeApproveVerification(${task ? task.id : 0}, '${rep.id}', 'modal-verif-notes')">
            ✓ APPROVE RESOLUTION
          </button>
        </div>
      `;
    } catch (err) {
      document.getElementById("verif-modal-body").innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`;
    }
  },

  async executeApproveVerification(taskId, reportId, inputNotesId) {
    const notesInput = document.getElementById(inputNotesId);
    const notes = notesInput ? notesInput.value.trim() : "Hygiene standards verified.";

    SWNotice.showLoading(`Approving completion for #${reportId}...`);
    try {
      if (taskId && taskId > 0) {
        await API.verifyTask(taskId, notes);
      } else {
        const res = await API.getReport(reportId);
        if (res.report && res.report.task) {
          await API.verifyTask(res.report.task.id, notes);
        }
      }
      SWNotice.hideLoading();
      SWNotice.success(`Report #${reportId} verified and marked as COMPLETED.`);
      this.closeModal();
      if (this.currentTab === "verification_queue") {
        this.renderVerificationQueue();
      } else {
        this.renderDashboard();
      }
    } catch (err) {
      SWNotice.hideLoading();
      SWNotice.error("Verification approval error: " + err.message);
    }
  },

  async promptRecleaning(taskId, reportId) {
    const reason = await SWNotice.prompt({
      title: "Request Site Re-Cleaning",
      message: `Specify why the cleanup for complaint #${reportId} needs rework:`,
      placeholder: "e.g. Residual debris remaining near the gutter / Site not sanitized...",
      confirmText: "Send Re-clean Order",
      required: true
    });
    if (!reason) return;

    SWNotice.showLoading(`Sending re-cleaning order for #${reportId}...`);
    try {
      let tId = taskId;
      if (!tId || tId === 0) {
        const res = await API.getReport(reportId);
        tId = res.report && res.report.task ? res.report.task.id : 0;
      }
      await API.requestRecleaning(tId, reason);
      SWNotice.hideLoading();
      SWNotice.warning(`Report #${reportId} flagged for RE-CLEANING.`);
      this.closeModal();
      if (this.currentTab === "verification_queue") {
        this.renderVerificationQueue();
      } else {
        this.renderDashboard();
      }
    } catch (err) {
      SWNotice.hideLoading();
      SWNotice.error("Error requesting re-cleaning: " + err.message);
    }
  },

  // WARD-WISE WASTE HEATMAP & HOTSPOTS
  async renderHeatmap() {
    this.currentTab = "heatmap";
    const container = document.getElementById("main-view");
    container.innerHTML = `
      <div class="sw-card">
        <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <div>
            <h4 class="fw-bold mb-0">🗺️ Ward-wise Waste Concentration & Heatmap</h4>
            <p class="text-muted small mb-0">Visual density analysis of open waste clusters and public hazards across city zones</p>
          </div>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-outline-secondary" onclick="MunicipalConsole.renderDashboard()">← Back to Dashboard</button>
            <button class="btn btn-sm btn-primary" onclick="MunicipalConsole.renderHeatmap()">↻ Refresh Map</button>
          </div>
        </div>

        <!-- Summary KPIs -->
        <div id="heatmap-summary-row" class="row g-3 mb-3">
          <div class="text-center py-3"><div class="spinner-border text-primary spinner-border-sm"></div> Loading heatmap metrics...</div>
        </div>

        <!-- Map and Ward Breakdown Grid -->
        <div class="row g-3">
          <div class="col-12 col-lg-8">
            <div class="p-2 bg-light rounded border">
              <div class="d-flex justify-content-between align-items-center mb-2 px-2">
                <span class="small fw-bold">Live Waste Hotspot Map</span>
                <div class="d-flex gap-2 align-items-center small">
                  <span class="badge" style="background:#dc2626;">● Critical / Hazard</span>
                  <span class="badge" style="background:#ea580c;">● High</span>
                  <span class="badge" style="background:#ca8a04;">● Medium</span>
                  <span class="badge" style="background:#16a34a;">● Low / Resolved</span>
                </div>
              </div>
              <div id="muni-heatmap-container" style="height: 440px; border-radius: 8px; background: #e2e8f0;"></div>
            </div>
          </div>
          <div class="col-12 col-lg-4">
            <div class="sw-card p-3 h-100 border">
              <h6 class="fw-bold mb-2">Ward Concentration Index</h6>
              <div class="table-responsive" style="max-height: 400px; overflow-y: auto;">
                <table class="table table-sm table-hover align-middle mb-0" style="font-size: 0.84rem;">
                  <thead class="table-light">
                    <tr>
                      <th>Ward</th>
                      <th>Total</th>
                      <th>Open</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody id="heatmap-wards-tbody">
                    <tr><td colspan="4" class="text-center text-muted py-3">Loading ward stats...</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    try {
      const res = await API.getHeatmap();
      const hotspots = res.heatmap_points || res.hotspots || [];
      const wardStatsList = res.ward_stats || (res.ward_summary ? Object.entries(res.ward_summary).map(([w, d]) => ({ ward: w, total: d.total, pending: d.open })) : []);
      const totalHotspots = hotspots.length;
      const criticalCount = hotspots.filter(h => h.priority === 'CRITICAL' || h.is_emergency).length;
      const activeWardsCount = wardStatsList.length;

      // Summary KPIs
      const summaryRow = document.getElementById("heatmap-summary-row");
      if (summaryRow) {
        summaryRow.innerHTML = `
          <div class="col-6 col-md-3">
            <div class="p-2 bg-light rounded border text-center">
              <div class="small text-muted fw-bold">ACTIVE HOTSPOTS</div>
              <div class="fs-4 fw-bold text-primary">${totalHotspots}</div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="p-2 bg-light rounded border text-center">
              <div class="small text-muted fw-bold">CRITICAL / HAZARD</div>
              <div class="fs-4 fw-bold text-danger">${criticalCount}</div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="p-2 bg-light rounded border text-center">
              <div class="small text-muted fw-bold">COVERED WARDS</div>
              <div class="fs-4 fw-bold text-info">${activeWardsCount}</div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="p-2 bg-light rounded border text-center">
              <div class="small text-muted fw-bold">HIGHEST LOAD WARD</div>
              <div class="fs-5 fw-bold text-warning text-truncate">${[...wardStatsList].sort((a,b)=>(b.pending||b.total)-(a.pending||a.total))[0]?.ward || 'Ward 5 - Central'}</div>
            </div>
          </div>
        `;
      }

      // Ward Breakdown Table
      const tbody = document.getElementById("heatmap-wards-tbody");
      if (tbody) {
        const sortedWards = [...wardStatsList].sort((a, b) => b.total - a.total);
        if (sortedWards.length === 0) {
          tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No ward data available</td></tr>`;
        } else {
          tbody.innerHTML = sortedWards.map(ws => `
            <tr>
              <td class="fw-bold">${ws.ward}</td>
              <td><span class="badge bg-light text-dark border">${ws.total}</span></td>
              <td><span class="badge ${ws.pending > 0 ? 'bg-warning text-dark' : 'bg-success'}">${ws.pending}</span></td>
              <td>
                <span class="small fw-semibold ${ws.pending > 2 ? 'text-danger' : (ws.pending > 0 ? 'text-warning' : 'text-success')}">
                  ${ws.pending > 2 ? 'High Load' : (ws.pending > 0 ? 'Normal' : 'Clean')}
                </span>
              </td>
            </tr>
          `).join("");
        }
      }

      // Render Leaflet Map
      setTimeout(() => {
        const firstSpot = hotspots[0] || { lat: 15.8246, lng: 80.3522 };
        const map = MapService.initMap("muni-heatmap-container", {
          lat: parseFloat(firstSpot.lat || firstSpot.latitude) || 15.8246,
          lng: parseFloat(firstSpot.lng || firstSpot.longitude) || 80.3522,
          zoom: 13
        });

        if (map && typeof L !== "undefined") {
          hotspots.forEach(h => {
            const lat = parseFloat(h.lat !== undefined ? h.lat : h.latitude);
            const lng = parseFloat(h.lng !== undefined ? h.lng : h.longitude);
            if (isNaN(lat) || isNaN(lng)) return;

            let color = "#16a34a";
            let radius = 8;
            if (h.priority === "CRITICAL" || h.is_emergency) {
              color = "#dc2626";
              radius = 16;
            } else if (h.priority === "HIGH") {
              color = "#ea580c";
              radius = 12;
            } else if (h.priority === "MEDIUM") {
              color = "#ca8a04";
              radius = 10;
            }

            L.circleMarker([lat, lng], {
              radius: radius,
              fillColor: color,
              color: "#ffffff",
              weight: 2,
              opacity: 1,
              fillOpacity: 0.8
            }).addTo(map).bindPopup(`
              <div style="font-size: 0.85rem;">
                <div class="fw-bold text-primary">${h.id}</div>
                <div><strong>Category:</strong> ${h.category}</div>
                <div><strong>Ward:</strong> ${h.ward || 'Central'}</div>
                <div><strong>Location:</strong> ${h.location_name}</div>
                <div><strong>Priority:</strong> <span class="badge-priority ${h.priority}">${h.priority}</span></div>
                <div><strong>Status:</strong> ${h.status}</div>
                ${h.is_emergency ? '<div class="text-danger fw-bold mt-1">🚨 Public Hazard Alert</div>' : ''}
                <div class="mt-2 text-center">
                  <button class="btn btn-xs btn-outline-primary" style="padding: 2px 6px; font-size: 0.75rem;" onclick="MunicipalConsole.openReportModal('${h.id}')">Inspect Report</button>
                </div>
              </div>
            `);
          });
        }
      }, 100);

    } catch (err) {
      SWNotice.error("Heatmap load error: " + err.message);
    }
  },

  // WORKER WORKLOAD & CAPACITY DASHBOARD
  async renderWorkerWorkload() {
    this.currentTab = "workers";
    const container = document.getElementById("main-view");
    container.innerHTML = `
      <div class="sw-card">
        <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <div>
            <h4 class="fw-bold mb-0">👷 Field Sanitation Worker Workload & Capacity</h4>
            <p class="text-muted small mb-0">Monitor active task loads, worker allocation balance, and field clearance progress</p>
          </div>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-outline-secondary" onclick="MunicipalConsole.renderDashboard()">← Back to Dashboard</button>
            <button class="btn btn-sm btn-primary" onclick="MunicipalConsole.renderWorkerWorkload()">↻ Refresh</button>
          </div>
        </div>

        <div id="worker-workload-content">
          <div class="text-center py-4"><div class="spinner-border text-primary"></div><p class="small text-muted mt-2">Analyzing worker load...</p></div>
        </div>
      </div>
    `;

    try {
      const res = await API.getWorkerWorkload();
      const workers = res.workers || [];
      const target = document.getElementById("worker-workload-content");

      const totalActiveTasks = workers.reduce((sum, w) => sum + (typeof w.active_tasks === 'number' ? w.active_tasks : (w.active_task_count || 0)), 0);
      const availableWorkers = workers.filter(w => (w.load_status || '').toLowerCase() === 'low').length;
      const busyWorkers = workers.filter(w => ['high', 'full'].includes((w.load_status || '').toLowerCase())).length;

      target.innerHTML = `
        <!-- Metrics Row -->
        <div class="row g-3 mb-4">
          <div class="col-6 col-md-3">
            <div class="p-3 bg-light rounded border text-center">
              <div class="small text-muted fw-bold">TOTAL WORKERS</div>
              <div class="fs-3 fw-bold text-dark">${workers.length}</div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="p-3 bg-light rounded border text-center">
              <div class="small text-muted fw-bold">AVAILABLE (LOW LOAD)</div>
              <div class="fs-3 fw-bold text-success">${availableWorkers}</div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="p-3 bg-light rounded border text-center">
              <div class="small text-muted fw-bold">BUSY / AT CAPACITY</div>
              <div class="fs-3 fw-bold text-warning">${busyWorkers}</div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="p-3 bg-light rounded border text-center">
              <div class="small text-muted fw-bold">ACTIVE ASSIGNED TASKS</div>
              <div class="fs-3 fw-bold text-primary">${totalActiveTasks}</div>
            </div>
          </div>
        </div>

        <!-- Worker Cards Grid -->
        <div class="row g-3">
          ${workers.map(w => {
            const statusUpper = (w.load_status || 'LOW').toUpperCase();
            let loadColor = "bg-success";
            if (statusUpper === "MEDIUM") loadColor = "bg-info";
            if (statusUpper === "HIGH") loadColor = "bg-warning";
            if (statusUpper === "FULL") loadColor = "bg-danger";

            const activeCt = typeof w.active_tasks === 'number' ? w.active_tasks : (w.active_task_count || 0);
            const pct = w.capacity_pct !== undefined ? w.capacity_pct : Math.min(100, Math.round((activeCt / 5) * 100));

            return `
              <div class="col-12 col-md-6 col-lg-4">
                <div class="sw-card p-3 h-100 border ${statusUpper === 'FULL' ? 'border-danger' : ''}">
                  <div class="d-flex justify-content-between align-items-start mb-2">
                    <div>
                      <h6 class="fw-bold mb-0 text-dark">${w.name}</h6>
                      <small class="text-muted">📞 ${w.phone || 'N/A'}</small>
                    </div>
                    <span class="badge ${loadColor} text-white">${statusUpper} LOAD</span>
                  </div>

                  <div class="small mb-2">
                    <span class="text-muted">Assigned Zone:</span> <strong>${w.zone || 'Ward 1 - Chirala Clock Tower'}</strong>
                  </div>
                  <div class="small mb-2">
                    <span class="text-muted">GPS Location:</span> <strong>${w.latitude != null && w.longitude != null ? `${Number(w.latitude).toFixed(4)}, ${Number(w.longitude).toFixed(4)}` : '<span class="text-warning">Location unavailable</span>'}</strong>
                  </div>

                  <div class="mb-3">
                    <div class="d-flex justify-content-between small text-muted mb-1">
                      <span>Workload Utilization</span>
                      <strong>${activeCt} / 5 tasks (${pct}%)</strong>
                    </div>
                    <div class="progress" style="height: 8px;">
                      <div class="progress-bar ${loadColor}" style="width: ${pct}%;"></div>
                    </div>
                  </div>

                  <div class="d-flex justify-content-between small text-muted pt-2 border-top">
                    <span>Completed Cleanups: <strong>${w.completed_tasks || 0}</strong></span>
                    <span>Total Handled: <strong>${w.total_assigned || 0}</strong></span>
                  </div>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      `;
    } catch (err) {
      document.getElementById("worker-workload-content").innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`;
    }
  },

  // CITY ANNOUNCEMENTS MANAGER CONSOLE
  async renderAnnouncementsManager() {
    this.currentTab = "announcements";
    const container = document.getElementById("main-view");
    container.innerHTML = `
      <div class="sw-card">
        <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <div>
            <h4 class="fw-bold mb-0">📢 Municipal Public Announcements Console</h4>
            <p class="text-muted small mb-0">Publish sanitation alerts, holiday collection schedules, and civic cleanliness drives</p>
          </div>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-outline-secondary" onclick="MunicipalConsole.renderDashboard()">← Back to Dashboard</button>
            <button class="btn btn-sm btn-primary" onclick="MunicipalConsole.renderAnnouncementsManager()">↻ Refresh</button>
          </div>
        </div>

        <div class="row g-4">
          <!-- Publish Form -->
          <div class="col-12 col-md-5">
            <div class="sw-card p-3 border">
              <h6 class="fw-bold mb-3 text-primary">Publish New Public Notice</h6>
              <form id="announcement-form" onsubmit="MunicipalConsole.executePublishAnnouncement(event)">
                <div class="mb-2">
                  <label class="form-label small fw-bold">Notice Title</label>
                  <input type="text" id="anc-title" class="form-control form-control-sm" placeholder="e.g. Ward 5 Night Clearance Drive" required>
                </div>
                <div class="row g-2 mb-2">
                  <div class="col-6">
                    <label class="form-label small fw-bold">Category</label>
                    <select id="anc-category" class="form-select form-select-sm">
                      <option value="GENERAL">General Notice</option>
                      <option value="EMERGENCY">Emergency Alert</option>
                      <option value="SCHEDULE">Collection Schedule</option>
                      <option value="EVENT">Cleanliness Drive</option>
                    </select>
                  </div>
                  <div class="col-6">
                    <label class="form-label small fw-bold">Priority</label>
                    <select id="anc-priority" class="form-select form-select-sm">
                      <option value="LOW">Low</option>
                      <option value="MEDIUM" selected>Medium</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent Alert</option>
                    </select>
                  </div>
                </div>
                <div class="mb-2">
                  <label class="form-label small fw-bold">Target Ward</label>
                  <select id="anc-ward" class="form-select form-select-sm">
                    <option value="">All City Wards (City-Wide Broadcast)</option>
                    <option value="Ward 1">Ward 1</option>
                    <option value="Ward 2">Ward 2</option>
                    <option value="Ward 3">Ward 3</option>
                    <option value="Ward 4">Ward 4</option>
                    <option value="Ward 5">Ward 5</option>
                    <option value="Ward 6">Ward 6</option>
                    <option value="Ward 7">Ward 7</option>
                    <option value="Ward 8">Ward 8</option>
                    <option value="Ward 9">Ward 9</option>
                    <option value="Ward 10">Ward 10</option>
                  </select>
                </div>
                <div class="mb-3">
                  <label class="form-label small fw-bold">Notice Content / Instructions</label>
                  <textarea id="anc-content" class="form-control form-control-sm" rows="3" placeholder="Enter detailed announcement message..." required></textarea>
                </div>
                <button type="submit" class="btn btn-primary btn-sm w-100 fw-bold">
                  🚀 Broadcast Announcement
                </button>
              </form>
            </div>
          </div>

          <!-- Existing Notices List -->
          <div class="col-12 col-md-7">
            <div class="sw-card p-3 border">
              <h6 class="fw-bold mb-3">Live Active Announcements</h6>
              <div id="announcements-list">
                <div class="text-center py-4"><div class="spinner-border text-primary spinner-border-sm"></div></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    try {
      const res = await API.getAnnouncements();
      const list = res.announcements || [];
      const listContainer = document.getElementById("announcements-list");

      if (list.length === 0) {
        listContainer.innerHTML = `<div class="text-muted text-center py-4 small">No active announcements. Use the form on the left to broadcast a notice.</div>`;
        return;
      }

      listContainer.innerHTML = `
        <div class="d-flex flex-column gap-2">
          ${list.map(a => `
            <div class="p-3 bg-light rounded border">
              <div class="d-flex justify-content-between align-items-start mb-1">
                <div>
                  <strong class="text-dark">${a.title}</strong>
                  <div class="d-flex gap-1 mt-1">
                    <span class="badge ${a.category === 'EMERGENCY' ? 'bg-danger' : 'bg-primary'}">${a.category}</span>
                    <span class="badge bg-secondary">${a.target_ward || 'City-Wide'}</span>
                    <span class="badge ${a.priority === 'URGENT' ? 'bg-danger' : 'bg-light text-dark border'}">${a.priority}</span>
                  </div>
                </div>
                <button class="btn btn-outline-danger btn-sm" onclick="MunicipalConsole.executeDeleteAnnouncement(${a.id})" title="Delete Announcement">🗑️</button>
              </div>
              <p class="small text-secondary mb-1 mt-2">${a.content}</p>
              <div class="text-muted" style="font-size: 0.75rem;">Published by ${a.author_name || 'Municipal Officer'} • ${new Date(a.created_at).toLocaleDateString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}</div>
            </div>
          `).join("")}
        </div>
      `;
    } catch (err) {
      document.getElementById("announcements-list").innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`;
    }
  },

  async executePublishAnnouncement(e) {
    e.preventDefault();
    const title = document.getElementById("anc-title").value.trim();
    const category = document.getElementById("anc-category").value;
    const priority = document.getElementById("anc-priority").value;
    const targetWard = document.getElementById("anc-ward").value;
    const content = document.getElementById("anc-content").value.trim();

    SWNotice.showLoading("Broadcasting municipal announcement...");
    try {
      await API.createAnnouncement({
        title,
        content,
        category,
        priority,
        target_ward: targetWard
      });
      SWNotice.hideLoading();
      SWNotice.success("Announcement broadcasted successfully to citizen portal.");
      this.renderAnnouncementsManager();
    } catch (err) {
      SWNotice.hideLoading();
      SWNotice.error("Failed to broadcast: " + err.message);
    }
  },

  async executeDeleteAnnouncement(id) {
    const confirmed = await SWNotice.confirm({
      title: "Delete Announcement",
      message: "Are you sure you want to remove this public announcement?",
      confirmText: "Delete",
      type: "danger"
    });
    if (!confirmed) return;

    SWNotice.showLoading("Deleting announcement...");
    try {
      await API.deleteAnnouncement(id);
      SWNotice.hideLoading();
      SWNotice.info("Announcement removed.");
      this.renderAnnouncementsManager();
    } catch (err) {
      SWNotice.hideLoading();
      SWNotice.error("Delete failed: " + err.message);
    }
  },

  // COMPLAINT DETAILS & AUDIT HISTORY MODAL
  async openReportModal(reportId) {
    const modalContainer = document.getElementById("modal-container");
    modalContainer.innerHTML = `
      <div class="sw-modal-backdrop">
        <div class="sw-modal" style="max-width: 780px;">
          <div class="sw-modal-header">
            <div>
              <h5 class="fw-bold mb-0">Complaint Details • ${reportId}</h5>
              <small class="text-muted">Municipal Audit Dossier & Evidence Record</small>
            </div>
            <button class="btn-close" onclick="MunicipalConsole.closeModal()"></button>
          </div>
          <div class="sw-modal-body" id="muni-report-detail-body">
            <div class="text-center py-4"><div class="spinner-border text-primary"></div></div>
          </div>
        </div>
      </div>
    `;

    try {
      const res = await API.getReport(reportId);
      const rep = res.report;
      const body = document.getElementById("muni-report-detail-body");

      body.innerHTML = `
        <div class="row g-3 mb-3">
          <div class="col-md-6">
            <img src="${rep.before_image || '/uploads/sample_mixed_waste.jpg'}" class="rounded w-100 shadow-sm" style="max-height: 220px; object-fit: cover;">
          </div>
          <div class="col-md-6">
            <div class="d-flex align-items-center gap-2 mb-1">
              <h5 class="fw-bold mb-0">${rep.category}</h5>
              ${rep.is_emergency ? '<span class="badge bg-danger">🚨 EMERGENCY</span>' : ''}
            </div>
            <p class="small mb-1"><strong>Status:</strong> <span class="badge-status badge-${rep.status}">${rep.status}</span></p>
            <p class="small mb-1"><strong>Priority:</strong> <span class="badge-priority ${rep.priority}">${rep.priority}</span></p>
            <p class="small mb-1"><strong>Ward:</strong> ${rep.ward || 'Central Ward'}</p>
            <p class="small mb-1"><strong>Location:</strong> ${rep.location_name}</p>
            <p class="small mb-1"><strong>Duration:</strong> ${rep.observed_duration || '1-2 days'}</p>
            <p class="small mb-1"><strong>Road Obstruction:</strong> ${rep.road_obstruction ? '⚠️ Yes (Impeding Traffic)' : 'No'}</p>
            <p class="small mb-0"><strong>Citizen:</strong> ${rep.citizen ? rep.citizen.name : 'Citizen'}</p>
          </div>
        </div>

        <!-- AI Waste Explanation & Assessment -->
        <div class="p-3 bg-light rounded border small mb-3">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <strong class="text-dark">🤖 AI Visual Explanation & Analysis:</strong>
            <span class="badge bg-primary text-white">Confidence: ${rep.confidence_score ? Math.round(rep.confidence_score * 100) : 92}%</span>
          </div>
          <div class="text-secondary">${rep.ai_summary || rep.description || 'Automated visual analysis detected municipal waste requiring field clearance.'}</div>
        </div>

        <!-- Waste Spot Pinpoint Map -->
        <div class="mb-3">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <strong class="small text-dark">📍 Exact Location Pinpoint:</strong>
            <small class="text-muted">${rep.latitude ? `${parseFloat(rep.latitude).toFixed(4)}, ${parseFloat(rep.longitude).toFixed(4)}` : ''}</small>
          </div>
          <div id="muni-detail-map" style="height: 180px; border-radius: 8px; border: 1px solid #cbd5e1; background: #f1f5f9;"></div>
        </div>

        <!-- History Timeline -->
        <h6 class="fw-bold small mb-2">Audit History</h6>
        <div class="timeline mb-3">
          ${(rep.history || []).map(h => `
            <div class="timeline-item">
              <div class="timeline-time">${h.formatted_time || h.timestamp}</div>
              <div class="timeline-title">${h.new_status}</div>
              <div class="timeline-comment">${h.comment || ''}</div>
            </div>
          `).join("")}
        </div>

        <!-- Actions Toolbar -->
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 pt-3 border-top">
          <div class="d-flex gap-2 flex-wrap">
            <button class="btn btn-outline-dark btn-sm fw-bold" onclick="window.open('/api/reports/${rep.id}/pdf', '_blank')">
              📄 Print / Download Dossier
            </button>
            <button class="btn btn-outline-warning btn-sm" onclick="MunicipalConsole.promptRequestInfo('${rep.id}')">
              Request More Info
            </button>
            <button class="btn btn-outline-danger btn-sm" onclick="MunicipalConsole.promptReject('${rep.id}')">
              Reject Complaint
            </button>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="MunicipalConsole.closeModal()">Close</button>
        </div>
      `;

      if (rep.latitude && rep.longitude) {
        setTimeout(() => {
          const detailMap = MapService.initMap("muni-detail-map", {
            lat: parseFloat(rep.latitude),
            lng: parseFloat(rep.longitude),
            zoom: 15
          });
          if (detailMap && typeof L !== "undefined") {
            L.circleMarker([parseFloat(rep.latitude), parseFloat(rep.longitude)], {
              radius: 9,
              fillColor: "#0284c7",
              color: "#ffffff",
              weight: 3,
              opacity: 1,
              fillOpacity: 0.9
            }).addTo(detailMap).bindPopup(`<strong>${rep.id}</strong><br>${rep.location_name}`).openPopup();
          }
        }, 100);
      }
    } catch (err) {
      document.getElementById("muni-report-detail-body").innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`;
    }
  },

  async promptRequestInfo(reportId) {
    const question = await SWNotice.prompt({
      title: "Request Info from Citizen",
      message: `Enter clarifying question for complaint #${reportId}:`,
      placeholder: "e.g. Is the waste near the northern gate or southern entrance?",
      confirmText: "Send Question to Citizen",
      required: true
    });
    if (!question) return;

    SWNotice.showLoading(`Sending inquiry to citizen for #${reportId}...`);
    try {
      await API.requestInfo(reportId, question);
      SWNotice.hideLoading();
      SWNotice.info(`Question sent to citizen. Report status updated to INFORMATION_REQUESTED.`);
      this.closeModal();
      if (this.currentTab === "verification_queue") {
        this.renderVerificationQueue();
      } else {
        this.renderDashboard();
      }
    } catch (err) {
      SWNotice.hideLoading();
      SWNotice.error("Error: " + err.message);
    }
  },

  async promptReject(reportId) {
    const reason = await SWNotice.prompt({
      title: "Reject Waste Complaint",
      message: `Enter mandatory audit reason for rejecting #${reportId}:`,
      placeholder: "e.g. Private property interior / False complaint / Area already cleared...",
      confirmText: "Reject Complaint",
      required: true
    });
    if (!reason) return;

    SWNotice.showLoading(`Rejecting complaint #${reportId}...`);
    try {
      await API.rejectReport(reportId, reason);
      SWNotice.hideLoading();
      SWNotice.error(`Report #${reportId} rejected with logged audit reason.`);
      this.closeModal();
      if (this.currentTab === "verification_queue") {
        this.renderVerificationQueue();
      } else {
        this.renderDashboard();
      }
    } catch (err) {
      SWNotice.hideLoading();
      SWNotice.error("Error: " + err.message);
    }
  },

  // ROUTE PLANNER
  async renderRoutePlanner() {
    this.currentTab = "route";
    const container = document.getElementById("main-view");
    container.innerHTML = `
      <div class="sw-card">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h4 class="fw-bold mb-0">Municipal Route Optimization</h4>
            <p class="text-muted small mb-0">Nearest-Neighbor collection routing for pending waste tasks</p>
          </div>
          <button class="btn btn-sm btn-outline-secondary" onclick="MunicipalConsole.renderDashboard()">← Back to Dashboard</button>
        </div>

        <div class="row g-3 mb-4">
          <div class="col-md-4">
            <label class="form-label small fw-bold">Starting Depot</label>
            <select class="form-select form-select-sm" id="route-depot">
              <option value="15.8246,80.3522">Ward 1 Chirala Clock Tower Central Yard (15.8246, 80.3522)</option>
              <option value="15.8285,80.3550">Ward 2 Chirala Railway Station Hub (15.8285, 80.3550)</option>
              <option value="15.8220,80.3480">Ward 4 Chirala Municipality Office (15.8220, 80.3480)</option>
            </select>
          </div>
          <div class="col-md-4">
            <label class="form-label small fw-bold">Assigned Vehicle</label>
            <select class="form-select form-select-sm" id="route-vehicle">
              <option>Standard 5-Ton Municipal Tipper</option>
              <option>Compact Electric Waste Vehicle (Narrow Lanes)</option>
              <option>Heavy Compactor Truck</option>
            </select>
          </div>
          <div class="col-md-4 d-flex align-items-end">
            <button class="btn btn-primary w-100 btn-sm fw-bold" onclick="MunicipalConsole.generateRoute()">
              ⚡ Generate Optimized Route
            </button>
          </div>
        </div>

        <div id="route-results-box">
          <div class="p-4 text-center text-muted bg-light rounded">
            Click "Generate Optimized Route" to compute travel stops for active complaints.
          </div>
        </div>
      </div>
    `;
  },

  async generateRoute() {
    const box = document.getElementById("route-results-box");
    box.innerHTML = `<div class="text-center py-4"><div class="spinner-border text-primary"></div><p class="small text-muted mt-2">Solving TSP stops...</p></div>`;

    try {
      const depotVal = document.getElementById("route-depot").value.split(",");
      const vehicle = document.getElementById("route-vehicle").value;
      const res = await API.generateRoute(parseFloat(depotVal[0]), parseFloat(depotVal[1]), vehicle);
      const r = res.route;

      box.innerHTML = `
        <div class="row g-3">
          <div class="col-12 col-md-5">
            <div class="p-3 bg-light rounded h-100">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <h6 class="fw-bold text-success mb-0">${r.route_id}</h6>
                <span class="badge bg-dark">${r.vehicle_type}</span>
              </div>
              <p class="small mb-1"><strong>Total Collection Stops:</strong> ${r.task_count}</p>
              <p class="small mb-1"><strong>Estimated Distance:</strong> ${r.total_distance_km} km</p>
              <p class="small mb-3"><strong>Estimated Duration:</strong> ~${r.estimated_duration_mins} mins</p>

              <h6 class="fw-bold small mb-2">Itinerary Sequence:</h6>
              <div class="list-group list-group-flush small">
                ${r.stops.map(s => `
                  <div class="list-group-item px-0 py-2 bg-transparent">
                    <span class="badge ${s.type.includes('DEPOT') ? 'bg-secondary' : 'bg-success'} me-1">${s.step}</span>
                    <strong>${s.title || s.location_name || s.id}</strong>
                    <div class="text-muted" style="font-size: 0.75rem;">${s.distance_from_prev_m ? `+${s.distance_from_prev_m}m from previous` : 'Start'}</div>
                  </div>
                `).join("")}
              </div>
            </div>
          </div>

          <div class="col-12 col-md-7">
            <div id="route-map" style="height: 380px; border-radius: 8px; background: #e2e8f0;"></div>
          </div>
        </div>
      `;

      setTimeout(() => {
        const map = MapService.initMap("route-map", {
          lat: parseFloat(depotVal[0]),
          lng: parseFloat(depotVal[1]),
          zoom: 13
        });
        MapService.renderRoutePolyline(map, r.stops);
      }, 100);
    } catch (err) {
      box.innerHTML = `<div class="alert alert-danger">Route generation error: ${err.message}</div>`;
    }
  },

  // COLLECTION POINTS
  async renderCollectionPoints() {
    this.currentTab = "points";
    const container = document.getElementById("main-view");
    container.innerHTML = `
      <div class="sw-card">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h4 class="fw-bold mb-0">Public Collection Points & Smart Bins</h4>
            <p class="text-muted small mb-0">Monitor capacity, fill levels, and maintenance status</p>
          </div>
          <button class="btn btn-sm btn-outline-secondary" onclick="MunicipalConsole.renderDashboard()">← Back to Dashboard</button>
        </div>

        <div id="points-list" class="row g-3">
          <div class="text-center py-4"><div class="spinner-border text-primary"></div></div>
        </div>
      </div>
    `;

    try {
      const res = await API.getCollectionPoints();
      const points = res.collection_points || [];
      const list = document.getElementById("points-list");

      list.innerHTML = points.map(p => `
        <div class="col-12 col-md-6">
          <div class="sw-card p-3 h-100 ${p.status === 'OVERFLOWING' ? 'border-danger border-2' : ''}">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <h6 class="fw-bold mb-0">${p.name}</h6>
              <span class="badge ${p.status === 'OVERFLOWING' ? 'bg-danger' : (p.status === 'NEAR_FULL' ? 'bg-warning text-dark' : 'bg-success')}">${p.status}</span>
            </div>
            <p class="small text-muted mb-2">📍 ${p.address} (${p.zone})</p>
            <div class="d-flex justify-content-between small text-muted mb-1">
              <span>Current Fill Level:</span>
              <strong class="${p.current_level_pct > 80 ? 'text-danger' : 'text-success'}">${p.current_level_pct}%</strong>
            </div>
            <div class="progress mb-3" style="height: 8px;">
              <div class="progress-bar ${p.current_level_pct > 80 ? 'bg-danger' : 'bg-success'}" style="width: ${p.current_level_pct}%;"></div>
            </div>
            <div class="small text-muted">Categories: ${p.categories.join(", ")}</div>
          </div>
        </div>
      `).join("");
    } catch (err) {
      document.getElementById("points-list").innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`;
    }
  },

  closeModal() {
    document.getElementById("modal-container").innerHTML = "";
  }
};
