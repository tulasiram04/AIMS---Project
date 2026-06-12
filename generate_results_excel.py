import os
import csv
import json
import pandas as pd
from difflib import SequenceMatcher

project_dir = r"d:\The Good Doctor S1\AI-Powered-Multi-Agent-Inventory-Reconciliation-System-main\AI-Powered-Multi-Agent-Inventory-Reconciliation-System-main\Project"
demo_dir = os.path.join(project_dir, "demo_data")
cmdb_dir = os.path.join(demo_dir, "cmdb")
live_dir = os.path.join(demo_dir, "live")
result_dir = os.path.join(demo_dir, "result")

os.makedirs(result_dir, exist_ok=True)

excel_path = os.path.join(result_dir, "reconciliation_results.xlsx")

def normalize_string(s):
    return str(s).strip().lower().replace("_", " ").replace("-", " ")

# Setup Excel writer
with pd.ExcelWriter(excel_path, engine="openpyxl") as writer:
    # We will also create a summary sheet
    summary_rows = []
    
    for i in range(1, 11):
        csv_file_name = f"cmdb_baseline_{i:02d}.csv"
        json_file_name = f"live_scan_{i:02d}.json"
        
        csv_path = os.path.join(cmdb_dir, csv_file_name)
        json_path = os.path.join(live_dir, json_file_name)
        
        # Load CSV records
        csv_records = []
        if os.path.exists(csv_path):
            with open(csv_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                csv_records = list(reader)
                
        # Load JSON records
        json_records = []
        if os.path.exists(json_path):
            with open(json_path, "r", encoding="utf-8") as f:
                json_records = json.load(f)
                
        csv_by_id = {r["asset_id"]: r for r in csv_records}
        json_by_id = {r["asset_id"]: r for r in json_records}
        
        discrepancies = []
        
        # 1. Check CSV assets
        for csv_asset in csv_records:
            cid = csv_asset["asset_id"]
            cname = csv_asset["asset_name"]
            
            if cid in json_by_id:
                json_asset = json_by_id[cid]
                jname = json_asset["asset_name"]
                
                # Check config mismatches
                mismatches = []
                compare_fields = ["location", "status", "os", "environment", "cpu", "memory"]
                for field in compare_fields:
                    csv_val = csv_asset.get(field)
                    json_val = json_asset.get(field)
                    if csv_val is not None and json_val is not None:
                        if str(csv_val).strip().lower() != str(json_val).strip().lower():
                            mismatches.append((field, csv_val, json_val))
                
                if mismatches:
                    fields_str = ", ".join(m for m, _, _ in mismatches)
                    csv_vals_str = ", ".join(f"{m}={v}" for m, v, _ in mismatches)
                    json_vals_str = ", ".join(f"{m}={v}" for m, _, v in mismatches)
                    discrepancies.append({
                        "Asset ID": cid,
                        "Discrepancy Type": "CONFIG_MISMATCH",
                        "CSV Asset Name": cname,
                        "JSON Asset Name": jname,
                        "Severity": "MEDIUM",
                        "Details": f"Configuration mismatch on fields: {fields_str}",
                        "CSV Value": csv_vals_str,
                        "JSON Value": json_vals_str,
                        "Recommended Action": "Standardize host configurations via automation templates"
                    })
                
                # Check naming mismatch
                if normalize_string(cname) != normalize_string(jname):
                    discrepancies.append({
                        "Asset ID": cid,
                        "Discrepancy Type": "NAMING_MISMATCH",
                        "CSV Asset Name": cname,
                        "JSON Asset Name": jname,
                        "Severity": "LOW",
                        "Details": f"Name mismatch: CMDB Name='{cname}' vs Live Scan Name='{jname}'",
                        "CSV Value": cname,
                        "JSON Value": jname,
                        "Recommended Action": "Align hostname identifiers on registry database"
                    })
            else:
                # Missing Asset
                discrepancies.append({
                    "Asset ID": cid,
                    "Discrepancy Type": "MISSING_ASSET",
                    "CSV Asset Name": cname,
                    "JSON Asset Name": "— (Not Found)",
                    "Severity": "HIGH",
                    "Details": f"Asset '{cid}' registered in CMDB but not detected in live scan",
                    "CSV Value": str(csv_asset),
                    "JSON Value": "—",
                    "Recommended Action": "Verify host online status or run scan ping manually"
                })
                
        # 2. Check Untracked Assets (in JSON but not CSV)
        for json_asset in json_records:
            jid = json_asset["asset_id"]
            jname = json_asset["asset_name"]
            
            if jid not in csv_by_id:
                discrepancies.append({
                    "Asset ID": jid,
                    "Discrepancy Type": "UNTRACKED_ASSET",
                    "CSV Asset Name": "— (Not Registered)",
                    "JSON Asset Name": jname,
                    "Severity": "MEDIUM",
                    "Details": f"Active asset '{jid}' discovered on network scan but missing in CMDB",
                    "CSV Value": "—",
                    "JSON Value": str(json_asset),
                    "Recommended Action": "Register discovered host into CMDB registry"
                })
                
        # Convert discrepancies to DataFrame and save to worksheet
        df = pd.DataFrame(discrepancies)
        if df.empty:
            df = pd.DataFrame(columns=["Asset ID", "Discrepancy Type", "CSV Asset Name", "JSON Asset Name", "Severity", "Details", "CSV Value", "JSON Value", "Recommended Action"])
            
        sheet_name = f"Pair {i}"
        df.to_excel(writer, sheet_name=sheet_name, index=False)
        
        # Add to summary page
        missing_count = sum(1 for d in discrepancies if d["Discrepancy Type"] == "MISSING_ASSET")
        untracked_count = sum(1 for d in discrepancies if d["Discrepancy Type"] == "UNTRACKED_ASSET")
        config_count = sum(1 for d in discrepancies if d["Discrepancy Type"] == "CONFIG_MISMATCH")
        naming_count = sum(1 for d in discrepancies if d["Discrepancy Type"] == "NAMING_MISMATCH")
        
        total_csv = len(csv_records)
        total_json = len(json_records)
        
        # Matching accuracy index
        matched_healthy = max(0, total_csv - missing_count - config_count - naming_count)
        accuracy = round((matched_healthy / total_csv) * 100) if total_csv > 0 else 100
        
        summary_rows.append({
            "Pair Sheet": sheet_name,
            "CMDB File": csv_file_name,
            "Live Scan File": json_file_name,
            "Total CMDB Assets": total_csv,
            "Total Live Assets": total_json,
            "Missing Assets": missing_count,
            "Untracked Assets": untracked_count,
            "Config Mismatches": config_count,
            "Naming Mismatches": naming_count,
            "Total Drifts/Discrepancies": len(discrepancies),
            "Match Accuracy Rate (%)": f"{accuracy}%"
        })
        
    # Write summary sheet
    summary_df = pd.DataFrame(summary_rows)
    summary_df.to_excel(writer, sheet_name="Overview Summary", index=False)

print(f"Success! Generated Excel results sheet at:\n{excel_path}")
