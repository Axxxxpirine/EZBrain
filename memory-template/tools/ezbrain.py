#!/usr/bin/env python3
"""EZBrain helper for agents. Standard library only.

Usage (from anywhere):
  python3 ~/EZBrain/tools/ezbrain.py check
  python3 .../ezbrain.py find --domain gamedev --tag ocr --status active
  python3 .../ezbrain.py find --text "binarisation"
  python3 .../ezbrain.py backlinks domains/gamedev/stack/tesseract-js.md
  python3 .../ezbrain.py tags [--domain gamedev]
"""
import argparse
import os
import re
import sys
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NOTE_DIRS = ("domains", "general", "me", "inbox")
SKIP_LINK_CHECK = ("PROTOCOL.md",)
REQUIRED = ("type", "domain", "status")
LINK_RE = re.compile(r"\[[^\]]*\]\(([^)\s]+)\)")
FENCE_RE = re.compile(r"```.*?```", re.S)
CODE_RE = re.compile(r"`[^`\n]*`")


def rel(path):
    return os.path.relpath(path, ROOT)


def all_md():
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if not d.startswith(".")]
        for f in files:
            if f.endswith(".md"):
                yield os.path.join(base, f)


def is_note(path):
    r = rel(path)
    return r.split(os.sep)[0] in NOTE_DIRS and os.path.basename(r) not in ("INDEX.md", "README.md")


def parse_frontmatter(text):
    if not text.startswith("---\n"):
        return {}
    end = text.find("\n---", 4)
    if end == -1:
        return {}
    meta = {}
    for line in text[4:end].splitlines():
        m = re.match(r"^([A-Za-z_]+):\s*(.*?)\s*(#.*)?$", line)
        if not m:
            continue
        key, val = m.group(1), m.group(2)
        if val.startswith("[") and val.endswith("]"):
            val = [v.strip().strip("'\"") for v in val[1:-1].split(",") if v.strip()]
        meta[key] = val
    return meta


def title_of(text):
    m = re.search(r"^# (.+)$", text, re.M)
    return m.group(1).strip() if m else ""


def links_of(path, text):
    """Resolved local link targets (absolute paths), ignoring code and URLs."""
    clean = CODE_RE.sub("", FENCE_RE.sub("", text))
    out = []
    for target in LINK_RE.findall(clean):
        if re.match(r"^[a-z]+:", target) or target.startswith("#"):
            continue
        target = target.split("#", 1)[0]
        out.append(os.path.normpath(os.path.join(os.path.dirname(path), target)))
    return out


def load():
    notes = {}
    for p in all_md():
        with open(p, encoding="utf-8") as fh:
            text = fh.read()
        notes[p] = {"text": text, "meta": parse_frontmatter(text), "title": title_of(text)}
    return notes


def as_list(v):
    if v is None:
        return []
    return v if isinstance(v, list) else [v]


def cmd_check(_args):
    notes = load()
    incoming = defaultdict(set)
    problems = defaultdict(list)
    for p, n in notes.items():
        r = rel(p)
        for t in links_of(p, n["text"]):
            incoming[t].add(p)
            if not r.startswith(SKIP_LINK_CHECK) and not os.path.exists(t):
                problems["Liens cassés"].append(f"{r} -> {rel(t)}")
    tag_count = Counter()
    for p, n in notes.items():
        if not is_note(p):
            continue
        r, meta = rel(p), n["meta"]
        parts = r.split(os.sep)
        missing = [k for k in REQUIRED if k not in meta]
        if missing:
            problems["Frontmatter incomplet"].append(f"{r} (manque : {', '.join(missing)})")
        expected = parts[1] if parts[0] == "domains" else parts[0]
        if meta.get("domain") and meta["domain"] != expected:
            problems["Champ domain incohérent"].append(f"{r} (domain: {meta['domain']}, dossier : {expected})")
        if parts[0] == "domains":
            idx = os.path.join(ROOT, "domains", parts[1], "INDEX.md")
            if idx not in incoming[p]:
                problems["Absentes de l'INDEX du domaine"].append(r)
        if not incoming[p]:
            problems["Orphelines (aucun lien entrant)"].append(r)
        if meta.get("status") == "doubtful":
            problems["Notes douteuses à revérifier"].append(r)
        tag_count.update(as_list(meta.get("tags")))
    domains_dir = os.path.join(ROOT, "domains")
    for d in sorted(x for x in os.listdir(domains_dir) if os.path.isdir(os.path.join(domains_dir, x))):
        if not os.path.exists(os.path.join(ROOT, "domains", d, "INDEX.md")):
            problems["Domaines sans INDEX.md"].append(d)
    inbox = [rel(p) for p in notes if rel(p).startswith("inbox" + os.sep) and is_note(p)]
    if inbox:
        problems["Inbox à classer"] = inbox
    singles = sorted(t for t, c in tag_count.items() if c == 1)
    total = sum(1 for p in notes if is_note(p))
    print(f"EZBrain : {total} notes, {len(tag_count)} tags.")
    if not problems:
        print("Aucun problème détecté.")
    for section, items in problems.items():
        print(f"\n## {section} ({len(items)})")
        for i in items:
            print(f"- {i}")
    if singles:
        print(f"\n## Tags utilisés une seule fois (vérifier qu'un tag existant ne convient pas) ({len(singles)})")
        print(", ".join(singles))
    return 1 if any(k in problems for k in ("Liens cassés", "Frontmatter incomplet", "Champ domain incohérent")) else 0


def cmd_find(args):
    notes = load()
    hits = []
    for p, n in notes.items():
        if not is_note(p):
            continue
        meta, r = n["meta"], rel(p)
        if args.domain and meta.get("domain") != args.domain:
            continue
        if args.type and meta.get("type") != args.type:
            continue
        if args.status and meta.get("status") != args.status:
            continue
        if args.tag and args.tag not in as_list(meta.get("tags")):
            continue
        if args.stack and args.stack not in as_list(meta.get("stack")):
            continue
        if args.project and args.project not in as_list(meta.get("projects")):
            continue
        if args.text:
            hay = (n["text"] + " " + " ".join(as_list(meta.get("aliases")))).lower()
            if args.text.lower() not in hay:
                continue
        hits.append((r, n["title"], meta.get("status", "?"), meta.get("updated", "?")))
    for r, t, s, u in sorted(hits):
        print(f"{r} | {t} | {s} | {u}")
    if not hits:
        print("Aucun résultat.")


def cmd_backlinks(args):
    target = os.path.normpath(os.path.join(ROOT, args.path))
    if not os.path.exists(target):
        sys.exit(f"Fichier introuvable : {args.path}")
    notes = load()
    found = sorted(rel(p) for p, n in notes.items() if target in links_of(p, n["text"]))
    print("\n".join(found) if found else "Aucun lien entrant.")


def cmd_tags(args):
    notes = load()
    c = Counter()
    for p, n in notes.items():
        if is_note(p) and (not args.domain or n["meta"].get("domain") == args.domain):
            c.update(as_list(n["meta"].get("tags")))
    for t, k in sorted(c.items(), key=lambda x: (-x[1], x[0])):
        print(f"{k:3d}  {t}")



def main():
    ap = argparse.ArgumentParser(description="EZBrain helper")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("check", help="santé de la mémoire : liens, frontmatter, orphelines, index, inbox, tags")
    f = sub.add_parser("find", help="filtrer les notes par propriétés")
    for opt in ("domain", "type", "status", "tag", "stack", "project", "text"):
        f.add_argument(f"--{opt}")
    b = sub.add_parser("backlinks", help="notes qui pointent vers un fichier")
    b.add_argument("path", help="chemin relatif à EZBrain")
    t = sub.add_parser("tags", help="vocabulaire de tags existant")
    t.add_argument("--domain")
    args = ap.parse_args()
    sys.exit({"check": cmd_check, "find": cmd_find, "backlinks": cmd_backlinks,
              "tags": cmd_tags}[args.cmd](args) or 0)


if __name__ == "__main__":
    main()
