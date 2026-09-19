import math
from backend.services.duplicate_detector import haversine_distance

def generate_collection_route(start_lat: float, start_lng: float, tasks: list, vehicle_type: str = "Standard Waste Truck"):
    """
    Generates an optimized route sequence using Nearest Neighbor heuristic.
    tasks: list of dicts with {id, report_id, latitude, longitude, category, priority, location_name}
    """
    if not tasks:
        return {
            "route_id": "RT-000",
            "stops": [],
            "total_distance_km": 0.0,
            "estimated_duration_mins": 0,
            "vehicle_type": vehicle_type
        }

    current_lat = start_lat
    current_lng = start_lng
    unvisited = list(tasks)
    ordered_stops = []
    total_distance_meters = 0.0

    # Start depot
    ordered_stops.append({
        "step": 0,
        "type": "START_DEPOT",
        "title": "Municipal Sanitation Depot",
        "latitude": start_lat,
        "longitude": start_lng,
        "distance_from_prev_m": 0
    })

    step = 1
    while unvisited:
        # Find closest unvisited task
        closest_idx = 0
        min_dist = float("inf")
        for i, t in enumerate(unvisited):
            dist = haversine_distance(current_lat, current_lng, t["latitude"], t["longitude"])
            # Give high/critical priority slightly higher proximity pull
            prio = t.get("priority", "MEDIUM")
            if prio == "CRITICAL":
                dist *= 0.75
            elif prio == "HIGH":
                dist *= 0.85

            if dist < min_dist:
                min_dist = dist
                closest_idx = i

        chosen = unvisited.pop(closest_idx)
        actual_dist = haversine_distance(current_lat, current_lng, chosen["latitude"], chosen["longitude"])
        total_distance_meters += actual_dist
        current_lat = chosen["latitude"]
        current_lng = chosen["longitude"]

        chosen_copy = dict(chosen)
        chosen_copy["step"] = step
        chosen_copy["type"] = "TASK_STOP"
        chosen_copy["distance_from_prev_m"] = round(actual_dist)
        ordered_stops.append(chosen_copy)
        step += 1

    # Return to depot
    return_dist = haversine_distance(current_lat, current_lng, start_lat, start_lng)
    total_distance_meters += return_dist
    ordered_stops.append({
        "step": step,
        "type": "END_DEPOT",
        "title": "Return to Depot / Waste Processing Facility",
        "latitude": start_lat,
        "longitude": start_lng,
        "distance_from_prev_m": round(return_dist)
    })

    total_km = round(total_distance_meters / 1000.0, 2)
    # Average municipal truck speed ~25 km/h + 15 mins per waste collection stop
    driving_minutes = (total_km / 25.0) * 60
    collection_minutes = len(tasks) * 15
    total_duration_minutes = round(driving_minutes + collection_minutes)

    import time
    route_id = f"RT-{int(time.time()) % 100000:05d}"

    return {
        "route_id": route_id,
        "stops": ordered_stops,
        "task_count": len(tasks),
        "total_distance_km": total_km,
        "estimated_duration_mins": total_duration_minutes,
        "vehicle_type": vehicle_type
    }
