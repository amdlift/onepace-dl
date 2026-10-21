# Name Roboto first, but ship no font

The token sheet declares `--font-sans: Roboto, 'Helvetica Neue', Arial, sans-serif`. Pacerr loads
no webfont, so an install on a machine without Roboto renders the interface in Helvetica Neue or
Arial at the measured sizes.

## The conflict this settles

Spec #20 asks for "a Roboto-first sans stack at a 14px base". The stack has named Roboto first
since the walking skeleton, and nothing has ever fetched it, so the sizes were measured from a
typeface the interface does not actually use.

Linking the font from a font host settles it in one line and is the wrong line. Pacerr runs in a
container beside a download client, often on a network that cannot reach the internet and
deliberately so. An interface that fetches a stylesheet from a third party on every page load
fails to render as intended exactly where it is most likely to be deployed, and tells that third
party when someone opens their library.

Bundling the woff2 files settles it properly: several files, a licence notice, and the build
plumbing to hash and serve them. That is a real piece of work for a difference most users will not
see, because Roboto is already present on Android and on most Linux desktops — which is where a
self-hosted *arr stack is usually read from.

So the stack names Roboto first and falls back. When the fallback is judged to cost enough, the
fix is to bundle the font, never to link it.

## Consequences

- **The measured 21.4px line height sits against Arial's metrics, not Roboto's.** The line box is
  the measured one; the letterforms inside it are not. Density is preserved, which is what the
  spec is actually buying.
- **Sign-off screenshots are taken in the fallback face.** "Matches the reference" is therefore
  judged on surface, density, spacing and layout, and not on letterforms. That is the honest
  reading of what this spec can deliver without shipping a typeface.
