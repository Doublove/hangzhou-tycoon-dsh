# -*- coding: utf-8 -*-
"""用 Git Data API 推送当前仓库快照（父提交 = 远端 HEAD，force=false）。"""
import base64, json, os, subprocess, time, urllib.error, urllib.request

REPO = "Doublove/hangzhou-tycoon-dsh"
BRANCH = "main"
ROOT = os.path.dirname(os.path.abspath(__file__))
TOKEN = os.environ["GITHUB_TOKEN"]
API = "https://api.github.com"


def call(method, path, body=None, tries=4):
    data = json.dumps(body).encode() if body is not None else None
    for i in range(tries):
        req = urllib.request.Request(API + path, method=method, data=data, headers={
            "Authorization": f"Bearer {TOKEN}", "User-Agent": "hz-dsh-push",
            "Accept": "application/vnd.github+json", "Content-Type": "application/json",
            "Connection": "close"})
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                return r.status, json.load(r)
        except urllib.error.HTTPError as e:
            raw = e.read().decode(errors="replace")
            if e.code in (500, 502, 503, 504) and i < tries - 1:
                time.sleep(1.5 * (i + 1)); continue
            raise SystemExit(f"API {method} {path} -> {e.code}\n{raw[:300]}")
        except Exception as e:
            if i < tries - 1:
                time.sleep(1.5 * (i + 1)); continue
            raise SystemExit(f"API {method} {path} 失败：{type(e).__name__}: {e}")


def git(*a):
    return subprocess.run(["git", *a], cwd=ROOT, capture_output=True,
                          encoding="utf-8", errors="replace").stdout


tree_local = git("write-tree").strip()
entries = []
for line in git("ls-tree", "-r", "-z", "HEAD").split("\0"):
    if line:
        meta, path = line.split("\t", 1)
        mode, _, sha = meta.split()
        entries.append((mode, sha, path))
print(f"本地 tree {tree_local[:8]}，文件 {len(entries)} 个")

blob = {}
for mode, sha, path in entries:
    content = subprocess.run(["git", "cat-file", "blob", sha], cwd=ROOT,
                             capture_output=True, check=True).stdout
    _, d = call("POST", f"/repos/{REPO}/git/blobs",
                {"content": base64.b64encode(content).decode(), "encoding": "base64"})
    blob[path] = d["sha"]
    time.sleep(0.1)


def build(dirpath):
    prefix = (dirpath + "/") if dirpath else ""
    kids = {}
    for mode, sha, path in entries:
        if not path.startswith(prefix):
            continue
        rest = path[len(prefix):]
        if "/" in rest:
            kids.setdefault(rest.split("/")[0], None)
        else:
            kids[rest] = (mode, blob[path])
    payload = []
    for name, info in kids.items():
        if info is None:
            sub = build(prefix + name)
            payload.append({"path": name, "mode": "040000", "type": "tree", "sha": sub})
        else:
            payload.append({"path": name, "mode": info[0], "type": "blob", "sha": info[1]})
    _, d = call("POST", f"/repos/{REPO}/git/trees", {"tree": payload})
    print(f"  tree '{dirpath or '.'}' -> {d['sha'][:8]}")
    return d["sha"]


expect = git("rev-parse", HEAD := "HEAD").strip() and tree_local
tree_remote = build("")
assert tree_remote == tree_local, f"tree 不一致：{tree_remote} vs {tree_local}"
print("tree 与本地一致 ✓")

_, ref = call("GET", f"/repos/{REPO}/git/ref/heads/{BRANCH}")
parent = ref["object"]["sha"]
msg = git("log", "-1", "--pretty=%B").rstrip()
_, commit = call("POST", f"/repos/{REPO}/git/commits",
                 {"message": msg, "tree": tree_remote, "parents": [parent]})
_, d = call("PATCH", f"/repos/{REPO}/git/refs/heads/{BRANCH}",
            {"sha": commit["sha"], "force": False})
print(f"推送完成 {commit['sha'][:8]}（父 {parent[:8]}）")
_, back = call("GET", f"/repos/{REPO}/git/commits/{commit['sha']}")
print("回读 tree 一致:", back["tree"]["sha"] == tree_local)
