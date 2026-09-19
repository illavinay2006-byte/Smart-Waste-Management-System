// SmartWaste Main Application Controller
const App = {
  currentUser: null,
  activeRole: "citizen",
  _pollInterval: null,

  async init() {
    console.log("Initializing SmartWaste Application...");

    // Listen for session invalidation (e.g. concurrent login on another device/browser)
    window.addEventListener("session-invalidated", (e) => {
      this.handleSessionInvalidated(e.detail?.message);
    });

    try {
      const authRes = await API.getCurrentUser();
      const hasActiveSession = typeof sessionStorage !== "undefined" && sessionStorage.getItem("sw_user_logged_in") === "true";
      if (authRes.authenticated && authRes.user && hasActiveSession) {
        this.showAppInterface(authRes.user);
      } else {
        // Website starts from login page or registration page
        this.showGatewayScreen();
      }
    } catch (err) {
      console.error("Initialization error:", err);
      this.showGatewayScreen();
    }
  },

  handleSessionInvalidated(message) {
    if (this._pollInterval) {
      clearInterval(this._pollInterval);
      this._pollInterval = null;
    }
    this.currentUser = null;
    this.showGatewayScreen(message || "Your session has ended because another login occurred with your credentials. At a time, only one user can use the app.");
  },

  showGatewayScreen(warningMessage) {
    this.currentUser = null;
    if (this._pollInterval) {
      clearInterval(this._pollInterval);
      this._pollInterval = null;
    }
    const gateway = document.getElementById("auth-gateway-screen");
    const appLayout = document.getElementById("app-layout");
    if (gateway) gateway.style.display = "flex";
    if (appLayout) appLayout.style.display = "none";

    this.switchGatewayTab("login");

    if (warningMessage) {
      const alertEl = document.getElementById("gateway-status-alert");
      if (alertEl) {
        alertEl.innerHTML = `
          <div class="alert alert-warning py-2 small shadow-sm border-warning">
            <strong>⚠️ Exclusive Session Notice:</strong><br>${warningMessage}
          </div>
        `;
      }
    }
  },

  showAppInterface(user) {
    this.currentUser = user;
    this.activeRole = user.role || "citizen";

    const gateway = document.getElementById("auth-gateway-screen");
    const appLayout = document.getElementById("app-layout");
    if (gateway) gateway.style.display = "none";
    if (appLayout) appLayout.style.display = "block";

    this.updateHeaderProfile();
    this.routeRoleView();
    this.pollNotifications();

    // Start single-session heartbeat & notification polling
    if (this._pollInterval) clearInterval(this._pollInterval);
    this._pollInterval = setInterval(async () => {
      if (!this.currentUser) return;
      try {
        const check = await API.getCurrentUser();
        if (!check.authenticated || !check.user) {
          this.handleSessionInvalidated("Another active login was detected with your credentials. Only one active user session is permitted at a time.");
          return;
        }
        this.pollNotifications();
      } catch (err) {
        // If 401 occurs, api.js will dispatch session-invalidated
      }
    }, 8000);
  },

  switchGatewayTab(tab) {
    const regPane = document.getElementById("gateway-reg-pane");
    const loginPane = document.getElementById("gateway-login-pane");
    const regBtn = document.getElementById("gateway-tab-reg-btn");
    const loginBtn = document.getElementById("gateway-tab-login-btn");
    const alertEl = document.getElementById("gateway-status-alert");
    if (alertEl) alertEl.innerHTML = "";

    if (tab === "register") {
      if (regPane) regPane.style.display = "block";
      if (loginPane) loginPane.style.display = "none";
      if (regBtn) regBtn.className = "nav-link rounded-pill py-2 fw-bold active bg-success text-white";
      if (loginBtn) loginBtn.className = "nav-link rounded-pill py-2 fw-bold text-secondary";
    } else {
      if (regPane) regPane.style.display = "none";
      if (loginPane) loginPane.style.display = "block";
      if (regBtn) regBtn.className = "nav-link rounded-pill py-2 fw-bold text-secondary";
      if (loginBtn) loginBtn.className = "nav-link rounded-pill py-2 fw-bold active bg-primary text-white";
    }
  },

  fillGatewayLogin(email, password) {
    this.switchGatewayTab("login");
    const emailEl = document.getElementById("gateway-login-email");
    const passEl = document.getElementById("gateway-login-password");
    if (emailEl) emailEl.value = email;
    if (passEl) passEl.value = password;
  },

  async handleGatewayRegister(e) {
    e.preventDefault();
    const email = document.getElementById("gateway-reg-email").value.trim().toLowerCase();
    const password = document.getElementById("gateway-reg-password").value;
    const zone = document.getElementById("gateway-reg-zone").value;
    const alertEl = document.getElementById("gateway-status-alert");
    const btn = document.getElementById("gateway-reg-btn");

    if (!email || !password) {
      alertEl.innerHTML = `<div class="alert alert-danger py-2 small">Email and password are required.</div>`;
      return;
    }

    if (btn) { btn.disabled = true; btn.innerText = "Creating Account..."; }

    try {
      const regRes = await API.register({
        email,
        password,
        role: "citizen",
        zone
      });

      try { sessionStorage.setItem("sw_user_logged_in", "true"); } catch (e) {}
      this.showAppInterface(regRes.user);
      SWNotice.success(`Welcome to SmartWaste, ${regRes.user.name || 'Citizen'}!`);
      if (btn) { btn.disabled = false; btn.innerText = "Create Citizen Account 🚀"; }
    } catch (err) {
      alertEl.innerHTML = `<div class="alert alert-danger py-2 small shadow-sm">${err.message}</div>`;
      if (btn) { btn.disabled = false; btn.innerText = "Create Citizen Account 🚀"; }
    }
  },

  async handleGatewayLogin(e) {
    e.preventDefault();
    const email = document.getElementById("gateway-login-email").value.trim().toLowerCase();
    const password = document.getElementById("gateway-login-password").value;
    const alertEl = document.getElementById("gateway-status-alert");
    const btn = document.getElementById("gateway-login-btn");

    if (!email || !password) {
      alertEl.innerHTML = `<div class="alert alert-danger py-2 small">Email and password are required.</div>`;
      return;
    }

    if (btn) { btn.disabled = true; btn.innerText = "Authenticating..."; }

    try {
      const loginRes = await API.login(email, password);
      try { sessionStorage.setItem("sw_user_logged_in", "true"); } catch (e) {}
      this.showAppInterface(loginRes.user);
    } catch (err) {
      alertEl.innerHTML = `<div class="alert alert-danger py-2 small shadow-sm">${err.message}</div>`;
      if (btn) { btn.disabled = false; btn.innerText = "Sign In to Portal →"; }
    }
  },

  async logout() {
    try {
      await API.logout();
    } catch (e) {}
    try { sessionStorage.removeItem("sw_user_logged_in"); } catch (e) {}
    try { localStorage.removeItem("sw_active_session_user"); } catch (e) {}
    this.currentUser = null;
    this.showGatewayScreen();
  },

  async switchRole(role) {
    try {
      const res = await API.switchDemo(role);
      SWNotice.success(`Switched active view to ${role.toUpperCase()}`);
      this.showAppInterface(res.user);
    } catch (err) {
      SWNotice.error("Role switch failed: " + err.message);
    }
  },

  updateHeaderProfile() {
    if (!this.currentUser) return;
    const nameEl = document.getElementById("header-user-name");
    const roleEl = document.getElementById("header-user-role");
    const avatarEl = document.getElementById("header-user-avatar");

    if (nameEl) nameEl.innerText = this.currentUser.name || this.currentUser.email;
    if (roleEl) roleEl.innerText = (this.currentUser.role || "CITIZEN").toUpperCase();
    if (avatarEl && this.currentUser.avatar_url) {
      avatarEl.src = this.currentUser.avatar_url;
    }

    // Highlight active role pill in top header
    document.querySelectorAll(".header-role-btn").forEach(btn => {
      if (btn.dataset.role === this.activeRole) {
        btn.className = "btn btn-xs rounded-pill px-3 py-1 fw-bold header-role-btn bg-success text-white shadow-sm";
      } else {
        btn.className = "btn btn-xs rounded-pill px-3 py-1 fw-bold header-role-btn text-secondary bg-transparent";
      }
    });
  },

  routeRoleView() {
    if (this.activeRole === "citizen") {
      CitizenPortal.init();
    } else if (this.activeRole === "officer") {
      MunicipalConsole.init();
    } else if (this.activeRole === "worker") {
      WorkerPortal.init();
    }
  },

  async pollNotifications() {
    if (!this.currentUser) return;
    try {
      const res = await API.getNotifications();
      const badge = document.getElementById("notif-badge-count");
      if (badge) {
        if (res.unread_count > 0) {
          badge.style.display = "inline-block";
          badge.innerText = res.unread_count;
        } else {
          badge.style.display = "none";
        }
      }
    } catch (e) {
      // Quiet poll fail
    }
  },

  async openNotificationsModal() {
    const modalContainer = document.getElementById("modal-container");
    modalContainer.innerHTML = `
      <div class="sw-modal-backdrop">
        <div class="sw-modal" style="max-width: 480px;">
          <div class="sw-modal-header">
            <h5 class="fw-bold mb-0">Notifications</h5>
            <div class="d-flex gap-2">
              <button class="btn btn-sm btn-link text-decoration-none" onclick="App.markAllNotificationsRead()">Mark all read</button>
              <button class="btn-close" onclick="App.closeModal()"></button>
            </div>
          </div>
          <div class="sw-modal-body" id="notif-list-body">
            <div class="text-center py-3"><div class="spinner-border text-success"></div></div>
          </div>
        </div>
      </div>
    `;

    try {
      const res = await API.getNotifications();
      const body = document.getElementById("notif-list-body");
      const list = res.notifications || [];

      if (list.length === 0) {
        body.innerHTML = `<p class="text-muted text-center py-4">No notifications yet.</p>`;
        return;
      }

      body.innerHTML = list.map(n => `
        <div class="p-2 border-bottom ${n.is_read ? 'opacity-75' : 'bg-light rounded mb-1'}">
          <div class="d-flex justify-content-between align-items-start">
            <strong class="text-dark small">${n.title}</strong>
            <small class="text-muted" style="font-size: 0.72rem;">${n.formatted_time}</small>
          </div>
          <p class="small text-secondary mb-0 mt-1">${n.message}</p>
        </div>
      `).join("");
    } catch (err) {
      document.getElementById("notif-list-body").innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`;
    }
  },

  async markAllNotificationsRead() {
    await API.markAllNotificationsRead();
    this.pollNotifications();
    this.openNotificationsModal();
  },

  async openEmailsModal() {
    const modalContainer = document.getElementById("modal-container");
    modalContainer.innerHTML = `
      <div class="sw-modal-backdrop">
        <div class="sw-modal" style="max-width: 860px; max-height: 90vh; overflow-y: auto;">
          <div class="sw-modal-header border-bottom pb-3">
            <div class="d-flex align-items-center gap-2">
              <span class="fs-4">📧</span>
              <div>
                <h5 class="fw-bold mb-0">Automated Real Email Dispatch Engine</h5>
                <small class="text-muted">Live notification delivery for Citizens, Municipal Officers & Field Workers</small>
              </div>
            </div>
            <button class="btn-close" onclick="App.closeModal()"></button>
          </div>

          <div class="sw-modal-body p-4">
            <!-- 3 Role Real Email Configuration Card -->
            <div class="sw-card p-3 mb-4" style="background: #f8fafc; border: 1px solid #cbd5e1;">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <h6 class="fw-bold text-dark mb-0">⚙️ 1. Configure Target Real Emails</h6>
                <span class="badge bg-success">Auto-Dispatch Active</span>
              </div>
              <p class="small text-muted mb-3">Set the real email inboxes where Citizen complaints and Field Worker task assignments will be delivered:</p>
              
              <div class="row g-2 mb-3">
                <div class="col-md-4">
                  <label class="form-label small fw-bold text-success mb-1">👤 Citizen Email</label>
                  <input type="email" id="cfg-citizen-email" class="form-control form-control-sm" placeholder="citizen@gmail.com" value="citizen@demo.com">
                </div>
                <div class="col-md-4">
                  <label class="form-label small fw-bold text-primary mb-1">🏢 Municipal Officer Email</label>
                  <input type="email" id="cfg-officer-email" class="form-control form-control-sm" placeholder="officer@municipality.gov" value="officer@demo.com">
                </div>
                <div class="col-md-4">
                  <label class="form-label small fw-bold text-warning mb-1">👷 Field Worker Email</label>
                  <input type="email" id="cfg-worker-email" class="form-control form-control-sm" placeholder="worker@fieldcrew.com" value="worker@demo.com">
                </div>
              </div>

              <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div id="email-cfg-status" class="small text-success fw-bold"></div>
                <button class="btn btn-sm btn-primary fw-bold px-3" onclick="App.saveRoleEmails()">Save Target Emails</button>
              </div>
            </div>

            <!-- SMTP Server & Live Delivery Configuration Card -->
            <div class="sw-card p-3 mb-4" style="background: #f0fdf4; border: 1px solid #86efac;">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <h6 class="fw-bold text-success mb-0">🌐 2. Live SMTP / Gmail Server Setup (Optional)</h6>
                <span id="smtp-status-badge" class="badge bg-secondary">Checking...</span>
              </div>
              <p class="small text-muted mb-2">Configure your Gmail App Password or custom SMTP server to deliver physical emails directly to external inboxes (Gmail, Outlook, Yahoo):</p>
              
              <div class="row g-2 mb-2">
                <div class="col-md-4">
                  <label class="form-label small fw-bold mb-1">SMTP Host</label>
                  <input type="text" id="smtp-host" class="form-control form-control-sm" placeholder="smtp.gmail.com" value="smtp.gmail.com">
                </div>
                <div class="col-md-2">
                  <label class="form-label small fw-bold mb-1">Port</label>
                  <input type="number" id="smtp-port" class="form-control form-control-sm" placeholder="587" value="587">
                </div>
                <div class="col-md-3">
                  <label class="form-label small fw-bold mb-1">Gmail / Username</label>
                  <input type="email" id="smtp-user" class="form-control form-control-sm" placeholder="yourname@gmail.com">
                </div>
                <div class="col-md-3">
                  <label class="form-label small fw-bold mb-1">App Password</label>
                  <input type="password" id="smtp-pass" class="form-control form-control-sm" placeholder="16-character App Password">
                </div>
              </div>

              <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 pt-1">
                <small class="text-muted" style="font-size: 0.75rem;">Tip: For Gmail, use an <strong>App Password</strong> from your Google Account Security settings.</small>
                <div class="d-flex gap-2 align-items-center">
                  <div id="smtp-save-status" class="small fw-bold"></div>
                  <button class="btn btn-sm btn-success fw-bold px-3" onclick="App.saveSmtpConfig()">Save SMTP Settings</button>
                </div>
              </div>
            </div>

            <!-- Send Live Test Email -->
            <div class="sw-card p-3 mb-4 border-info">
              <h6 class="fw-bold text-info mb-2">🧪 3. Send Immediate Live Test Email</h6>
              <div class="input-group input-group-sm mb-2">
                <input type="email" id="test-recipient-email" class="form-control" placeholder="Enter any real email address (e.g. your personal email)">
                <select id="test-recipient-role" class="form-select" style="max-width: 140px;">
                  <option value="officer">Officer Alert</option>
                  <option value="worker">Worker Alert</option>
                  <option value="citizen">Citizen Confirm</option>
                </select>
                <button class="btn btn-info text-white fw-bold px-3" onclick="App.triggerTestEmail()">Send Test Mail 🚀</button>
              </div>
              <small id="test-email-status" class="text-muted"></small>
            </div>

            <!-- Dispatched Email History Log -->
            <div class="d-flex justify-content-between align-items-center mb-2">
              <h6 class="fw-bold mb-0">📬 Automated Email Dispatch Logs</h6>
              <button class="btn btn-sm btn-outline-secondary" onclick="App.refreshEmailLogs()">↻ Refresh Logs</button>
            </div>
            
            <div id="email-logs-table-container">
              <div class="text-center py-4"><div class="spinner-border text-primary"></div></div>
            </div>
          </div>
        </div>
      </div>
    `;

    App.loadSmtpConfig();
    App.refreshEmailLogs();
  },

  async loadSmtpConfig() {
    try {
      const res = await API.getSmtpConfig();
      const cfg = res.config || {};
      const hostEl = document.getElementById("smtp-host");
      const portEl = document.getElementById("smtp-port");
      const userEl = document.getElementById("smtp-user");
      const passEl = document.getElementById("smtp-pass");
      const badge = document.getElementById("smtp-status-badge");

      if (hostEl && cfg.server) hostEl.value = cfg.server;
      if (portEl && cfg.port) portEl.value = cfg.port;
      if (userEl && cfg.username) userEl.value = cfg.username;
      if (passEl && cfg.password && cfg.password !== "••••••••") passEl.value = cfg.password;

      if (badge) {
        if (res.configured) {
          badge.className = "badge bg-success";
          badge.innerText = "✓ Live SMTP Active";
        } else {
          badge.className = "badge bg-secondary";
          badge.innerText = "Sandbox Mode Active";
        }
      }
    } catch (e) {
      console.warn("Could not load SMTP config:", e);
    }
  },

  async saveSmtpConfig() {
    const server = document.getElementById("smtp-host").value.trim();
    const port = document.getElementById("smtp-port").value.trim();
    const username = document.getElementById("smtp-user").value.trim();
    const password = document.getElementById("smtp-pass").value;
    const statusEl = document.getElementById("smtp-save-status");

    try {
      await API.updateSmtpConfig({
        server,
        port: parseInt(port) || 587,
        username,
        password: password || undefined,
        sender: username || "notifications@smartwaste.civic",
        use_tls: parseInt(port) !== 465
      });
      statusEl.className = "small text-success fw-bold";
      statusEl.innerText = "✓ SMTP settings saved!";
      App.loadSmtpConfig();
      setTimeout(() => { if (statusEl) statusEl.innerText = ""; }, 4000);
    } catch (e) {
      statusEl.className = "small text-danger fw-bold";
      statusEl.innerText = "Error: " + e.message;
    }
  },

  async saveRoleEmails() {
    const cit = document.getElementById("cfg-citizen-email").value.trim();
    const off = document.getElementById("cfg-officer-email").value.trim();
    const wrk = document.getElementById("cfg-worker-email").value.trim();
    const statusEl = document.getElementById("email-cfg-status");

    try {
      const res = await API.updateRoleEmails({
        citizen_email: cit,
        officer_email: off,
        worker_email: wrk
      });
      statusEl.innerText = "✓ Role emails updated successfully!";
      setTimeout(() => { if (statusEl) statusEl.innerText = ""; }, 4000);
    } catch (e) {
      statusEl.className = "small text-danger fw-bold";
      statusEl.innerText = "Error: " + e.message;
    }
  },

  async triggerTestEmail() {
    const email = document.getElementById("test-recipient-email").value.trim();
    const role = document.getElementById("test-recipient-role").value;
    const statusEl = document.getElementById("test-email-status");

    if (!email) {
      SWNotice.warning("Please enter a valid email address.");
      return;
    }

    statusEl.innerText = "Dispatching test email...";
    try {
      const res = await API.sendTestEmail(email, role);
      statusEl.className = "text-success fw-bold";
      statusEl.innerText = "✓ Test email sent successfully to " + email + "!";
      SWNotice.success(`Test email dispatched to ${email}!`);
      App.refreshEmailLogs();
    } catch (e) {
      statusEl.className = "text-danger fw-bold";
      statusEl.innerText = "Failed to send: " + e.message;
      SWNotice.error(`Failed to send email: ${e.message}`);
    }
  },

  async refreshEmailLogs() {
    const container = document.getElementById("email-logs-table-container");
    if (!container) return;

    try {
      const res = await API.getEmails();
      const list = res.emails || [];

      if (list.length === 0) {
        container.innerHTML = `
          <div class="text-center py-4 sw-card bg-light">
            <p class="text-muted mb-0">No emails dispatched yet. Submit a waste complaint to see live email dispatches to Municipal Officers and Field Workers!</p>
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <div class="table-responsive">
          <table class="table table-hover table-sm align-middle" style="font-size: 0.84rem;">
            <thead class="table-light">
              <tr>
                <th>Recipient Role</th>
                <th>To Email</th>
                <th>Subject</th>
                <th>Status</th>
                <th>Time</th>
                <th class="text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              ${list.map(em => `
                <tr>
                  <td><span class="badge bg-${em.recipient_role === 'officer' ? 'primary' : (em.recipient_role === 'worker' ? 'warning text-dark' : 'success')}">${(em.recipient_role || 'user').toUpperCase()}</span></td>
                  <td class="fw-bold">${em.recipient_email}</td>
                  <td class="text-truncate" style="max-width: 200px;" title="${em.subject}">${em.subject}</td>
                  <td><span class="badge bg-${em.status === 'SENT' ? 'success' : (em.status === 'SIMULATED' ? 'info' : 'danger')}">${em.status}</span></td>
                  <td class="text-muted small">${em.formatted_time}</td>
                  <td class="text-end">
                    <button class="btn btn-xs btn-outline-dark px-2 py-1" style="font-size: 0.75rem;" onclick="App.viewEmailPreview(${em.id})">Preview HTML</button>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    } catch (e) {
      container.innerHTML = `<div class="alert alert-danger">Error loading email logs: ${e.message}</div>`;
    }
  },

  async viewEmailPreview(emailId) {
    try {
      const res = await API.request(`/emails/${emailId}`);
      const em = res.email;

      const previewDiv = document.createElement("div");
      previewDiv.className = "sw-modal-backdrop";
      previewDiv.style.zIndex = "1060";
      previewDiv.innerHTML = `
        <div class="sw-modal" style="max-width: 680px; max-height: 85vh; overflow-y: auto;">
          <div class="sw-modal-header border-bottom pb-2">
            <div>
              <h6 class="fw-bold mb-0">📧 ${em.subject}</h6>
              <small class="text-muted">To: ${em.recipient_name} &lt;${em.recipient_email}&gt; • ${em.formatted_time}</small>
            </div>
            <button class="btn-close" onclick="this.closest('.sw-modal-backdrop').remove()"></button>
          </div>
          <div class="sw-modal-body p-0">
            <iframe srcdoc="${em.body_html.replace(/"/g, '&quot;')}" style="width: 100%; height: 480px; border: none;"></iframe>
          </div>
        </div>
      `;
      document.body.appendChild(previewDiv);
    } catch (e) {
      SWNotice.error("Could not load email preview: " + e.message);
    }
  },

  async openAuthModal(activeTab = "login") {
    const modalContainer = document.getElementById("modal-container");
    modalContainer.innerHTML = `
      <div class="sw-modal-backdrop">
        <div class="sw-modal" style="max-width: 480px;">
          <div class="sw-modal-header border-bottom pb-2">
            <div class="d-flex align-items-center gap-2">
              <span class="fs-4">🔐</span>
              <div>
                <h5 class="fw-bold mb-0">Switch Account or Register</h5>
                <small class="text-muted">Email & Password Access</small>
              </div>
            </div>
            <button class="btn-close" onclick="App.closeModal()"></button>
          </div>

          <div class="sw-modal-body p-4">
            <!-- Auth Nav Tabs -->
            <ul class="nav nav-pills nav-fill mb-3 p-1 bg-light rounded-pill" id="auth-tab" role="tablist">
              <li class="nav-item" role="presentation">
                <button class="nav-link rounded-pill py-2 fw-bold ${activeTab === 'login' ? 'active bg-primary text-white' : 'text-secondary'}" id="pills-login-tab" onclick="App.switchAuthTab('login')">
                  1. Log In
                </button>
              </li>
              <li class="nav-item" role="presentation">
                <button class="nav-link rounded-pill py-2 fw-bold ${activeTab === 'register' ? 'active bg-success text-white' : 'text-secondary'}" id="pills-reg-tab" onclick="App.switchAuthTab('register')">
                  2. Register New Citizen
                </button>
              </li>
            </ul>

            <!-- Status banner -->
            <div id="auth-status-alert"></div>

            <!-- LOGIN TAB CONTENT -->
            <div id="auth-tab-login" style="display: ${activeTab === 'login' ? 'block' : 'none'};">
              <form onsubmit="App.handleLogin(event)">
                <div class="mb-3">
                  <label class="form-label small fw-bold mb-1">Email Address <span class="text-danger">*</span></label>
                  <input type="email" id="login-email" class="form-control" placeholder="e.g. rahul.verma@gmail.com" required>
                </div>
                <div class="mb-3">
                  <label class="form-label small fw-bold mb-1">Password <span class="text-danger">*</span></label>
                  <input type="password" id="login-password" class="form-control" placeholder="Enter password" required>
                </div>

                <button type="submit" id="login-submit-btn" class="btn btn-primary w-100 fw-bold py-2 rounded-pill shadow-sm" style="background: linear-gradient(135deg, #2563eb, #3b82f6); border: none;">
                  Sign In to Portal →
                </button>
              </form>

              <!-- Quick Demo Fill -->
              <div class="pt-3 mt-3 border-top text-center">
                <small class="text-muted d-block mb-2">Quick 1-Click Demo Accounts:</small>
                <div class="d-flex justify-content-center gap-2 flex-wrap">
                  <button class="btn btn-xs btn-outline-success px-2 py-1" style="font-size: 0.75rem;" onclick="App.fillLogin('citizen@demo.com', 'demo123')">👤 Citizen</button>
                  <button class="btn btn-xs btn-outline-primary px-2 py-1" style="font-size: 0.75rem;" onclick="App.fillLogin('officer@demo.com', 'demo123')">🏢 Officer</button>
                  <button class="btn btn-xs btn-outline-warning text-dark px-2 py-1" style="font-size: 0.75rem;" onclick="App.fillLogin('worker@demo.com', 'demo123')">👷 Worker</button>
                </div>
              </div>
            </div>

            <!-- REGISTER TAB CONTENT (Email & Password Only) -->
            <div id="auth-tab-register" style="display: ${activeTab === 'register' ? 'block' : 'none'};">
              <form onsubmit="App.handleRegister(event)">
                <div class="mb-3">
                  <label class="form-label small fw-bold mb-1">Real Email Address <span class="text-danger">*</span></label>
                  <input type="email" id="reg-email" class="form-control" placeholder="e.g. rahul.verma@gmail.com" required>
                  <small class="text-muted" style="font-size: 0.75rem;">Status updates & assignments will be sent here.</small>
                </div>
                <div class="mb-3">
                  <label class="form-label small fw-bold mb-1">Password <span class="text-danger">*</span></label>
                  <input type="password" id="reg-password" class="form-control" placeholder="Create a secure password" required minlength="4">
                </div>
                <div class="mb-3">
                  <label class="form-label small fw-bold mb-1">Municipal Ward</label>
                  <select id="reg-zone" class="form-select form-select-sm">
                    <option value="Ward 1 - Chirala Clock Tower (Main Bazaar)">Ward 1 - Chirala Clock Tower (Gadiyara Sthambham & Main Bazaar)</option>
                    <option value="Ward 2 - Chirala Railway Station Road (Kothapeta)">Ward 2 - Chirala Railway Station Road (Kothapeta)</option>
                    <option value="Ward 3 - Chirala Handloom Weavers Colony (Perala)">Ward 3 - Chirala Handloom Weavers Colony (Perala)</option>
                    <option value="Ward 4 - Chirala Municipality Office (Muntha Vari Thota)">Ward 4 - Chirala Municipality Office (Muntha Vari Thota)</option>
                    <option value="Ward 5 - Chirala Vadarevu Beach Road (Fisherman Colony)">Ward 5 - Chirala Vadarevu Beach Road (Fisherman Colony)</option>
                    <option value="Ward 6 - Chirala RTC Bus Complex & Bypass Junction">Ward 6 - Chirala RTC Bus Complex & Bypass Junction</option>
                    <option value="Ward 7 - Chirala Vetapalem Road (Ramapuram Beach Area)">Ward 7 - Chirala Vetapalem Road (Ramapuram Beach Area)</option>
                    <option value="Ward 8 - Chirala Ipurupalem & Gandhi Nagar">Ward 8 - Chirala Ipurupalem & Gandhi Nagar</option>
                    <option value="Ward 9 - Chirala Trunk Road & St. Mark High School Road">Ward 9 - Chirala Trunk Road & St. Mark High School Road</option>
                    <option value="Ward 10 - Chirala Chennupati Nagar & Pandillapalli">Ward 10 - Chirala Chennupati Nagar & Pandillapalli</option>
                    <option value="Ward 11 - Chirala Perala Market & Jandrapeta">Ward 11 - Chirala Perala Market & Jandrapeta</option>
                    <option value="Ward 12 - Chirala Kothapeta & Kamma Vari Palem">Ward 12 - Chirala Kothapeta & Kamma Vari Palem</option>
                  </select>
                </div>

                <button type="submit" id="reg-submit-btn" class="btn btn-success w-100 fw-bold py-2 rounded-pill shadow-sm" style="background: linear-gradient(135deg, #059669, #10b981); border: none;">
                  Create Citizen Account 🚀
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  switchAuthTab(tab) {
    const regTab = document.getElementById("auth-tab-register");
    const loginTab = document.getElementById("auth-tab-login");
    const regBtn = document.getElementById("pills-reg-tab");
    const loginBtn = document.getElementById("pills-login-tab");

    if (tab === "register") {
      if (regTab) regTab.style.display = "block";
      if (loginTab) loginTab.style.display = "none";
      if (regBtn) regBtn.className = "nav-link rounded-pill py-2 fw-bold active bg-success text-white";
      if (loginBtn) loginBtn.className = "nav-link rounded-pill py-2 fw-bold text-secondary";
    } else {
      if (regTab) regTab.style.display = "none";
      if (loginTab) loginTab.style.display = "block";
      if (regBtn) regBtn.className = "nav-link rounded-pill py-2 fw-bold text-secondary";
      if (loginBtn) loginBtn.className = "nav-link rounded-pill py-2 fw-bold active bg-primary text-white";
    }
  },

  fillLogin(email, pass) {
    this.switchAuthTab("login");
    const emailEl = document.getElementById("login-email");
    const passEl = document.getElementById("login-password");
    if (emailEl) emailEl.value = email;
    if (passEl) passEl.value = pass;
  },

  async handleRegister(e) {
    e.preventDefault();
    const email = document.getElementById("reg-email").value.trim().toLowerCase();
    const password = document.getElementById("reg-password").value;
    const zone = document.getElementById("reg-zone").value;
    const statusAlert = document.getElementById("auth-status-alert");
    const btn = document.getElementById("reg-submit-btn");

    if (!email || !password) {
      statusAlert.innerHTML = `<div class="alert alert-danger py-2 small">Email and password are required.</div>`;
      return;
    }

    if (btn) { btn.disabled = true; btn.innerText = "Creating Account..."; }

    try {
      await API.register({
        email,
        password,
        role: "citizen",
        zone
      });

      this.switchAuthTab("login");
      this.fillLogin(email, "");
      
      const newStatus = document.getElementById("auth-status-alert");
      if (newStatus) {
        newStatus.innerHTML = `
          <div class="alert alert-success py-2 small shadow-sm">
            <strong>✅ Account created successfully!</strong><br>
            Please enter your password to log in.
          </div>
        `;
      }
      if (btn) { btn.disabled = false; btn.innerText = "Create Citizen Account 🚀"; }
    } catch (err) {
      statusAlert.innerHTML = `<div class="alert alert-danger py-2 small">${err.message}</div>`;
      if (btn) { btn.disabled = false; btn.innerText = "Create Citizen Account 🚀"; }
    }
  },

  async handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById("login-email").value.trim().toLowerCase();
    const password = document.getElementById("login-password").value;
    const statusAlert = document.getElementById("auth-status-alert");
    const btn = document.getElementById("login-submit-btn");

    if (btn) { btn.disabled = true; btn.innerText = "Signing in..."; }

    try {
      const res = await API.login(email, password);
      this.closeModal();
      this.showAppInterface(res.user);
    } catch (err) {
      statusAlert.innerHTML = `<div class="alert alert-danger py-2 small">${err.message}</div>`;
      if (btn) { btn.disabled = false; btn.innerText = "Sign In to Portal →"; }
    }
  },

  async logout() {
    try {
      await API.logout();
    } catch (e) {
      console.warn("Logout error:", e);
    }
    this.showGatewayScreen();
  },

  closeModal() {
    document.getElementById("modal-container").innerHTML = "";
  }
};

window.addEventListener("DOMContentLoaded", () => {
  App.init();
});
