// Official French NAF top-level sections (21) + a starter division map.
// Section labels are kept in French (official labels) and translated for UI via helper text only.
// Division labels are official French INSEE labels — they are reference data, not UI strings.

export const NATURES_OF_ACTIVITY = [
  "commerciale",
  "artisanale",
  "liberale",
  "agricole",
] as const;
export type NatureOfActivity = (typeof NATURES_OF_ACTIVITY)[number];

export type NafSection = { code: string; label: string };

export const NAF_SECTIONS: NafSection[] = [
  { code: "A", label: "Agriculture, sylviculture et pêche" },
  { code: "B", label: "Industries extractives" },
  { code: "C", label: "Industrie manufacturière" },
  { code: "D", label: "Production et distribution d'électricité, de gaz, de vapeur et d'air conditionné" },
  { code: "E", label: "Production et distribution d'eau ; assainissement, gestion des déchets et dépollution" },
  { code: "F", label: "Construction" },
  { code: "G", label: "Commerce ; réparation d'automobiles et de motocycles" },
  { code: "H", label: "Transports et entreposage" },
  { code: "I", label: "Hébergement et restauration" },
  { code: "J", label: "Information et communication" },
  { code: "K", label: "Activités financières et d'assurance" },
  { code: "L", label: "Activités immobilières" },
  { code: "M", label: "Activités spécialisées, scientifiques et techniques" },
  { code: "N", label: "Activités de services administratifs et de soutien" },
  { code: "O", label: "Administration publique" },
  { code: "P", label: "Enseignement" },
  { code: "Q", label: "Santé humaine et action sociale" },
  { code: "R", label: "Arts, spectacles et activités récréatives" },
  { code: "S", label: "Autres activités de services" },
  { code: "T", label: "Activités des ménages en tant qu'employeurs ; activités indifférenciées des ménages en tant que producteurs de biens et services pour usage propre" },
  { code: "U", label: "Activités extra-territoriales" },
];

export type NafDivision = { code: string; label: string };

// Starter NAF division map (official 2-digit divisions) by section.
// Used by the optional dependent division selector. Safe to extend later.
export const NAF_DIVISIONS_BY_SECTION: Record<string, NafDivision[]> = {
  A: [
    { code: "01", label: "Culture et production animale, chasse et services annexes" },
    { code: "02", label: "Sylviculture et exploitation forestière" },
    { code: "03", label: "Pêche et aquaculture" },
  ],
  B: [
    { code: "05", label: "Extraction de houille et de lignite" },
    { code: "06", label: "Extraction d'hydrocarbures" },
    { code: "07", label: "Extraction de minerais métalliques" },
    { code: "08", label: "Autres industries extractives" },
    { code: "09", label: "Services de soutien aux industries extractives" },
  ],
  C: [
    { code: "10", label: "Industries alimentaires" },
    { code: "11", label: "Fabrication de boissons" },
    { code: "13", label: "Fabrication de textiles" },
    { code: "14", label: "Industrie de l'habillement" },
    { code: "15", label: "Industrie du cuir et de la chaussure" },
    { code: "16", label: "Travail du bois et fabrication d'articles en bois" },
    { code: "17", label: "Industrie du papier et du carton" },
    { code: "18", label: "Imprimerie et reproduction d'enregistrements" },
    { code: "20", label: "Industrie chimique" },
    { code: "21", label: "Industrie pharmaceutique" },
    { code: "22", label: "Fabrication de produits en caoutchouc et en plastique" },
    { code: "23", label: "Fabrication d'autres produits minéraux non métalliques" },
    { code: "24", label: "Métallurgie" },
    { code: "25", label: "Fabrication de produits métalliques" },
    { code: "26", label: "Fabrication de produits informatiques, électroniques et optiques" },
    { code: "27", label: "Fabrication d'équipements électriques" },
    { code: "28", label: "Fabrication de machines et équipements n.c.a." },
    { code: "29", label: "Industrie automobile" },
    { code: "30", label: "Fabrication d'autres matériels de transport" },
    { code: "31", label: "Fabrication de meubles" },
    { code: "32", label: "Autres industries manufacturières" },
    { code: "33", label: "Réparation et installation de machines et équipements" },
  ],
  D: [{ code: "35", label: "Production et distribution d'électricité, de gaz, de vapeur et d'air conditionné" }],
  E: [
    { code: "36", label: "Captage, traitement et distribution d'eau" },
    { code: "37", label: "Collecte et traitement des eaux usées" },
    { code: "38", label: "Collecte, traitement et élimination des déchets" },
    { code: "39", label: "Dépollution et autres services de gestion des déchets" },
  ],
  F: [
    { code: "41", label: "Construction de bâtiments" },
    { code: "42", label: "Génie civil" },
    { code: "43", label: "Travaux de construction spécialisés" },
  ],
  G: [
    { code: "45", label: "Commerce et réparation d'automobiles et de motocycles" },
    { code: "46", label: "Commerce de gros, à l'exception des automobiles et des motocycles" },
    { code: "47", label: "Commerce de détail, à l'exception des automobiles et des motocycles" },
  ],
  H: [
    { code: "49", label: "Transports terrestres et transport par conduites" },
    { code: "50", label: "Transports par eau" },
    { code: "51", label: "Transports aériens" },
    { code: "52", label: "Entreposage et services auxiliaires des transports" },
    { code: "53", label: "Activités de poste et de courrier" },
  ],
  I: [
    { code: "55", label: "Hébergement" },
    { code: "56", label: "Restauration" },
  ],
  J: [
    { code: "58", label: "Édition" },
    { code: "59", label: "Production de films, vidéos, programmes de télévision, enregistrements sonores" },
    { code: "60", label: "Programmation et diffusion" },
    { code: "61", label: "Télécommunications" },
    { code: "62", label: "Programmation, conseil et autres activités informatiques" },
    { code: "63", label: "Services d'information" },
  ],
  K: [
    { code: "64", label: "Activités des services financiers, hors assurance et caisses de retraite" },
    { code: "65", label: "Assurance" },
    { code: "66", label: "Activités auxiliaires de services financiers et d'assurance" },
  ],
  L: [{ code: "68", label: "Activités immobilières" }],
  M: [
    { code: "69", label: "Activités juridiques et comptables" },
    { code: "70", label: "Activités des sièges sociaux ; conseil de gestion" },
    { code: "71", label: "Activités d'architecture et d'ingénierie ; activités de contrôle et analyses techniques" },
    { code: "72", label: "Recherche-développement scientifique" },
    { code: "73", label: "Publicité et études de marché" },
    { code: "74", label: "Autres activités spécialisées, scientifiques et techniques" },
    { code: "75", label: "Activités vétérinaires" },
  ],
  N: [
    { code: "77", label: "Activités de location et location-bail" },
    { code: "78", label: "Activités liées à l'emploi" },
    { code: "79", label: "Activités des agences de voyage, voyagistes, services de réservation" },
    { code: "80", label: "Enquêtes et sécurité" },
    { code: "81", label: "Services relatifs aux bâtiments et aménagement paysager" },
    { code: "82", label: "Activités administratives et autres activités de soutien aux entreprises" },
  ],
  O: [{ code: "84", label: "Administration publique et défense ; sécurité sociale obligatoire" }],
  P: [{ code: "85", label: "Enseignement" }],
  Q: [
    { code: "86", label: "Activités pour la santé humaine" },
    { code: "87", label: "Hébergement médico-social et social" },
    { code: "88", label: "Action sociale sans hébergement" },
  ],
  R: [
    { code: "90", label: "Activités créatives, artistiques et de spectacle" },
    { code: "91", label: "Bibliothèques, archives, musées et autres activités culturelles" },
    { code: "92", label: "Organisation de jeux de hasard et d'argent" },
    { code: "93", label: "Activités sportives, récréatives et de loisirs" },
  ],
  S: [
    { code: "94", label: "Activités des organisations associatives" },
    { code: "95", label: "Réparation d'ordinateurs et de biens personnels et domestiques" },
    { code: "96", label: "Autres services personnels" },
  ],
  T: [
    { code: "97", label: "Activités des ménages en tant qu'employeurs de personnel domestique" },
    { code: "98", label: "Activités indifférenciées des ménages en tant que producteurs de biens et services pour usage propre" },
  ],
  U: [{ code: "99", label: "Activités des organisations et organismes extraterritoriaux" }],
};

export function getSectionLabel(code: string): string {
  return NAF_SECTIONS.find((s) => s.code === code)?.label ?? "";
}

export function getDivisionLabel(sectionCode: string, divisionCode: string): string {
  return (
    NAF_DIVISIONS_BY_SECTION[sectionCode]?.find((d) => d.code === divisionCode)?.label ?? ""
  );
}
