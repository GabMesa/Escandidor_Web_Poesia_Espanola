import json
import sqlite3
import sys
from pathlib import Path

count = 0
profile = None
for path in Path(sys.argv[1]).glob('*.sqlite'):
    connection = sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True)
    try:
        exists = connection.execute("SELECT 1 FROM sqlite_master WHERE name='user_plica_profiles'").fetchone()
        if exists:
            count += connection.execute('SELECT count(*) FROM user_plica_profiles').fetchone()[0]
            row = connection.execute('SELECT user_id,encrypted_sensitive FROM user_plica_profiles LIMIT 1').fetchone()
            if row:
                profile = {'owner': row[0], 'encrypted': row[1]}
    finally:
        connection.close()
print(json.dumps({'count': count, 'profile': profile}))
