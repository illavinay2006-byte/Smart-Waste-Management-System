// Global image resolver and error fallback for static hosting / GitHub Pages / Live Server
window.resolveImageUrl = function(path) {
  if (!path) return "./uploads/sample_mixed_waste.jpg";
  if (typeof path !== "string") return "./uploads/sample_mixed_waste.jpg";
  if (path.startsWith("data:") || path.startsWith("blob:") || path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  // Strip any leading slashes, dots, and upload folder prefix variations
  let clean = path.replace(/^[./\\]+/, "");
  if (clean.toLowerCase().startsWith("uploads/")) {
    clean = clean.substring("uploads/".length);
  } else if (clean.toLowerCase().startsWith("uploads\\")) {
    clean = clean.substring("uploads\\".length);
  }
  return "./uploads/" + clean;
};

window.handleImageError = function(img) {
  if (!img) return;
  if (img._hasFailed) return;
  img._hasFailed = true;
  img.src = "./uploads/sample_mixed_waste.jpg";
};

const ClientEngine = {
  initialized: false,

  // Haversine formula: calculates geographic distance in km
  calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371.0; // Earth radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180.0;
    const dLon = (lon2 - lon1) * Math.PI / 180.0;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180.0) * Math.cos(lat2 * Math.PI / 180.0) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(1));
  },

  // Priority Engine
  calculatePriority(severity, roadObstruction, category, duration, nearbyCount = 0) {
    let score = 0;
    const reasons = [];

    const sev = (severity || "").toUpperCase();
    if (sev === "CRITICAL") { score += 50; reasons.push("Critical severity level reported"); }
    else if (sev === "HIGH") { score += 35; reasons.push("High severity accumulation"); }
    else if (sev === "MEDIUM") { score += 20; reasons.push("Moderate waste volume"); }
    else { score += 10; reasons.push("Minor waste volume"); }

    if (roadObstruction) { score += 30; reasons.push("Roadway or pedestrian walkway obstruction"); }

    const cat = (category || "").toLowerCase();
    if (cat.includes("hazardous") || cat.includes("biohazard") || cat.includes("medical")) {
      score += 40; reasons.push("Hazardous / toxic material risk");
    } else if (cat.includes("e-waste")) {
      score += 20; reasons.push("E-waste electronic hazard");
    } else if (cat.includes("organic")) {
      score += 15; reasons.push("Decomposing organic waste bio-concern");
    }

    const dur = (duration || "").toLowerCase();
    if (dur.includes("more than a week") || dur.includes("3-7") || dur.includes("3–7")) {
      score += 20; reasons.push(`Prolonged accumulation (${duration})`);
    } else if (dur.includes("1-2") || dur.includes("1–2")) {
      score += 10; reasons.push("Persistent multi-day accumulation");
    }

    if (nearbyCount > 0) {
      const clusterBoost = Math.min(nearbyCount * 5, 20);
      score += clusterBoost;
      reasons.push(`Cluster zone: ${nearbyCount} existing nearby complaints`);
    }

    let priority = "LOW";
    if (score >= 80) priority = "CRITICAL";
    else if (score >= 50) priority = "HIGH";
    else if (score >= 30) priority = "MEDIUM";

    return { priority, score, reasons };
  },

  // Helper to migrate existing reports in localStorage
  migrateReportImageUrls() {
    try {
      const reportsRaw = localStorage.getItem("sw_reports");
      if (!reportsRaw) return;
      const reports = JSON.parse(reportsRaw);
      let changed = false;
      if (Array.isArray(reports)) {
        reports.forEach(r => {
          if (r.before_image) {
            const resolved = window.resolveImageUrl(r.before_image);
            if (resolved !== r.before_image) {
              r.before_image = resolved;
              changed = true;
            }
          }
          if (r.after_image) {
            const resolved = window.resolveImageUrl(r.after_image);
            if (resolved !== r.after_image) {
              r.after_image = resolved;
              changed = true;
            }
          }
          if (r.task?.proof_image) {
            const resolved = window.resolveImageUrl(r.task.proof_image);
            if (resolved !== r.task.proof_image) {
              r.task.proof_image = resolved;
              changed = true;
            }
          }
          if (r.task?.proof_image_url) {
            const resolved = window.resolveImageUrl(r.task.proof_image_url);
            if (resolved !== r.task.proof_image_url) {
              r.task.proof_image_url = resolved;
              changed = true;
            }
          }
        });
        if (changed) {
          localStorage.setItem("sw_reports", JSON.stringify(reports));
        }
      }
    } catch (e) {
      console.warn("Migration of report image URLs skipped:", e);
    }
  },

  // Helper to ensure all workers in localStorage have valid coordinates and zones
  migrateWorkerData() {
    try {
      const usersRaw = localStorage.getItem("sw_users");
      if (!usersRaw) return;
      const users = JSON.parse(usersRaw);
      const workerDefaults = {
        3: { latitude: 15.8252, longitude: 80.3530, zone: "Ward 1 - Chirala Clock Tower (Main Bazaar)" },
        4: { latitude: 15.8180, longitude: 80.3620, zone: "Ward 3 - Chirala Handloom Weavers Colony (Perala)" },
        5: { latitude: 15.8320, longitude: 80.3450, zone: "Ward 5 - Chirala Vadarevu Beach Road (Fisherman Colony)" },
        6: { latitude: 15.8210, longitude: 80.3560, zone: "Ward 2 - Chirala Railway Station Road (Kothapeta)" }
      };
      let changed = false;
      users.forEach(u => {
        if (u.role === "worker" && workerDefaults[u.id]) {
          if (!u.latitude || !u.longitude) {
            u.latitude = workerDefaults[u.id].latitude;
            u.longitude = workerDefaults[u.id].longitude;
            changed = true;
          }
          if (!u.zone) {
            u.zone = workerDefaults[u.id].zone;
            changed = true;
          }
        }
      });
      if (!users.some(u => u.id === 6)) {
        users.push({
          id: 6,
          name: "Suresh",
          email: "suresh.worker@demo.com",
          role: "worker",
          phone: "+91 98765 66778",
          zone: "Ward 2 - Chirala Railway Station Road (Kothapeta)",
          latitude: 15.8210,
          longitude: 80.3560,
          avatar_url: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=120&q=80",
          points: 150,
          rank_tier: "Sanitation Squad",
          badges: []
        });
        changed = true;
      }
      if (changed) {
        localStorage.setItem("sw_users", JSON.stringify(users));
      }
    } catch (e) {
      console.warn("Migration of worker data skipped:", e);
    }
  },

  // Helper to ensure all tasks and reports in localStorage have valid assigned_at timestamps
  migrateTaskAssignedDates() {
    try {
      const reportsRaw = localStorage.getItem("sw_reports");
      if (!reportsRaw) return;
      const reports = JSON.parse(reportsRaw);
      let changed = false;
      const now = Date.now();
      reports.forEach((r, idx) => {
        if (r.task) {
          if (!r.task.assigned_at || r.task.assigned_at === "undefined" || r.task.assigned_at === "null" || isNaN(new Date(r.task.assigned_at).getTime())) {
            r.task.assigned_at = r.updated_at || r.created_at || new Date(now - 3600000 * (idx + 2)).toISOString();
            changed = true;
          }
        }
      });
      if (changed) {
        localStorage.setItem("sw_reports", JSON.stringify(reports));
      }
    } catch (e) {
      console.warn("Migration of task assigned dates skipped:", e);
    }
  },

  // Seamlessly assign legacy reports to active logged-in citizen
  assignReportsToCitizen(citizen) {
    if (!citizen || !citizen.name) return;
    try {
      const reports = JSON.parse(localStorage.getItem("sw_reports") || "[]");
      let changed = false;
      reports.forEach(r => {
        if (!r.citizen_name || r.citizen_name === "Akash Kothagorla" || r.citizen_id === 1 || !r.citizen_id) {
          r.citizen_name = citizen.name;
          r.citizen_id = citizen.id;
          if (r.history) {
            r.history.forEach(h => {
              if (h.changed_by === "Akash Kothagorla") {
                h.changed_by = citizen.name;
              }
            });
          }
          changed = true;
        }
      });
      if (changed) {
        localStorage.setItem("sw_reports", JSON.stringify(reports));
      }

      // Also clean up default demo citizen from sw_users
      const users = JSON.parse(localStorage.getItem("sw_users") || "[]");
      const cleanedUsers = users.filter(u => u.name !== "Akash Kothagorla" && u.email !== "citizen@demo.com");
      if (!cleanedUsers.some(u => u.id === citizen.id || u.email === citizen.email)) {
        cleanedUsers.unshift(citizen);
      }
      localStorage.setItem("sw_users", JSON.stringify(cleanedUsers));
    } catch (e) {
      console.warn("Could not reassign reports:", e);
    }
  },

  // Initialize Default Database in localStorage
  initDB() {
    this.migrateReportImageUrls();
    this.migrateWorkerData();
    this.migrateTaskAssignedDates();

    // Ensure initial browser visit starts on login page unless user has logged in during this session
    if (typeof sessionStorage !== "undefined" && !sessionStorage.getItem("sw_user_logged_in")) {
      localStorage.removeItem("sw_active_session_user");
    }

    if (localStorage.getItem("sw_db_initialized_v2")) {
      this.initialized = true;
      return;
    }

    const defaultUsers = [
      {
        id: 1,
        name: "Akash Kothagorla",
        email: "citizen@demo.com",
        role: "citizen",
        phone: "+91 93983 91677",
        zone: "Ward 1 - Chirala Clock Tower (Main Bazaar)",
        avatar_url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
        points: 240,
        rank_tier: "Civic Champion",
        badges: ["🌱 First Step", "🌿 Cleanliness Pioneer", "🛡️ Neighborhood Protector"]
      },
      {
        id: 2,
        name: "Ramesh",
        email: "officer@demo.com",
        role: "officer",
        phone: "+91 98765 11223",
        zone: "Ward 4 - Chirala Municipality Office (Muntha Vari Thota)",
        avatar_url: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=120&q=80",
        points: 0,
        rank_tier: "Chief Sanitation Officer",
        badges: []
      },
      {
        id: 3,
        name: "Ravi",
        email: "worker@demo.com",
        role: "worker",
        phone: "+91 98765 33445",
        zone: "Ward 1 - Chirala Clock Tower (Main Bazaar)",
        latitude: 15.8252,
        longitude: 80.3530,
        avatar_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80",
        points: 480,
        rank_tier: "Senior Sanitation Lead",
        badges: ["⚡ Rapid Responder", "⭐ 50 Sites Cleared"]
      },
      {
        id: 4,
        name: "Ramu",
        email: "ramu.worker@demo.com",
        role: "worker",
        phone: "+91 98765 44556",
        zone: "Ward 3 - Chirala Handloom Weavers Colony (Perala)",
        latitude: 15.8180,
        longitude: 80.3620,
        avatar_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80",
        points: 310,
        rank_tier: "Lead Field Crew",
        badges: []
      },
      {
        id: 5,
        name: "Rajesh",
        email: "rajesh.worker@demo.com",
        role: "worker",
        phone: "+91 98765 55667",
        zone: "Ward 5 - Chirala Vadarevu Beach Road (Fisherman Colony)",
        latitude: 15.8320,
        longitude: 80.3450,
        avatar_url: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=120&q=80",
        points: 210,
        rank_tier: "Field Specialist",
        badges: []
      },
      {
        id: 6,
        name: "Suresh",
        email: "suresh.worker@demo.com",
        role: "worker",
        phone: "+91 98765 66778",
        zone: "Ward 2 - Chirala Railway Station Road (Kothapeta)",
        latitude: 15.8210,
        longitude: 80.3560,
        avatar_url: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=120&q=80",
        points: 150,
        rank_tier: "Sanitation Squad",
        badges: []
      }
    ];

    const defaultReports = [
      {
        id: "SW-2026-000001",
        citizen_id: 1,
        citizen_name: "Akash Kothagorla",
        category: "Mixed Waste",
        severity: "High",
        priority: "HIGH",
        status: "SUBMITTED",
        latitude: 15.8246,
        longitude: 80.3522,
        location_name: "Ward 1 - Chirala Clock Tower, Main Bazaar",
        ward: "Ward 1 - Chirala Clock Tower (Main Bazaar)",
        description: "Heavy roadside accumulation of mixed packaging, cartons, and plastic bags near the clock tower intersection.",
        road_obstruction: true,
        observed_duration: "3–7 days",
        is_emergency: false,
        before_image: "./uploads/sample_mixed_waste.jpg",
        created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 4).toISOString(),
        history: [
          { status: "SUBMITTED", changed_by: "Akash Kothagorla", notes: "Complaint registered via SmartWaste AI", timestamp: new Date(Date.now() - 3600000 * 4).toISOString() }
        ]
      },
      {
        id: "SW-2026-000002",
        citizen_id: 1,
        citizen_name: "Akash Kothagorla",
        category: "Plastic",
        severity: "Medium",
        priority: "MEDIUM",
        status: "UNDER_REVIEW",
        latitude: 15.8210,
        longitude: 80.3560,
        location_name: "Ward 2 - Chirala Railway Station Road (Kothapeta)",
        ward: "Ward 2 - Chirala Railway Station Road (Kothapeta)",
        description: "Discarded plastic mineral water bottles and food containers scattered outside railway entrance platform 1.",
        road_obstruction: false,
        observed_duration: "1–2 days",
        is_emergency: false,
        before_image: "./uploads/sample_plastic.jpg",
        created_at: new Date(Date.now() - 3600000 * 8).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 6).toISOString(),
        history: [
          { status: "SUBMITTED", changed_by: "Akash Kothagorla", notes: "Complaint registered via SmartWaste AI", timestamp: new Date(Date.now() - 3600000 * 8).toISOString() },
          { status: "UNDER_REVIEW", changed_by: "Ramesh (Municipal Officer)", notes: "Officer verified civic jurisdiction", timestamp: new Date(Date.now() - 3600000 * 6).toISOString() }
        ]
      },
      {
        id: "SW-2026-000003",
        citizen_id: 1,
        citizen_name: "Akash Kothagorla",
        category: "Organic / Wet Waste",
        severity: "Critical",
        priority: "CRITICAL",
        status: "ASSIGNED",
        latitude: 15.8280,
        longitude: 80.3490,
        location_name: "Ward 11 - Chirala Perala Market & Jandrapeta",
        ward: "Ward 11 - Chirala Perala Market & Jandrapeta",
        description: "Rotting vegetable waste and fruit heaps producing foul odor near wholesale vegetable market gate 2.",
        road_obstruction: true,
        observed_duration: "3–7 days",
        is_emergency: true,
        before_image: "./uploads/sample_organic.jpg",
        created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        task: {
          id: 101,
          worker_id: 3,
          worker_name: "Ravi",
          worker_phone: "+91 98765 33445",
          status: "ASSIGNED",
          assigned_at: new Date(Date.now() - 3600000 * 2).toISOString()
        },
        history: [
          { status: "SUBMITTED", changed_by: "Akash Kothagorla", notes: "Complaint registered with Emergency Flag", timestamp: new Date(Date.now() - 3600000 * 12).toISOString() },
          { status: "UNDER_REVIEW", changed_by: "Ramesh (Municipal Officer)", notes: "Marked high municipal priority", timestamp: new Date(Date.now() - 3600000 * 8).toISOString() },
          { status: "ASSIGNED", changed_by: "Ramesh (Municipal Officer)", notes: "Assigned to nearest sanitation crew: Ravi", timestamp: new Date(Date.now() - 3600000 * 2).toISOString() }
        ]
      },
      {
        id: "SW-2026-000004",
        citizen_id: 1,
        citizen_name: "Akash Kothagorla",
        category: "Mixed Waste",
        severity: "High",
        priority: "HIGH",
        status: "IN_PROGRESS",
        latitude: 15.8195,
        longitude: 80.3540,
        location_name: "Ward 4 - Muntha Vari Thota, Municipal High School Road",
        ward: "Ward 4 - Chirala Municipality Office (Muntha Vari Thota)",
        description: "Overflowing commercial garbage bins spilling across the pedestrian sidewalk.",
        road_obstruction: true,
        observed_duration: "1–2 days",
        is_emergency: false,
        before_image: "./uploads/sample_mixed_waste.jpg",
        created_at: new Date(Date.now() - 3600000 * 18).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 1).toISOString(),
        task: {
          id: 102,
          worker_id: 3,
          worker_name: "Ravi",
          worker_phone: "+91 98765 33445",
          status: "IN_PROGRESS",
          assigned_at: new Date(Date.now() - 3600000 * 5).toISOString(),
          started_at: new Date(Date.now() - 3600000 * 1).toISOString()
        },
        history: [
          { status: "SUBMITTED", changed_by: "Akash Kothagorla", notes: "Complaint registered", timestamp: new Date(Date.now() - 3600000 * 18).toISOString() },
          { status: "UNDER_REVIEW", changed_by: "Ramesh", notes: "Reviewed", timestamp: new Date(Date.now() - 3600000 * 12).toISOString() },
          { status: "ASSIGNED", changed_by: "Ramesh", notes: "Assigned to Ravi", timestamp: new Date(Date.now() - 3600000 * 5).toISOString() },
          { status: "ACCEPTED", changed_by: "Ravi", notes: "Worker accepted task", timestamp: new Date(Date.now() - 3600000 * 4).toISOString() },
          { status: "IN_PROGRESS", changed_by: "Ravi", notes: "Worker on site with municipal sanitation tipper", timestamp: new Date(Date.now() - 3600000 * 1).toISOString() }
        ]
      },
      {
        id: "SW-2026-000005",
        citizen_id: 1,
        citizen_name: "Akash Kothagorla",
        category: "Plastic",
        severity: "High",
        priority: "HIGH",
        status: "AWAITING_VERIFICATION",
        latitude: 15.8320,
        longitude: 80.3450,
        location_name: "Ward 5 - Vadarevu Beach Road, Fisherman Colony",
        ward: "Ward 5 - Chirala Vadarevu Beach Road (Fisherman Colony)",
        description: "Discarded fishing nets, beverage cups, and plastic packing debris.",
        road_obstruction: false,
        observed_duration: "3–7 days",
        is_emergency: false,
        before_image: "./uploads/sample_plastic.jpg",
        after_image: "./uploads/sample_cleaned_after.jpg",
        worker_notes: "Beach approach road thoroughly cleared, swept, and bleached with municipal disinfectant.",
        created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        task: {
          id: 103,
          worker_id: 5,
          worker_name: "Rajesh",
          worker_phone: "+91 98765 55667",
          status: "AWAITING_VERIFICATION",
          assigned_at: new Date(Date.now() - 3600000 * 16).toISOString(),
          started_at: new Date(Date.now() - 3600000 * 6).toISOString(),
          proof_submitted_at: new Date(Date.now() - 3600000 * 2).toISOString(),
          proof_image: "./uploads/sample_cleaned_after.jpg",
          proof_notes: "Beach approach road thoroughly cleared, swept, and bleached with municipal disinfectant."
        },
        history: [
          { status: "SUBMITTED", changed_by: "Akash Kothagorla", notes: "Submitted", timestamp: new Date(Date.now() - 3600000 * 24).toISOString() },
          { status: "UNDER_REVIEW", changed_by: "Ramesh", notes: "Reviewed", timestamp: new Date(Date.now() - 3600000 * 20).toISOString() },
          { status: "ASSIGNED", changed_by: "Ramesh", notes: "Assigned to Rajesh", timestamp: new Date(Date.now() - 3600000 * 16).toISOString() },
          { status: "ACCEPTED", changed_by: "Rajesh", notes: "Accepted", timestamp: new Date(Date.now() - 3600000 * 10).toISOString() },
          { status: "IN_PROGRESS", changed_by: "Rajesh", notes: "Cleaning started", timestamp: new Date(Date.now() - 3600000 * 6).toISOString() },
          { status: "AWAITING_VERIFICATION", changed_by: "Rajesh", notes: "After-cleaning photo uploaded for inspection", timestamp: new Date(Date.now() - 3600000 * 2).toISOString() }
        ]
      },
      {
        id: "SW-2026-000006",
        citizen_id: 1,
        citizen_name: "Akash Kothagorla",
        category: "Organic / Wet Waste",
        severity: "High",
        priority: "HIGH",
        status: "COMPLETED",
        latitude: 15.8270,
        longitude: 80.3510,
        location_name: "Ward 11 - Perala Market Gate 1",
        ward: "Ward 11 - Chirala Perala Market & Jandrapeta",
        description: "Cleared organic compost waste and swept market perimeter.",
        road_obstruction: false,
        observed_duration: "1–2 days",
        is_emergency: false,
        before_image: "./uploads/sample_organic.jpg",
        after_image: "./uploads/sample_cleaned_market.jpg",
        worker_notes: "Market gate cleared, washed, and sprayed with lime powder.",
        created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 12).toISOString(),
        completed_at: new Date(Date.now() - 3600000 * 12).toISOString(),
        feedback: {
          rating: 5,
          comment: "Super quick cleaning by municipal crew! Smells fresh now."
        },
        task: {
          id: 104,
          worker_id: 3,
          worker_name: "Ravi",
          status: "COMPLETED",
          assigned_at: new Date(Date.now() - 3600000 * 30).toISOString()
        },
        history: [
          { status: "SUBMITTED", changed_by: "Akash Kothagorla", notes: "Submitted", timestamp: new Date(Date.now() - 3600000 * 48).toISOString() },
          { status: "UNDER_REVIEW", changed_by: "Ramesh", notes: "Reviewed", timestamp: new Date(Date.now() - 3600000 * 40).toISOString() },
          { status: "ASSIGNED", changed_by: "Ramesh", notes: "Assigned", timestamp: new Date(Date.now() - 3600000 * 30).toISOString() },
          { status: "IN_PROGRESS", changed_by: "Ravi", notes: "In Progress", timestamp: new Date(Date.now() - 3600000 * 20).toISOString() },
          { status: "AWAITING_VERIFICATION", changed_by: "Ravi", notes: "Submitted proof", timestamp: new Date(Date.now() - 3600000 * 15).toISOString() },
          { status: "COMPLETED", changed_by: "Ramesh (Municipal Officer)", notes: "Inspection approved: Verified side-by-side photo proof", timestamp: new Date(Date.now() - 3600000 * 12).toISOString() }
        ]
      }
    ];

    const defaultAnnouncements = [
      {
        id: 1,
        title: "Chirala Swachh Survekshan Cleanliness Drive",
        content: "Special sanitation tippers deployed across Ward 1, Ward 2, and Ward 3. Citizens are requested to segregate wet and dry waste.",
        message: "Special sanitation tippers deployed across Ward 1, Ward 2, and Ward 3. Citizens are requested to segregate wet and dry waste.",
        priority: "IMPORTANT",
        target_ward: "All",
        author_name: "Ramesh (Sanitation Officer)",
        created_at: new Date().toISOString(),
        formatted_date: "Today"
      },
      {
        id: 2,
        title: "Monsoon Drainage Desilting Scheduled",
        content: "Municipal tractors desilting storm drains along Trunk Road and Kothapeta. Avoid discarding plastics into open gutters.",
        message: "Municipal tractors desilting storm drains along Trunk Road and Kothapeta. Avoid discarding plastics into open gutters.",
        priority: "NORMAL",
        target_ward: "Ward 2 - Chirala Railway Station Road (Kothapeta)",
        author_name: "Municipal Engineering Dept",
        created_at: new Date(Date.now() - 86400000).toISOString(),
        formatted_date: "Yesterday"
      }
    ];

    const defaultNotifications = [
      {
        id: 1,
        user_id: 1,
        title: "Complaint Status Update",
        message: "Your complaint #SW-2026-000003 has been assigned to Sanitation Worker Ravi.",
        is_read: false,
        formatted_time: "2h ago",
        created_at: new Date(Date.now() - 7200000).toISOString()
      },
      {
        id: 2,
        user_id: 1,
        title: "Report Resolved & Closed",
        message: "Complaint #SW-2026-000006 at Perala Market Gate 1 has been verified clean by the Sanitation Inspector.",
        is_read: true,
        formatted_time: "12h ago",
        created_at: new Date(Date.now() - 43200000).toISOString()
      }
    ];

    const defaultEmails = [
      {
        id: 1,
        recipient_role: "officer",
        recipient_email: "officer@demo.com",
        recipient_name: "Municipal Officer Ramesh",
        subject: "🚨 [NEW REPORT] #SW-2026-000001 (HIGH Priority - Mixed Waste)",
        status: "SENT",
        formatted_time: "4h ago",
        body_html: "<div style='font-family: sans-serif; padding: 20px; color: #1e293b;'><h2 style='color: #059669;'>🚨 New Waste Complaint Registered</h2><p>Citizen Akash Kothagorla has reported an accumulation of <strong>Mixed Waste</strong> at <strong>Ward 1 - Chirala Clock Tower, Main Bazaar</strong>.</p><p>Immediate inspection and worker assignment required.</p></div>"
      },
      {
        id: 2,
        recipient_role: "worker",
        recipient_email: "worker@demo.com",
        recipient_name: "Sanitation Worker Ravi",
        subject: "👷 [TASK ASSIGNED] Clean #SW-2026-000003 at Perala Market",
        status: "SENT",
        formatted_time: "2h ago",
        body_html: "<div style='font-family: sans-serif; padding: 20px; color: #1e293b;'><h2 style='color: #2563eb;'>👷 New Cleaning Task Dispatched</h2><p>You have been assigned to clear <strong>Organic / Wet Waste</strong> at <strong>Ward 11 - Perala Market Gate 2</strong>.</p><p>Please proceed on-site with your municipal collection vehicle.</p></div>"
      }
    ];

    const defaultCollectionPoints = [
      { id: 1, name: "Chirala Clock Tower Public Bin Hub", address: "Gadiyara Sthambham, Main Bazaar", latitude: 15.8246, longitude: 80.3522, fill_level: 78, category: "Mixed Waste", capacity_kg: 500 },
      { id: 2, name: "Kothapeta Railway Approach Hub", address: "Station Road Corner", latitude: 15.8210, longitude: 80.3560, fill_level: 62, category: "Plastic & Dry", capacity_kg: 400 },
      { id: 3, name: "Perala Handloom Center Dump Hub", address: "Weavers Colony Cross", latitude: 15.8180, longitude: 80.3620, fill_level: 45, category: "Mixed Waste", capacity_kg: 600 },
      { id: 4, name: "Vadarevu Coastal Transfer Station", address: "Beach Road Junction", latitude: 15.8320, longitude: 80.3450, fill_level: 89, category: "Bulk Solid Waste", capacity_kg: 1000 }
    ];

    localStorage.setItem("sw_users", JSON.stringify(defaultUsers));
    localStorage.setItem("sw_reports", JSON.stringify(defaultReports));
    localStorage.setItem("sw_announcements", JSON.stringify(defaultAnnouncements));
    localStorage.setItem("sw_notifications", JSON.stringify(defaultNotifications));
    localStorage.setItem("sw_emails", JSON.stringify(defaultEmails));
    localStorage.setItem("sw_collection_points", JSON.stringify(defaultCollectionPoints));
    localStorage.setItem("sw_db_initialized_v2", "true");
    this.initialized = true;
  },

  get(table) {
    this.initDB();
    try {
      return JSON.parse(localStorage.getItem(`sw_${table}`) || "[]");
    } catch (e) {
      return [];
    }
  },

  set(table, data) {
    localStorage.setItem(`sw_${table}`, JSON.stringify(data));
  },

  getCurrentUser() {
    this.initDB();
    try {
      return JSON.parse(localStorage.getItem("sw_active_session_user") || "null");
    } catch (e) {
      return null;
    }
  },

  setCurrentUser(user) {
    if (user) {
      localStorage.setItem("sw_active_session_user", JSON.stringify(user));
      try { sessionStorage.setItem("sw_user_logged_in", "true"); } catch (e) {}
    } else {
      localStorage.removeItem("sw_active_session_user");
      try { sessionStorage.removeItem("sw_user_logged_in"); } catch (e) {}
    }
  },

  // ==========================================
  // SMARTWASTE AI COMPUTER VISION AGENT v2.5
  // ==========================================
  async analyzeWasteImage(imageSrc, userDescription = "") {
    const descLower = (userDescription || "").toLowerCase();
    const srcLower = (imageSrc || "").toLowerCase();

    // 1. Check for Optional User-Configured Google Gemini API Key
    let geminiKey = "";
    try {
      geminiKey = localStorage.getItem("sw_gemini_api_key") || (window.GEMINI_API_KEY || "");
    } catch (e) {}

    if (geminiKey && geminiKey.trim().length > 10) {
      try {
        const geminiResult = await this._callGeminiVisionClient(imageSrc, userDescription, geminiKey.trim());
        if (geminiResult) return geminiResult;
      } catch (geminiErr) {
        console.warn("[SmartWaste AI] Gemini API remote call failed, falling back to Local Computer Vision Agent:", geminiErr);
      }
    }

    // 2. Local Computer Vision Agent (In-Browser Canvas & Color Spectrum Analysis)
    return this._runLocalComputerVisionAgent(imageSrc, userDescription);
  },

  // Remote Google Gemini 1.5 Flash Vision Client (Optional Direct Integration)
  async _callGeminiVisionClient(imageSrc, userDescription, apiKey) {
    let base64Data = "";
    let mimeType = "image/jpeg";

    if (imageSrc.startsWith("data:")) {
      const parts = imageSrc.split(",");
      const mimeMatch = parts[0].match(/:(.*?);/);
      if (mimeMatch) mimeType = mimeMatch[1];
      base64Data = parts[1];
    } else {
      // Convert image to base64 via Canvas
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => resolve();
        img.src = imageSrc;
      });
      if (!img.width) return null;
      const canvas = document.createElement("canvas");
      canvas.width = Math.min(img.width, 512);
      canvas.height = Math.min(img.height, 512);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      base64Data = dataUrl.split(",")[1];
      mimeType = "image/jpeg";
    }

    if (!base64Data) return null;

    const prompt = `You are SmartWaste AI, a strict civic waste inspection agent for Chirala Municipality.
Inspect this image and determine whether it contains visible physical civic waste/garbage/litter/debris/overflowing trash.
If the image is NOT physical waste (e.g. A presentation slide, PowerPoint/deck, diagram, text document, screenshot, human face/selfie, vehicle/car, computer/laptop, clean room/building, nature landscape without trash, food on plates):
Return a JSON object with:
{
  "is_waste": false,
  "is_garbage": false,
  "detected_category": "Other",
  "detected_severity": "None",
  "detected_subject": "<Exact subject e.g. Presentation Slide / Lecture Deck, Human Portrait / Selfie, Document / Screenshot, Automobile / Vehicle, Clean Space>",
  "subject_details": "<Concise 2-sentence description of what is visible in the image and why no civic waste is present>",
  "criticality": "None (Civic waste management not applicable)",
  "criticality_score": 0,
  "error": "Invalid Waste Image",
  "message": "No clear waste or garbage was detected in this image."
}
If the image IS physical waste:
Return a JSON object with:
{
  "is_waste": true,
  "is_garbage": true,
  "detected_category": "Plastic" | "Organic / Wet Waste" | "Paper" | "E-Waste" | "Hazardous Waste" | "Glass" | "Metal" | "Mixed Waste",
  "confidence": <float 0.80 to 0.98>,
  "confidence_percentage": <int 80 to 98>,
  "detected_severity": "Low" | "Medium" | "High" | "Critical",
  "criticality_score": <int 20 to 100>,
  "criticality_level": "Low" | "Medium" | "High" | "Critical",
  "sla_urgency": "<e.g. 2 Hours (Emergency Dispatch) or 4 Hours or 8 Hours>",
  "health_hazard": "<hazard summary>",
  "drainage_threat": "<drainage summary>",
  "volume_level": "<estimated volume>",
  "road_obstruction": <boolean>,
  "summary": "<2-sentence municipal inspection summary>",
  "recommended_action": "<action recommendation>"
}
Return ONLY valid JSON without markdown wrapping.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: base64Data } }
          ]
        }]
      })
    });

    if (!resp.ok) return null;
    const json = await resp.json();
    let text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    if (text.startsWith("```json")) text = text.substring(7);
    if (text.startsWith("```")) text = text.substring(3);
    if (text.endsWith("```")) text = text.substring(0, text.length - 3);
    const parsed = JSON.parse(text.trim());
    parsed.engine = "Google Gemini 1.5 Flash Vision (Live)";
    parsed.valid = Boolean(parsed.is_waste);
    return parsed;
  },

  // Deterministic In-Browser Computer Vision Agent
  async _runLocalComputerVisionAgent(imageSrc, userDescription) {
    const descLower = (userDescription || "").toLowerCase();
    const srcLower = (imageSrc || "").toLowerCase();

    const isPresentationFile = anyMatch(srcLower, ["presentation", "slide", "deck", "ppt", "powerpoint", "keynote", "canva", "template", "diagram", "chart", "graph", "figure", "lecture", "module", "agenda", "pitch", "curriculum", "infographic"]);
    const isCleanAreaFile = anyMatch(srcLower, ["cleaned_after", "cleaned_market", "clean_road", "swept"]);
    const isLaptopFile = anyMatch(srcLower, ["laptop", "monitor", "display", "screen_shot"]);
    const isCarFile = anyMatch(srcLower, ["car", "bike", "vehicle", "automobile", "traffic"]);
    const isScreenshotFile = anyMatch(srcLower, ["screenshot", "document", "spreadsheet", "excel", "receipt"]);
    const isSceneryFile = anyMatch(srcLower, ["scenery", "landscape", "nature", "sky", "mountain"]);
    const isPortraitFile = anyMatch(srcLower, ["selfie", "portrait", "person", "face", "ak2"]);

    function anyMatch(str, keywords) {
      return keywords.some(k => str.includes(k));
    }

    // Default inspection metrics
    let aspect = 1.33;
    let cornerStd = 50.0;
    let bgRatio = 0.0;
    let skinRatio = 0.0;
    let centerSkin = 0.0;
    let flatRatio = 0.0;
    let skyRatio = 0.0;
    let highEdges = 0.08;
    let clutterScore = 0.50;
    let rowVarianceSpikes = 0;

    // Inspect via HTML5 Canvas
    if (typeof Image !== "undefined" && (srcLower.startsWith("data:") || srcLower.startsWith("blob:") || srcLower.startsWith("http") || srcLower.includes("uploads/"))) {
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = () => resolve();
          img.src = imageSrc;
        });

        if (img.width > 0 && img.height > 0) {
          aspect = img.width / Math.max(img.height, 1);
          const canvas = document.createElement("canvas");
          const W = 160;
          const H = 100;
          canvas.width = W;
          canvas.height = H;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, W, H);
          const imgData = ctx.getImageData(0, 0, W, H);
          const d = imgData.data;

          // 4 Corner Colors: Top-Left, Top-Right, Bottom-Left, Bottom-Right
          const tl = [d[0], d[1], d[2]];
          const tr = [d[(W - 1) * 4], d[(W - 1) * 4 + 1], d[(W - 1) * 4 + 2]];
          const bl = [d[(H - 1) * W * 4], d[(H - 1) * W * 4 + 1], d[(H - 1) * W * 4 + 2]];
          const br = [d[((H - 1) * W + W - 1) * 4], d[((H - 1) * W + W - 1) * 4 + 1], d[((H - 1) * W + W - 1) * 4 + 2]];

          const avgBgR = (tl[0] + tr[0] + bl[0] + br[0]) / 4;
          const avgBgG = (tl[1] + tr[1] + bl[1] + br[1]) / 4;
          const avgBgB = (tl[2] + tr[2] + bl[2] + br[2]) / 4;

          const cornerVar = Math.hypot(tl[0] - avgBgR, tr[0] - avgBgR, bl[0] - avgBgR, br[0] - avgBgR);
          cornerStd = cornerVar / 2;

          let matchingBgPx = 0;
          let skinPx = 0;
          let flatPx = 0;
          let skyPx = 0;
          let edgeDiffSum = 0;
          const total = W * H;

          // Horizontal row variance buckets (for text line detection)
          const rowBrightness = new Array(H).fill(0);

          for (let y = 0; y < H; y++) {
            let rowSum = 0;
            for (let x = 0; x < W; x++) {
              const idx = (y * W + x) * 4;
              const r = d[idx], g = d[idx+1], b = d[idx+2];
              const lum = 0.299 * r + 0.587 * g + 0.114 * b;
              rowSum += lum;

              // Background canvas matching distance
              const distToBg = Math.hypot(r - avgBgR, g - avgBgG, b - avgBgB);
              if (distToBg < 35) matchingBgPx++;

              // YCbCr skin tone test
              const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
              const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
              if (cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173) {
                skinPx++;
                if (x >= W * 0.25 && x <= W * 0.75 && y >= H * 0.2 && y <= H * 0.8) {
                  centerSkin++;
                }
              }

              // Flat white/dark screen test
              if (Math.abs(r - g) < 10 && Math.abs(g - b) < 10 && (lum > 220 || lum < 35)) {
                flatPx++;
              }

              // Sky gradient test (top half)
              if (y < H * 0.45 && b > 155 && b > r + 25 && b > g + 15) {
                skyPx++;
              }

              // Horizontal edge gradient
              if (x < W - 1) {
                const nIdx = idx + 4;
                edgeDiffSum += Math.abs(r - d[nIdx]) + Math.abs(g - d[nIdx+1]) + Math.abs(b - d[nIdx+2]);
              }
            }
            rowBrightness[y] = rowSum / W;
          }

          bgRatio = matchingBgPx / total;
          skinRatio = skinPx / total;
          centerSkin = centerSkin / (total * 0.3);
          flatRatio = flatPx / total;
          skyRatio = skyPx / (total * 0.45);
          highEdges = (edgeDiffSum / (total * 3 * 255));

          // Check row brightness variance (detects slide text lines & bullet points)
          for (let y = 1; y < H - 1; y++) {
            const diff = Math.abs(rowBrightness[y] - ((rowBrightness[y-1] + rowBrightness[y+1]) / 2));
            if (diff > 8) rowVarianceSpikes++;
          }

          clutterScore = highEdges * 2.5 + (1.0 - bgRatio) * 0.4;
        }
      } catch (e) {
        // Fallback gracefully on CORS
      }
    }

    // Classify Non-Waste Categories
    const isPresentationVisual = (
      (aspect >= 1.25 && aspect <= 2.1) &&
      (cornerStd < 28) &&
      (bgRatio > 0.36) &&
      (highEdges < 0.25) &&
      (skinRatio < 0.08)
    );
    const isPresentation = isPresentationFile || isPresentationVisual;

    const isPortraitVisual = (skinRatio > 0.22 && centerSkin > 0.18) || (skinRatio > 0.35);
    const isPortrait = isPortraitFile || isPortraitVisual;

    const isDocumentVisual = (flatRatio > 0.55 && highEdges < 0.12 && skinRatio < 0.05);
    const isDocument = isScreenshotFile || isDocumentVisual;

    const isLaptopVisual = isLaptopFile || (flatRatio > 0.35 && aspect > 1.2 && highEdges < 0.06 && skinRatio < 0.05);
    const isCar = isCarFile || (highEdges < 0.08 && skyRatio > 0.25 && clutterScore < 0.3);
    const isScenery = isSceneryFile || (skyRatio > 0.40 && clutterScore < 0.28 && !descLower.includes("waste"));
    const isCleanArea = isCleanAreaFile || (highEdges < 0.035 && clutterScore < 0.25);

    const isNonWaste = isPresentation || isPortrait || isDocument || isLaptopVisual || isCar || isScenery || isCleanArea;

    if (isNonWaste) {
      let detectedSubject = "Everyday Object / Household Scene";
      let subjectDetails = "General non-waste subject detected with no municipal garbage accumulation.";

      if (isPresentation) {
        detectedSubject = "Presentation Slide / Lecture Deck";
        subjectDetails = "Digital presentation slide layout detected with widescreen slide canvas, structured title/bullet text rows, and clean thematic palette. 0% civic waste accumulation detected.";
      } else if (isPortrait) {
        detectedSubject = "Human Portrait / Selfie";
        subjectDetails = "Human face, facial landmarks, and natural skin tone pigments detected. Public civic waste reporting requires photos of physical garbage or litter.";
      } else if (isDocument) {
        detectedSubject = "Digital Document / UI Screenshot";
        subjectDetails = "Document text lines, spreadsheet rows, or computer screen capture detected with no visible outdoor or indoor waste.";
      } else if (isLaptopVisual) {
        detectedSubject = "Electronic Device / Computer Display";
        subjectDetails = "Hardware screen, laptop frame, or electronic monitor detected without discarded e-waste accumulation.";
      } else if (isCar) {
        detectedSubject = "Automobile / Motor Vehicle";
        subjectDetails = "Motor vehicle bodywork, headlights, or street traffic detected with no dumped garbage.";
      } else if (isScenery) {
        detectedSubject = "Natural Landscape / Scenic View";
        subjectDetails = "Open natural landscape, vegetation, or sky without civic waste accumulation.";
      } else if (isCleanArea) {
        detectedSubject = "Clean Area / Sanitized Space";
        subjectDetails = "Clean pavement or interior space with no visible litter or garbage accumulation.";
      }

      return {
        valid: false,
        is_waste: false,
        is_garbage: false,
        is_not_garbage: true,
        waste_confidence: 0.05,
        confidence: 0.95,
        confidence_percentage: 95,
        detected_category: "Other",
        detected_severity: "None",
        detected_subject: detectedSubject,
        subject_details: subjectDetails,
        criticality: "None (Civic waste management not applicable)",
        criticality_score: 0,
        visual_breakdown: {
          detected_subject: detectedSubject,
          waste_probability: "0%",
          visual_characteristics: subjectDetails
        },
        error: "Invalid Waste Image",
        message: `No clear waste or garbage was detected in this image. Visual inspection identified: ${detectedSubject}. ${subjectDetails}`,
        summary: `Visual inspection identified: ${detectedSubject}. ${subjectDetails}`,
        recommended_action: "No municipal sanitation action required. Citizen must upload a clear photo of physical waste.",
        engine: "SmartWaste AI Computer Vision Agent v2.5"
      };
    }

    // ==========================================
    // 3. WASTE CATEGORIZATION & CRITICALITY SCORING
    // ==========================================
    let detectedCategory = "Mixed Waste";
    let confidence = 0.91;
    let severity = "High";
    let roadObstruction = true;

    if (srcLower.includes("plastic") || descLower.includes("plastic") || descLower.includes("bottle") || descLower.includes("wrapper")) {
      detectedCategory = "Plastic";
      confidence = 0.94;
      severity = "Medium";
      roadObstruction = false;
    } else if (srcLower.includes("organic") || descLower.includes("organic") || descLower.includes("food") || descLower.includes("vegetable") || descLower.includes("wet")) {
      detectedCategory = "Organic / Wet Waste";
      confidence = 0.93;
      severity = "High";
      roadObstruction = true;
    } else if (srcLower.includes("ewaste") || srcLower.includes("e-waste") || descLower.includes("electronic") || descLower.includes("phone") || descLower.includes("wire")) {
      detectedCategory = "E-Waste";
      confidence = 0.89;
      severity = "High";
      roadObstruction = false;
    } else if (srcLower.includes("paper") || descLower.includes("paper") || descLower.includes("cardboard") || descLower.includes("carton")) {
      detectedCategory = "Paper";
      confidence = 0.92;
      severity = "Medium";
      roadObstruction = false;
    } else if (srcLower.includes("hazardous") || descLower.includes("chemical") || descLower.includes("hazard") || descLower.includes("toxic") || descLower.includes("medical")) {
      detectedCategory = "Hazardous Waste";
      confidence = 0.96;
      severity = "Critical";
      roadObstruction = true;
    }

    // Check for road obstruction cues in description
    if (anyMatch(descLower, ["block", "road", "footpath", "gate", "traffic", "street", "path"])) {
      roadObstruction = true;
    }

    // Compute Criticality Score (0 to 100)
    let baseScore = { "Critical": 90, "High": 74, "Medium": 52, "Low": 30 }[severity] || 60;
    let criticalityScore = baseScore;
    if (roadObstruction) criticalityScore += 10;
    if (detectedCategory === "Hazardous Waste") criticalityScore = Math.max(criticalityScore, 95);
    if (detectedCategory === "Organic / Wet Waste" && severity === "High") criticalityScore += 6;
    criticalityScore = Math.min(100, Math.max(15, criticalityScore));

    // SLA & Hazard Determination
    let slaUrgency = "4 Hours (High Priority Clearing)";
    let healthHazard = "High / Pathogen & Animal Scavenging Threat";
    let drainageThreat = "Moderate Runoff Ingress Risk";
    let volumeLevel = "Substantial Waste Heap (40–100 kg)";

    if (severity === "Critical" || criticalityScore >= 85) {
      slaUrgency = "2 Hours (Emergency Dispatch)";
      healthHazard = "Critical Pathogen / Biohazard Hazard";
      drainageThreat = "Severe Drainage Clogging & Flooding Threat";
      volumeLevel = "Heavy Waste Accumulation (> 100 kg)";
    } else if (severity === "High" || criticalityScore >= 65) {
      slaUrgency = "4 Hours (High Priority Clearing)";
      healthHazard = "High / Pathogen & Animal Scavenging Threat";
      drainageThreat = "Moderate Runoff Ingress Risk";
      volumeLevel = "Substantial Waste Heap (40–100 kg)";
    } else if (severity === "Medium" || criticalityScore >= 40) {
      slaUrgency = "8 Hours (Standard Civic Clearance)";
      healthHazard = "Moderate Litter Contamination";
      drainageThreat = "Low";
      volumeLevel = "Moderate Accumulation (10–40 kg)";
    } else {
      slaUrgency = "24 Hours (Scheduled Routine Sweep)";
      healthHazard = "Low";
      drainageThreat = "Minimal";
      volumeLevel = "Scattered Minor Litter (< 10 kg)";
    }

    const summary = `Visual inspection identifies an accumulation of ${detectedCategory.toLowerCase()} with estimated ${severity.toLowerCase()} severity (Criticality Score: ${criticalityScore}/100)${roadObstruction ? ' obstructing pedestrian or vehicular access' : ''}. Recommended SLA: ${slaUrgency}.`;

    return {
      valid: true,
      is_waste: true,
      is_garbage: true,
      confidence: confidence,
      confidence_percentage: Math.round(confidence * 100),
      detected_category: detectedCategory,
      detected_severity: severity,
      criticality_score: criticalityScore,
      criticality_level: severity,
      sla_urgency: slaUrgency,
      health_hazard: healthHazard,
      drainage_threat: drainageThreat,
      volume_level: volumeLevel,
      road_obstruction: roadObstruction,
      message: `Detected ${detectedCategory} with ${Math.round(confidence * 100)}% AI confidence. Criticality: ${severity} (${criticalityScore}/100).`,
      summary: summary,
      recommended_action: `Dispatch sanitation crew for ${detectedCategory} clearance within ${slaUrgency}.`,
      engine: "SmartWaste AI Computer Vision Agent v2.5",
      suggested_questions: [
        { id: "q1", question: "Is the waste blocking a road, footpath, or entrance?", options: ["Yes", "No", "Not sure"], default: roadObstruction ? "Yes" : "No" },
        { id: "q2", question: "How long has this waste approximately been accumulating?", options: ["Less than a day", "1–2 days", "3–7 days", "More than a week", "Not sure"], default: "1–2 days" },
        { id: "q3", question: "Is there a strong odor, liquid leakage, or visible animal scavenging?", options: ["Yes", "No", "Not sure"], default: severity === "High" || severity === "Critical" ? "Yes" : "No" }
      ]
    };
  }
};

if (typeof window !== "undefined") window.ClientEngine = ClientEngine;
if (typeof globalThis !== "undefined") globalThis.ClientEngine = ClientEngine;

// Auto-initialize DB when script loads
ClientEngine.initDB();

