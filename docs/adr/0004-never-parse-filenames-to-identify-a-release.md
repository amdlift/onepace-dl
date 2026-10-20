# Never parse filenames to identify a Release

Infohash is the only machine-trusted link between a file, a Release and a Part. Pacerr does not
derive identity from titles or filenames anywhere in the automated path.

## Why

The feed and the Catalogue disagree on names in ways no normaliser fixes reliably: "Arabasta" versus
`alabasta`, apostrophes that slugify differently, and Variant suffixes embedded in titles. Any
parser over these is a permanent maintenance tax with a silent failure mode — a wrong match records
the wrong file against a Part, and nothing surfaces the error.

## Consequences

Pacerr has no automated library scanning. A pre-existing collection is not discovered, because
discovering it would require exactly the filename parsing this decision rejects. Instead, Manual
Import puts a human in the loop: the user browses the Import Source, and Pacerr assigns each file to
a Part only on confirmation.

Filename parsing **is** permitted in that one place, to pre-fill a suggested Part the user can
override, because a suggestion awaiting confirmation has no silent-corruption failure mode. Low
confidence must render as a blank field rather than a wrong guess, and this path never runs
unattended.

A manually imported Part is recorded as had, with no Release attached and no Upgrade path, since
Pacerr genuinely does not know what the file is.
