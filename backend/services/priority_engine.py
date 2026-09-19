import json

def calculate_priority(
    severity: str = "Medium",
    road_obstruction: bool = False,
    category: str = "Mixed Waste",
    observed_duration: str = None,
    description: str = "",
    nearby_reports_count: int = 0
) -> tuple[str, list[str]]:
    """
    Transparent rule-based priority engine.
    Returns (priority_level, reasons_list).
    Priority levels: LOW, MEDIUM, HIGH, CRITICAL
    """
    score = 0
    reasons = []

    # 1. Severity weight
    sev_upper = (severity or "Medium").upper()
    if sev_upper == "CRITICAL":
        score += 4
        reasons.append("Reported severity is Critical")
    elif sev_upper == "HIGH":
        score += 3
        reasons.append("High volume / large accumulation detected")
    elif sev_upper == "MEDIUM":
        score += 2
    else:
        score += 1

    # 2. Road Obstruction
    if road_obstruction:
        score += 3
        reasons.append("Road, footpath, or entrance is obstructed")

    # 3. Category sensitivity
    cat_lower = (category or "").lower()
    if "hazard" in cat_lower or "chemical" in cat_lower:
        score += 4
        reasons.append("Hazardous materials present immediate health hazard")
    elif "e-waste" in cat_lower or "electronic" in cat_lower:
        score += 2
        reasons.append("E-waste requires specialized handling")
    elif "organic" in cat_lower or "wet" in cat_lower:
        if observed_duration in ["3–7 days", "More than a week"]:
            score += 2
            reasons.append("Decomposing wet waste poses odor & disease risk")

    # 4. Observed Duration
    if observed_duration in ["More than a week", "> 1 week"]:
        score += 3
        reasons.append("Accumulated for more than a week without clearing")
    elif observed_duration in ["3–7 days", "3-7 days"]:
        score += 2
        reasons.append("Accumulated for 3 to 7 days")

    # 5. Repeated reports / accumulation
    if nearby_reports_count >= 2:
        score += 2
        reasons.append(f"Multiple ({nearby_reports_count}) complaints reported in close proximity")

    # 6. Description keywords
    desc_lower = (description or "").lower()
    if any(k in desc_lower for k in ["hospital", "school", "clinic", "market", "kindergarten"]):
        score += 2
        reasons.append("Located near sensitive public facility (school/hospital/market)")
    if any(k in desc_lower for k in ["leak", "sewage", "fire", "smoke", "toxic", "dog", "rat"]):
        score += 2
        reasons.append("Active leakage, biological vector or fire risk mentioned")

    # Score thresholding
    if score >= 8:
        priority = "CRITICAL"
    elif score >= 5:
        priority = "HIGH"
    elif score >= 3:
        priority = "MEDIUM"
    else:
        priority = "LOW"

    if not reasons:
        reasons.append("Standard priority based on category and baseline review")

    return priority, reasons
