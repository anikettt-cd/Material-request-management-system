from sqlalchemy.orm import Session

def get_recipient_emails(db: Session, role: str, plant_id: str = None, material_type: str = None):
    # Import inside the function to avoid circular import/reloading errors
    from backend.models import User
    
    # 🛠️ TRANSLATOR: Map workflow stage names to actual database role names
    if role == "GST_Audit":
        role = "GST"
    elif role == "IT_Approval":  
        role = "IT_Admin"
        
    print(f"DEBUG: Searching for Role: '{role}', Plant ID: '{plant_id}', Material Type: '{material_type}'")

    # 1. Fetch ALL users for the requested role
    users = db.query(User).filter(User.role == role).all()

    if not users:
        print("DEBUG: NO MATCH. Falling back to admin.")
        return ["admin@viraj.com"]

    # 🎯 2. THE USERNAME LOGIC: Route based on 'Mech' and 'Elec' in the username
    if role == "Material_Head" and material_type:
        if material_type == "ZEIS":
            # Electrical Items -> Find the user with "Elec" in their username
            matched = [u.email for u in users if "Elec" in u.username]
            if matched:
                print(f"DEBUG: Routed ZEIS to Electrical Head: {matched}")
                return matched
                
        elif material_type == "ZMIS":
            # Mechanical Items -> Find the user with "Mech" in their username
            matched = [u.email for u in users if "Mech" in u.username]
            if matched:
                print(f"DEBUG: Routed ZMIS to Mechanical Head: {matched}")
                return matched

    # 3. GLOBAL VS MULTI-PLANT LOGIC (For all other roles)
    global_roles = ["Material_Head", "GST", "Store", "IT_Admin"]

    if role in global_roles:
        print(f"DEBUG: '{role}' is a Global Role. Ignoring Plant ID.")
    else:
        # Fetch users in the role, then parse their assigned plants
        plant_users = []
        for u in users:
            if u.plant_id:
                # Converts "1000, 2000" into a clean list: ['1000', '2000']
                assigned_plants = [p.strip() for p in str(u.plant_id).split(",")]
                if str(plant_id) in assigned_plants:
                    plant_users.append(u)
        users = plant_users

    # 4. Return a LIST of emails, or fallback to admin
    if users:
        email_list = [user.email for user in users]
        print(f"DEBUG: Match found! Broadcasting to: {email_list}")
        return email_list
    else:
        print("DEBUG: NO MATCH. Falling back to admin.")
        return ["admin@viraj.com"]