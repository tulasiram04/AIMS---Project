import os
import csv
import json
import random

project_dir = r"d:\The Good Doctor S1\AI-Powered-Multi-Agent-Inventory-Reconciliation-System-main\AI-Powered-Multi-Agent-Inventory-Reconciliation-System-main\Project"
demo_dir = os.path.join(project_dir, "demo_data")
cmdb_dir = os.path.join(demo_dir, "cmdb")
live_dir = os.path.join(demo_dir, "live")

os.makedirs(cmdb_dir, exist_ok=True)
os.makedirs(live_dir, exist_ok=True)

# Define some random options to populate config data
os_list = ["Ubuntu 22.04 LTS", "RHEL 9.2", "Windows Server 2022", "Debian 12"]
env_list = ["Production", "Staging", "Development", "UAT"]
loc_list = ["US-East-1", "EU-West-1", "AP-South-1", "US-West-2"]
status_list = ["Active", "Decommissioned", "Pending", "Suspended"]

# Let's generate 10 pairs of files
for i in range(1, 11):
    csv_records = []
    json_records = []
    
    # Each pair of files will have:
    # - 6 matching assets (with some name/config drifts)
    # - 2 assets only in CMDB (Missing in Live)
    # - 2 assets only in Live (Untracked in CMDB)
    
    # 1. Generate baseline assets in CMDB
    # Match assets
    for j in range(1, 7):
        asset_id = f"srv-host-{i:02d}-{j:02d}"
        asset_name = f"App Host {i:02d} {j:02d}"
        asset_type = "Server" if j % 2 == 0 else "VM"
        os_choice = os_list[j % len(os_list)]
        env_choice = env_list[j % len(env_list)]
        loc_choice = loc_list[j % len(loc_list)]
        status_choice = "Active"
        
        csv_record = {
            "asset_id": asset_id,
            "asset_name": asset_name,
            "asset_type": asset_type,
            "location": loc_choice,
            "status": status_choice,
            "os": os_choice,
            "environment": env_choice,
            "cpu": f"{2 * j} Cores",
            "memory": f"{4 * j} GB"
        }
        csv_records.append(csv_record)
        
        # Live records matching:
        # File 1-10 will have specific discrepancies introduced:
        live_name = asset_name
        live_env = env_choice
        live_os = os_choice
        live_status = status_choice
        
        # Introduce Naming Mismatches on j=1 and j=2
        if j == 1:
            live_name = f"{asset_name} - Drifted Name"
        elif j == 2:
            live_name = f"{asset_name} (Updated)"
            
        # Introduce Config Mismatches on j=3 and j=4
        if j == 3:
            live_env = "Development" if env_choice != "Development" else "Production"
        elif j == 4:
            live_status = "Suspended"
            
        json_record = {
            "asset_id": asset_id,
            "asset_name": live_name,
            "asset_type": asset_type,
            "location": loc_choice,
            "status": live_status,
            "os": live_os,
            "environment": live_env,
            "cpu": f"{2 * j} Cores",
            "memory": f"{4 * j} GB"
        }
        json_records.append(json_record)
        
    # 2. Assets only in CMDB (Missing in Live)
    for j in range(7, 9):
        asset_id = f"srv-host-{i:02d}-{j:02d}"
        asset_name = f"App Host {i:02d} {j:02d} - Offline"
        asset_type = "VM"
        os_choice = os_list[j % len(os_list)]
        env_choice = env_list[j % len(env_list)]
        loc_choice = loc_list[j % len(loc_list)]
        status_choice = "Active"
        
        csv_record = {
            "asset_id": asset_id,
            "asset_name": asset_name,
            "asset_type": asset_type,
            "location": loc_choice,
            "status": status_choice,
            "os": os_choice,
            "environment": env_choice,
            "cpu": "2 Cores",
            "memory": "4 GB"
        }
        csv_records.append(csv_record)
        # Note: Do not add to json_records
        
    # 3. Assets only in Live (Untracked in CMDB)
    for j in range(9, 11):
        asset_id = f"srv-host-{i:02d}-{j:02d}"
        asset_name = f"App Host {i:02d} {j:02d} - Shadow IT"
        asset_type = "Server"
        os_choice = os_list[j % len(os_list)]
        env_choice = env_list[j % len(env_list)]
        loc_choice = loc_list[j % len(loc_list)]
        status_choice = "Active"
        
        json_record = {
            "asset_id": asset_id,
            "asset_name": asset_name,
            "asset_type": asset_type,
            "location": loc_choice,
            "status": status_choice,
            "os": os_choice,
            "environment": env_choice,
            "cpu": "4 Cores",
            "memory": "8 GB"
        }
        json_records.append(json_record)
        # Note: Do not add to csv_records
        
    # Shuffle lists to look realistic
    random.shuffle(csv_records)
    random.shuffle(json_records)
    
    # Write CSV
    csv_file_path = os.path.join(cmdb_dir, f"cmdb_baseline_{i:02d}.csv")
    with open(csv_file_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["asset_id", "asset_name", "asset_type", "location", "status", "os", "environment", "cpu", "memory"])
        writer.writeheader()
        writer.writerows(csv_records)
        
    # Write JSON
    json_file_path = os.path.join(live_dir, f"live_scan_{i:02d}.json")
    with open(json_file_path, "w", encoding="utf-8") as f:
        json.dump(json_records, f, indent=2)

print(f"Success! Generated 10 CSV baseline files and 10 JSON scan files under:\n{demo_dir}")
