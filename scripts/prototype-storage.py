"""SQLite user profiles. Sensitive fields arrive encrypted from Node."""
import sys, json, sqlite3, pathlib
if len(sys.argv)>1 and sys.argv[1]=='pdf':
    import fitz
    data=sys.stdin.buffer.read(8_000_001)
    if len(data)>8_000_000: raise ValueError('PDF demasiado grande')
    with fitz.open(stream=data,filetype='pdf') as pdf:
        if len(pdf)>40: raise ValueError('Demasiadas páginas')
        pages=[page.get_text(sort=True) for page in pdf]
        print(json.dumps({'text':'\n'.join(pages)[:100000],'pages':len(pages),'sparsePages':sum(len(t.strip())<200 for t in pages),'imagePages':sum(bool(page.get_images()) for page in pdf)},ensure_ascii=False))
    sys.exit(0)
request=json.load(sys.stdin)
db_path=pathlib.Path(__file__).resolve().parent.parent/'.wrangler'/'prototype-plicas.sqlite'
db_path.parent.mkdir(exist_ok=True)
with sqlite3.connect(db_path,timeout=10) as db:
    db.row_factory=sqlite3.Row
    db.execute('PRAGMA secure_delete=ON')
    db.execute('CREATE TABLE IF NOT EXISTS local_plica_profiles(owner TEXT PRIMARY KEY,encrypted_sensitive TEXT NOT NULL,includeAi INTEGER NOT NULL DEFAULT 0,aiStatement TEXT NOT NULL DEFAULT "",signatureDate TEXT NOT NULL DEFAULT "",updatedAt TEXT DEFAULT CURRENT_TIMESTAMP)')
    legacy=bool(db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='local_plicas'").fetchone())
    def old_rows(): return [dict(row) for row in db.execute('SELECT * FROM local_plicas ORDER BY owner,updatedAt DESC,contest_key')]
    if request['operation']=='status':
        print(json.dumps({'legacy':legacy,'rows':old_rows() if legacy else [],'profiles':[dict(row) for row in db.execute('SELECT * FROM local_plica_profiles')]},ensure_ascii=False))
    elif request['operation']=='migrate':
        if not legacy: raise ValueError('La base ya fue migrada')
        db.execute('BEGIN IMMEDIATE')
        if old_rows()!=request['expected']: raise ValueError('La base cambió durante la migración')
        for row in request['rows']:
            db.execute('INSERT INTO local_plica_profiles(owner,encrypted_sensitive,includeAi,aiStatement,signatureDate,updatedAt) VALUES(?,?,?,?,?,?) ON CONFLICT(owner) DO NOTHING',(row['owner'],row['encrypted_sensitive'],row['includeAi'],row['aiStatement'],row['signatureDate'],row['updatedAt']))
        db.execute('DROP TABLE local_plicas')
        db.commit()
        db.execute('VACUUM')
        print(json.dumps({'ok':True,'migrated':len(request['rows'])}))
    else:
        if legacy: raise ValueError('La base requiere migración')
        owner=request['owner']
        if request['operation']=='put':
            envelope=json.loads(request['encryptedSensitive'])
            if envelope.get('version')!=1 or not envelope.get('iv') or not envelope.get('ciphertext'): raise ValueError('Cifrado requerido')
            db.execute('INSERT INTO local_plica_profiles(owner,encrypted_sensitive,includeAi,aiStatement,signatureDate) VALUES(?,?,?,?,?) ON CONFLICT(owner) DO UPDATE SET encrypted_sensitive=excluded.encrypted_sensitive,includeAi=excluded.includeAi,aiStatement=excluded.aiStatement,signatureDate=excluded.signatureDate,updatedAt=CURRENT_TIMESTAMP',(owner,request['encryptedSensitive'],request['includeAi'],request['aiStatement'],request['signatureDate']))
        row=db.execute('SELECT * FROM local_plica_profiles WHERE owner=?',(owner,)).fetchone()
        print(json.dumps({'ok':True,'row':dict(row) if row else None},ensure_ascii=False))
