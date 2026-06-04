// Map area grouping has moved to the single-source-of-truth map catalog. This
// module is kept as a thin re-export so existing imports keep working.
export { MAP_AREAS, USA_ATTACK_MAPS, areaOf, prettyArea, canonicalMapName } from './mapCatalog';
