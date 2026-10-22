# Borrow the grammar of state, but write our own legend

Pacerr shows state the way the *arr family shows it — an icon in a narrow column, coloured pills
for counts and qualities — and attaches its own six meanings to the colours. The legend is
declared once in `src/app.css`, documented in `GLOSSARY.md`, and asserted by `tests/state.test.ts`.

## The conflict this settles

Spec #20 exists so that someone who runs the rest of that family finds nothing surprising here,
and the most direct reading of that is to take the reference's status colours along with its
grammar. The reference encodes series state — continuing, ended — crossed with completeness.

Pacerr has neither concept. An Arc is a stretch of a recut: it does not announce a run and it does
not end one. And Pacerr has two states the reference cannot express at all — the Unreleased Part,
which One Pace has numbered and not published, and the to-be-redone Release, which the project
intends to replace while it still stands as the one to prefer.

Taking the palette and keeping the meanings would have produced an interface that looked correct
and lied: a colour a user already reads fluently, attached to something it has never meant.
Taking the palette and redefining the legend is the honest version of the same familiarity.

## What the legend had to cover that the reference does not

Three of the six are not a restyle of anything that was on the wire:

- **Downloading** lived only in Activity, fetched live from the Download Client and keyed by
  infohash. Reaching it from a Part meant composing the grabs with the client's statuses through
  `grab_part`, which is the only join ADR-0004 permits. Arc detail and Wanted became asynchronous
  to do it, and both treat an unreachable client as "no Part is downloading" rather than as a
  failure: the view keeps saying everything else it knows.
- **Missing, not monitored** is unreachable from Wanted by construction — the query joins
  `monitored_arc`, so every gap it lists is one somebody asked for. It is derivable on Arc detail,
  and that is where it shows. The Arcs list is a list of Arcs, not of Parts, so it carries the
  had-of-total count as a pill instead of a state nobody can define for an Arc.
- **To Be Redone** was absent from the Wanted row entirely and is now carried there too.

## Consequences

- **Warning orange changed meaning.** It marked a missing Part on the Wanted list; it now marks a
  gap nobody is monitoring, which Wanted can never show. A test asserts orange and red are each
  spent on one thing wherever a Part or a Release is listed.
- **System is outside the legend.** A Health check is `ok`, `warned` or `failed` and a History
  entry `succeeded`, `warned` or `failed`. Those are their own vocabularies, they are not about a
  Part, and folding them in would recreate exactly the overloading this decision rejects.
- **The Queue borrows the treatments and keeps the Download Client's words.** It lists Releases,
  and a transfer's four states are the daemon's vocabulary, not Pacerr's. The colour is the
  legend's; the word in the accessible name is the daemon's, so neither is made to stand for the
  other.
- **The icons are Pacerr's own.** The spec rules out taking any asset from the reference, so each
  state's mark is an inline SVG path written here. Matching an icon set was never the point;
  matching the grammar was.
