# Title the shared Specials season `Specials`, not after an Arc

The season NFO Pacerr writes into the `Specials` directory carries the title `Specials` and no
plot. Every other season directory carries its Arc's title and description, as ticket #29 asks for.
The special Arcs — the April Fools entries, the Fan Letter — therefore reach the Library with their
names and descriptions only on the Parts inside them, never on the season above.

## The conflict this settles

Ticket #29's criterion is unqualified: "Each season directory holding an imported Part has a season
NFO carrying **that Arc's** title and description." Library index zero is the one index many Arcs
share, fixed on first sight so a special published upstream tomorrow cannot move the ones a Library
already holds. One directory, many Arcs, one `season.nfo`.

Honouring the criterion literally means the last special imported wins. A user holding the Fan
Letter and two April Fools entries would see the whole of season zero titled and described as
whichever of the three landed most recently, and that title would change under them on the next
import. A media server shows that string wherever it shows the season, so the error is not a
detail in a file: it is the name of a season in the client.

Writing nothing at all was the other option. It is worse. A season directory with no `season.nfo`
is a season a media server names from the directory — which is already `Specials`, so the user
gains nothing — while Pacerr loses the one place that states, deliberately and stably, what season
zero is. It also makes the Library's shape depend on which seasons happen to be special, which is
exactly the kind of conditional structure the flattened layout exists to remove.

So the season NFO states the truth about the directory rather than a half-truth about one of the
Arcs in it. `Specials` is also the name media servers look for, which is why the directory is
called that in the first place.

## What is not lost

- **Each special Part keeps its own NFO**, with its own title, description and Coverage, beside
  its video file. Browsing into season zero shows the Fan Letter and the April Fools entries by
  name and described; only the season heading above them is generic.
- **Pacerr's own views are unaffected.** The Arcs view and the Arc detail view read the Catalogue,
  not the Library, and show every special Arc's own title and description.
- **No plot is invented.** The season document carries a title and nothing else, rather than
  concatenating the descriptions of whichever specials are present, which would restamp the file
  on every import of a special and read as nonsense in a client.

## Consequences

- A special Arc's description reaches the Library only through its Parts. If One Pace ever gives a
  special Arc a description worth surfacing at season level, there is nowhere for it to go, and
  that remains true for as long as all specials share one index.
- The Poster written into `Specials/cover.jpg` has the same collision and is resolved the same way
  by consequence: whichever special landed last supplied it. That is a real wart, visible as
  artwork rather than text, and is the thing to revisit first if this area is reopened.
- Giving each special Arc its own season index would dissolve the conflict entirely, at the cost of
  scattering one-off entries across several high-numbered seasons instead of the one directory
  media servers expect. That trade was made when the index was fixed, not here.
