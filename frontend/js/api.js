// SmartWaste Universal API Client (Supports both Flask Backend & In-Browser ClientEngine)
const API = {
  baseUrl: "/api",
  useClientEngine: false,

  // Automatically detect if running without Flask server (GitHub Pages, Live Server, file://)
  shouldUseClientEngine() {
    if (this.useClientEngine) return true;
    if (typeof window !== "undefined") {
      const loc = window.location;
      if (loc.protocol === "file:") return true;
      if (loc.hostname.endsWith("github.io")) return true;
      if (loc.port === "5500" || loc.port === "3000" || loc.port === "8080") return true;
    }
    return false;
  },

  async request(endpoint, options = {}) {
    // If running in static/browser environment, directly process with ClientEngine
    if (this.shouldUseClientEngine()) {
      return this.handleClientRequest(endpoint, options);
    }

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
      // If network/404 failure occurs on static host, automatically fall back to ClientEngine
      if (err.status === 404 || err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
        console.warn(`[SmartWaste API] Backend unreachable at ${endpoint}. Seamlessly switching to In-Browser Client Engine.`);
        this.useClientEngine = true;
        return this.handleClientRequest(endpoint, options);
      }
      console.error(`API Error [${endpoint}]:`, err);
      throw err;
    }
  },

  // In-Browser Client Engine Request Router
  async handleClientRequest(endpoint, options = {}) {
    if (typeof ClientEngine === "undefined") {
      throw new Error("ClientEngine is required for offline/static execution.");
    }
    ClientEngine.initDB();

    const method = (options.method || "GET").toUpperCase();
    let body = options.body;
    let params = {};

    // Parse URL query parameters
    let path = endpoint;
    if (endpoint.includes("?")) {
      const [p, q] = endpoint.split("?");
      path = p;
      params = Object.fromEntries(new URLSearchParams(q));
    }

    // Parse Body
    let parsedBody = {};
    if (body instanceof FormData) {
      for (const [key, value] of body.entries()) {
        parsedBody[key] = value;
      }
    } else if (typeof body === "string") {
      try { parsedBody = JSON.parse(body); } catch (e) { parsedBody = {}; }
    } else if (typeof body === "object" && body !== null) {
      parsedBody = body;
    }

    const currentUser = ClientEngine.getCurrentUser();

    // 1. AUTH ROUTES
    if (path === "/auth/me") {
      return { authenticated: Boolean(currentUser), user: currentUser };
    }

    if (path === "/auth/login" && method === "POST") {
      const email = (parsedBody.email || "").trim().toLowerCase();
      const password = (parsedBody.password || "").trim();
      const users = ClientEngine.get("users");
      const user = users.find(u => u.email.toLowerCase() === email);

      const isDemo = email.endsWith("@demo.com") && ["demo123", "citizen123", "officer123", "worker123"].includes(password);
      if (!user || (!isDemo && password.length < 3)) {
        const err = new Error("Invalid email or password");
        err.status = 401; err.data = { error: "Invalid email or password" };
        throw err;
      }
      ClientEngine.setCurrentUser(user);
      return { message: "Login successful", user };
    }

    if (path === "/auth/register" && method === "POST") {
      const email = (parsedBody.email || "").trim().toLowerCase();
      const zone = parsedBody.zone || "Ward 1 - Chirala Clock Tower (Main Bazaar)";
      const users = ClientEngine.get("users");
      let user = users.find(u => u.email.toLowerCase() === email);
      if (!user) {
        const namePart = email.split("@")[0].replace(/[._]/g, " ");
        const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
        user = {
          id: users.length + 1,
          name: formattedName,
          email: email,
          role: "citizen",
          zone: zone,
          points: 100,
          rank_tier: "Eco Scout",
          badges: ["🌱 First Step"],
          avatar_url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80"
        };
        users.push(user);
        ClientEngine.set("users", users);
      }
      ClientEngine.setCurrentUser(user);
      return { message: "Account created successfully", user };
    }

    if (path === "/auth/switch-demo" && method === "POST") {
      const role = (parsedBody.role || "citizen").toLowerCase();
      const users = ClientEngine.get("users");
      const user = users.find(u => u.role === role) || users[0];
      ClientEngine.setCurrentUser(user);
      return { message: `Switched demo role to ${role}`, user };
    }

    if (path === "/auth/logout" && method === "POST") {
      ClientEngine.setCurrentUser(null);
      return { message: "Logged out successfully" };
    }

    // 2. AI VISION INSPECTION & VALIDATION GATE
    if (path === "/ai/analyze-image" && method === "POST") {
      let imgSrc = parsedBody.image_url || "";
      if (parsedBody.image instanceof File) {
        imgSrc = URL.createObjectURL(parsedBody.image);
      }
      const notes = parsedBody.notes || "";
      const analysis = await ClientEngine.analyzeWasteImage(imgSrc, notes);

      if (!analysis.is_waste) {
        const err = new Error(analysis.message);
        err.status = 422;
        err.data = analysis;
        throw err;
      }

      return {
        valid: true,
        is_waste: true,
        analysis: analysis,
        suggested_questions: analysis.suggested_questions
      };
    }

    if (path === "/ai/assistant/chat" && method === "POST") {
      const msg = (parsedBody.message || "").toLowerCase();
      let reply = "I am SmartWaste AI Assistant for Chirala Municipality. You can report overflowing waste, locate collection hubs, or check your complaint status.";
      if (msg.includes("plastic")) {
        reply = "Plastic waste (PET bottles, bags, wrappers) must be cleaned, dried, and deposited in the Blue Recyclable Bin. In Chirala, the Kothapeta Railway Station Hub accepts segregated plastic every morning.";
      } else if (msg.includes("organic") || msg.includes("wet") || msg.includes("food")) {
        reply = "Wet organic waste (kitchen scraps, fruit peels, leftover food) should be placed in the Green Bin. It is transported to the Chirala Municipal Composting Unit.";
      } else if (msg.includes("report") || msg.includes("status")) {
        reply = "You can view the real-time status of all your complaints in the 'My Reports' tab, including photo verification by Municipal Officers.";
      } else if (msg.includes("high") || msg.includes("emergency") || msg.includes("priority")) {
        reply = "Emergencies involving hazardous chemicals, hospital road blocks, or severe drain overflow can be toggled as 'High-Priority Public Hazard' in Step 1 of the report wizard.";
      }
      return { reply };
    }

    // 3. REPORTS
    if (path === "/reports" && method === "GET") {
      const reports = ClientEngine.get("reports");
      return { reports };
    }

    if (path === "/reports/check-duplicates" && method === "GET") {
      const lat = parseFloat(params.lat || 0);
      const lng = parseFloat(params.lng || 0);
      const category = params.category || "";
      const reports = ClientEngine.get("reports");

      const dups = [];
      for (const r of reports) {
        if (["COMPLETED", "REJECTED"].includes(r.status)) continue;
        const d = ClientEngine.calculateHaversineDistance(lat, lng, r.latitude, r.longitude);
        if (d !== null && d <= 0.25) { // 250 meters
          dups.push({
            id: r.id,
            category: r.category,
            status: r.status,
            distance_meters: Math.round(d * 1000)
          });
        }
      }
      return { duplicates: dups };
    }

    if (path.match(/^\/reports\/SW-[0-9-]+$/) && method === "GET") {
      const id = path.split("/").pop();
      const reports = ClientEngine.get("reports");
      const r = reports.find(x => x.id === id);
      if (!r) {
        const err = new Error("Complaint not found"); err.status = 404; throw err;
      }
      return { report: r };
    }

    if (path === "/reports" && method === "POST") {
      let imgSrc = parsedBody.image_url ? (window.resolveImageUrl ? window.resolveImageUrl(parsedBody.image_url) : parsedBody.image_url) : "./uploads/sample_mixed_waste.jpg";
      if (parsedBody.image instanceof File) {
        imgSrc = URL.createObjectURL(parsedBody.image);
      }
      const desc = parsedBody.description || "";

      // Strict Waste Image Validation Gate
      const analysis = await ClientEngine.analyzeWasteImage(imgSrc, desc);
      if (!analysis.is_waste) {
        const err = new Error(analysis.message);
        err.status = 422;
        err.data = analysis;
        throw err;
      }

      const reports = ClientEngine.get("reports");
      const nextNum = reports.length + 1;
      const reportId = `SW-2026-${String(nextNum).padStart(6, "0")}`;

      const lat = parseFloat(parsedBody.latitude) || 15.8246;
      const lng = parseFloat(parsedBody.longitude) || 80.3522;
      const category = parsedBody.category || analysis.detected_category || "Mixed Waste";
      const severity = parsedBody.severity || analysis.detected_severity || "High";
      const roadObstruction = String(parsedBody.road_obstruction) === "true";
      const duration = parsedBody.observed_duration || "1–2 days";
      const isEmergency = String(parsedBody.is_emergency) === "true";

      const priorityCalc = ClientEngine.calculatePriority(severity, roadObstruction, category, duration);
      const priority = isEmergency ? "CRITICAL" : priorityCalc.priority;

      const newReport = {
        id: reportId,
        citizen_id: currentUser ? currentUser.id : 1,
        citizen_name: currentUser ? currentUser.name : "Akash Kothagorla",
        category: category,
        severity: severity,
        priority: priority,
        status: "SUBMITTED",
        latitude: lat,
        longitude: lng,
        location_name: parsedBody.location_name || "Ward 1 - Chirala Clock Tower",
        ward: parsedBody.ward || "Ward 1 - Chirala Clock Tower (Main Bazaar)",
        description: desc || `Reported ${category} accumulation at ${parsedBody.location_name || 'Chirala'}.`,
        road_obstruction: roadObstruction,
        observed_duration: duration,
        is_emergency: isEmergency,
        before_image: imgSrc,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        history: [
          { status: "SUBMITTED", changed_by: currentUser ? currentUser.name : "Citizen", notes: "Complaint registered via SmartWaste AI", timestamp: new Date().toISOString() }
        ]
      };

      reports.unshift(newReport);
      ClientEngine.set("reports", reports);

      // Create email notification
      const emails = ClientEngine.get("emails");
      emails.unshift({
        id: emails.length + 1,
        recipient_role: "officer",
        recipient_email: "officer@demo.com",
        recipient_name: "Municipal Officer Ramesh",
        subject: `🚨 [NEW REPORT] #${reportId} (${priority} Priority - ${category}) at ${newReport.location_name}`,
        status: "SENT",
        formatted_time: "Just Now",
        body_html: `<div style='font-family: sans-serif; padding: 20px;'><h3 style='color: #059669;'>🚨 New Waste Complaint Registered</h3><p>Citizen reported <strong>${category}</strong> at <strong>${newReport.location_name}</strong>.</p><p>Assigned Priority: <strong>${priority}</strong></p></div>`
      });
      ClientEngine.set("emails", emails);

      return { message: "Report submitted successfully", report: newReport };
    }

    if (path.match(/\/reports\/[A-Z0-9-]+\/review$/) && method === "POST") {
      const id = path.split("/")[2];
      const reports = ClientEngine.get("reports");
      const r = reports.find(x => x.id === id);
      if (r) {
        r.status = "UNDER_REVIEW";
        r.updated_at = new Date().toISOString();
        r.history.push({ status: "UNDER_REVIEW", changed_by: currentUser?.name || "Officer", notes: "Officer verified report details", timestamp: new Date().toISOString() });
        ClientEngine.set("reports", reports);
        return { message: "Report marked Under Review", report: r };
      }
    }

    if (path.match(/\/reports\/[A-Z0-9-]+\/feedback$/) && method === "POST") {
      const id = path.split("/")[2];
      const reports = ClientEngine.get("reports");
      const r = reports.find(x => x.id === id);
      if (r) {
        r.feedback = {
          rating: parsedBody.rating || 5,
          comment: parsedBody.comment || "Thank you"
        };
        ClientEngine.set("reports", reports);
        return { message: "Feedback submitted successfully" };
      }
    }

    // 4. TASKS & WORKER DISPATCH
    if (path === "/tasks" && method === "GET") {
      const reports = ClientEngine.get("reports");
      const tasks = [];
      for (const r of reports) {
        if (["ASSIGNED", "ACCEPTED", "IN_PROGRESS", "AWAITING_VERIFICATION", "RE_CLEANING_REQUIRED", "COMPLETED"].includes(r.status)) {
          tasks.push({
            id: r.task?.id || Math.floor(Math.random() * 900) + 100,
            report_id: r.id,
            category: r.category,
            severity: r.severity,
            priority: r.priority,
            status: r.task?.status || r.status,
            location_name: r.location_name,
            latitude: r.latitude,
            longitude: r.longitude,
            before_image: r.before_image,
            after_image: r.after_image || r.task?.proof_image,
            worker_id: r.task?.worker_id || 3,
            worker_name: r.task?.worker_name || "Ravi",
            created_at: r.created_at
          });
        }
      }
      return { tasks };
    }

    if (path.match(/\/tasks\/recommended-workers\/[A-Z0-9-]+$/)) {
      const reportId = path.split("/").pop();
      const reports = ClientEngine.get("reports");
      const r = reports.find(x => x.id === reportId);
      const repLat = r ? r.latitude : 15.8246;
      const repLng = r ? r.longitude : 80.3522;

      const users = ClientEngine.get("users");
      const workers = users.filter(u => u.role === "worker");

      const recommended = workers.map(w => {
        const d = ClientEngine.calculateHaversineDistance(repLat, repLng, w.latitude, w.longitude);
        const distanceStr = (d !== null) ? `${d} km away` : "Location unavailable";
        return {
          id: w.id,
          name: w.name,
          phone: w.phone,
          zone: w.zone,
          active_tasks_count: (w.id === 3) ? 1 : 0,
          current_shift_status: "ON_DUTY",
          distance_meters: (d !== null) ? Math.round(d * 1000) : 1500,
          distance_km_str: distanceStr
        };
      });

      // Sort by proximity
      recommended.sort((a, b) => a.distance_meters - b.distance_meters);
      return { recommended_workers: recommended };
    }

    if (path === "/tasks/assign" && method === "POST") {
      const reportId = parsedBody.report_id;
      const workerId = parseInt(parsedBody.worker_id) || 3;
      const reports = ClientEngine.get("reports");
      const r = reports.find(x => x.id === reportId);
      const users = ClientEngine.get("users");
      const worker = users.find(u => u.id === workerId) || users.find(u => u.role === "worker");

      if (r) {
        r.status = "ASSIGNED";
        r.task = {
          id: Math.floor(Math.random() * 900) + 100,
          worker_id: worker.id,
          worker_name: worker.name,
          worker_phone: worker.phone,
          status: "ASSIGNED",
          assigned_at: new Date().toISOString()
        };
        r.history.push({ status: "ASSIGNED", changed_by: currentUser?.name || "Officer", notes: `Assigned to ${worker.name}`, timestamp: new Date().toISOString() });
        ClientEngine.set("reports", reports);

        // Add worker email
        const emails = ClientEngine.get("emails");
        emails.unshift({
          id: emails.length + 1,
          recipient_role: "worker",
          recipient_email: worker.email,
          recipient_name: worker.name,
          subject: `👷 [TASK ASSIGNED] Clean #${reportId} at ${r.location_name}`,
          status: "SENT",
          formatted_time: "Just Now",
          body_html: `<p>You have been assigned to clear <strong>${r.category}</strong> at ${r.location_name}.</p>`
        });
        ClientEngine.set("emails", emails);
      }
      return { message: "Worker assigned successfully" };
    }

    if (path.match(/\/tasks\/\d+\/accept$/) && method === "PUT") {
      const taskId = parseInt(path.split("/")[2]);
      const reports = ClientEngine.get("reports");
      const r = reports.find(x => x.task && x.task.id === taskId) || reports.find(x => x.status === "ASSIGNED");
      if (r) {
        r.status = "ACCEPTED";
        if (r.task) r.task.status = "ACCEPTED";
        r.history.push({ status: "ACCEPTED", changed_by: currentUser?.name || "Worker", notes: "Worker accepted task", timestamp: new Date().toISOString() });
        ClientEngine.set("reports", reports);
      }
      return { message: "Task accepted" };
    }

    if (path.match(/\/tasks\/\d+\/start$/) && method === "PUT") {
      const taskId = parseInt(path.split("/")[2]);
      const reports = ClientEngine.get("reports");
      const r = reports.find(x => x.task && x.task.id === taskId) || reports.find(x => x.status === "ACCEPTED");
      if (r) {
        r.status = "IN_PROGRESS";
        if (r.task) r.task.status = "IN_PROGRESS";
        r.history.push({ status: "IN_PROGRESS", changed_by: currentUser?.name || "Worker", notes: "Cleaning commenced on-site", timestamp: new Date().toISOString() });
        ClientEngine.set("reports", reports);
      }
      return { message: "Cleaning started" };
    }

    if (path.match(/\/tasks\/\d+\/proof$/) && method === "POST") {
      const taskId = parseInt(path.split("/")[2]);
      const reports = ClientEngine.get("reports");
      const r = reports.find(x => x.task && x.task.id === taskId) || reports.find(x => x.status === "IN_PROGRESS");
      if (r) {
        let proofImg = parsedBody.image_url ? (window.resolveImageUrl ? window.resolveImageUrl(parsedBody.image_url) : parsedBody.image_url) : "./uploads/sample_cleaned_after.jpg";
        if (parsedBody.image instanceof File) {
          proofImg = URL.createObjectURL(parsedBody.image);
        }
        r.status = "AWAITING_VERIFICATION";
        r.after_image = proofImg;
        r.worker_notes = parsedBody.notes || "Cleaned and sanitized";
        if (r.task) {
          r.task.status = "AWAITING_VERIFICATION";
          r.task.proof_image = proofImg;
          r.task.proof_notes = r.worker_notes;
        }
        r.history.push({ status: "AWAITING_VERIFICATION", changed_by: currentUser?.name || "Worker", notes: "Photo proof uploaded", timestamp: new Date().toISOString() });
        ClientEngine.set("reports", reports);
      }
      return { message: "Proof submitted successfully" };
    }

    if (path.match(/\/tasks\/\d+\/verify$/) && method === "POST") {
      const taskId = parseInt(path.split("/")[2]);
      const reports = ClientEngine.get("reports");
      const r = reports.find(x => x.task && x.task.id === taskId) || reports.find(x => x.status === "AWAITING_VERIFICATION");
      if (r) {
        r.status = "COMPLETED";
        r.completed_at = new Date().toISOString();
        if (r.task) r.task.status = "COMPLETED";
        r.history.push({ status: "COMPLETED", changed_by: currentUser?.name || "Officer", notes: "Verified clean and approved", timestamp: new Date().toISOString() });
        ClientEngine.set("reports", reports);

        // Notify citizen
        const notifs = ClientEngine.get("notifications");
        notifs.unshift({
          id: notifs.length + 1,
          user_id: r.citizen_id,
          title: "Report Resolved & Verified",
          message: `Your complaint #${r.id} at ${r.location_name} was verified clean.`,
          is_read: false,
          formatted_time: "Just Now",
          created_at: new Date().toISOString()
        });
        ClientEngine.set("notifications", notifs);
      }
      return { message: "Task verified and completed" };
    }

    if (path.match(/\/tasks\/\d+\/reclean$/) && method === "POST") {
      const taskId = parseInt(path.split("/")[2]);
      const reports = ClientEngine.get("reports");
      const r = reports.find(x => x.task && x.task.id === taskId) || reports.find(x => x.status === "AWAITING_VERIFICATION");
      if (r) {
        r.status = "RE_CLEANING_REQUIRED";
        if (r.task) r.task.status = "RE_CLEANING_REQUIRED";
        r.history.push({ status: "RE_CLEANING_REQUIRED", changed_by: currentUser?.name || "Officer", notes: parsedBody.reason || "Re-cleaning requested", timestamp: new Date().toISOString() });
        ClientEngine.set("reports", reports);
      }
      return { message: "Re-cleaning required flagged" };
    }

    // 5. ANNOUNCEMENTS
    if (path === "/announcements" && method === "GET") {
      const announcements = ClientEngine.get("announcements");
      return { announcements };
    }

    if (path === "/announcements" && method === "POST") {
      const list = ClientEngine.get("announcements");
      const newAnn = {
        id: list.length + 1,
        title: parsedBody.title || "Civic Announcement",
        content: parsedBody.content || parsedBody.message || "",
        message: parsedBody.content || parsedBody.message || "",
        priority: parsedBody.priority || "NORMAL",
        target_ward: parsedBody.target_ward || "All",
        author_name: currentUser?.name || "Municipal Office",
        created_at: new Date().toISOString(),
        formatted_date: "Just Now"
      };
      list.unshift(newAnn);
      ClientEngine.set("announcements", list);
      return { message: "Announcement published", announcement: newAnn };
    }

    if (path.match(/^\/announcements\/\d+$/) && method === "DELETE") {
      const id = parseInt(path.split("/").pop());
      let list = ClientEngine.get("announcements");
      list = list.filter(a => a.id !== id);
      ClientEngine.set("announcements", list);
      return { message: "Announcement deleted" };
    }

    // 6. NOTIFICATIONS
    if (path === "/notifications" && method === "GET") {
      const list = ClientEngine.get("notifications");
      const unreadCount = list.filter(n => !n.is_read).length;
      return { notifications: list, unread_count: unreadCount };
    }

    if (path === "/notifications/read-all" && method === "POST") {
      const list = ClientEngine.get("notifications");
      list.forEach(n => n.is_read = true);
      ClientEngine.set("notifications", list);
      return { message: "All notifications marked read" };
    }

    // 7. STATS & COLLECTION POINTS & EMAILS
    if (path === "/citizen/stats" && method === "GET") {
      return {
        stats: {
          points: currentUser?.points || 240,
          rank_tier: currentUser?.rank_tier || "Civic Champion",
          reports_filed: 6,
          reports_resolved: 4,
          badges: currentUser?.badges || ["🌱 First Step", "🌿 Cleanliness Pioneer"]
        }
      };
    }

    if (path === "/collection-points" && method === "GET") {
      const points = ClientEngine.get("collection_points");
      return { collection_points: points };
    }

    if (path === "/collection-points/generate-route" && method === "POST") {
      const points = ClientEngine.get("collection_points");
      return {
        route: {
          total_distance_km: 14.8,
          estimated_time_mins: 48,
          stops: [
            { name: "Start: Municipal Depot Gate", lat: 15.8200, lng: 80.3500 },
            ...points.map(p => ({ name: p.name, lat: p.latitude, lng: p.longitude, fill_level: p.fill_level })),
            { name: "Finish: Chirala Waste Processing Facility", lat: 15.8350, lng: 80.3600 }
          ]
        }
      };
    }

    if (path === "/emails" && method === "GET") {
      const emails = ClientEngine.get("emails");
      return { emails, smtp_configured: true, smtp_server: "smtp.gmail.com" };
    }

    if (path === "/emails/send-test" && method === "POST") {
      const emails = ClientEngine.get("emails");
      emails.unshift({
        id: emails.length + 1,
        recipient_role: parsedBody.role || "citizen",
        recipient_email: parsedBody.email || "citizen@demo.com",
        recipient_name: `${(parsedBody.role || 'citizen').toUpperCase()} User`,
        subject: "🧪 [TEST EMAIL] SmartWaste Notification System Active",
        status: "SENT",
        formatted_time: "Just Now",
        body_html: `<div style='font-family: sans-serif; padding: 20px;'><h3 style='color: #059669;'>🧪 Live Test Dispatch Successful</h3><p>Notification system verified for <strong>${parsedBody.email}</strong>.</p></div>`
      });
      ClientEngine.set("emails", emails);
      return { message: "Test email dispatched successfully" };
    }

    // Default fallback
    return {};
  },

  // Auth Methods
  getCurrentUser() { return this.request("/auth/me"); },
  register(data) { return this.request("/auth/register", { method: "POST", body: data }); },
  login(email, password) { return this.request("/auth/login", { method: "POST", body: { email, password } }); },
  logout() { return this.request("/auth/logout", { method: "POST" }); },
  switchDemo(role) { return this.request("/auth/switch-demo", { method: "POST", body: { role } }); },

  // Reports Methods
  getReports(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/reports${query ? "?" + query : ""}`);
  },
  getReport(id) { return this.request(`/reports/${id}`); },
  checkDuplicates(lat, lng, category) {
    return this.request(`/reports/check-duplicates?lat=${lat}&lng=${lng}&category=${encodeURIComponent(category || "")}`);
  },
  createReport(formData) { return this.request("/reports", { method: "POST", body: formData }); },
  reviewReport(id) { return this.request(`/reports/${id}/review`, { method: "POST" }); },
  requestInfo(id, question) { return this.request(`/reports/${id}/request-info`, { method: "POST", body: { question } }); },
  answerInfo(id, answer) { return this.request(`/reports/${id}/answer-info`, { method: "POST", body: { answer } }); },
  rejectReport(id, reason) { return this.request(`/reports/${id}/reject`, { method: "POST", body: { reason } }); },
  submitFeedback(id, rating, comment) { return this.request(`/reports/${id}/feedback`, { method: "POST", body: { rating, comment } }); },

  // AI Methods
  analyzeImage(formData) { return this.request("/ai/analyze-image", { method: "POST", body: formData }); },
  generateComplaint(payload) { return this.request("/ai/generate-complaint", { method: "POST", body: payload }); },
  sendAIChat(message) { return this.request("/ai/assistant/chat", { method: "POST", body: { message } }); },

  // Tasks & Operations
  getTasks() { return this.request("/tasks"); },
  getRecommendedWorkers(reportId) { return this.request(`/tasks/recommended-workers/${reportId}`); },
  assignWorker(reportId, workerId) { return this.request("/tasks/assign", { method: "POST", body: { report_id: reportId, worker_id: workerId } }); },
  updateWorkerLocation(workerId, latitude, longitude) { return this.request("/tasks/worker/location", { method: "POST", body: { worker_id: workerId, latitude, longitude } }); },
  acceptTask(taskId) { return this.request(`/tasks/${taskId}/accept`, { method: "PUT" }); },
  startCleaning(taskId) { return this.request(`/tasks/${taskId}/start`, { method: "PUT" }); },
  submitTaskProof(taskId, formData) { return this.request(`/tasks/${taskId}/proof`, { method: "POST", body: formData }); },
  requestRecleaning(taskId, reason) { return this.request(`/tasks/${taskId}/reclean`, { method: "POST", body: { reason } }); },
  verifyTask(taskId, notes) { return this.request(`/tasks/${taskId}/verify`, { method: "POST", body: { notes } }); },

  // Notifications
  getNotifications() { return this.request("/notifications"); },
  markNotificationRead(id) { return this.request(`/notifications/${id}/read`, { method: "POST" }); },
  markAllNotificationsRead() { return this.request("/notifications/read-all", { method: "POST" }); },

  // Citizen Stats & Gamification
  getCitizenStats() { return this.request("/citizen/stats"); },

  // Announcements
  getAnnouncements(ward = "All") { return this.request(`/announcements?ward=${encodeURIComponent(ward)}`); },
  createAnnouncement(data) { return this.request("/announcements", { method: "POST", body: data }); },
  deleteAnnouncement(id) { return this.request(`/announcements/${id}`, { method: "DELETE" }); },

  // Analytics & Heatmap
  getAnalyticsOverview() { return this.request("/analytics/overview"); },
  getHeatmapData() { return this.request("/analytics/heatmap"); },

  // Collection Points & Route
  getCollectionPoints() { return this.request("/collection-points"); },
  generateRoute(data) { return this.request("/collection-points/generate-route", { method: "POST", body: data }); },

  // Email Audits & SMTP Configuration
  getEmails() { return this.request("/emails"); },
  saveRoleEmails(emails) { return this.request("/emails/config", { method: "POST", body: emails }); },
  saveSmtpConfig(config) { return this.request("/emails/smtp", { method: "POST", body: config }); },
  sendTestEmail(targetEmail, role) { return this.request("/emails/send-test", { method: "POST", body: { email: targetEmail, role } }); }
};
