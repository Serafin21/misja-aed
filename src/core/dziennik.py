"""Accountability (docs/MODEL_ROL.md §9): event log (insert-only, enforced by DB triggers) and notifications to providers."""
from __future__ import annotations

from . import db
from .store import get_store, now_min


def zapisz(kto, operacja: str, obiekt: str | None = None, przed=None, po=None) -> None:
    """Log who did what on which object, with the state before and after."""
    st = get_store()
    login = getattr(kto, "login", None) or str(kto)
    rola = str(kto) if kto is not None else None
    st.conn.execute("INSERT INTO dziennik (czas, kto, rola, operacja, obiekt, przed, po) VALUES (?,?,?,?,?,?,?)",
                    (now_min(), login, rola, operacja, obiekt,
                     db.dumps(przed) if przed is not None else None, db.dumps(po) if po is not None else None))
    st.conn.commit()


def lista(limit: int = 200, obiekt: str | None = None) -> list[dict]:
    sql, args = "SELECT * FROM dziennik", ()
    if obiekt:
        sql, args = sql + " WHERE obiekt=?", (obiekt,)
    rows = get_store().conn.execute(sql + " ORDER BY id DESC LIMIT ?", args + (limit,)).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        for k in ("przed", "po"):
            d[k] = db.loads(d[k]) if d[k] else None
        out.append(d)
    return out


def powiadom(dostawca: str, typ: str, tresc: str, ref: str | None = None) -> bool:
    """Notification for a provider (prototype of the portal's comments/notifications). Same (typ, ref) only once."""
    st = get_store()
    cur = st.conn.execute("INSERT OR IGNORE INTO powiadomienia (dostawca, typ, tresc, ref, czas) VALUES (?,?,?,?,?)",
                          (dostawca, typ, tresc, ref, now_min()))
    st.conn.commit()
    return cur.rowcount > 0


def powiadomienia(dostawca: str) -> list[dict]:
    rows = get_store().conn.execute("SELECT * FROM powiadomienia WHERE lower(dostawca)=lower(?) ORDER BY id DESC",
                                    (dostawca,)).fetchall()
    return [dict(r) | {"przeczytane": bool(r["przeczytane"])} for r in rows]
