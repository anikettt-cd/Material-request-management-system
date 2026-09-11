# backend/utils/audit.py

def generate_diff(old_data: dict, new_data: dict) -> dict:
    """
    Compares two dictionaries and returns a JSON-friendly diff of what changed.
    Ignores fields that weren't updated.
    """
    diff = {}
    
    for key, new_value in new_data.items():
        # 🎯 Updated: Skipping additional internal tracking fields
        if key in ["id", "request_id", "created_at", "status", "current_stage"]:
            continue
            
        old_value = old_data.get(key)
        
        # If the value changed, log the old vs new state
        if old_value != new_value:
            diff[key] = {
                "old": old_value or "Empty",
                "new": new_value or "Empty"
            }
            
    return diff