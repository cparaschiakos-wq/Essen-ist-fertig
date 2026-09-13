import type { CategoryId } from './types'
import { CATEGORY_BY_ID } from './taxonomy'
import { normalizeName } from './units'

/**
 * Ordnet einer Zutat automatisch eine Warengruppe zu. Ohne das müsste man
 * jede Zutat von Hand einsortieren, und die Sortierung nach Supermarkt-
 * Reihenfolge wäre in der Praxis nutzlos.
 *
 * Die Treffer sind Teilstring-Vergleiche auf dem normalisierten Namen, damit
 * "Bio-Vollmilch 3,5%" noch bei "milch" landet. Reihenfolge zählt: der erste
 * Treffer gewinnt, spezielle Begriffe stehen deshalb vor allgemeinen.
 */
const RULES: Array<[CategoryId, string[]]> = [
  // Vor "milch", sonst schluckt Molkerei die Pflanzendrinks nicht korrekt ein.
  ['tiefkuehl', ['tiefkühl', 'tk ', 'gefrier', 'eiswürfel', 'blattspinat', 'pommes', 'speiseeis']],
  [
    'molkerei',
    [
      'milch', 'sahne', 'quark', 'joghurt', 'jogurt', 'butter', 'margarine', 'käse', 'kaese',
      'frischkäse', 'schmand', 'crème', 'creme fraiche', 'mozzarella', 'feta', 'parmesan',
      'mascarpone', 'ricotta', 'skyr', 'buttermilch', 'kefir', 'ei', 'eier', 'eigelb', 'eiweiß',
      'hüttenkäse', 'pudding', 'tofu',
    ],
  ],
  [
    'obst_gemuese',
    [
      'apfel', 'äpfel', 'banane', 'birne', 'beere', 'erdbeer', 'himbeer', 'heidelbeer', 'traube',
      'orange', 'zitrone', 'limette', 'mandarine', 'pfirsich', 'nektarine', 'pflaume', 'kirsche',
      'melone', 'ananas', 'mango', 'avocado', 'kiwi', 'zwiebel', 'knoblauch', 'kartoffel',
      'karotte', 'möhre', 'moehre', 'tomate', 'gurke', 'paprika', 'zucchini', 'aubergine',
      'brokkoli', 'blumenkohl', 'kohl', 'salat', 'spinat', 'lauch', 'porree', 'sellerie',
      'pilz', 'champignon', 'kürbis', 'kuerbis', 'bohne', 'erbse', 'mais', 'rucola', 'petersilie',
      'schnittlauch', 'basilikum', 'koriander', 'dill', 'minze', 'rosmarin', 'thymian', 'ingwer',
      'radieschen', 'rettich', 'spargel', 'fenchel', 'pastinake', 'süßkartoffel', 'datteln',
    ],
  ],
  [
    'fleisch_fisch',
    [
      'fleisch', 'hack', 'rind', 'schwein', 'kalb', 'lamm', 'hähnchen', 'haehnchen', 'huhn',
      'hühner', 'pute', 'truthahn', 'ente', 'wurst', 'schinken', 'speck', 'bacon', 'salami',
      'bratwurst', 'steak', 'filet', 'gulasch', 'schnitzel', 'fisch', 'lachs', 'thunfisch',
      'forelle', 'kabeljau', 'garnele', 'shrimp', 'muschel', 'tintenfisch',
    ],
  ],
  [
    'backwaren',
    ['brot', 'brötchen', 'broetchen', 'baguette', 'toast', 'semmel', 'croissant', 'kuchen', 'brezel', 'fladenbrot', 'wrap', 'tortilla'],
  ],
  [
    'trocken',
    [
      'mehl', 'zucker', 'salz', 'pfeffer', 'hefe', 'backpulver', 'natron', 'stärke', 'staerke',
      'nudel', 'spaghetti', 'penne', 'reis', 'couscous', 'bulgur', 'quinoa', 'linsen', 'grieß',
      'haferflocken', 'müsli', 'muesli', 'nuss', 'nüsse', 'mandel', 'walnuss', 'haselnuss',
      'cashew', 'sesam', 'leinsamen', 'chia', 'öl', 'oel', 'essig', 'sojasauce', 'gewürz',
      'paprikapulver', 'curry', 'kreuzkümmel', 'zimt', 'vanille', 'kakao', 'brühe', 'bruehe',
      'gelatine', 'agar', 'kokosmilch', 'kokosraspel', 'semmelbrösel', 'paniermehl', 'honig',
    ],
  ],
  [
    'konserven',
    ['dose', 'konserve', 'passierte tomaten', 'tomatenmark', 'kichererbsen', 'mais dose', 'oliven', 'kapern', 'marmelade', 'konfitüre', 'gurken glas', 'pesto', 'ketchup', 'senf', 'mayonnaise', 'nutella', 'nussnougat'],
  ],
  [
    'getraenke',
    ['wasser', 'saft', 'schorle', 'cola', 'limonade', 'bier', 'wein', 'sekt', 'kaffee', 'tee', 'sirup', 'prosecco', 'rum', 'wodka'],
  ],
  ['suesses', ['schokolade', 'keks', 'bonbon', 'gummibär', 'chips', 'riegel', 'praline', 'waffel', 'popcorn', 'salzstangen']],
  [
    'drogerie',
    ['shampoo', 'duschgel', 'zahnpasta', 'zahnbürste', 'seife', 'deo', 'creme', 'windel', 'feuchttücher', 'taschentücher', 'toilettenpapier', 'rasier', 'binden', 'tampon', 'sonnencreme', 'pflaster'],
  ],
  [
    'haushalt',
    ['spülmittel', 'spuelmittel', 'waschmittel', 'weichspüler', 'putzmittel', 'müllbeutel', 'muellbeutel', 'küchenrolle', 'kuechenrolle', 'alufolie', 'frischhaltefolie', 'backpapier', 'schwamm', 'batterie', 'kerze', 'spülmaschinentabs'],
  ],
]

export function guessCategory(name: string): CategoryId {
  const needle = normalizeName(name)
  if (!needle) return 'sonstiges'

  for (const [category, keywords] of RULES) {
    for (const keyword of keywords) {
      if (needle.includes(keyword)) return category
    }
  }
  return 'sonstiges'
}

/** Passender Ladentyp zur geratenen Kategorie. */
export function defaultStoreFor(category: CategoryId) {
  return CATEGORY_BY_ID[category].defaultStore
}
