// SmartWaste API Client
const API = {
  baseUrl: "/api",

  async request(endpoint, options = {}) {
    const defaultHeaders = {};
    if (!(options.body instanceof FormData)) {
      defaultHeaders["Content-Type"] = "application/json";
    }

    const config = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
      credentials: "same-origin"
    };

    if (config.body && typeof config.body === "object" && !(config.body instanceof FormData)) {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, config);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401 && !endpoint.includes("/auth/login") && !endpoint.includes("/auth/register")) {
          window.dispatchEvent(new CustomEvent("session-invalidated", {
            detail: {
              message: data.error || "Your session has ended because another login occurred with your credentials. Only one active user session is permitted at a time."
            }
          }));
        }
        const err = new Error(data.message || data.error || `HTTP error ${response.status}`);
        err.status = response.status;
        err.data = data;
        throw err;
      }
      return data;
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err);
      throw err;
    }
  },

  // Auth
  getCurrentUser() {
    return this.request("/auth/me");
  },
  register(data) {
    return this.request("/auth/register", {
      method: "POST",
      body: data
    });
  },
  login(email, password) {
    return this.request("/auth/login", {
      method: "POST",
      body: { email, password }
    });
  },
  logout() {
    return this.request("/auth/logout", { method: "POST" });
  },
  switchDemo(role) {
    return this.request("/auth/switch-demo", {
      method: "POST",
      body: { role }
    });
  },

  // Reports
  getReports(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/reports${query ? "?" + query : ""}`);
  },
  getReport(id) {
    return this.request(`/reports/${id}`);
  },
  checkDuplicates(lat, lng, category) {
    return this.request(`/reports/check-duplicates?lat=${lat}&lng=${lng}&category=${encodeURIComponent(category || "")}`);
  },
  createReport(formData) {
    return this.request("/reports", {
      method: "POST",
      body: formData
    });
  },
  reviewReport(id) {
    return this.request(`/reports/${id}/review`, { method: "POST" });
  },
  requestInfo(id, question) {
    return this.request(`/reports/${id}/request-info`, {
      method: "POST",
      body: { question }
    });
  },
  answerInfo(id, answer) {
    return this.request(`/reports/${id}/answer-info`, {
      method: "POST",
      body: { answer }
    });
  },
  rejectReport(id, reason) {
    return this.request(`/reports/${id}/reject`, {
      method: "POST",
      body: { reason }
    });
  },
  submitFeedback(id, rating, comment) {
    return this.request(`/reports/${id}/feedback`, {
      method: "POST",
      body: { rating, comment }
    });
  },

  // AI
  analyzeImage(formData) {
    return this.request("/ai/analyze-image", {
      method: "POST",
      body: formData
    });
  },
  generateComplaint(payload) {
    return this.request("/ai/generate-complaint", {
      method: "POST",
      body: payload
    });
  },
  sendAIChat(message) {
    return this.request("/ai/assistant/chat", {
      method: "POST",
      body: { message }
    });
  },

  // Tasks & Operations
  getTasks() {
    return this.request("/tasks");
  },
  getRecommendedWorkers(reportId) {
    return this.request(`/tasks/recommended-workers/${reportId}`);
  },
  assignWorker(reportId, workerId) {
    return this.request("/tasks/assign", {
      method: "POST",
      body: { report_id: reportId, worker_id: workerId }
    });
  },
  updateWorkerLocation(workerId, latitude, longitude) {
    return this.request("/tasks/worker/location", {
      method: "POST",
      body: { worker_id: workerId, latitude, longitude }
    });
  },
  acceptTask(taskId) {
    return this.request(`/tasks/${taskId}/accept`, { method: "PUT" });
  },
  startCleaning(taskId) {
    return this.request(`/tasks/${taskId}/start`, { method: "PUT" });
  },
  submitTaskProof(taskId, formData) {
    return this.request(`/tasks/${taskId}/proof`, {
      method: "POST",
      body: formData
    });
  },
  verifyTask(taskId, notes) {
    return this.request(`/tasks/${taskId}/verify`, {
      method: "POST",
      body: { notes }
    });
  },
  requestRecleaning(taskId, reason) {
    return this.request(`/tasks/${taskId}/reclean`, {
      method: "POST",
      body: { reason }
    });
  },

  // Analytics & Collections & Routes
  getAnalytics() {
    return this.request("/analytics/overview");
  },
  getCollectionPoints() {
    return this.request("/collection-points");
  },
  generateRoute(startLat, startLng, vehicleType) {
    return this.request("/collection-points/generate-route", {
      method: "POST",
      body: { start_lat: startLat, start_lng: startLng, vehicle_type: vehicleType }
    });
  },

  // Notifications
  getNotifications() {
    return this.request("/notifications");
  },
  markNotificationRead(id) {
    return this.request(`/notifications/${id}/read`, { method: "PUT" });
  },
  markAllNotificationsRead() {
    return this.request("/notifications/read-all", { method: "PUT" });
  },

  // Citizen Stats & Leaderboard
  getCitizenStats() {
    return this.request("/citizen/stats");
  },
  getCitizenLeaderboard() {
    return this.request("/citizen/leaderboard");
  },

  // Announcements
  getAnnouncements(ward = "") {
    return this.request(`/announcements${ward ? "?ward=" + encodeURIComponent(ward) : ""}`);
  },
  createAnnouncement(data) {
    return this.request("/announcements", {
      method: "POST",
      body: data
    });
  },
  deleteAnnouncement(id) {
    return this.request(`/announcements/${id}`, {
      method: "DELETE"
    });
  },

  // Analytics Extras
  getHeatmap(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/analytics/heatmap${query ? "?" + query : ""}`);
  },
  getWorkerWorkload() {
    return this.request("/analytics/workers-workload");
  },

  // Real Email Dispatcher
  getEmails() {
    return this.request("/emails");
  },
  sendTestEmail(email, role) {
    return this.request("/emails/send-test", {
      method: "POST",
      body: { email, role }
    });
  },
  updateRoleEmails(data) {
    return this.request("/emails/update-role-emails", {
      method: "POST",
      body: data
    });
  },
  getSmtpConfig() {
    return this.request("/emails/smtp-config");
  },
  updateSmtpConfig(data) {
    return this.request("/emails/smtp-config", {
      method: "POST",
      body: data
    });
  }
};
