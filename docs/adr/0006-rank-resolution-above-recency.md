# Rank Resolution above recency

Where several Releases cover the same Part and all satisfy the Profile, Pacerr takes the one
highest in the Profile's Resolution order. The most recently published decides only *within* a
Resolution.

## The conflict this settles

The spec asks for both and cannot have both:

- Story 17: "set an ordered Resolution preference, so that Pacerr takes 1080p where it exists and
  falls back rather than leaving a gap."
- Story 20: "Pacerr to choose the most recently published Release covering each Part, so that I get
  the newest cut of everything."

An older 1080p Release against a newer 480p one satisfies exactly one of them. Pacerr previously
ranked recency first, so the 480p won — which is not what "takes 1080p where it exists" means. The
project owner resolved it in favour of story 17.

## What keeps its place

- **The preferred Variant still outranks both.** Ticket #7 put it there for story 18 — "I get the
  regular cut by default and am not surprised by an extended one" — with Arlong Park 05's extended
  cut published six days after its regular one as the case in point.
- **The Resolution hard filter is unchanged.** A Release whose Resolution is absent from the
  Profile's ordered list does not qualify at all, whatever its date.
- **Infohash remains the final deterministic tiebreak.**
- **The Cutoff is untouched.** `upgrade/store.ts` gates a Resolution-driven Upgrade on the
  Resolution the Part *already holds*, not the one offered, and that is correct as it stands.

## Consequences

ADR-0003's per-Part recency now governs within a Resolution rather than across all of them. Its
argument is unaffected: the reason to compare per Part rather than per Arc is that an Arc mid-re-cut
has a few new per-Part Releases and an older Batch holding everything else, and that holds whichever
axis ranks first.

Measured across all 476 Parts in the checked-in fixtures, the change moves **nothing**: not one
Part's selected Release differs. The case exists in the rules rather than in today's Catalogue,
which is why it had to be settled rather than observed.
