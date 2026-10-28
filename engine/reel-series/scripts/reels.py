"""Your Reel series: scripts (spoken or read-along lines) + beat specs, one entry per reel.

Lines are spoken by your cloned voice (numbers spelled as spoken), or read along on screen for silent
Reels. Beats reference cue strings:
  "c"            start of line c
  "c:word"       first Whisper word in line c matching `word` (case/punct-insensitive; number words match digits)
  "c:word#2"     second match;  "c:word+0.3" offset in seconds
Text markup in on-screen strings: *accent*, \n line break.
Beat types: hero, list, vs, quote, cta. Styles: luxury, motorsport, notes (see src/styles/).

Add a reel = add one dict below, then:  python3 scripts/tts.py N   (or skip for silent)
                                         python3 scripts/build.py N   (or build_silent.py N)
Keep the owner's brand rules (BRAND.md) in force in every line. Verified facts only; log sources in CREDITS.md.
"""

FINE_PRINT = "Replace with any disclaimer your field requires, or delete this line and the fine= argument."

REELS = {
    2: dict(slug="example-two-things", style="notes", pool=["broll"], note="Example reel: replace me", fine=FINE_PRINT,
        lines=dict(
            a="Here is the one thing people get wrong.",
            b="There are two parts to it.",
            c="The first part. And the second part.",
            d="Send this to someone who needs to hear it."),
        beats=[
            dict(type="hero", at="a", kicker="Common mistake", big="The one thing\n*people miss*", bigAt="a:thing"),
            dict(type="list", at="b", mode="number", items=[("First part", "c:first"), ("Second part", "c:second")]),
            dict(type="cta", at="d", head="Send this", headAt="d:send", sub="to someone who needs to hear it"),
        ]),
}
