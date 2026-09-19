// SmartWaste Real Map Engine (Multi-layer Google Maps, Satellite, and Carto)
const MapService = {
  instances: {},

  // Configure Leaflet default icons
  setupLeafletIcons() {
    if (typeof L !== "undefined" && L.Icon && L.Icon.Default) {
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png"
      });
    }
  },

  createPinIcon(color = "#059669") {
    if (typeof L === "undefined") return null;
    return L.divIcon({
      className: "sw-custom-pin",
      html: `
        <div style="position: relative; width: 34px; height: 42px; transform: translate(-50%, -100%);">
          <svg width="34" height="42" viewBox="0 0 34 42" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M17 0C7.611 0 0 7.611 0 17C0 29.75 17 42 17 42C17 42 34 29.75 34 17C34 7.611 26.389 0 17 0Z" fill="${color}"/>
            <circle cx="17" cy="17" r="7" fill="white"/>
            <circle cx="17" cy="17" r="4" fill="${color}"/>
          </svg>
          <div style="position: absolute; bottom: 0; left: 50%; transform: translate(-50%, 50%); width: 14px; height: 6px; background: rgba(0,0,0,0.3); border-radius: 50%; filter: blur(2px);"></div>
        </div>
      `,
      iconSize: [34, 42],
      iconAnchor: [17, 42],
      popupAnchor: [0, -40]
    });
  },

  initMap(containerId, options = {}) {
    this.setupLeafletIcons();
    const defaultCenter = [options.lat || 15.8246, options.lng || 80.3522];
    const zoom = options.zoom || 14;

    if (this.instances[containerId]) {
      try {
        this.instances[containerId].remove();
      } catch (e) {
        console.warn("Error removing previous map instance:", e);
      }
      delete this.instances[containerId];
    }

    const container = document.getElementById(containerId);
    if (!container) return null;

    // Fallback if Leaflet isn't loaded
    if (typeof L === "undefined") {
      container.innerHTML = `
        <div class="p-4 text-center text-muted bg-light rounded d-flex flex-column align-items-center justify-content-center h-100">
          <p class="mb-1"><strong>📍 Live Coordinates Pinned</strong></p>
          <span class="badge bg-secondary mb-2">${defaultCenter[0].toFixed(6)}, ${defaultCenter[1].toFixed(6)}</span>
          <small class="text-muted">Interactive map loading...</small>
        </div>
      `;
      return null;
    }

    try {
      const map = L.map(containerId, {
        zoomControl: true,
        scrollWheelZoom: true
      }).setView(defaultCenter, zoom);

      // Real Map Base Layers
      const googleStreets = L.tileLayer("https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
        maxZoom: 20,
        subdomains: ["mt0", "mt1", "mt2", "mt3"],
        attribution: "&copy; Google Maps"
      });

      const googleSatelliteHybrid = L.tileLayer("https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", {
        maxZoom: 20,
        subdomains: ["mt0", "mt1", "mt2", "mt3"],
        attribution: "&copy; Google Satellite Imagery"
      });

      const cartoVoyager = L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
        subdomains: "abcd",
        attribution: "&copy; CARTO & OpenStreetMap"
      });

      const osmStandard = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
      });

      // Add default layer (Google Streets)
      googleStreets.addTo(map);

      // Add layer switcher control if not explicitly disabled
      if (options.showLayerControl !== false) {
        L.control.layers({
          "🗺️ Street Map": googleStreets,
          "🛰️ Satellite Hybrid": googleSatelliteHybrid,
          "🏙️ Carto Detail": cartoVoyager,
          "🌍 OpenStreetMap": osmStandard
        }, null, { position: "topright" }).addTo(map);
      }

      this.instances[containerId] = map;

      // Ensure proper sizing after modal or container opens
      const triggerResize = () => {
        if (map && map.invalidateSize) {
          map.invalidateSize();
        }
      };
      setTimeout(triggerResize, 100);
      setTimeout(triggerResize, 300);
      setTimeout(triggerResize, 600);

      window.addEventListener("resize", triggerResize);

      return map;
    } catch (e) {
      console.warn("Leaflet map initialization warning:", e);
      return null;
    }
  },

  addDraggableMarker(map, lat, lng, onPositionChange) {
    if (!map || typeof L === "undefined") return null;

    const pinIcon = this.createPinIcon("#059669");
    const marker = L.marker([lat, lng], {
      draggable: true,
      icon: pinIcon
    }).addTo(map);

    marker.bindPopup("<strong>📍 Selected Waste Location</strong><br>Drag pin or click map to move.").openPopup();

    marker.on("dragend", (event) => {
      const position = event.target.getLatLng();
      if (onPositionChange) onPositionChange(position.lat, position.lng);
    });

    // Support clicking anywhere on map to reposition pin
    map.on("click", (e) => {
      marker.setLatLng(e.latlng);
      marker.openPopup();
      if (onPositionChange) onPositionChange(e.latlng.lat, e.latlng.lng);
    });

    return marker;
  },

  async reverseGeocode(lat, lng) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
      const response = await fetch(url, {
        headers: { "Accept": "application/json" }
      });
      if (response.ok) {
        const data = await response.json();
        if (data && data.display_name) {
          const addr = data.address || {};
          const road = addr.road || addr.pedestrian || addr.street || addr.neighbourhood || addr.suburb || "";
          const area = addr.suburb || addr.neighbourhood || addr.city_district || addr.quarter || "";
          const city = addr.city || addr.town || addr.municipality || addr.state_district || "";

          const parts = [road, area, city].filter(Boolean);
          const shortName = parts.length > 0 ? parts.join(", ") : data.display_name.split(",").slice(0, 3).join(", ");
          return {
            displayName: data.display_name,
            shortName: shortName || data.display_name
          };
        }
      }
    } catch (e) {
      console.warn("Reverse geocode network fallback:", e);
    }

    return {
      displayName: `Pinned Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      shortName: `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`
    };
  },

  async searchAddress(query) {
    if (!query || query.trim().length < 2) return [];
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query.trim())}&limit=5&addressdetails=1`;
      const response = await fetch(url, {
        headers: { "Accept": "application/json" }
      });
      if (response.ok) {
        const data = await response.json();
        return (data || []).map(item => ({
          displayName: item.display_name,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon)
        }));
      }
    } catch (e) {
      console.warn("Search address fallback:", e);
    }
    return [];
  },

  getLivePosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by your browser"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        }),
        err => reject(err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  },

  renderReports(map, reports, onReportClick) {
    if (!map || typeof L === "undefined" || !reports) return;

    reports.forEach(r => {
      if (!r.latitude || !r.longitude) return;

      const markerColor = {
        "CRITICAL": "#ef4444",
        "HIGH": "#f97316",
        "MEDIUM": "#0284c7",
        "LOW": "#64748b"
      }[r.priority] || "#059669";

      const circle = L.circleMarker([r.latitude, r.longitude], {
        radius: 8,
        fillColor: markerColor,
        color: "#ffffff",
        weight: 2,
        opacity: 1,
        fillOpacity: 0.85
      }).addTo(map);

      const popupContent = `
        <div style="font-size: 12px; min-width: 150px;">
          <strong>${r.id}</strong><br/>
          <span style="color:${markerColor}; font-weight:bold;">${r.priority}</span> • ${r.category}<br/>
          <em>${r.status}</em><br/>
          <small>${r.location_name || ""}</small>
        </div>
      `;
      circle.bindPopup(popupContent);

      if (onReportClick) {
        circle.on("click", () => onReportClick(r));
      }
    });
  },

  renderCollectionPoints(map, points) {
    if (!map || typeof L === "undefined" || !points) return;

    points.forEach(p => {
      if (!p.latitude || !p.longitude) return;

      const isOverflowing = p.status === "OVERFLOWING";
      const iconHtml = `<div style="background:${isOverflowing ? '#ef4444' : '#10b981'}; width:24px; height:24px; border-radius:50%; border:2px solid white; display:flex; align-items:center; justify-content:center; color:white; font-size:12px; font-weight:bold; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">♻</div>`;

      const customIcon = L.divIcon({
        className: "custom-bin-marker",
        html: iconHtml,
        iconSize: [24, 24]
      });

      const marker = L.marker([p.latitude, p.longitude], { icon: customIcon }).addTo(map);
      marker.bindPopup(`
        <div style="font-size: 12px;">
          <strong>${p.name}</strong><br/>
          <span>Status: <b>${p.status}</b> (${p.current_level_pct}% Full)</span><br/>
          <small>${p.address}</small>
        </div>
      `);
    });
  },

  renderRoutePolyline(map, stops) {
    if (!map || typeof L === "undefined" || !stops || stops.length < 2) return;

    const latlngs = stops.map(s => [s.latitude, s.longitude]);
    const polyline = L.polyline(latlngs, {
      color: "#059669",
      weight: 5,
      opacity: 0.85,
      dashArray: "8, 8"
    }).addTo(map);

    // Place stop markers
    stops.forEach((s, idx) => {
      const isDepot = s.type && s.type.includes("DEPOT");
      const stopIcon = L.divIcon({
        className: "route-stop-icon",
        html: `<div style="background:${isDepot ? '#0f172a' : '#059669'}; color:white; border-radius:50%; width:22px; height:22px; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:bold; border:2px solid white;">${s.step || (idx + 1)}</div>`,
        iconSize: [22, 22]
      });
      L.marker([s.latitude, s.longitude], { icon: stopIcon }).addTo(map)
        .bindPopup(`<strong>Stop ${s.step || (idx + 1)}: ${s.title || s.location_name}</strong><br>${s.type || ''}`);
    });

    map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
    return polyline;
  }
};
