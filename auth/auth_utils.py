from database.db import get_db


def create_user(email, password):

    conn = get_db()
    cur = conn.cursor()

    cur.execute(
        "INSERT INTO users(email, password) VALUES (?, ?)",
        (email, password)
    )

    conn.commit()
    conn.close()


def verify_user(email, password):

    conn = get_db()
    cur = conn.cursor()

    cur.execute(
        "SELECT * FROM users WHERE email=? AND password=?",
        (email, password)
    )

    user = cur.fetchone()

    conn.close()

    return user
