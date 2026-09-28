import imgBombis from "@/imports/52088.jpg";
import imgBomuva from "@/imports/52084.jpg";
import imgOreo from "@/imports/52080.jpg";
import imgMousese from "@/imports/51587.jpg";
import imgMorango1 from "@/imports/51580.jpg";
import imgMorango2 from "@/imports/51650.jpg";
import imgMorangoPote from "@/imports/morango-pote.jpg";

export interface Product {
  id: number;
  name: string;
  tagline: string;
  description: string;
  layers: string[];
  price: number;
  originalPrice?: number;
  promotionActive?: boolean;
  image: string;
  category: string;
  stock?: number;
  bestseller?: boolean;
  isNew?: boolean;
}

export const SLOGANS = [
  "Feito com carinho, servido em cada colher.",
  "Transformando momentos em doces lembranças.",
  "O sabor que abraça o coração.",
];

export const PRODUCTS: Product[] = [
  {
    id: 1,
    name: "Bombis",
    tagline: "Bombom de Bis",
    description: "Uma combinação crocante e cremosa de Bis, ganache de chocolate e brigadeiro branco. Três camadas que se completam em cada colherada.",
    layers: ["Bis crocante", "Ganache", "Brigadeiro Branco"],
    price: 12.00, image: imgBombis, category: "chocolate", bestseller: true,
  },
  {
    id: 2,
    name: "Bomuva",
    tagline: "Bombom de Uva",
    description: "Uvas frescas, brigadeiro branco e ganache em camadas generosas. Uma mistura delicada de fruta e chocolate para quem ama sabores equilibrados.",
    layers: ["Uva verde", "Brigadeiro Branco", "Ganache", "Ganache"],
    price: 12.00, image: imgBomuva, category: "frutas",
  },
  {
    id: 3,
    name: "Oreo",
    tagline: "Sabor Oreo",
    description: "Oreo triturado, brigadeiro branco e ganache formando uma sobremesa cremosa, intensa e cheia de textura.",
    layers: ["Oreo triturado", "Brigadeiro Branco", "Ganache"],
    price: 12.00, image: imgOreo, category: "especial", bestseller: true,
  },
  {
    id: 4,
    name: "Mousse de Maracujá",
    tagline: "Recorde de Vendas",
    description: "Mousse de maracujá feito com a própria fruta, combinado com brigadeirão. Uma sobremesa cremosa, refrescante e marcante.",
    layers: ["Mousse de Maracujá", "Mousse de Maracujá", "Brigadeirão"],
    price: 12.00, image: imgMousese, category: "mousse", bestseller: true,
  },
  {
    id: 5,
    name: "Bombom no Pote / Morango",
    tagline: "Morango com Brigadeiro",
    description: "Uma combinação delicada e irresistível: uma camada de brigadeiro de Ninho ou brigadeiro tradicional, finalizada com uma camada generosa de morango fresco.",
    layers: ["Brigadeiro de Ninho ou Tradicional", "Morango"],
    price: 12.00, image: imgMorango2, category: "frutas", isNew: true,
  },
  {
    id: 6,
    name: "Morango Cravejado",
    tagline: "Morango, Ninho e Cravejado",
    description: "Camadas pensadas para deixar cada colherada especial: morangos frescos, brigadeiro de Ninho cremoso e uma finalização crocante de cravejado.",
    layers: ["Morango", "Brigadeiro de Ninho", "Cravejado"],
    price: 14.00, image: imgMorangoPote, category: "pote", bestseller: true, isNew: true,
  },
  {
    id: 7,
    name: "Surpresa de Uva",
    tagline: "Uva com Brigadeiro",
    description: "Uma surpresa a cada colherada: duas camadas de brigadeiro branco ou brigadeiro tradicional envolvendo uma camada de uvas frescas. Cremoso, frutado e equilibrado.",
    layers: ["Brigadeiro Branco ou Tradicional", "Uva", "Brigadeiro Branco ou Tradicional"],
    price: 12.00, image: imgBomuva, category: "frutas", isNew: true,
  },
];

export const GALLERY_ITEMS = [
  { id: 1, src: imgMorangoPote, alt: "Morango Cravejado", cls: "col-span-2 row-span-2" },
  { id: 2, src: imgMorango2, alt: "Bombom no Pote com Morango", cls: "" },
  { id: 3, src: imgBomuva, alt: "Bomuva", cls: "" },
  { id: 4, src: imgOreo, alt: "Oreo", cls: "" },
  { id: 5, src: imgBombis, alt: "Bombis", cls: "" },
  { id: 6, src: imgMousese, alt: "Mousse de Maracujá", cls: "col-span-2" },
  { id: 7, src: imgMorango1, alt: "Doces de Morango", cls: "" },
  { id: 8, src: imgMorangoPote, alt: "Doces artesanais BC", cls: "" },
];

export const FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "maisVendidos", label: "Mais Vendidos" },
  { key: "novidades", label: "Novidades" },
  { key: "frutas", label: "Frutas" },
  { key: "chocolate", label: "Chocolate" },
  { key: "mousse", label: "Mousse" },
  { key: "especial", label: "Especial" },
  { key: "pote", label: "No Pote" },
];

export function calcFrete(cidade: string, uf: string, freteFloriano = 3.00, freteBarao = 4.00): number {
  const key = cidade.trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const estado = uf.trim().toUpperCase();
  if (key === "floriano" && estado === "PI") return freteFloriano;
  if (key === "barao de grajau" && estado === "MA") return freteBarao;
  return -1;
}

export const DEFAULT_SETTINGS = {
  nome: "BC Bom Feito Confeitaria",
  whatsapp: "5589994112439",
  whatsappDisplay: "(89) 99411-2439",
  instagram: "bcconfeitaria_doces",
  email: "emillesilva879@gmail.com",
  horario: "Qua – Dom · 14h às 20h",
  pixKey: "ludmyla.emille1412@gmail.com",
  freteFloriano: 3.00,
  freteBarao: 4.00,
  slogans: SLOGANS as string[],
};

export const FALLBACK_IMAGES: Record<number, string> = {
  1: imgBombis,
  2: imgBomuva,
  3: imgOreo,
  4: imgMousese,
  5: imgMorango2,
  6: imgMorangoPote,
  7: imgBomuva,
};
