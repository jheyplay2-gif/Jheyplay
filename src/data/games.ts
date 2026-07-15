export interface Game {
  slug: string;
  name: string;
  image: string;
  description: string;
  products: GameProduct[];
}

export interface GameProduct {
  label: string;
  usd: number;
  bs: number;
}

export const games: Game[] = [
  {
    slug: 'fifa-26',
    name: 'FIFA 26',
    image: '/games/fifa-26.svg',
    description: 'Compite en torneos online y partidos rápidos con tus equipos favoritos.',
    products: [
      { label: '20 FIFA Points', usd: 1, bs: 700 },
      { label: '100 FIFA Points', usd: 5, bs: 3500 },
      { label: '220 FIFA Points', usd: 10, bs: 7000 },
    ],
  },
  {
    slug: 'fortnite',
    name: 'Fortnite',
    image: '/games/fortnite.svg',
    description: 'Explora, construye y sobrevive en mapas dinámicos llenos de acción.',
    products: [
      { label: '100 V-Bucks', usd: 1, bs: 700 },
      { label: '600 V-Bucks', usd: 5, bs: 3500 },
      { label: '1200 V-Bucks', usd: 10, bs: 7000 },
    ],
  },
  {
    slug: 'valorant',
    name: 'Valorant',
    image: '/games/valorant.svg',
    description: 'Demuestra precisión y estrategia en rondas tácticas 5 contra 5.',
    products: [
      { label: '125 VP', usd: 1, bs: 700 },
      { label: '650 VP', usd: 5, bs: 3500 },
      { label: '1380 VP', usd: 10, bs: 7000 },
    ],
  },
  {
    slug: 'minecraft',
    name: 'Minecraft',
    image: '/games/minecraft.svg',
    description: 'Crea mundos sin límites y vive aventuras en solitario o en equipo.',
    products: [
      { label: '60 Minecoins', usd: 1, bs: 700 },
      { label: '320 Minecoins', usd: 5, bs: 3500 },
      { label: '700 Minecoins', usd: 10, bs: 7000 },
    ],
  },
  {
    slug: 'rocket-league',
    name: 'Rocket League',
    image: '/games/rocket-league.svg',
    description: 'Fútbol con autos de alta velocidad, jugadas aéreas y goles épicos.',
    products: [
      { label: '100 Credits', usd: 1, bs: 700 },
      { label: '500 Credits', usd: 5, bs: 3500 },
      { label: '1100 Credits', usd: 10, bs: 7000 },
    ],
  },
  {
    slug: 'league-of-legends',
    name: 'League of Legends',
    image: '/games/league-of-legends.svg',
    description: 'Coordina tácticas con tu escuadra y domina la Grieta del Invocador.',
    products: [
      { label: '80 RP', usd: 1, bs: 700 },
      { label: '450 RP', usd: 5, bs: 3500 },
      { label: '1000 RP', usd: 10, bs: 7000 },
    ],
  },
];
