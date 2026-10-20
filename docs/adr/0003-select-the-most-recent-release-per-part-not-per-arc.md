# Select the most recent Release per Part, not per Arc

When several Releases cover the same Part, Pacerr takes the most recently published one that
satisfies the Profile. The unit of that comparison is the **Part**, not the Arc.

## Why the unit matters

One Pace publishes Batch Releases covering a whole Arc, and separately re-cuts individual Parts over
the following years. The obvious reading — "if the Arc's Parts are newer than its Batch, ignore the
Batch" — loses most of an Arc that is mid-re-cut, because only a few Parts have been redone:

| Arc | Parts in Catalogue | Parts with their own current Release |
| --- | --- | --- |
| Fishman Island | 24 | 2 |
| Post-Enies Lobby | 6 | 3 |
| Long Ring Long Land | 7 | 1 |

Evaluated per Arc, Fishman Island yields 2 of 24 Parts. Evaluated per Part, Fishman Island 02 comes
from the 2026 per-Part Release and Fishman Island 05 comes from the 2017 Batch, because nothing
newer covers it. Arcs where the Batch genuinely is newest still take the Batch wholesale.

## Consequences

Pacerr must expand a Batch Release's covered range onto the specific Parts it satisfies, using the
Catalogue's per-Part chapter and episode terms. This is the subtlest logic in the system and lives
in its own module with its own tests.

Grabbing a Batch for only some of its Parts would otherwise waste disk and produce duplicate
imports, so Pacerr sets per-file priority to zero in the Download Client for files already covered
by a newer per-Part Release. This makes the importer's correctness depend on a Download Client
feature; a client without per-file priority would have to download the whole Batch and discard the
surplus at import.
