# Assumptions and known limitations

Every assumption the platform makes is also represented at runtime as `assumption` evidence and
depresses Confidence — nothing here is hidden from the user.

## Data assumptions

1. **Median income tier** — no free, global, per-neighborhood income provider exists. When absent,
   the engine assumes tier 3/5 ("national median") with reliability 0.3. Configure a paid provider
   (e.g. census/statistical office APIs) to replace it.
2. **Commercial rent tier** — same treatment as income (assumed tier 3/5, reliability 0.3).
3. **Population density** — derivable only where a provider is configured; otherwise it is a `gap`
   (which suppresses the population-floor disqualifier and lowers confidence rather than guessing).
4. **Foot traffic** — derived from anchor POIs (transit, retail, offices, schools) unless real
   field `traffic_count` observations exist, which then take precedence at quality 0.95.
5. **OSM completeness** — POI-derived signals are only as complete as OpenStreetMap in that area.
   Signal quality factors reflect this; field research is the corrective.

## Engineering limitations (v1)

- **No paid data providers** wired (income, rent, mobility). Blocked on credentials/contracts.
- **Fixture provider** powers demo/offline analysis; it is deterministic synthetic data and is
  labeled as such in provider statuses (`providerId: 'fixture-poi'`).
- **Auth**: the API is single-tenant/dev-mode (no user accounts). Add authn before any multi-user
  deployment; the sync protocol already carries `deviceId`.
- **Mobile native builds** (MapLibre/react-native-maps, SQLite) run via Expo dev client / EAS;
  app-store delivery pipelines are out of scope here.
- **PDF export** renders via expo-print (HTML → PDF on device); server-side rendering not included.
- Population/income providers, multi-user auth, and CRDT sync are deliberate deferrals, not oversights.

## Master-prompt milestone (2026-07-10) — scope reconciliation

The Location Opportunity Analyzer master prompt was adopted as a milestone with two explicit
overrides (user-confirmed): **ADR-001 stays frozen** — ranking remains Opportunity → Risk → id
(not Confidence-first), and **no AI anywhere**, including explanation wording (deterministic
templates instead of AI-phrased prose).

Delivered: map-first home tab, place search (geocode chain), map styles, analysis heat layer,
taxonomy expanded to 287 types.

Deferred (need native/3rd-party infrastructure not present here):

- ~~Isochrones~~ — RESOLVED: `/api/isochrone` resolves walk/bike/drive reach through the
  provider chain (public Valhalla instance in live mode with 1 req/s politeness, deterministic
  fixture otherwise); the map renders the contour as a dashed overlay.
- **3D buildings, rotate/tilt, terrain shading** — MapLibre GL dev build; react-native-maps
  covers standard/satellite/hybrid/terrain today.
- ~~Polygon drawing/measuring~~ — RESOLVED: draw mode on the map (tap to add vertices,
  live km² area). Buffers, time slider, and side-by-side compare remain future work.
- **PPT/Excel exports** — PDF + CSV ship today; PPTX/XLSX generation would add heavy deps.
- **Offline tile packs** — MapLibre's OfflineManager is available, but bulk-downloading the
  public OSM/CARTO raster tiles we use would violate their usage policies, and
  `OfflinePackCreateOptions.mapStyle` wants a hosted style URL rather than our inline JSON.
  Viewed tiles are ambient-cached by MapLibre and work offline; full offline packs need a
  bulk-download-friendly source (PMTiles, MapTiler key, or self-hosted tiles) first.
