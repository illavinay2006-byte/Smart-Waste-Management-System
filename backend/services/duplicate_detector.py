import math
from backend.models.report import WasteReport

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance between two points in meters.
    """
    R = 6371000  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def find_possible_duplicates(latitude: float, longitude: float, category: str = None, radius_meters: float = 250.0):
    """
    Find unresolved reports within radius_meters.
    Unresolved means status not in ['COMPLETED', 'REJECTED'].
    """
    unresolved = WasteReport.query.filter(
        WasteReport.status.notin_(["COMPLETED", "REJECTED"])
    ).all()

    duplicates = []
    for rep in unresolved:
        dist = haversine_distance(latitude, longitude, rep.latitude, rep.longitude)
        if dist <= radius_meters:
            duplicates.append({
                "id": rep.id,
                "category": rep.category,
                "status": rep.status,
                "priority": rep.priority,
                "location_name": rep.location_name,
                "distance_meters": int(dist),
                "created_at": rep.created_at.isoformat() if rep.created_at else None
            })

    duplicates.sort(key=lambda x: x["distance_meters"])
    return duplicates
