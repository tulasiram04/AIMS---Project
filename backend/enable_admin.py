import sqlite3

db_path = "inventory_db.db"
conn = sqlite3.connect(db_path)
cur = conn.cursor()
cur.execute("UPDATE users SET is_active = 1, status = 'Enabled' WHERE username = 'admin'")
conn.commit()
conn.close()
print("Admin account successfully enabled!")
