# Design — atlas, throughout (inherited from the Film Commission Atlas, 2026-08-18; applies to every Layercake page)

Set 2026-08-18. The instruction: *keep the design aesthetic atlas-like throughout.*

Not decoration. The aesthetic is an argument — the competing sources
(`BRIEF.md` §9) all look like software: EUFCN's corporate site, Entertainment
Partners' lead-generation map, KFTV's directory. **An atlas looks like a
reference work, and a reference work is a claim to be checked rather than a
product to be clicked.** That is exactly the claim this project is making.

---

## 1 · The governing idea

A printed atlas is honest in a way a web app is not. It carries an **edition**,
a **date**, a **legend**, a **scale**, and a **source note** — and it never
pretends the map is the territory. Every one of those conventions maps onto
something this project actually needs:

| Atlas convention | What it does here |
| --- | --- |
| **Edition and date** on the title page | The build date and record counts, stated up front |
| **Plates**, numbered | Each view is a plate: I — The Association Layer, II — Iberia, III — The Nordics |
| **Legend** | Entity type, tier, and **confidence** — scraped vs human-checked vs confirmed-by-office |
| **Gazetteer / index** | The searchable A–Z of all entities, the way an atlas indexes place names |
| **Source note** per plate | `source_url` and `fetched_at`, visible, not buried |
| **Graticule** | Faint lat/long grid — structure without decoration |
| **Terra incognita** | ⭐ The 578 known gaps, drawn as absence rather than hidden |

⭐ **The last one is the soul of it.** Old atlases left blank space where
knowledge stopped, and labelled it. This project has 578 recorded gaps across 106
entities. **They get drawn.** A commission with no established jurisdiction is
rendered as an unsurveyed region, not a complete one — which is the visual form
of the honesty that separates this from every source that came before it.

---

## 2 · Palette — ink on paper, not pixels on glass

Warm paper, not white. Ink, not black. Colour is scarce and always means
something.

```
--paper        #F4EFE6    aged cartridge, the ground
--paper-deep   #E8E0D2    landmass fill, panels
--ink          #1C1A17    text, coastlines — never pure black
--ink-soft     #5A5349    secondary, captions, graticule labels
--rule         #B8AE9C    hairlines, borders, graticule
--sea          #DDE4E3    water, cool against the warm land

--oxblood      #7A2E2E    ⭐ the single accent. Selection, the current plate
--verdigris    #4A6B62    the green layer — sustainability standards
--sepia        #8B6F47    incentives and money
```

**Three inks maximum on any one plate.** An atlas printed in six colours was
expensive and looked it; restraint reads as authority.

**Confidence is rendered as ink weight, not hue** — so it survives greyscale,
print, and colourblindness:

- `scraped` — hairline outline, unfilled
- `human-checked` — solid hairline
- `confirmed-by-office` — filled, full weight

You can see at a glance how much of the map is actually *known*.

---

## 3 · Type

- **Display and headings:** a transitional or old-style serif — the engraved
  register. Titles in small caps with generous letterspacing.
- **Labels on the map:** small caps for territories, italic for water and
  regions, roman for settlements. That is the standard cartographic hierarchy
  and it is centuries old because it works.
- **Data and coordinates:** a mono, sparingly — for IDs, dates and lat/long only.
- **No sans-serif UI font anywhere.** The moment a system font appears it looks
  like an admin panel.

Numerals: oldstyle in running text, lining in tables.

---

## 4 · The plates

The map is not one infinite canvas. It is **a bound set of plates**, and moving
between them is turning a page.

- **Plate I — The Association Layer.** Not geographic. A schematic of AFCI,
  EUFCN, CineRegio, EFAD, FilmUSA and the edges between them, drawn like a
  chart of trade routes rather than a force-directed graph. **Orphans are
  visible as unconnected islands** — the three-of-six finding, rendered.
- **Plates II+ — Regional.** Iberia, the Nordics, DACH, Italy, the Balkans,
  Britain and Ireland. Each with its own legend and source note.
- **The Gazetteer.** Every entity, A–Z, with tier, country, confidence and gaps.

Transitions are page-turns and cross-fades. **No zoom-and-pan infinity** — that
is a mapping product, not an atlas.

---

## 5 · Rules

1. **Never show a volatile value without its date.** Incentive rates, budgets and
   programme status carry `verified_at` inline. This is not a footnote; it is
   the product.
2. **Draw absence.** Unsurveyed fields are rendered, never silently omitted.
3. **No named individuals, ever.** `BRIEF.md` §5 — enforced in the build, and the
   interface has no place to put one.
4. **Cite on the face of the plate.** Sources sit in the margin, as an atlas
   does, not behind a modal.
5. **Legible in greyscale and in print.** If a plate fails printed on a mono
   laser, it fails.
6. **No motion for its own sake.** Nothing moves unless it reveals structure.

---

## 6 · What it must not look like

Not a dashboard. Not a SaaS landing page. Not a dark-mode developer tool. Not a
tourism map with pin-drop markers and rounded cards.

The nearest references are the **Times Comprehensive Atlas**, the plate work in
old Ordnance Survey and Bartholomew editions, and the restrained information
design of a national statistical yearbook — objects that expect to be consulted
rather than browsed, and that tell you when they were made.


---

## 7 · Interaction — added 2026-08-18

The plates are clickable. That changes nothing about the aesthetic and
everything about the data shape, so it is recorded here before it is built.

**What the data already supports, and must keep supporting:**

- **Stable, URL-safe ids.** `it-idm-film-music-commission-sudtirol` is the
  permalink. Deep links are `#/entity/<id>` — an atlas plate has a reference,
  and so does every entry in it.
- **One bundle, one fetch.** `graph.js` carries entities, relations and gap
  counts together. No per-record round trips.
- **Relations traversable both ways.** Stored directed, indexed both directions
  at load, so a body shows what it belongs to *and* what belongs to it.

**How interaction should behave, in atlas terms:**

- **Selection is an inset, not a modal.** Clicking a body opens a cartouche
  beside the plate — the way an atlas prints a detail inset in the margin. The
  plate stays visible; you never lose your place.
- **The cartouche shows what is missing as prominently as what is known.**
  A commission with no established jurisdiction says so, in the same weight as
  the fields it does have. Absence is content.
- **Every value in the cartouche carries its source and date**, inline. Clicking
  through to the source is one step, never hidden behind a tab.
- **Hovering a tie highlights both ends and states the relation in words** —
  "Spain Film Commission founded EUFCN, 2005" — not a tooltip of raw fields.
- **The gazetteer is the index and it is the search.** Typing filters it;
  selecting an entry moves the plate to that body.
- **Nothing animates except to show structure.** Selection may draw attention
  along a tie; nothing bounces, nothing fades for decoration.

⚠️ **Interaction must not become the reason to trust it.** A slick clickable map
of wrong data is worse than a static plate of right data — that is precisely
what the incumbent directories are. Provenance stays on the face of the plate at
every zoom level.

---

## 8 · ⚠️ Standing concern — crowding (Carter, 2026-08-19)

The site is getting "smashed and crowded": five nav items, dense pages, chips +
tables + insets accumulating. Keep top of mind; sort deliberately later. Likely
moves when addressed: a proper title page/contents as the front door instead of
landing on Plate I; more whitespace discipline; the contents nav collapsed to a
single "Contents" affordance; fewer things per viewport. Do not add more chrome
before this is resolved.

⏰ **Scheduled: the redesign/de-crowding pass is the FIRST task of the next
session (Carter, end of 2026-08-19).** Start here, not on Wave 4.

## 9 · The front door is the map — decided 2026-08-20 (Carter)

"It's an atlas, the landing page should just be map map map." The cover page
lasted one day; the landing is now a full-viewport interactive map and nothing
else. Everything the old cover carried lives in a **title cartouche** printed
on the sheet itself — masthead, edition counts, contents — the way a real
atlas plate carries its furniture in the margin.

**Built to outgrow Europe.** The atlas will chart North America. So:

- Geometry is stored as **lon/lat rings** (`web/data/geo.js`, built by
  `scripts/geo.mjs` from Natural Earth 1:50m, public domain) and projected in
  the browser. Charting a new continent = add a coverage window in `geo.mjs`,
  re-run it. Nothing on the page says "Europe".
- The projection (Lambert azimuthal equal-area) is **centred on the centroid
  of whatever is charted**, and the initial frame is **fitted to the charted
  extent** — both computed, never hardcoded.
- Charted countries whose geometry has no window yet are printed as a
  marginal note: "Beyond this frame: US — 1 body." The frame widens when a
  continent is charted, not before.

Rules of the sheet:

- Surveyed territories in paper + full ink, clickable; unsurveyed neighbours
  in lighter ink, mute, unclickable — background, not content.
- This page is GEOGRAPHIC, so it carries a real graticule — the honest
  counterpart of Plate I's refusal to print fake degrees on a schematic.
  Graticule lines end at the coverage window, so the sheet's cut edges read
  as the meridians they are.
- Labels hold constant size on screen and appear as the view earns them;
  unsurveyed neighbours earn a name only well after charted territories.
- Hover speaks in words in the caption strip; click opens the country's
  record in a margin cartouche (money first, then bodies, tier-ordered),
  linking into the Gazetteer (`#/q/country:cc`). Deep link: `#/country/CC`.

**Founding dates print as bare years** (same session): `founded` must be an
integer year — the validator fails anything else; exact dates go in notes.

## 10 · The interior layer — states, and where a name sits (2026-08-24)

"Make the map show all 50 states" (Carter). The US record is **state-shaped**,
because in the United States the money is statutory *per state* — the thing the
Atlas is actually charting there is fifty separate legislatures. A map that
drew the US as one shape was drawing the wrong unit.

- `scripts/geo.mjs` now builds **Natural Earth admin-1** beside admin-0,
  through the same clip/simplify pipeline, keyed by **ISO 3166-2** (`US-IA`).
- That key is deliberate: it is the *same code entities already carry* in
  `jurisdiction.covers`. The map and the record meet with no lookup table and
  no second list to keep in sync. A body charts a state by covering it.
- Adding another country's interior divisions is one entry in
  `ADMIN1_COUNTRIES`. Canada's provinces are the obvious next one, and the
  page will not need editing.

Rules of the interior layer, following §9's rules for the sheet:

- A **charted** state (something covers it) takes full ink, a name, a hover
  tip, a cartouche and a deep link `#/state/US-CA`, and links into the
  Gazetteer's matching `state:us-ca` filter.
- An **unsurveyed** state is a boundary line only — no name at normal zoom, no
  pointer events, and clicks fall **through** to the country beneath it. It is
  interior structure, not content.
- **A country whose states are printing their own names stands back.**
  UNITED STATES lying across KANSAS and MISSOURI is precisely the crowding §8
  refuses. Zoom out, the state names go quiet, and the country takes its name
  back. This is the ordinary behaviour of an atlas and it falls out of one
  rule, not a special case per country.

### ⭐ Where a name sits

The label anchor was **the average of a ring's vertices**, and that is wrong in
a way worth recording, because it is wrong for a reason that recurs:

> A detailed coastline carries ten times the points of a straight inland
> border, so a vertex average drifts toward whichever edge was surveyed in most
> detail.

CALIFORNIA and OREGON printed *in the Pacific*. The obvious correction — the
true **area centroid** — is honest but can fall outside a concave shape
entirely, which would put LOUISIANA and NORWAY offshore instead.

So the anchor is now the **pole of inaccessibility**: the point inside the
polygon furthest from any edge (quadtree bisection, Mapbox's polylabel), which
is by construction *inside the shape* and is where a cartographer's hand puts a
name. It is computed in a `cos(lat)`-corrected space, because a degree of
longitude is only `cos(lat)` as wide as a degree of latitude and without the
correction every northern name — Canada, Norway, Alaska — shoves sideways.

Checked at build: **all 261 anchors fall inside their own shape.**

The name goes in the **largest** landmass of a multi-part territory. A country
does not label itself on its own outlying island.
