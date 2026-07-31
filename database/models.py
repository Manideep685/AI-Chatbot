from database.db import get_db


def _ensure_messages_email_column(cur):
    cur.execute("PRAGMA table_info(messages)")
    columns = [row["name"] for row in cur.fetchall()]

    if "email" not in columns:
        cur.execute("ALTER TABLE messages ADD COLUMN email TEXT")

    if "username" in columns:
        cur.execute("UPDATE messages SET email = username WHERE email IS NULL")


def create_tables():

    conn = get_db()
    cur = conn.cursor()

    # Users table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS users(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        password TEXT
    )
    """)

    # Messages table (chat history)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS messages(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT,
        role TEXT,
        content TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    _ensure_messages_email_column(cur)

    conn.commit()
    conn.close()


def create_default_user():

    conn = get_db()
    cur = conn.cursor()

    # Insert default user if not exists
    cur.execute(
        "INSERT OR IGNORE INTO users (email, password) VALUES (?, ?)",
        ("admin@gmail.com", "1234")
    )

    conn.commit()
    conn.close()
