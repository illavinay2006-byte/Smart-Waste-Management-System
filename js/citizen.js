// Citizen Portal UI & Interactions - SmartWaste AI Production Version
const CitizenPortal = {
  activeStep: 1,
  currentTab: 'reports',
  wizardData: {
    imageFile: null,
    imageUrl: "./uploads/sample_mixed_waste.jpg",
    latitude: 15.8246,
    longitude: 80.3522,
    location_name: "Ward 1 - Chirala Clock Tower, Main Bazaar",
    ward: "Ward 1 - Chirala Clock Tower",
    category: "Mixed Waste",
    severity: "High",
    is_emergency: false,
    road_obstruction: true,
    observed_duration: "3–7 days",
    concerns: "Strong smell, spilling onto sidewalk",
    notes: "Pedestrian walkway is partially blocked.",
    ai_analysis: null,
    questions: []
  },

  init() {
    this.renderDashboard();
  },

  formatDateTime(isoStr) {
    if (!isoStr) return "Recently";
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return "Recently";
    return `${d.toLocaleDateString([], {day: 'numeric', month: 'short'})}, ${d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
  },

  clearSessionReports() {
    sessionStorage.removeItem("sw_citizen_session_report_ids");
    this.renderDashboard();
  },

  async renderDashboard() {
    this.currentTab = 'reports';
    const container = document.getElementById("main-view");
    container.innerHTML = `
      <div class="text-center py-5">
        <div class="spinner-border text-success" role="status"></div>
        <p class="text-muted mt-2">Loading citizen portal...</p>
      </div>
    `;

    try {
      const user = App.currentUser;
      const citizenName = (user && user.name) ? user.name : "Citizen";
      const userZone = (user && user.zone) ? user.zone : "Ward 1 - Chirala Clock Tower (Main Bazaar)";
      
      const [reportsRes, notifRes, announceRes, statsRes] = await Promise.all([
        API.getReports(),
        API.getNotifications().catch(() => ({ notifications: [], unread_count: 0 })),
        API.getAnnouncements(userZone).catch(() => ({ announcements: [] })),
        API.getCitizenStats().catch(() => ({ stats: {} }))
      ]);

      const allReports = reportsRes.reports || [];
      const activeCount = allReports.filter(r => !["COMPLETED", "REJECTED"].includes(r.status)).length;
      const resolvedCount = allReports.filter(r => r.status === "COMPLETED").length;
      const announcements = announceRes.announcements || [];
      const stats = statsRes.stats || {};
      const unreadNotifs = notifRes.unread_count || 0;

      // Display all previous reports for this citizen or community (newest first)
      let reports = allReports;
      if (user && user.role === 'citizen') {
        const userSpecific = allReports.filter(r => r.citizen_id === user.id || r.citizen_name === citizenName);
        if (userSpecific.length > 0) {
          reports = userSpecific;
        }
      }
      reports.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

      container.innerHTML = `
        <div class="citizen-dashboard">
          <!-- Announcement Broadcast Ribbon -->
          ${announcements.length > 0 ? `
            <div class="alert alert-info border-info d-flex align-items-center justify-content-between mb-3 shadow-sm" style="border-radius: 12px; background: #e0f2fe; color: #0369a1;">
              <div class="d-flex align-items-center gap-2">
                <span class="fs-4">📢</span>
                <div>
                  <strong class="d-block">${announcements[0].title}</strong>
                  <span class="small">${announcements[0].content || announcements[0].message}</span>
                </div>
              </div>
              <span class="badge ${announcements[0].priority === 'URGENT' ? 'bg-danger' : 'bg-primary'} text-white">${announcements[0].priority}</span>
            </div>
          ` : ''}

          <!-- Hero Header -->
          <div class="sw-card citizen-hero-card p-4 rounded-4 text-white">
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-3">
              <div>
                <span class="badge bg-light text-dark mb-2 px-3 py-1 fw-bold">Citizen Portal • ${userZone}</span>
                <h2 class="fw-bold mb-1">SmartWaste AI 🤖</h2>
                <p class="mb-0 opacity-90">Keep your community clean. Report waste anytime with instant AI routing & municipal dispatch.</p>
              </div>
              <div class="d-flex gap-2 flex-wrap">
                <button class="btn btn-light fw-bold px-4 py-3 shadow" style="border-radius: 9999px; font-size: 1.05rem; color: #064e3b;" onclick="CitizenPortal.startReportWizard()">
                  📸 REPORT WASTE
                </button>
              </div>
            </div>

            <!-- Stats Ribbon -->
            <div class="row mt-4 pt-3 border-top border-white border-opacity-25 g-3 text-center text-sm-start">
              <div class="col-6 col-md-3">
                <div class="fs-4 fw-bold">${reports.length}</div>
                <div class="small opacity-75">My Total Reports</div>
              </div>
              <div class="col-6 col-md-3">
                <div class="fs-4 fw-bold text-warning">${stats.points || 0} ⭐</div>
                <div class="small opacity-75">Cleanliness Points (${stats.rank_tier || 'Eco Scout'})</div>
              </div>
              <div class="col-6 col-md-3">
                <div class="fs-4 fw-bold">${reports.filter(r => r.status === 'COMPLETED').length}</div>
                <div class="small opacity-75">Resolved by Municipality</div>
              </div>
              <div class="col-6 col-md-3">
                <div class="fs-4 fw-bold text-info">${unreadNotifs} 🔔</div>
                <div class="small opacity-75">Unread Notifications</div>
              </div>
            </div>
          </div>

          <!-- Feature Navigation Tabs Bar -->
          <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2 pt-2">
            <div class="btn-group shadow-sm">
              <button class="btn btn-sm ${this.currentTab === 'reports' ? 'btn-success fw-bold' : 'btn-outline-secondary'}" onclick="CitizenPortal.renderDashboard()">
                📋 My Reports (${reports.length})
              </button>
              <button class="btn btn-sm ${this.currentTab === 'map' ? 'btn-success fw-bold' : 'btn-outline-secondary'}" onclick="CitizenPortal.renderLiveMap()">
                📍 Live Map
              </button>
              <button class="btn btn-sm ${this.currentTab === 'stats' ? 'btn-success fw-bold' : 'btn-outline-secondary'}" onclick="CitizenPortal.renderStatsView()">
                📊 Stats & Badges
              </button>
              <button class="btn btn-sm ${this.currentTab === 'leaderboard' ? 'btn-success fw-bold' : 'btn-outline-secondary'}" onclick="CitizenPortal.renderLeaderboardView()">
                🏆 Leaderboard
              </button>
              <button class="btn btn-sm ${this.currentTab === 'notifications' ? 'btn-success fw-bold' : 'btn-outline-secondary'}" onclick="CitizenPortal.renderNotificationsView()">
                🔔 Notifications ${unreadNotifs > 0 ? `<span class="badge bg-danger rounded-pill ms-1">${unreadNotifs}</span>` : ''}
              </button>
            </div>

            <div class="d-flex gap-2">
              <button class="btn btn-sm btn-outline-success fw-bold" onclick="WasteEducation.showModal()">
                ♻️ Segregation Guide
              </button>
              <button class="btn btn-sm btn-success fw-bold" onclick="CitizenPortal.startReportWizard()">
                + New Report
              </button>
            </div>
          </div>

          <!-- Reports List -->
          <div class="row g-3">
            ${reports.length === 0 ? `
              <div class="col-12">
                <div class="sw-card text-center p-4 p-md-5 position-relative overflow-hidden shadow-sm" style="background: linear-gradient(145deg, #ffffff 0%, #f0fdf4 100%); border: 2px dashed #86efac; border-radius: 20px;">
                  <!-- Decorative subtle background glow -->
                  <div style="position: absolute; top: -40px; right: -40px; width: 130px; height: 130px; background: rgba(52, 211, 153, 0.25); border-radius: 50%; filter: blur(35px); pointer-events: none;"></div>
                  <div style="position: absolute; bottom: -40px; left: -40px; width: 130px; height: 130px; background: rgba(16, 185, 129, 0.2); border-radius: 50%; filter: blur(35px); pointer-events: none;"></div>

                  <!-- Floating Icon / Badge -->
                  <div class="d-inline-flex align-items-center justify-content-center mb-3 shadow" style="width: 76px; height: 76px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 50%; color: white; font-size: 2.2rem;">
                    ✨
                  </div>

                  <!-- Status Label & Heading -->
                  <div class="mb-2">
                    <span class="badge bg-success bg-opacity-10 text-success fw-bold px-3 py-1 rounded-pill mb-2" style="font-size: 0.8rem; letter-spacing: 0.5px;">
                      🌿 COMMUNITY STATUS: PRISTINE
                    </span>
                    <h3 class="fw-bold text-dark mb-1">No New Reports Yet</h3>
                  </div>

                  <!-- Message Description -->
                  <p class="text-muted mx-auto mb-4" style="max-width: 520px; font-size: 0.95rem; line-height: 1.6;">
                    Everything looks sparkling clean in your area! Whenever you notice overflowing garbage, debris, or blocked sidewalks, snap a photo to report it. Your complaint will appear right here with real-time tracking.
                  </p>

                  <!-- Quick Action Buttons -->
                  <div class="d-flex justify-content-center gap-2 flex-wrap mb-4">
                    <button class="btn btn-success fw-bold px-4 py-2 shadow-sm rounded-pill d-flex align-items-center gap-2" style="background: linear-gradient(135deg, #059669, #10b981); border: none;" onclick="CitizenPortal.startReportWizard()">
                      <span>📸</span> Report New Waste
                    </button>
                    <button class="btn btn-outline-success fw-bold px-4 py-2 rounded-pill d-flex align-items-center gap-2" onclick="AIChatAssistant.toggleChat()">
                      <span>🤖</span> Ask AI Assistant
                    </button>
                    <button class="btn btn-outline-secondary fw-bold px-3 py-2 rounded-pill d-flex align-items-center gap-2" onclick="CitizenPortal.renderDashboard()">
                      <span>↻</span> Refresh
                    </button>
                  </div>

                  <!-- 3 Feature Highlight Pills -->
                  <div class="row g-2 justify-content-center pt-3 border-top border-success border-opacity-10 text-start" style="max-width: 680px; margin: 0 auto;">
                    <div class="col-12 col-md-4">
                      <div class="p-2 rounded bg-white bg-opacity-80 border border-success border-opacity-10 d-flex align-items-center gap-2">
                        <span class="fs-5">⚡</span>
                        <div style="line-height: 1.2;">
                          <div class="fw-bold small text-dark">Fast Dispatch</div>
                          <small class="text-muted" style="font-size: 0.72rem;">Rapid response crew</small>
                        </div>
                      </div>
                    </div>
                    <div class="col-12 col-md-4">
                      <div class="p-2 rounded bg-white bg-opacity-80 border border-success border-opacity-10 d-flex align-items-center gap-2">
                        <span class="fs-5">🔍</span>
                        <div style="line-height: 1.2;">
                          <div class="fw-bold small text-dark">Photo Proof</div>
                          <small class="text-muted" style="font-size: 0.72rem;">Before & after verified</small>
                        </div>
                      </div>
                    </div>
                    <div class="col-12 col-md-4">
                      <div class="p-2 rounded bg-white bg-opacity-80 border border-success border-opacity-10 d-flex align-items-center gap-2">
                        <span class="fs-5">🛡️</span>
                        <div style="line-height: 1.2;">
                          <div class="fw-bold small text-dark">100% Privacy</div>
                          <small class="text-muted" style="font-size: 0.72rem;">Protected civic record</small>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ` : reports.map(r => `
              <div class="col-12 col-md-6">
                <div class="sw-card h-100 d-flex flex-column justify-content-between" style="cursor: pointer;" onclick="CitizenPortal.viewReportDetail('${r.id}')">
                  <div>
                    <div class="d-flex justify-content-between align-items-start mb-2">
                      <div>
                        <span class="badge-status badge-${r.status || 'SUBMITTED'}">${(r.status || 'SUBMITTED').replace(/_/g, ' ')}</span>
                        <span class="badge-priority ${r.priority || 'MEDIUM'} ms-1">${r.priority || 'MEDIUM'}</span>
                      </div>
                      <small class="text-muted">${r.id}</small>
                    </div>
                    <div class="d-flex gap-3 mt-2">
                      <img src="${window.resolveImageUrl(r.before_image)}" onerror="window.handleImageError(this)" alt="evidence" class="rounded" style="width: 80px; height: 80px; object-fit: cover;">
                      <div>
                        <h6 class="fw-bold mb-1 text-truncate" style="max-width: 260px;">${r.category}</h6>
                        <p class="small text-muted mb-1 text-truncate" style="max-width: 260px;">📍 ${r.location_name || 'Ward 5'}</p>
                        <p class="small text-secondary mb-0 line-clamp-2" style="font-size: 0.8rem; line-height: 1.3;">${r.description || r.ai_summary || ''}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div class="pt-3 mt-3 border-top d-flex justify-content-between align-items-center">
                    <small class="text-muted">Updated: ${CitizenPortal.formatDateTime(r.updated_at || r.created_at)}</small>
                    <button class="btn btn-sm btn-link text-success p-0 fw-bold text-decoration-none" onclick="event.stopPropagation(); CitizenPortal.viewReportDetail('${r.id}')">Track Timeline →</button>
                  </div>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `
        <div class="alert alert-danger">
          <strong>Error loading dashboard:</strong> ${err.message}
          <div class="mt-2"><button class="btn btn-sm btn-outline-danger" onclick="CitizenPortal.renderDashboard()">Retry</button></div>
        </div>
      `;
    }
  },

  // 1. NOTIFICATION CENTER VIEW
  async renderNotificationsView() {
    this.currentTab = 'notifications';
    const container = document.getElementById("main-view");
    container.innerHTML = `<div class="text-center py-5"><div class="spinner-border text-success"></div><p class="text-muted mt-2">Loading notification center...</p></div>`;

    try {
      const res = await API.getNotifications();
      const notifs = res.notifications || [];
      const unreadCount = res.unread_count || 0;

      container.innerHTML = `
        <div style="max-width: 860px; margin: 0 auto;">
          <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
            <div>
              <button class="btn btn-sm btn-outline-secondary mb-1" onclick="CitizenPortal.renderDashboard()">← Back to Reports</button>
              <h3 class="fw-bold mb-0">🔔 Notification Center</h3>
              <p class="text-muted small mb-0">Real-time status updates, crew assignments, and municipal notices.</p>
            </div>
            <div class="d-flex gap-2">
              <button class="btn btn-sm btn-outline-primary fw-bold" onclick="CitizenPortal.markAllRead()">✓ Mark All Read</button>
              <button class="btn btn-sm btn-outline-secondary" onclick="CitizenPortal.renderNotificationsView()">↻ Refresh</button>
            </div>
          </div>

          <div class="sw-card p-0 overflow-hidden shadow-sm">
            <div class="p-3 bg-light border-bottom d-flex justify-content-between align-items-center">
              <span class="fw-bold small text-secondary">ALL NOTIFICATIONS (${notifs.length})</span>
              <span class="badge ${unreadCount > 0 ? 'bg-danger' : 'bg-secondary'}">${unreadCount} Unread</span>
            </div>
            <div class="list-group list-group-flush">
              ${notifs.length === 0 ? `
                <div class="p-5 text-center text-muted">
                  <div class="fs-1 mb-2">🔕</div>
                  <h6 class="fw-bold">No Notifications Yet</h6>
                  <p class="small mb-0">You'll receive notifications when your reports change status or are verified.</p>
                </div>
              ` : notifs.map(n => `
                <div class="list-group-item list-group-item-action p-3 d-flex justify-content-between align-items-start gap-3 ${!n.is_read ? 'bg-light bg-opacity-75 border-start border-4 border-success' : ''}">
                  <div class="flex-grow-1" style="cursor: pointer;" onclick="${n.report_id ? `CitizenPortal.viewReportDetail('${n.report_id}')` : ''}">
                    <div class="d-flex align-items-center gap-2 mb-1 flex-wrap">
                      <span class="badge ${n.type === 'success' ? 'bg-success' : (n.type === 'danger' ? 'bg-danger' : (n.type === 'warning' ? 'bg-warning text-dark' : 'bg-primary'))}">${n.type ? n.type.toUpperCase() : 'INFO'}</span>
                      <strong class="text-dark">${n.title}</strong>
                      ${!n.is_read ? '<span class="badge bg-danger rounded-pill" style="font-size:0.65rem;">NEW</span>' : ''}
                    </div>
                    <p class="mb-1 text-secondary small">${n.message}</p>
                    <small class="text-muted" style="font-size: 0.75rem;">${n.formatted_time || n.created_at}</small>
                  </div>
                  <div class="d-flex align-items-center gap-2">
                    ${!n.is_read ? `
                      <button class="btn btn-xs btn-outline-success" onclick="CitizenPortal.markNotifRead(${n.id}, event)" title="Mark as read">✓</button>
                    ` : ''}
                    ${n.report_id ? `
                      <button class="btn btn-xs btn-outline-primary fw-bold" onclick="CitizenPortal.viewReportDetail('${n.report_id}')">View →</button>
                    ` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
  },

  async markNotifRead(id, evt) {
    if (evt) evt.stopPropagation();
    try {
      await API.markNotificationRead(id);
      this.renderNotificationsView();
    } catch (err) {
      SWNotice.error(err.message);
    }
  },

  async markAllRead() {
    try {
      await API.markAllNotificationsRead();
      SWNotice.success("All notifications marked as read!");
      this.renderNotificationsView();
    } catch (err) {
      SWNotice.error(err.message);
    }
  },

  // 2. LIVE COMPLAINT MAP VIEW
  async renderLiveMap() {
    this.currentTab = 'map';
    const container = document.getElementById("main-view");
    container.innerHTML = `
      <div style="max-width: 1000px; margin: 0 auto;">
        <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <div>
            <button class="btn btn-sm btn-outline-secondary mb-1" onclick="CitizenPortal.renderDashboard()">← Back to Reports</button>
            <h3 class="fw-bold mb-0">📍 Live Waste Complaints Map</h3>
            <p class="text-muted small mb-0">Interactive geographical view of your reported waste issues & real-time cleanup status.</p>
          </div>
          <button class="btn btn-sm btn-success fw-bold" onclick="CitizenPortal.startReportWizard()">+ Report Here</button>
        </div>

        <div class="sw-card p-0 overflow-hidden mb-3 shadow-sm">
          <div id="citizen-live-map" style="height: 480px; width: 100%; background: #e2e8f0;"></div>
        </div>

        <div class="sw-card p-3">
          <div class="d-flex align-items-center justify-content-around flex-wrap gap-2 text-center small">
            <div><span class="badge bg-warning text-dark me-1">●</span> Submitted / Review</div>
            <div><span class="badge bg-primary me-1">●</span> Assigned / In Progress</div>
            <div><span class="badge bg-success me-1">●</span> Cleaned & Verified</div>
            <div><span class="badge bg-danger me-1">●</span> Emergency Hazard</div>
          </div>
        </div>
      </div>
    `;

    try {
      const res = await API.getReports();
      const reports = res.reports || [];

      setTimeout(() => {
        const centerLat = reports.length > 0 && reports[0].latitude ? parseFloat(reports[0].latitude) : 15.8246;
        const centerLng = reports.length > 0 && reports[0].longitude ? parseFloat(reports[0].longitude) : 80.3522;

        const map = MapService.initMap("citizen-live-map", {
          lat: centerLat,
          lng: centerLng,
          zoom: 13
        });

        if (map && typeof L !== "undefined") {
          reports.forEach(r => {
            if (r.latitude && r.longitude) {
              let color = "#3b82f6";
              if (r.is_emergency) color = "#dc2626";
              else if (r.status === "COMPLETED") color = "#16a34a";
              else if (["SUBMITTED", "UNDER_REVIEW"].includes(r.status)) color = "#f59e0b";

              const marker = L.circleMarker([parseFloat(r.latitude), parseFloat(r.longitude)], {
                radius: r.is_emergency ? 12 : 9,
                fillColor: color,
                color: "#ffffff",
                weight: 2,
                opacity: 1,
                fillOpacity: 0.9
              }).addTo(map);

              marker.bindPopup(`
                <div style="font-family: sans-serif; min-width: 180px;">
                  <div style="font-weight: 700; color: #0f172a; margin-bottom: 2px;">${r.id}</div>
                  <div style="font-size: 12px; color: ${color}; font-weight: 600; margin-bottom: 4px;">${(r.status || 'SUBMITTED').replace(/_/g, ' ')} ${r.is_emergency ? '🚨' : ''}</div>
                  <div style="font-size: 12px; color: #475569; margin-bottom: 6px;">${r.category} • ${r.location_name}</div>
                  <button onclick="CitizenPortal.viewReportDetail('${r.id}')" style="background: #0d9488; color: white; border: none; padding: 4px 10px; border-radius: 4px; font-size: 11px; cursor: pointer; width: 100%;">View Details →</button>
                </div>
              `);
            }
          });
        }
      }, 150);
    } catch (err) {
      console.error(err);
    }
  },

  // 3. CITIZEN PERSONAL STATS & BADGES VIEW
  async renderStatsView() {
    this.currentTab = 'stats';
    const container = document.getElementById("main-view");
    container.innerHTML = `<div class="text-center py-5"><div class="spinner-border text-success"></div><p class="text-muted mt-2">Calculating personal impact...</p></div>`;

    try {
      const res = await API.getCitizenStats();
      const s = res.stats || {};

      container.innerHTML = `
        <div style="max-width: 860px; margin: 0 auto;">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <div>
              <button class="btn btn-sm btn-outline-secondary mb-1" onclick="CitizenPortal.renderDashboard()">← Back to Reports</button>
              <h3 class="fw-bold mb-0">📊 Personal Impact & Eco Tier</h3>
              <p class="text-muted small mb-0">Track your contribution towards a cleaner, greener community.</p>
            </div>
            <button class="btn btn-sm btn-outline-success fw-bold" onclick="CitizenPortal.renderLeaderboardView()">🏆 View Leaderboard</button>
          </div>

          <!-- Tier Status Banner -->
          <div class="sw-card mb-4" style="background: linear-gradient(135deg, #065f46 0%, #0d9488 100%); color: white; border-radius: 16px;">
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-3">
              <div>
                <span class="badge bg-warning text-dark fw-bold mb-2">CIVIC RANK LEVEL</span>
                <h2 class="fw-bold mb-1">${s.rank_tier || 'Eco Scout'}</h2>
                <p class="mb-0 opacity-90">Total Cleanliness Points: <strong>${s.points || 0} pts</strong></p>
              </div>
              <div class="text-center bg-white bg-opacity-20 p-3 rounded-4" style="min-width: 140px;">
                <div class="fs-1">🌱</div>
                <div class="small fw-bold">Cleanliness Score: ${s.cleanliness_score || 0}</div>
              </div>
            </div>

            <!-- Progress Bar to Next Level -->
            <div class="mt-4 pt-3 border-top border-white border-opacity-25">
              <div class="d-flex justify-content-between small mb-1">
                <span>Progress to <strong>${s.next_tier}</strong></span>
                <span>${s.points_needed > 0 ? `${s.points_needed} pts needed` : 'Max Level Reached!'}</span>
              </div>
              <div class="progress" style="height: 10px; border-radius: 5px; background: rgba(255,255,255,0.3);">
                <div class="progress-bar bg-warning" role="progressbar" style="width: ${s.tier_progress_pct || 10}%;"></div>
              </div>
            </div>
          </div>

          <!-- Stats 4-Grid -->
          <div class="row g-3 mb-4">
            <div class="col-6 col-md-3">
              <div class="sw-card p-3 h-100 border-start border-4 border-primary">
                <div class="text-muted small fw-bold">TOTAL REPORTS</div>
                <div class="fs-3 fw-bold">${s.total_reports || 0}</div>
                <small class="text-muted">Lifetime submissions</small>
              </div>
            </div>
            <div class="col-6 col-md-3">
              <div class="sw-card p-3 h-100 border-start border-4 border-success">
                <div class="text-muted small fw-bold">RESOLVED</div>
                <div class="fs-3 fw-bold text-success">${s.resolved_reports || 0}</div>
                <small class="text-muted">Cleaned & Verified</small>
              </div>
            </div>
            <div class="col-6 col-md-3">
              <div class="sw-card p-3 h-100 border-start border-4 border-warning">
                <div class="text-muted small fw-bold">IN PROGRESS</div>
                <div class="fs-3 fw-bold text-warning">${s.active_reports || 0}</div>
                <small class="text-muted">Active crew tasks</small>
              </div>
            </div>
            <div class="col-6 col-md-3">
              <div class="sw-card p-3 h-100 border-start border-4 border-danger">
                <div class="text-muted small fw-bold">EMERGENCY</div>
                <div class="fs-3 fw-bold text-danger">${s.emergency_reports || 0}</div>
                <small class="text-muted">Public hazard alerts</small>
              </div>
            </div>
          </div>

          <!-- Earned Badges Showcase -->
          <div class="sw-card mb-4">
            <h5 class="fw-bold mb-3">🎖️ Community Cleanliness Badges</h5>
            <div class="row g-3">
              <div class="col-6 col-md-3">
                <div class="p-3 rounded text-center border ${(s.badges || []).includes('🌱 First Step') ? 'bg-success bg-opacity-10 border-success' : 'bg-light opacity-50'}">
                  <div class="fs-2 mb-1">🌱</div>
                  <div class="fw-bold small">First Step</div>
                  <small class="text-muted" style="font-size:0.7rem;">Submit first report (+50 pts)</small>
                </div>
              </div>
              <div class="col-6 col-md-3">
                <div class="p-3 rounded text-center border ${(s.badges || []).includes('🌿 Cleanliness Pioneer') ? 'bg-success bg-opacity-10 border-success' : 'bg-light opacity-50'}">
                  <div class="fs-2 mb-1">🌿</div>
                  <div class="fw-bold small">Pioneer</div>
                  <small class="text-muted" style="font-size:0.7rem;">Earn 150+ Cleanliness pts</small>
                </div>
              </div>
              <div class="col-6 col-md-3">
                <div class="p-3 rounded text-center border ${(s.badges || []).includes('🛡️ Neighborhood Protector') ? 'bg-success bg-opacity-10 border-success' : 'bg-light opacity-50'}">
                  <div class="fs-2 mb-1">🛡️</div>
                  <div class="fw-bold small">Protector</div>
                  <small class="text-muted" style="font-size:0.7rem;">Earn 300+ Cleanliness pts</small>
                </div>
              </div>
              <div class="col-6 col-md-3">
                <div class="p-3 rounded text-center border ${(s.badges || []).includes('👑 Civic Sustainability Master') ? 'bg-success bg-opacity-10 border-success' : 'bg-light opacity-50'}">
                  <div class="fs-2 mb-1">👑</div>
                  <div class="fw-bold small">Civic Master</div>
                  <small class="text-muted" style="font-size:0.7rem;">Earn 500+ Cleanliness pts</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
  },

  // 4. COMMUNITY LEADERBOARD VIEW
  async renderLeaderboardView() {
    this.currentTab = 'leaderboard';
    const container = document.getElementById("main-view");
    container.innerHTML = `<div class="text-center py-5"><div class="spinner-border text-success"></div><p class="text-muted mt-2">Loading leaderboard...</p></div>`;

    try {
      const res = await API.getCitizenLeaderboard();
      const leaders = res.leaderboard || [];

      container.innerHTML = `
        <div style="max-width: 860px; margin: 0 auto;">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <div>
              <button class="btn btn-sm btn-outline-secondary mb-1" onclick="CitizenPortal.renderDashboard()">← Back to Reports</button>
              <h3 class="fw-bold mb-0">🏆 Community Cleanliness Champions</h3>
              <p class="text-muted small mb-0">Top citizens leading the neighborhood cleanliness movement.</p>
            </div>
            <button class="btn btn-sm btn-success fw-bold" onclick="CitizenPortal.startReportWizard()">+ Earn Points</button>
          </div>

          <div class="sw-card p-0 overflow-hidden shadow-sm">
            <div class="table-responsive">
              <table class="table table-hover align-middle mb-0">
                <thead class="table-light small">
                  <tr>
                    <th style="width: 70px;">Rank</th>
                    <th>Citizen</th>
                    <th>Eco Tier</th>
                    <th>Badges</th>
                    <th>Resolved</th>
                    <th class="text-end">Cleanliness Points</th>
                  </tr>
                </thead>
                <tbody>
                  ${leaders.map(u => `
                    <tr class="${u.rank === 1 ? 'table-warning bg-opacity-25' : ''}">
                      <td class="fw-bold fs-5">${u.rank === 1 ? '🥇' : (u.rank === 2 ? '🥈' : (u.rank === 3 ? '🥉' : `#${u.rank}`))}</td>
                      <td>
                        <strong class="text-dark">${u.name}</strong>
                      </td>
                      <td><span class="badge bg-success bg-opacity-10 text-success fw-bold">${u.rank_tier}</span></td>
                      <td><span class="badge bg-light text-dark border">${u.badges_count || 0} badges</span></td>
                      <td><span class="text-muted small">${u.resolved_reports} cleanups</span></td>
                      <td class="text-end fw-bold text-primary fs-6">${u.points} pts ⭐</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
  },

  // START WIZARD
  startReportWizard() {
    this.activeStep = 1;
    this.wizardData = {
      imageFile: null,
      imageUrl: "./uploads/sample_mixed_waste.jpg",
      latitude: 15.8246,
      longitude: 80.3522,
      location_name: "Ward 1 - Chirala Clock Tower, Main Bazaar",
      ward: "Ward 1 - Chirala Clock Tower",
      category: "Mixed Waste",
      severity: "High",
      is_emergency: false,
      road_obstruction: true,
      observed_duration: "3–7 days",
      concerns: "Strong odor, road access partially blocked",
      notes: "Pedestrian walkway is partially blocked.",
      ai_analysis: null,
      questions: [],
      imageValidated: false
    };
    this.renderWizardStep();
  },

  renderWizardStep() {
    const container = document.getElementById("main-view");
    container.innerHTML = `
      <div class="wizard-container" style="max-width: 760px; margin: 0 auto;">
        <!-- Header -->
        <div class="d-flex justify-content-between align-items-center mb-3">
          <button class="btn btn-sm btn-outline-secondary" onclick="CitizenPortal.renderDashboard()">← Back to Dashboard</button>
          <span class="text-muted small">Step ${this.activeStep} of 4</span>
        </div>

        <!-- Stepper Visualizer -->
        <div class="wizard-stepper">
          <div class="step-node ${this.activeStep === 1 ? 'active' : (this.activeStep > 1 ? 'completed' : '')}">
            <div class="step-circle">${this.activeStep > 1 ? '✓' : '1'}</div>
            <div class="step-label">Photo</div>
          </div>
          <div class="step-node ${this.activeStep === 2 ? 'active' : (this.activeStep > 2 ? 'completed' : '')}">
            <div class="step-circle">${this.activeStep > 2 ? '✓' : '2'}</div>
            <div class="step-label">Location</div>
          </div>
          <div class="step-node ${this.activeStep === 3 ? 'active' : (this.activeStep > 3 ? 'completed' : '')}">
            <div class="step-circle">${this.activeStep > 3 ? '✓' : '3'}</div>
            <div class="step-label">AI Analysis</div>
          </div>
          <div class="step-node ${this.activeStep === 4 ? 'active' : ''}">
            <div class="step-circle">4</div>
            <div class="step-label">Review & Submit</div>
          </div>
        </div>

        <div id="wizard-step-content"></div>
      </div>
    `;

    const content = document.getElementById("wizard-step-content");
    if (this.activeStep === 1) this.renderStep1(content);
    else if (this.activeStep === 2) this.renderStep2(content);
    else if (this.activeStep === 3) this.renderStep3(content);
    else if (this.activeStep === 4) this.renderStep4(content);
  },

  // STEP 1: IMAGE & EMERGENCY MODE
  renderStep1(content) {
    content.innerHTML = `
      <div class="sw-card">
        <h4 class="fw-bold mb-1">📸 Step 1: Capture or Upload Evidence</h4>
        <p class="text-muted small mb-3">Upload clear photo evidence of the waste accumulation.</p>

        <!-- Emergency Hazard Mode Toggle Box -->
        <div class="p-3 mb-3 rounded border ${this.wizardData.is_emergency ? 'bg-danger bg-opacity-10 border-danger' : 'bg-light'}" style="transition: all 0.2s ease;">
          <div class="form-check form-switch d-flex align-items-center justify-content-between p-0">
            <div>
              <label class="form-check-label fw-bold text-danger mb-0" for="emergency-switch" style="cursor: pointer;">
                🚨 High-Priority Public Hazard (Emergency Mode)
              </label>
              <div class="small text-muted">Toggle if this involves severe biohazard, toxic spillage, hospital road block, or immediate health risks.</div>
            </div>
            <input class="form-check-input ms-2" type="checkbox" role="switch" id="emergency-switch" ${this.wizardData.is_emergency ? 'checked' : ''} onchange="CitizenPortal.toggleEmergency(this.checked)" style="cursor: pointer; width: 2.5em; height: 1.3em;">
          </div>
        </div>

        <div class="border rounded p-3 text-center mb-3 bg-light" id="preview-box">
          <img id="image-preview" src="${window.resolveImageUrl(this.wizardData.imageUrl)}" onerror="window.handleImageError(this)" style="max-height: 260px; max-width: 100%; border-radius: 8px; object-fit: contain;" alt="Waste Preview">
        </div>

        <!-- Validation Status Ribbon -->
        <div id="image-validation-status" class="mb-3" style="display: none;"></div>

        <div class="mb-3">
          <label class="form-label small fw-bold">Upload Custom Photo</label>
          <input type="file" id="file-input" class="form-control" accept="image/jpeg,image/png,image/webp">
        </div>

        <!-- Clean Sample Evidence Picker -->
        <div class="mb-4">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <label class="form-label small fw-bold text-muted mb-0">Select from test samples:</label>
            <button type="button" class="btn btn-xs btn-outline-primary rounded-pill px-2 py-0" style="font-size: 0.72rem;" onclick="CitizenPortal.openAiSettingsModal()">⚙️ AI Agent Settings</button>
          </div>
          <div class="d-flex flex-wrap gap-2">
            <button type="button" class="btn btn-xs btn-outline-secondary rounded-pill px-2 py-1" style="font-size: 0.75rem;" onclick="CitizenPortal.selectSample('./uploads/sample_mixed_waste.jpg', 'Mixed Waste', 'High')">📦 Mixed Waste</button>
            <button type="button" class="btn btn-xs btn-outline-secondary rounded-pill px-2 py-1" style="font-size: 0.75rem;" onclick="CitizenPortal.selectSample('./uploads/sample_plastic.jpg', 'Plastic', 'Medium')">🥤 Plastic</button>
            <button type="button" class="btn btn-xs btn-outline-secondary rounded-pill px-2 py-1" style="font-size: 0.75rem;" onclick="CitizenPortal.selectSample('./uploads/sample_organic.jpg', 'Organic / Wet Waste', 'High')">🥬 Organic Dump</button>
            <button type="button" class="btn btn-xs btn-outline-secondary rounded-pill px-2 py-1" style="font-size: 0.75rem;" onclick="CitizenPortal.selectSample('./uploads/sample_ewaste.jpg', 'E-Waste', 'High')">💻 E-Waste</button>
            <button type="button" class="btn btn-xs btn-outline-danger rounded-pill px-2 py-1" style="font-size: 0.75rem;" onclick="CitizenPortal.testPresentationImage()">📊 Test Presentation Slide (Non-Waste)</button>
          </div>
        </div>

        <div class="d-flex justify-content-end gap-2 pt-2 border-top">
          <button class="btn btn-secondary" onclick="CitizenPortal.renderDashboard()">Cancel</button>
          <button class="btn-primary-action" id="btn-step1-continue" onclick="CitizenPortal.proceedToStep2()">Continue to Location →</button>
        </div>
      </div>
    `;

    const fileInput = document.getElementById("file-input");
    if (fileInput) {
      fileInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (file) {
          if (file.size > 16 * 1024 * 1024) {
            SWNotice.warning("File size exceeds 16 MB. Please select a smaller photo.");
            return;
          }
          this.wizardData.imageFile = file;
          this.wizardData.imageValidated = false;
          const reader = new FileReader();
          reader.onload = async (event) => {
            const preview = document.getElementById("image-preview");
            if (preview) preview.src = event.target.result;
            this.wizardData.imageUrl = event.target.result;
            // Instantly run waste validation gate
            await this.validateSelectedImage();
          };
          reader.readAsDataURL(file);
        }
      });
    }
  },

  toggleEmergency(checked) {
    this.wizardData.is_emergency = checked;
    if (checked) {
      this.wizardData.severity = "Critical";
      SWNotice.warning("Emergency mode active: Complaint will be marked with highest municipal priority.");
    }
  },

  async selectSample(url, category, severity) {
    this.wizardData.imageUrl = url;
    this.wizardData.imageFile = null;
    this.wizardData.category = category;
    this.wizardData.severity = severity;
    const img = document.getElementById("image-preview");
    if (img) img.src = url;
    const fileInput = document.getElementById("file-input");
    if (fileInput) fileInput.value = "";
    await this.validateSelectedImage();
  },

  async testPresentationImage() {
    this.wizardData.imageUrl = "./uploads/sample_presentation.jpg";
    this.wizardData.imageFile = null;
    this.wizardData.imageValidated = false;
    const img = document.getElementById("image-preview");
    if (img) img.src = "./uploads/sample_presentation.jpg";
    const fileInput = document.getElementById("file-input");
    if (fileInput) fileInput.value = "";
    await this.validateSelectedImage();
  },

  openAiSettingsModal() {
    const oldModal = document.getElementById("sw-ai-settings-modal");
    if (oldModal) oldModal.remove();

    let currentKey = "";
    try { currentKey = localStorage.getItem("sw_gemini_api_key") || ""; } catch (e) {}

    const modalHtml = `
      <div id="sw-ai-settings-modal" class="modal fade show" tabindex="-1" style="display: block; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(4px); z-index: 9999;" role="dialog">
        <div class="modal-dialog modal-dialog-centered" style="max-width: 500px;">
          <div class="modal-content border-0 shadow-2xl rounded-4 overflow-hidden">
            <div class="p-3 px-4 bg-light border-bottom d-flex justify-content-between align-items-center">
              <div class="d-flex align-items-center gap-2">
                <span class="fs-4">⚙️</span>
                <h5 class="fw-bold mb-0">SmartWaste AI Agent Settings</h5>
              </div>
              <button type="button" class="btn-close" onclick="document.getElementById('sw-ai-settings-modal').remove()"></button>
            </div>
            <div class="p-4">
              <div class="mb-3">
                <label class="form-label small fw-bold">Active Vision Engine</label>
                <div class="p-2 bg-light rounded-3 border small">
                  <strong>🤖 SmartWaste AI Computer Vision Agent v2.5</strong>
                  <p class="text-muted mb-0" style="font-size: 0.75rem;">Multi-band pixel analysis across RGB/HSV/YCbCr, spatial clutter entropy, presentation slide discrimination, and deterministic criticality scoring.</p>
                </div>
              </div>
              <div class="mb-3">
                <label class="form-label small fw-bold">Optional: Connect Google Gemini 1.5 Flash Vision</label>
                <input type="password" id="gemini-api-key-input" class="form-control form-control-sm" placeholder="AIzaSy..." value="${currentKey}">
                <small class="text-muted" style="font-size: 0.72rem;">Enter your Google Gemini API Key if you wish to run remote multi-modal vision directly. If left blank, the built-in local Computer Vision agent operates automatically.</small>
              </div>
              <div class="d-flex justify-content-end gap-2 pt-2">
                <button type="button" class="btn btn-outline-secondary btn-sm" onclick="document.getElementById('sw-ai-settings-modal').remove()">Cancel</button>
                <button type="button" class="btn btn-success btn-sm fw-bold px-3" onclick="CitizenPortal.saveAiSettings()">Save Settings</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML("beforeend", modalHtml);
  },

  saveAiSettings() {
    const input = document.getElementById("gemini-api-key-input");
    const val = input ? input.value.trim() : "";
    try {
      if (val) {
        localStorage.setItem("sw_gemini_api_key", val);
        SWNotice.success("Google Gemini Vision API key connected!");
      } else {
        localStorage.removeItem("sw_gemini_api_key");
        SWNotice.info("Switched to Built-in Local AI Computer Vision Agent.");
      }
    } catch (e) {}
    const modal = document.getElementById("sw-ai-settings-modal");
    if (modal) modal.remove();
  },

  showInvalidWasteImageModal(analysisData) {
    const oldModal = document.getElementById("invalid-waste-image-modal");
    if (oldModal) oldModal.remove();

    const isObj = typeof analysisData === "object" && analysisData !== null;
    const detectedSubject = (isObj && analysisData.detected_subject) ? analysisData.detected_subject : "Non-Waste Subject Detected";
    const subjectDetails = (isObj && (analysisData.subject_details || analysisData.summary)) 
      ? (analysisData.subject_details || analysisData.summary) 
      : (typeof analysisData === "string" ? analysisData : "No clear waste or garbage was detected in this image.");
    const wasteProb = (isObj && analysisData.waste_probability) ? analysisData.waste_probability : "0%";
    const criticality = (isObj && analysisData.criticality) ? analysisData.criticality : "None (Civic waste management not applicable)";
    const currentImg = this.wizardData.imageUrl || "./uploads/sample_presentation.jpg";
    const engineName = (isObj && analysisData.engine) ? analysisData.engine : "SmartWaste AI Computer Vision Agent v2.5";

    const modalHtml = `
      <div id="invalid-waste-image-modal" class="modal fade show" tabindex="-1" style="display: block; background: rgba(15, 23, 42, 0.78); backdrop-filter: blur(5px); z-index: 9999;" role="dialog" aria-modal="true" aria-labelledby="invalid-waste-modal-title">
        <div class="modal-dialog modal-dialog-centered" style="max-width: 620px; margin: 1.5rem auto;">
          <div class="modal-content border-0 shadow-2xl" style="border-radius: 20px; overflow: hidden; background: #ffffff;">
            <!-- Modal Header -->
            <div class="p-3 px-4 d-flex align-items-center justify-content-between border-bottom" style="background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);">
              <div class="d-flex align-items-center gap-2">
                <span class="fs-4">🤖</span>
                <div>
                  <h5 class="fw-bold text-dark mb-0" id="invalid-waste-modal-title">SmartWaste AI Image Inspection</h5>
                  <small class="text-muted" style="font-size: 0.75rem;">Engine: ${engineName}</small>
                </div>
              </div>
              <span class="badge bg-danger bg-opacity-15 text-danger border border-danger px-3 py-1 rounded-pill fw-bold" style="font-size: 0.76rem;">
                ⚠️ Invalid Waste Image Gate
              </span>
            </div>

            <!-- Modal Body -->
            <div class="p-4 bg-white">
              <div class="row g-3 align-items-center mb-3">
                <div class="col-12 col-md-5 text-center">
                  <div class="position-relative p-1 rounded-3 border bg-light shadow-sm">
                    <img src="${window.resolveImageUrl(currentImg)}" onerror="window.handleImageError(this)" class="img-fluid rounded-2" style="max-height: 190px; width: 100%; object-fit: contain; background: #fff;" alt="Inspected Evidence">
                    <span class="position-absolute bottom-0 start-50 translate-middle-x mb-2 badge bg-dark bg-opacity-80 text-white shadow-sm" style="font-size: 0.72rem;">
                      Inspected Photo
                    </span>
                  </div>
                </div>
                <div class="col-12 col-md-7">
                  <div class="mb-2">
                    <label class="text-muted small fw-bold d-block text-uppercase" style="font-size: 0.7rem; letter-spacing: 0.5px;">Identified Image Subject</label>
                    <span class="badge bg-warning text-dark px-3 py-1 fs-6 fw-bold rounded-pill shadow-sm">
                      ${detectedSubject}
                    </span>
                  </div>
                  <div class="p-2 rounded-3 bg-light border mb-2">
                    <label class="text-muted fw-bold d-block" style="font-size: 0.7rem;">AI Visual Findings & Details:</label>
                    <p class="small text-secondary mb-0" style="line-height: 1.45;">${subjectDetails}</p>
                  </div>
                  <div class="d-flex justify-content-between align-items-center py-1 border-bottom small">
                    <span class="text-muted">Waste Probability:</span>
                    <strong class="text-danger">${wasteProb}</strong>
                  </div>
                  <div class="d-flex justify-content-between align-items-center py-1 border-bottom small">
                    <span class="text-muted">Criticality Assessment:</span>
                    <strong class="text-secondary">${criticality}</strong>
                  </div>
                  <div class="d-flex justify-content-between align-items-center py-1 small">
                    <span class="text-muted">Validation Gate Verdict:</span>
                    <strong class="text-danger">❌ Report Blocked</strong>
                  </div>
                </div>
              </div>

              <!-- Civic Guidance Alert -->
              <div class="alert alert-warning py-2 px-3 small mb-0 rounded-3 d-flex align-items-start gap-2 shadow-sm" style="background: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #f59e0b;">
                <span class="fs-5">ℹ️</span>
                <div style="line-height: 1.45;">
                  <strong>Civic Reporting Notice:</strong> SmartWaste AI validates images to prevent non-waste content (such as presentation slides, documents, portraits, or vehicles) from dispatching sanitation compactor trucks. Please upload a clear photo of physical garbage or litter to report.
                </div>
              </div>
            </div>

            <!-- Modal Footer -->
            <div class="p-3 px-4 bg-light border-top d-flex flex-wrap justify-content-between align-items-center gap-2">
              <button type="button" class="btn btn-outline-secondary btn-sm fw-semibold px-3 py-2 rounded-3" onclick="CitizenPortal.closeInvalidWasteModal()">
                Cancel
              </button>
              <div class="d-flex gap-2">
                <button type="button" class="btn btn-outline-success btn-sm fw-bold px-3 py-2 rounded-3" onclick="CitizenPortal.selectSample('./uploads/sample_plastic.jpg', 'Plastic', 'Medium'); CitizenPortal.closeInvalidWasteModal();">
                  🧪 Try Sample Waste
                </button>
                <button type="button" class="btn btn-success btn-sm fw-bold px-4 py-2 rounded-3 shadow-sm d-flex align-items-center gap-2" style="background: #059669; border: none;" onclick="CitizenPortal.handleUploadAnotherImage()">
                  <span>📸</span>
                  <span>Upload Real Waste Photo</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", modalHtml);
  },

  handleUploadAnotherImage() {
    this.closeInvalidWasteModal();
    if (this.activeStep !== 1) {
      this.activeStep = 1;
      this.renderWizardStep();
    }
    this.resetInvalidImage();
    setTimeout(() => {
      const fileInput = document.getElementById("file-input");
      if (fileInput) {
        fileInput.value = "";
        fileInput.click();
      }
    }, 150);
  },

  closeInvalidWasteModal() {
    const modalEl = document.getElementById("invalid-waste-image-modal");
    if (modalEl) modalEl.remove();
    this.resetInvalidImage();
  },

  resetInvalidImage() {
    this.wizardData.imageFile = null;
    this.wizardData.imageValidated = false;
    this.wizardData.ai_analysis = null;
    const fileInput = document.getElementById("file-input");
    if (fileInput) fileInput.value = "";
    const preview = document.getElementById("image-preview");
    if (preview) {
      preview.src = "./uploads/sample_mixed_waste.jpg";
    }
    this.wizardData.imageUrl = "./uploads/sample_mixed_waste.jpg";
    const statusEl = document.getElementById("image-validation-status");
    if (statusEl) {
      statusEl.style.display = "none";
      statusEl.innerHTML = "";
    }
  },

  async validateSelectedImage() {
    const statusEl = document.getElementById("image-validation-status");
    const continueBtn = document.getElementById("btn-step1-continue");
    if (statusEl) {
      statusEl.style.display = "block";
      statusEl.innerHTML = `
        <div class="alert alert-info py-2 px-3 d-flex align-items-center gap-2 mb-0 shadow-sm" style="border-radius: 8px;">
          <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
          <span class="small fw-semibold">Validating image with SmartWaste AI Vision Gate...</span>
        </div>
      `;
    }
    if (continueBtn) continueBtn.disabled = true;

    try {
      const fd = new FormData();
      if (this.wizardData.imageFile) {
        fd.append("image", this.wizardData.imageFile);
      } else {
        fd.append("image_url", this.wizardData.imageUrl);
      }
      fd.append("notes", this.wizardData.location_name || "");

      const res = await API.analyzeImage(fd);
      const analysis = res.analysis;

      if (!analysis || analysis.is_waste === false || !analysis.is_garbage || analysis.detected_category === "Other" || analysis.detected_category === "Not Garbage / Clean Area") {
        this.resetInvalidImage();
        this.showInvalidWasteImageModal(analysis || { message: "No clear waste detected." });
        if (statusEl) statusEl.style.display = "none";
        if (continueBtn) continueBtn.disabled = false;
        return false;
      }

      // Valid waste confirmed
      this.wizardData.ai_analysis = analysis;
      this.wizardData.category = analysis.detected_category || this.wizardData.category;
      this.wizardData.severity = (analysis.detected_severity && analysis.detected_severity !== "None") ? analysis.detected_severity : this.wizardData.severity;
      this.wizardData.road_obstruction = Boolean(analysis.road_obstruction);
      this.wizardData.imageValidated = true;

      const critScore = analysis.criticality_score || (analysis.detected_severity === "Critical" ? 92 : (analysis.detected_severity === "High" ? 75 : 50));
      const sla = analysis.sla_urgency || (analysis.detected_severity === "Critical" ? "2 Hours" : "4 Hours");
      const sevBadge = analysis.detected_severity === "Critical" ? "bg-danger" : (analysis.detected_severity === "High" ? "bg-warning text-dark" : "bg-primary");

      if (statusEl) {
        statusEl.innerHTML = `
          <div class="alert alert-success py-2 px-3 mb-0 shadow-sm" style="border-radius: 10px; background: #f0fdf4; border-color: #86efac;">
            <div class="d-flex align-items-center justify-content-between mb-1 flex-wrap gap-2">
              <div class="d-flex align-items-center gap-2">
                <span class="fs-5 text-success">✓</span>
                <span class="small fw-bold text-success">Waste Verified: ${analysis.detected_category} (${analysis.confidence_percentage}% AI Confidence)</span>
              </div>
              <span class="badge ${sevBadge} fw-bold">Criticality: ${analysis.detected_severity} (${critScore}/100)</span>
            </div>
            <div class="d-flex align-items-center gap-2 flex-wrap small text-muted pt-1 border-top" style="border-color: #dcfce7 !important; font-size: 0.78rem;">
              <span>⏱️ SLA: <strong class="text-dark">${sla}</strong></span>
              <span>•</span>
              <span>🚨 Obstruction: <strong class="${analysis.road_obstruction ? 'text-danger' : 'text-success'}">${analysis.road_obstruction ? 'Yes (Roadway Blocked)' : 'Clear Access'}</strong></span>
              <span>•</span>
              <span>📦 Volume: <strong class="text-dark">${analysis.volume_level || 'Substantial Pile'}</strong></span>
            </div>
          </div>
        `;
      }
      if (continueBtn) continueBtn.disabled = false;
      return true;
    } catch (err) {
      this.resetInvalidImage();
      const analysisData = err.data?.analysis || err.data || {
        detected_subject: "Non-Waste Image",
        subject_details: err.message,
        message: err.message
      };
      this.showInvalidWasteImageModal(analysisData);
      if (statusEl) statusEl.style.display = "none";
      if (continueBtn) continueBtn.disabled = false;
      return false;
    }
  },

  async proceedToStep2() {
    const continueBtn = document.getElementById("btn-step1-continue");
    if (!this.wizardData.imageValidated) {
      if (continueBtn) {
        continueBtn.disabled = true;
        continueBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Validating...`;
      }
      const isValid = await this.validateSelectedImage();
      if (continueBtn) {
        continueBtn.disabled = false;
        continueBtn.innerHTML = `Continue to Location →`;
      }
      if (!isValid) {
        return;
      }
    }
    this.activeStep = 2;
    this.renderWizardStep();
  },

  // STEP 2: LOCATION & DUPLICATE CHECK
  async renderStep2(content) {
    content.innerHTML = `
      <div class="sw-card">
        <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
          <div>
            <h4 class="fw-bold mb-1">📍 Step 2: Confirm Real Waste Location</h4>
            <p class="text-muted small mb-0">Use your device GPS, search an address, or drag the pin to the exact spot.</p>
          </div>
          <button type="button" class="btn btn-sm btn-outline-success fw-bold d-flex align-items-center gap-1 shadow-sm" onclick="CitizenPortal.detectLiveLocation()">
            <span>🎯</span>
            <span>Detect My Live GPS</span>
          </button>
        </div>

        <!-- Search location bar -->
        <div class="mb-3 position-relative">
          <div class="input-group input-group-sm">
            <span class="input-group-text bg-white">🔍</span>
            <input type="text" id="map-search-input" class="form-control" placeholder="Search Chirala street, landmark, or area (e.g., Clock Tower, Perala, Kothapeta, Vadarevu)..." onkeydown="if(event.key==='Enter'){ event.preventDefault(); CitizenPortal.searchLocation(); }">
            <button class="btn btn-success fw-bold" type="button" onclick="CitizenPortal.searchLocation()">Find on Map</button>
          </div>
          <div id="map-search-results" class="list-group position-absolute w-100 shadow" style="z-index: 1050; display: none; max-height: 200px; overflow-y: auto; top: 100%;"></div>
        </div>

        <!-- Duplicate warning placeholder -->
        <div id="duplicate-warning"></div>

        <!-- Live geocoding status notification -->
        <div id="location-status-badge" class="small text-muted mb-2 d-flex align-items-center gap-1">
          <span class="spinner-border spinner-border-sm text-success" id="loc-spinner" style="display: none;"></span>
          <span id="loc-status-text">Click anywhere on the map or drag the pin to set location.</span>
        </div>

        <div id="report-map" style="height: 320px; border-radius: 8px; margin-bottom: 16px; background: #e2e8f0; border: 1px solid #cbd5e1;"></div>

        <div class="row g-2 mb-3">
          <div class="col-12 col-md-8">
            <label class="form-label small fw-bold">Location Description / Landmark <span class="text-danger">*</span></label>
            <input type="text" id="loc-name-input" class="form-control" value="${this.wizardData.location_name}" placeholder="Exact street, building, or landmark">
            <small class="text-muted" style="font-size: 0.72rem;">Autofilled by OpenStreetMap when you move the map pin.</small>
          </div>
          <div class="col-6 col-md-2">
            <label class="form-label small fw-bold">Latitude</label>
            <input type="text" id="loc-lat" class="form-control" value="${this.wizardData.latitude.toFixed(6)}" readonly>
          </div>
          <div class="col-6 col-md-2">
            <label class="form-label small fw-bold">Longitude</label>
            <input type="text" id="loc-lng" class="form-control" value="${this.wizardData.longitude.toFixed(6)}" readonly>
          </div>
        </div>

        <div class="d-flex justify-content-between align-items-center pt-2 border-top">
          <button class="btn btn-outline-secondary" onclick="CitizenPortal.activeStep = 1; CitizenPortal.renderWizardStep();">← Back</button>
          <button class="btn-primary-action" onclick="CitizenPortal.proceedToStep3()">Analyze with AI →</button>
        </div>
      </div>
    `;

    // Initialize Map
    setTimeout(() => {
      this.initReportMap();
    }, 100);
  },

  initReportMap() {
    const lat = this.wizardData.latitude || 15.8246;
    const lng = this.wizardData.longitude || 80.3522;

    const map = MapService.initMap("report-map", {
      lat: lat,
      lng: lng,
      zoom: 15
    });

    if (map) {
      this.currentReportMap = map;
      this.currentReportMarker = MapService.addDraggableMarker(map, lat, lng, (newLat, newLng) => {
        this.handleLocationUpdate(newLat, newLng);
      });
      setTimeout(() => { if (map.invalidateSize) map.invalidateSize(); }, 200);
    }

    this.checkDuplicates(lat, lng);
  },

  async handleLocationUpdate(lat, lng, skipReverse = false) {
    this.wizardData.latitude = lat;
    this.wizardData.longitude = lng;

    const latEl = document.getElementById("loc-lat");
    const lngEl = document.getElementById("loc-lng");
    const statusText = document.getElementById("loc-status-text");
    const spinner = document.getElementById("loc-spinner");

    if (latEl) latEl.value = lat.toFixed(6);
    if (lngEl) lngEl.value = lng.toFixed(6);

    this.checkDuplicates(lat, lng);

    if (!skipReverse) {
      if (spinner) spinner.style.display = "inline-block";
      if (statusText) statusText.innerText = "Finding real address from OpenStreetMap...";

      try {
        const geo = await MapService.reverseGeocode(lat, lng);
        const nameInput = document.getElementById("loc-name-input");
        if (nameInput && geo.shortName) {
          nameInput.value = geo.shortName;
          this.wizardData.location_name = geo.shortName;
        }
        if (statusText) statusText.innerHTML = `📍 <strong>${geo.shortName}</strong>`;
      } catch (e) {
        if (statusText) statusText.innerText = `Coordinates pinned: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      } finally {
        if (spinner) spinner.style.display = "none";
      }
    }
  },

  async detectLiveLocation() {
    const statusText = document.getElementById("loc-status-text");
    const spinner = document.getElementById("loc-spinner");
    if (spinner) spinner.style.display = "inline-block";
    if (statusText) statusText.innerText = "Acquiring live GPS satellite coordinates...";

    try {
      const pos = await MapService.getLivePosition();
      const lat = pos.latitude;
      const lng = pos.longitude;

      if (this.currentReportMap) {
        this.currentReportMap.setView([lat, lng], 16);
      }
      if (this.currentReportMarker) {
        this.currentReportMarker.setLatLng([lat, lng]);
      }

      await this.handleLocationUpdate(lat, lng);
    } catch (err) {
      if (statusText) {
        statusText.innerHTML = `<span class="text-danger">⚠️ Could not get live GPS (${err.message || 'Permission denied'}). You can still click or search on the map.</span>`;
      }
    } finally {
      if (spinner) spinner.style.display = "none";
    }
  },

  async searchLocation() {
    const input = document.getElementById("map-search-input");
    const resultsContainer = document.getElementById("map-search-results");
    if (!input || !resultsContainer) return;

    const query = input.value.trim();
    if (!query) return;

    resultsContainer.style.display = "block";
    resultsContainer.innerHTML = `<div class="list-group-item text-muted py-2 small">Searching real locations for "${query}"...</div>`;

    const results = await MapService.searchAddress(query);
    if (results.length === 0) {
      resultsContainer.innerHTML = `<div class="list-group-item text-danger py-2 small">No matching locations found. Try another query.</div>`;
      setTimeout(() => { resultsContainer.style.display = "none"; }, 3000);
      return;
    }

    resultsContainer.innerHTML = results.map((item, idx) => {
      const name = item.displayName || item.name || "Selected Location";
      return `
      <button type="button" class="list-group-item list-group-item-action py-2 text-start small" onclick="CitizenPortal.selectSearchResult(${item.lat}, ${item.lng}, '${name.replace(/'/g, "\\'")}')">
        <strong>📍 ${name.split(',')[0]}</strong><br>
        <span class="text-muted" style="font-size: 0.75rem;">${name}</span>
      </button>
      `;
    }).join("");
  },

  selectSearchResult(lat, lng, fullName) {
    const resultsContainer = document.getElementById("map-search-results");
    if (resultsContainer) resultsContainer.style.display = "none";

    if (this.currentReportMap) {
      this.currentReportMap.setView([lat, lng], 16);
    }
    if (this.currentReportMarker) {
      this.currentReportMarker.setLatLng([lat, lng]);
    }

    const shortName = fullName.split(",").slice(0, 3).join(", ");
    const nameInput = document.getElementById("loc-name-input");
    if (nameInput) nameInput.value = shortName;
    this.wizardData.location_name = shortName;

    this.handleLocationUpdate(lat, lng, true);
  },

  async checkDuplicates(lat, lng) {
    try {
      const res = await API.checkDuplicates(lat, lng, this.wizardData.category);
      const container = document.getElementById("duplicate-warning");
      if (!container) return;

      if (res.duplicates && res.duplicates.length > 0) {
        const topDup = res.duplicates[0];
        container.innerHTML = `
          <div class="alert alert-warning d-flex justify-content-between align-items-center mb-3">
            <div>
              <strong>⚠️ Possible Existing Report (${topDup.distance_meters}m away)</strong>
              <div class="small">#${topDup.id} (${topDup.category} - Status: ${topDup.status}) was recently reported at this spot.</div>
            </div>
            <button class="btn btn-sm btn-outline-dark" onclick="CitizenPortal.viewReportDetail('${topDup.id}')">View Existing</button>
          </div>
        `;
      } else {
        container.innerHTML = "";
      }
    } catch (e) {
      console.warn("Duplicate check failed:", e);
    }
  },

  async proceedToStep3() {
    const locName = document.getElementById("loc-name-input");
    if (locName) this.wizardData.location_name = locName.value;

    this.activeStep = 3;
    this.renderWizardStep();
  },

  // STEP 3: AI ANALYSIS
  async renderStep3(content) {
    content.innerHTML = `
      <div class="sw-card text-center py-5">
        <div class="spinner-border text-success mb-3" style="width: 3rem; height: 3rem;" role="status"></div>
        <h5 class="fw-bold">SmartWaste AI is Analyzing Image...</h5>
        <p class="text-muted small">Detecting waste category, volume accumulation, and road obstructions...</p>
      </div>
    `;

    try {
      let aiResult;
      if (this.wizardData.imageFile) {
        const fd = new FormData();
        fd.append("image", this.wizardData.imageFile);
        fd.append("notes", this.wizardData.location_name);
        const res = await API.analyzeImage(fd);
        aiResult = res.analysis;
      } else {
        const fd = new FormData();
        fd.append("image_url", this.wizardData.imageUrl);
        const res = await API.analyzeImage(fd);
        aiResult = res.analysis;
      }

      if (!aiResult || aiResult.is_waste === false || !aiResult.is_garbage || aiResult.detected_category === "Other" || aiResult.detected_category === "Not Garbage / Clean Area") {
        this.resetInvalidImage();
        this.showInvalidWasteImageModal(aiResult || { message: "No clear waste detected." });
        this.activeStep = 1;
        this.renderWizardStep();
        return;
      }

      this.wizardData.ai_analysis = aiResult;
      this.wizardData.category = aiResult.detected_category || this.wizardData.category;
      this.wizardData.severity = (aiResult.detected_severity && aiResult.detected_severity !== "None") ? aiResult.detected_severity : this.wizardData.severity;
      this.wizardData.road_obstruction = Boolean(aiResult.road_obstruction);
      this.wizardData.imageValidated = true;

      const critScore = aiResult.criticality_score || (aiResult.detected_severity === "Critical" ? 92 : (aiResult.detected_severity === "High" ? 75 : 50));
      const sla = aiResult.sla_urgency || (aiResult.detected_severity === "Critical" ? "2 Hours (Emergency Dispatch)" : "4 Hours (High Priority Clearing)");
      const critClass = aiResult.detected_severity === "Critical" ? "danger" : (aiResult.detected_severity === "High" ? "warning" : "primary");

      content.innerHTML = `
        <div class="sw-card">
          <div class="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
            <div class="d-flex align-items-center gap-2">
              <span class="fs-4">🤖</span>
              <div>
                <h4 class="fw-bold mb-0">SmartWaste AI Inspection & Criticality Analysis</h4>
                <small class="text-muted">Engine: ${aiResult.engine || 'SmartWaste AI Computer Vision Agent v2.5'}</small>
              </div>
            </div>
            ${aiResult.image_hash ? `<span class="badge bg-light text-muted border small">Hash: ${aiResult.image_hash}</span>` : ''}
          </div>

          <!-- GARBAGE DETECTED BANNER -->
          <div class="alert alert-success border-success p-3 mb-3 shadow-sm rounded-3" style="background: #f0fdf4; border-color: #86efac;">
            <div class="d-flex align-items-center justify-content-between flex-wrap gap-3">
              <div class="d-flex align-items-center gap-3">
                <span class="fs-2">🗑️</span>
                <div>
                  <h5 class="fw-bold text-success mb-1">Waste Confirmed: ${aiResult.detected_category}</h5>
                  <p class="mb-0 text-dark small">${aiResult.message || `Detected ${aiResult.detected_category} with ${aiResult.confidence_percentage}% AI confidence.`}</p>
                </div>
              </div>
              <div class="text-end">
                <span class="badge bg-${critClass} fs-6 px-3 py-2 fw-bold shadow-sm">
                  Criticality: ${aiResult.detected_severity} (${critScore}/100)
                </span>
              </div>
            </div>
          </div>

          <!-- Image & Criticality Inspection Grid -->
          <div class="p-3 bg-light rounded-3 mb-3 border">
            <div class="row g-3 align-items-center">
              <div class="col-12 col-md-4 text-center">
                <img src="${window.resolveImageUrl(this.wizardData.imageUrl)}" onerror="window.handleImageError(this)" class="rounded-3 shadow-sm" style="max-height: 180px; max-width: 100%; object-fit: contain; background: #fff;" alt="Inspected Evidence">
              </div>
              <div class="col-12 col-md-8">
                <div class="d-flex justify-content-between align-items-center mb-1">
                  <span class="small fw-bold text-muted">Detected Category:</span>
                  <span class="badge fs-6 bg-success">${aiResult.detected_category}</span>
                </div>
                <div class="d-flex justify-content-between align-items-center mb-1">
                  <span class="small fw-bold text-muted">AI Model Confidence:</span>
                  <span class="fw-bold text-success">${aiResult.confidence_percentage}%</span>
                </div>
                <div class="progress mb-2" style="height: 8px;">
                  <div class="progress-bar bg-success" style="width: ${aiResult.confidence_percentage}%;"></div>
                </div>

                <!-- Criticality Meter -->
                <div class="d-flex justify-content-between align-items-center mb-1">
                  <span class="small fw-bold text-muted">Waste Criticality Meter:</span>
                  <span class="fw-bold text-${critClass}">${critScore}/100 • ${aiResult.detected_severity} Priority</span>
                </div>
                <div class="progress mb-3" style="height: 10px;">
                  <div class="progress-bar bg-${critClass}" style="width: ${critScore}%;"></div>
                </div>

                <!-- 4-Factor Risk Matrix -->
                <div class="row g-2 pt-1">
                  <div class="col-6">
                    <div class="p-2 bg-white rounded border small">
                      <span class="text-muted d-block" style="font-size: 0.7rem;">🚨 ROADWAY IMPACT</span>
                      <strong class="${aiResult.road_obstruction ? 'text-danger' : 'text-success'}">${aiResult.road_obstruction ? 'Blocked (High Risk)' : 'Clear Access'}</strong>
                    </div>
                  </div>
                  <div class="col-6">
                    <div class="p-2 bg-white rounded border small">
                      <span class="text-muted d-block" style="font-size: 0.7rem;">⏱️ RESPONSE SLA</span>
                      <strong class="text-dark">${sla}</strong>
                    </div>
                  </div>
                  <div class="col-6">
                    <div class="p-2 bg-white rounded border small">
                      <span class="text-muted d-block" style="font-size: 0.7rem;">🦠 HEALTH / BIOHAZARD</span>
                      <strong class="text-dark">${aiResult.health_hazard || 'Pathogen Hazard'}</strong>
                    </div>
                  </div>
                  <div class="col-6">
                    <div class="p-2 bg-white rounded border small">
                      <span class="text-muted d-block" style="font-size: 0.7rem;">📦 ESTIMATED VOLUME</span>
                      <strong class="text-dark">${aiResult.volume_level || 'Substantial Pile'}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="alert alert-secondary py-2 small mb-3">
            <strong>AI Inspection Summary:</strong> ${aiResult.summary}
          </div>

          <!-- Edit options if user wishes to customize AI findings -->
          <div class="border rounded p-3 mb-3 bg-white">
            <h6 class="fw-bold small mb-2">Want to adjust AI findings manually?</h6>
            <div class="row g-2">
              <div class="col-md-6">
                <label class="form-label small fw-bold">Category</label>
                <select id="edit-cat" class="form-select form-select-sm" onchange="CitizenPortal.wizardData.category = this.value">
                  ${["Organic / Wet Waste", "Plastic", "Paper", "Glass", "Metal", "E-Waste", "Hazardous Waste", "Mixed Waste"].map(c => `
                    <option value="${c}" ${c === this.wizardData.category ? 'selected' : ''}>${c}</option>
                  `).join("")}
                </select>
              </div>
              <div class="col-md-6">
                <label class="form-label small fw-bold">Severity</label>
                <select id="edit-sev" class="form-select form-select-sm" onchange="CitizenPortal.wizardData.severity = this.value">
                  ${["Low", "Medium", "High", "Critical"].map(s => `
                    <option value="${s}" ${s === this.wizardData.severity ? 'selected' : ''}>${s}</option>
                  `).join("")}
                </select>
              </div>
            </div>
          </div>

          <div class="d-flex justify-content-between align-items-center pt-3 border-top flex-wrap gap-2">
            <button class="btn btn-outline-secondary" onclick="CitizenPortal.activeStep = 2; CitizenPortal.renderWizardStep();">← Back to Location</button>
            <button class="btn-primary-action shadow" id="btn-submit-step3" onclick="CitizenPortal.submitDirectlyFromStep3()">
              Yes, Continue to Review & Submit Report 🚀
            </button>
          </div>
        </div>
      `;
    } catch (err) {
      if (err.status === 422 || err.data?.is_waste === false || (err.message && err.message.toLowerCase().includes("waste"))) {
        this.resetInvalidImage();
        this.showInvalidWasteImageModal(err.data?.message || err.message);
        this.activeStep = 1;
        this.renderWizardStep();
        return;
      }

      content.innerHTML = `
        <div class="sw-card text-center py-4">
          <h5 class="text-danger fw-bold">AI Analysis Fallback</h5>
          <p class="text-muted">Could not connect to external vision API. You can manually select the category below.</p>
          <div class="my-3 text-start" style="max-width: 320px; margin: 0 auto;">
            <label class="form-label small fw-bold">Waste Category</label>
            <select id="edit-cat" class="form-select mb-2">
              <option value="Mixed Waste">Mixed Waste</option>
              <option value="Plastic">Plastic</option>
              <option value="Organic / Wet Waste">Organic / Wet Waste</option>
              <option value="Paper">Paper</option>
              <option value="Glass">Glass</option>
              <option value="Metal">Metal</option>
              <option value="E-Waste">E-Waste</option>
              <option value="Hazardous Waste">Hazardous Waste</option>
            </select>
          </div>
          <button class="btn-primary-action" id="btn-submit-step3" onclick="CitizenPortal.submitDirectlyFromStep3()">Yes, Continue to Review & Submit Report 🚀</button>
        </div>
      `;
    }
  },

  isSubmitting: false,

  async submitDirectlyFromStep3() {
    if (this.isSubmitting) return;

    const catEl = document.getElementById("edit-cat");
    const sevEl = document.getElementById("edit-sev");
    if (catEl) this.wizardData.category = catEl.value;
    if (sevEl) this.wizardData.severity = sevEl.value;

    const btn = document.getElementById("btn-submit-step3");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Submitting & Mailing Municipal Team...`;
    }

    await this.submitOfficialReport();
  },

  // STEP 4: AI CONVERSATION QUESTIONS & REVIEW
  async renderStep4(content) {
    content.innerHTML = `
      <div class="sw-card">
        <div class="d-flex align-items-center gap-2 mb-3">
          <span class="fs-4">🤖</span>
          <div>
            <h4 class="fw-bold mb-0">Step 4: AI Follow-Up Questions</h4>
            <small class="text-muted">Answering these 3 quick questions helps municipal teams dispatch the right equipment.</small>
          </div>
        </div>

        <div class="p-3 bg-light rounded mb-4" id="ai-questions-box">
          <!-- Question 1 -->
          <div class="mb-3 pb-3 border-bottom">
            <label class="fw-bold small d-block mb-1">1. Is the waste blocking a road, footpath, or property entrance?</label>
            <div class="btn-group btn-group-sm" role="group">
              <input type="radio" class="btn-check" name="q_road" id="q_road_yes" value="yes" ${this.wizardData.road_obstruction ? 'checked' : ''}>
              <label class="btn btn-outline-secondary" for="q_road_yes">Yes</label>
              <input type="radio" class="btn-check" name="q_road" id="q_road_no" value="no" ${!this.wizardData.road_obstruction ? 'checked' : ''}>
              <label class="btn btn-outline-secondary" for="q_road_no">No</label>
              <input type="radio" class="btn-check" name="q_road" id="q_road_ns" value="not_sure">
              <label class="btn btn-outline-secondary" for="q_road_ns">Not sure</label>
            </div>
          </div>

          <!-- Question 2 -->
          <div class="mb-3 pb-3 border-bottom">
            <label class="fw-bold small d-block mb-1">2. How long has the waste approximately been present?</label>
            <div class="btn-group btn-group-sm flex-wrap" role="group">
              ${["Less than a day", "1–2 days", "3–7 days", "More than a week", "Not sure"].map((d, i) => `
                <input type="radio" class="btn-check" name="q_duration" id="q_dur_${i}" value="${d}" ${d === this.wizardData.observed_duration ? 'checked' : ''}>
                <label class="btn btn-outline-secondary" for="q_dur_${i}">${d}</label>
              `).join("")}
            </div>
          </div>

          <!-- Question 3 -->
          <div>
            <label class="fw-bold small d-block mb-1">3. Is there a strong smell, leakage, or visible concern?</label>
            <div class="btn-group btn-group-sm" role="group">
              <input type="radio" class="btn-check" name="q_smell" id="q_smell_yes" value="yes" checked>
              <label class="btn btn-outline-secondary" for="q_smell_yes">Yes</label>
              <input type="radio" class="btn-check" name="q_smell" id="q_smell_no" value="no">
              <label class="btn btn-outline-secondary" for="q_smell_no">No</label>
              <input type="radio" class="btn-check" name="q_smell" id="q_smell_ns" value="not_sure">
              <label class="btn btn-outline-secondary" for="q_smell_ns">Not sure</label>
            </div>
          </div>
        </div>

        <!-- Structured Preview Card -->
        <h5 class="fw-bold mb-2">Review Your Complaint Before Sending</h5>
        <div class="sw-card border-success" style="background: #f0fdf4;">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <h6 class="fw-bold text-success mb-0">${this.wizardData.category} Accumulation</h6>
            <span class="badge bg-warning text-dark">Suggested: HIGH Priority</span>
          </div>
          <p class="small mb-1"><strong>Location:</strong> ${this.wizardData.location_name}</p>
          <p class="small mb-1"><strong>Observed Duration:</strong> ${this.wizardData.observed_duration}</p>
          <p class="small mb-1"><strong>Obstruction:</strong> ${this.wizardData.road_obstruction ? 'Yes, roadside/footpath' : 'No'}</p>
          <p class="small mb-0 text-muted"><strong>Attached Evidence:</strong> 1 Photo verified by AI</p>
        </div>

        <div class="alert alert-info py-2 small">
          ℹ️ <strong>Rule:</strong> AI does not automatically submit. You must confirm by clicking below.
        </div>

        <div class="d-flex justify-content-between pt-2 border-top">
          <button class="btn btn-outline-secondary" onclick="CitizenPortal.activeStep = 3; CitizenPortal.renderWizardStep();">← Back</button>
          <button class="btn-primary-action" id="submit-complaint-btn" onclick="CitizenPortal.submitOfficialReport()">
            SUBMIT TO MUNICIPAL CORPORATION 🚀
          </button>
        </div>
      </div>
    `;
  },

  async submitOfficialReport() {
    if (this.isSubmitting) return;

    // Validation
    if (!this.wizardData.location_name || !this.wizardData.category) {
      SWNotice.warning("Please specify a location and category for the waste complaint.");
      return;
    }

    this.isSubmitting = true;

    const btn = document.getElementById("submit-complaint-btn");
    const step3Btn = document.getElementById("btn-submit-step3");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Submitting to Municipal Server...`;
    }
    if (step3Btn) {
      step3Btn.disabled = true;
      step3Btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Submitting & Mailing Municipal Team...`;
    }

    SWNotice.showLoading("Submitting complaint to Municipal Corporation & dispatching emails...");

    try {
      // Gather inputs
      const roadChoice = document.querySelector('input[name="q_road"]:checked');
      const durChoice = document.querySelector('input[name="q_duration"]:checked');
      const smellChoice = document.querySelector('input[name="q_smell"]:checked');

      const isRoadObstruction = roadChoice ? roadChoice.value === "yes" : Boolean(this.wizardData.road_obstruction);
      const durationVal = durChoice ? durChoice.value : (this.wizardData.observed_duration || "1–2 days");
      const smellVal = smellChoice ? smellChoice.value : "yes";

      const formData = new FormData();
      if (this.wizardData.imageFile) {
        formData.append("image", this.wizardData.imageFile);
      } else {
        formData.append("image_url", window.resolveImageUrl(this.wizardData.imageUrl || "./uploads/sample_mixed_waste.jpg"));
      }
      formData.append("category", this.wizardData.category);
      formData.append("severity", this.wizardData.severity || "Medium");
      formData.append("latitude", this.wizardData.latitude || 15.8246);
      formData.append("longitude", this.wizardData.longitude || 80.3522);
      formData.append("location_name", this.wizardData.location_name);
      formData.append("road_obstruction", isRoadObstruction ? "true" : "false");
      formData.append("observed_duration", durationVal);
      formData.append("description", `Reported ${this.wizardData.category.toLowerCase()} waste at ${this.wizardData.location_name}. Duration: ${durationVal}. Odor/leakage concern: ${smellVal}.`);

      const questionsPayload = [
        { question: "Is the waste blocking a road, footpath, or entrance?", answer: isRoadObstruction ? "Yes" : "No" },
        { question: "How long has the waste been present?", answer: durationVal },
        { question: "Is there strong smell/leakage?", answer: smellVal }
      ];
      formData.append("questions", JSON.stringify(questionsPayload));

      const res = await API.createReport(formData);
      const report = res.report;

      // Save report ID in session storage so it displays during this active session
      try {
        const sessionIds = JSON.parse(sessionStorage.getItem("sw_citizen_session_report_ids") || "[]");
        if (report && report.id && !sessionIds.includes(report.id)) {
          sessionIds.push(report.id);
          sessionStorage.setItem("sw_citizen_session_report_ids", JSON.stringify(sessionIds));
        }
      } catch (e) {
        console.warn("sessionStorage error:", e);
      }

      SWNotice.hideLoading();
      SWNotice.success(`Report Submitted Successfully! Assigned ID: #${report.id}`);
      this.isSubmitting = false;
      this.renderConfirmation(report);
    } catch (err) {
      SWNotice.hideLoading();
      this.isSubmitting = false;
      if (btn) {
        btn.disabled = false;
        btn.innerText = "SUBMIT TO MUNICIPAL CORPORATION 🚀";
      }
      if (step3Btn) {
        step3Btn.disabled = false;
        step3Btn.innerText = "Yes, Continue to Review & Submit Report 🚀";
      }

      if (err.status === 422 || err.data?.is_waste === false || (err.data?.error && err.data.error.includes("Waste Image"))) {
        this.resetInvalidImage();
        this.showInvalidWasteImageModal(err.data?.message || err.message);
        this.activeStep = 1;
        this.renderWizardStep();
        return;
      }

      SWNotice.error("Submission Failed: " + err.message);
    }
  },

  renderConfirmation(report) {
    const container = document.getElementById("main-view");
    container.innerHTML = `
      <div class="sw-card text-center py-5" style="max-width: 620px; margin: 30px auto;">
        <div class="display-3 mb-2">✅</div>
        <h3 class="fw-bold text-success mb-1">Complaint Submitted & Mails Dispatched!</h3>
        <p class="text-muted mb-4">Your waste report has been registered with the Municipal Sanitation Department and emailed directly to field personnel.</p>

        <!-- Complaint Details Card -->
        <div class="p-3 bg-light rounded text-start mb-3" style="font-size: 0.92rem;">
          <div class="d-flex justify-content-between py-1 border-bottom">
            <span class="text-muted">Complaint ID:</span>
            <strong class="text-primary">${report.id}</strong>
          </div>
          <div class="d-flex justify-content-between py-1 border-bottom">
            <span class="text-muted">Location:</span>
            <span class="fw-bold text-truncate" style="max-width: 320px;">📍 ${report.location_name}</span>
          </div>
          <div class="d-flex justify-content-between py-1 border-bottom">
            <span class="text-muted">Category / Priority:</span>
            <span><strong>${report.category}</strong> • <span class="badge-priority ${report.priority}">${report.priority}</span></span>
          </div>
          <div class="d-flex justify-content-between py-1">
            <span class="text-muted">Current Status:</span>
            <span class="badge-status badge-${report.status}">${report.status}</span>
          </div>
        </div>


        <div class="d-flex justify-content-center flex-wrap gap-2">
          <button class="btn btn-primary-action px-4" onclick="CitizenPortal.viewReportDetail('${report.id}')">
            TRACK COMPLAINT 📍
          </button>
          <button class="btn btn-outline-secondary" onclick="CitizenPortal.renderDashboard()">
            Back to Home
          </button>
        </div>
      </div>
    `;
  },

  // VIEW REPORT DETAIL & TIMELINE
  async viewReportDetail(reportId) {
    const container = document.getElementById("main-view");
    container.innerHTML = `
      <div class="text-center py-5">
        <div class="spinner-border text-success" role="status"></div>
        <p class="text-muted mt-2">Loading complaint details...</p>
      </div>
    `;

    try {
      const res = await API.getReport(reportId);
      const rep = res.report;

      container.innerHTML = `
        <div class="report-detail-view" style="max-width: 860px; margin: 0 auto;">
          <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
            <button class="btn btn-sm btn-outline-secondary" onclick="CitizenPortal.renderDashboard()">← Back to Reports</button>
            <div class="d-flex gap-2 align-items-center">
              <button class="btn btn-sm btn-outline-dark fw-bold" onclick="window.open('/api/reports/${rep.id}/pdf', '_blank')">
                📄 Print / Download Dossier
              </button>
              <span class="badge-status badge-${rep.status || 'SUBMITTED'}">${(rep.status || 'SUBMITTED').replace(/_/g, ' ')}</span>
              <span class="badge-priority ${rep.priority || 'MEDIUM'}">${rep.priority || 'MEDIUM'}</span>
              ${rep.is_emergency ? '<span class="badge bg-danger">🚨 EMERGENCY</span>' : ''}
            </div>
          </div>

          <!-- Information Request Banner if active -->
          ${rep.status === "INFORMATION_REQUESTED" ? `
            <div class="alert alert-warning mb-4 shadow-sm border-warning">
              <h6 class="fw-bold">⚠️ Municipal Officer Requested Additional Details:</h6>
              <p class="mb-2 fst-italic">"${rep.info_request_question || 'Please provide more details.'}"</p>
              <div class="input-group">
                <input type="text" id="citizen-answer-input" class="form-control" placeholder="Type your response here...">
                <button class="btn btn-warning fw-bold" onclick="CitizenPortal.submitInfoAnswer('${rep.id}')">Send Response to Officer</button>
              </div>
            </div>
          ` : ''}

          <!-- Resolution & Feedback Banner if completed -->
          ${rep.status === "COMPLETED" ? `
            <div class="sw-card border-success" style="background: #f0fdf4;">
              <div class="d-flex align-items-center gap-3">
                <div class="fs-1">🎉</div>
                <div>
                  <h5 class="fw-bold text-success mb-1">Complaint Resolved & Verified!</h5>
                  <p class="small text-muted mb-0">The sanitation worker cleared this waste and the municipal officer certified completion.</p>
                </div>
              </div>

              <!-- Feedback section -->
              <div class="mt-3 pt-3 border-top">
                <h6 class="fw-bold small mb-2">Was this issue resolved satisfactorily?</h6>
                ${rep.feedback ? `
                  <div class="alert alert-light border small mb-0">
                    <div>Your Rating: ${'⭐'.repeat(rep.feedback.rating)}</div>
                    <div class="fst-italic">"${rep.feedback.comment || 'Satisfactory'}"</div>
                  </div>
                ` : `
                  <div class="d-flex align-items-center gap-2 mb-2">
                    <div class="star-rating" id="star-rating-box">
                      <span class="star" onclick="CitizenPortal.setRating(1)">★</span>
                      <span class="star" onclick="CitizenPortal.setRating(2)">★</span>
                      <span class="star" onclick="CitizenPortal.setRating(3)">★</span>
                      <span class="star" onclick="CitizenPortal.setRating(4)">★</span>
                      <span class="star selected" onclick="CitizenPortal.setRating(5)">★</span>
                    </div>
                    <span class="small text-muted fw-bold" id="rating-label">5 Stars (Excellent)</span>
                  </div>
                  <div class="input-group input-group-sm">
                    <input type="text" id="feedback-comment" class="form-control" placeholder="Optional comments on cleanup quality...">
                    <button class="btn btn-success fw-bold" onclick="CitizenPortal.submitFeedback('${rep.id}')">Submit Feedback</button>
                  </div>
                `}
              </div>
            </div>
          ` : ''}

          <!-- Images Comparison -->
          <div class="verification-compare">
            <div class="compare-card">
              <div class="compare-card-header">
                <span>📸 Before Cleanup</span>
                <span class="badge bg-secondary">Reported</span>
              </div>
              <img src="${window.resolveImageUrl(rep.before_image)}" onerror="window.handleImageError(this)" class="compare-img" alt="Before">
            </div>

            <div class="compare-card">
              <div class="compare-card-header">
                <span>📸 After Cleanup</span>
                <span class="badge ${rep.after_image ? 'bg-success' : 'bg-warning text-dark'}">
                  ${rep.after_image ? 'Verified Proof' : 'Pending Cleanup'}
                </span>
              </div>
              ${rep.after_image ? `
                <img src="${window.resolveImageUrl(rep.after_image)}" onerror="window.handleImageError(this)" class="compare-img" alt="After">
              ` : `
                <div class="d-flex align-items-center justify-content-center h-100 p-4 text-center text-muted bg-light" style="min-height: 220px;">
                  <div>
                    <div class="fs-2 mb-1">⏳</div>
                    <small>After-cleaning photo will be uploaded by the sanitation worker upon completion.</small>
                  </div>
                </div>
              `}
            </div>
          </div>

          <!-- Timeline & Details Grid -->
          <div class="row g-3">
            <!-- Left: Metadata -->
            <div class="col-12 col-md-6">
              <div class="sw-card h-100">
                <h5 class="fw-bold mb-3">Complaint Details</h5>
                <p class="small mb-2"><strong>ID:</strong> ${rep.id}</p>
                <p class="small mb-2"><strong>Category:</strong> ${rep.category}</p>
                <p class="small mb-2"><strong>Location:</strong> ${rep.location_name}</p>
                <p class="small mb-2"><strong>Observed Duration:</strong> ${rep.observed_duration || 'Not specified'}</p>
                <p class="small mb-2"><strong>Roadway Blocked:</strong> ${rep.road_obstruction ? '⚠️ Yes' : 'No'}</p>
                <p class="small mb-2"><strong>Priority Factors:</strong></p>
                <ul class="small text-muted ps-3 mb-3">
                  ${(rep.priority_reasons || []).map(r => `<li>${r}</li>`).join("")}
                </ul>
                <div class="p-2 bg-light rounded small mb-3">
                  <strong>AI Summary:</strong> ${rep.ai_summary || rep.description}
                </div>

                <!-- Interactive Pinpoint Map -->
                <div>
                  <div class="d-flex justify-content-between align-items-center mb-1">
                    <strong class="small text-dark">📍 Spot on OpenStreetMap:</strong>
                    <small class="text-muted" style="font-size: 0.75rem;">${rep.latitude ? `${parseFloat(rep.latitude).toFixed(4)}, ${parseFloat(rep.longitude).toFixed(4)}` : ''}</small>
                  </div>
                  <div id="citizen-detail-map" style="height: 160px; border-radius: 8px; border: 1px solid #cbd5e1; background: #f1f5f9;"></div>
                </div>
              </div>
            </div>

            <!-- Right: Database-Backed History Timeline -->
            <div class="col-12 col-md-6">
              <div class="sw-card h-100">
                <h5 class="fw-bold mb-3">Action History Timeline</h5>
                <div class="timeline">
                  ${(rep.history || []).map((h, i) => {
                    const statusText = (h.new_status || h.status || 'STATUS UPDATE').replace(/_/g, ' ');
                    const timeText = h.formatted_time || (h.timestamp ? new Date(h.timestamp).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : 'Recently');
                    const noteText = h.notes || h.comment || (h.changed_by ? `Action by ${h.changed_by}` : '');
                    return `
                    <div class="timeline-item ${i === rep.history.length - 1 ? 'active' : ''}">
                      <div class="timeline-time">${timeText}</div>
                      <div class="timeline-title">${statusText}</div>
                      <div class="timeline-comment">${noteText}</div>
                    </div>
                    `;
                  }).join("")}
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      if (rep.latitude && rep.longitude) {
        setTimeout(() => {
          const detailMap = MapService.initMap("citizen-detail-map", {
            lat: parseFloat(rep.latitude),
            lng: parseFloat(rep.longitude),
            zoom: 15
          });
          if (detailMap && typeof L !== "undefined") {
            L.circleMarker([parseFloat(rep.latitude), parseFloat(rep.longitude)], {
              radius: 9,
              fillColor: "#059669",
              color: "#ffffff",
              weight: 3,
              opacity: 1,
              fillOpacity: 0.9
            }).addTo(detailMap).bindPopup(`<strong>${rep.id}</strong><br>${rep.location_name}`).openPopup();
          }
        }, 100);
      }
    } catch (err) {
      container.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`;
    }
  },

  async submitInfoAnswer(reportId) {
    const input = document.getElementById("citizen-answer-input");
    if (!input || !input.value.trim()) return;

    try {
      await API.answerInfo(reportId, input.value.trim());
      SWNotice.success("Response submitted to municipal officer.");
      this.viewReportDetail(reportId);
    } catch (err) {
      SWNotice.error("Error: " + err.message);
    }
  },

  userRating: 5,
  setRating(stars) {
    this.userRating = stars;
    const labels = ["1 Star (Poor)", "2 Stars (Fair)", "3 Stars (Average)", "4 Stars (Good)", "5 Stars (Excellent)"];
    document.getElementById("rating-label").innerText = labels[stars - 1];
    const starEls = document.querySelectorAll("#star-rating-box .star");
    starEls.forEach((el, idx) => {
      if (idx < stars) el.classList.add("selected");
      else el.classList.remove("selected");
    });
  },

  async submitFeedback(reportId) {
    const commentInput = document.getElementById("feedback-comment");
    const comment = commentInput ? commentInput.value.trim() : "";
    try {
      await API.submitFeedback(reportId, this.userRating, comment);
      SWNotice.success("Thank you for rating municipal sanitation service!");
      this.viewReportDetail(reportId);
    } catch (err) {
      SWNotice.error("Error: " + err.message);
    }
  }
};
