from database.db import get_db

def save_message(email, role, content):

    conn = get_db()
    cur = conn.cursor()

    cur.execute(
        "INSERT INTO messages (email, role, content) VALUES (?, ?, ?)",
        (email, role, content)
    )

    conn.commit()
    conn.close()
