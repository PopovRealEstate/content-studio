"""B-roll catalog (clean segments of YOUR clips, seconds in the 30fps proxies) and the per-reel shot picker.

How to fill it in:
1. Make 1080x1920 30fps H.264 proxies of the clips you want and put them in public/clips/ (see the
   vertical-reel-craft skill for the ffmpeg command).
2. Watch every second of each clip. Leave out any span that shows third-party branding (signs, bags,
   doormats, uniforms), other people's faces, plates, or anything you do not have permission to use.
   Record what you left out below, so the next person does not put it back.
3. Add one tuple per clean span: (clip name without extension, start seconds, end seconds, pool tag).
   The pool tag groups clips by subject. A reel's `pool=[...]` in reels.py picks which groups it draws from.

Left out on purpose (add your own notes):
  - (none yet)
"""

SEGMENTS = [
    # ("kitchen", 0.3, 6.5, "broll"),
    # ("living", 0.3, 8.0, "broll"),
]


def pick_shots(n, spec, tl):
    """One shot per beat, two for long beats (motorsport cuts faster). Rotates through the pool by reel id so
    neighbouring reels open on different clips; never repeats a segment inside a reel; mirrors every other reuse."""
    pools = spec.get("pool", ["home"])
    by_tag = {t: [s for s in SEGMENTS if s[3] == t] for t in pools}
    fast = spec["style"] == "motorsport"
    split_at = 3.4 if fast else 5.0
    slots = []
    for b in tl["beats"]:
        t0, t1 = b["t0"], b["t1"]
        if t1 - t0 > split_at * 1.6:
            k = 3 if fast and t1 - t0 > split_at * 2.6 else 2
            for j in range(k):
                slots.append(t0 + (t1 - t0) * j / k)
        else:
            slots.append(t0)
    shots, used = [], set()
    for i, at in enumerate(slots):
        dur = (slots[i + 1] if i + 1 < len(slots) else tl["total"]) - at + 0.3
        tag = pools[i % len(pools)]
        cands = by_tag[tag]
        for k in range(len(cands)):
            seg = cands[(n * 5 + i * 3 + k) % len(cands)]
            if (seg[0], seg[1]) not in used and seg[2] - seg[1] >= min(dur, 4.0):
                break
        used.add((seg[0], seg[1]))
        room = max(0.0, seg[2] - seg[1] - dur)
        start = seg[1] + (((n * 1.7 + i * 2.3) % 1.0) * room if room > 0 else 0)
        shots.append({"at": round(at, 3), "clip": seg[0], "from": round(start, 2), "flip": (n + i) % 3 == 0 and seg[3] == "home",  # never mirror cars/garages (logos, plates)
                      "rate": 1.0 if seg[2] - start >= dur else round(max(0.5, (seg[2] - start) / dur), 3)})
    return shots
