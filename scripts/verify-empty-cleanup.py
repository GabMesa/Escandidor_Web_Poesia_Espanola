import sqlite3, json
from pathlib import Path
root = Path(__file__).resolve().parents[1]
db = sqlite3.connect(':memory:')
db.executescript((root/'schema.sql').read_text(encoding='utf-8'))
for name in ['poem_versions_require_content_insert','poem_versions_require_content_update','poems_require_title_insert','poems_require_title_update','poem_versions_skip_consecutive_duplicates']:
    db.execute(f'DROP TRIGGER {name}')
db.execute("INSERT INTO users(id,username,email) VALUES(1,'test','test@example.test')")
db.executemany('INSERT INTO poems(id,user_id,name) VALUES(?,1,?)', [(1,'Solo vacío'),(2,'Sin título'),(3,'Espacios Unicode')])
db.executemany('INSERT INTO poem_versions(poem_id,name,content,version) VALUES(?,?,?,?)', [(1,'v1','',1),(2,'v1','\t\n',1),(2,'v3','Un verso',3),(3,'v1','\u00a0\u2003\ufeff',1)])
db.execute('INSERT INTO deleted_poems(user_id,title,versions_json) VALUES(1,?,?)', ('Papelera',json.dumps([{'content':'\t'},{'content':'Conservar'}])))
db.executescript((root/'migrations/0012_remove_empty_poem_versions.sql').read_text(encoding='utf-8'))
assert db.execute('SELECT poem_id,version,content FROM poem_versions').fetchall() == [(2,3,'Un verso')]
assert db.execute('SELECT id,name FROM poems').fetchall() == [(2,'Sin título')]
assert db.execute('SELECT poem_id FROM deleted_poems WHERE poem_id IS NOT NULL ORDER BY poem_id').fetchall() == [(1,),(3,)]
assert json.loads(db.execute("SELECT versions_json FROM deleted_poems WHERE title='Papelera'").fetchone()[0]) == [{'content':'Conservar'}]
for title in ['', 'Sin título', ' SIN TITULO ', 'Sin  título']:
    try:
        db.execute('INSERT INTO poems(user_id,name) VALUES(1,?)',(title,))
        raise AssertionError('Se aceptó un título inválido')
    except sqlite3.IntegrityError:
        pass
for content in ['', ' \r\n\t', '\u00a0\u2003\ufeff']:
    try:
        db.execute('INSERT INTO poem_versions(poem_id,name,content,version) VALUES(2,?,?,4)',('invalid',content))
        raise AssertionError('Se aceptó contenido vacío')
    except sqlite3.IntegrityError:
        pass
db.execute("INSERT INTO poem_versions(poem_id,name,content,version) VALUES(2,'duplicate','Un verso\n',4)")
assert db.execute('SELECT COUNT(*) FROM poem_versions').fetchone()[0] == 1
db.execute("INSERT INTO poem_versions(poem_id,name,content,version) VALUES(2,'v4','Otro verso',4)")
db.execute("INSERT INTO poem_versions(poem_id,name,content,version) VALUES(2,'v5','Un verso',5)")
assert db.execute('SELECT COUNT(*) FROM poem_versions').fetchone()[0] == 3
print('PASS: empty cleanup, Unicode whitespace, archived copies, stable IDs/numbers, tombstones, title/content guards and consecutive duplicate guard.')
