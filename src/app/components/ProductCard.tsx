import { useState } from "react";
import { motion } from "motion/react";
import { Heart, Layers } from "lucide-react";
import { ImageWithFallback } from "@/app/components/figma/ImageWithFallback";
import type { Product } from "../siteData";

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function ProductCard({ p, onAdd, onBuy, isFav, onFav }: {
  key?: number; p: Product; onAdd(): void; onBuy(): void; isFav: boolean; onFav(): void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }} transition={{ duration: 0.45 }}
      whileHover={{ y: -5 }}
      className="bg-card rounded-3xl shadow-sm border border-border overflow-hidden flex flex-col group bc-hover-lift"
    >
      <div className="relative overflow-hidden bg-[#F3E8FF]">
        <ImageWithFallback src={p.image} alt={p.name}
          className="w-full h-52 object-cover transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />

        <div className="absolute top-3 left-3 flex gap-1.5 flex-wrap bc-bounce-in">
          {p.bestseller && (
            <span className="bg-amber-400 text-amber-900 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wide shadow">
              ⭐ Mais Vendido
            </span>
          )}
          {p.promotionActive && (
            <span className="bg-amber-400 text-amber-900 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wide shadow">
              🏷️ Promoção
            </span>
          )}
          {p.isNew && (
            <span className="bg-[#9B5DE5] text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wide shadow">
              Novo
            </span>
          )}
        </div>

        <button onClick={onFav}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/85 backdrop-blur-sm flex items-center justify-center shadow transition-transform hover:scale-110 bc-favorite-pop">
          <Heart size={15} className={isFav ? "fill-rose-500 text-rose-500" : "text-gray-400"} />
        </button>

        <div className="absolute bottom-3 left-3">
          {p.promotionActive && p.originalPrice && p.originalPrice > p.price ? (
            <div className="bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-2xl shadow-sm">
              <span className="block text-[10px] font-bold text-gray-400 line-through leading-none">{fmt(p.originalPrice)}</span>
              <span className="text-[#16A34A] font-black text-lg leading-none" style={{ fontFamily: "'Fredoka', sans-serif" }}>
                {fmt(p.price)}
              </span>
            </div>
          ) : (
            <span className="bg-white/90 backdrop-blur-sm text-[#9B5DE5] font-black text-lg px-3 py-1 rounded-2xl shadow-sm"
              style={{ fontFamily: "'Fredoka', sans-serif" }}>
              {fmt(p.price)}
            </span>
          )}
        </div>
      </div>

      <div className="p-4 flex flex-col flex-1 gap-3">
        <div>
          <p className="text-[10px] font-bold text-[#F15BB5] uppercase tracking-widest mb-0.5">{p.tagline}</p>
          <h3 className="font-black text-xl text-foreground leading-tight"
            style={{ fontFamily: "'Fredoka', sans-serif" }}>{p.name}</h3>
        </div>

        <div>
          <p className={`text-sm text-muted-foreground leading-relaxed ${expanded ? "" : "line-clamp-2"}`}>
            {p.description}
          </p>
          <button onClick={() => setExpanded(v => !v)}
            className="text-xs text-[#9B5DE5] font-bold mt-1 hover:underline">
            {expanded ? "Ver menos ↑" : "Ver mais ↓"}
          </button>
        </div>

        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Layers size={10} /> Camadas
          </p>
          <div className="flex flex-wrap gap-1">
            {p.layers.map((l, i) => (
              <span key={i} className="text-[10px] bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full font-semibold">
                {l}
              </span>
            ))}
          </div>
        </div>

        <div className="flex gap-2 mt-auto pt-1">
          <button onClick={onAdd} disabled={(p.stock ?? 1) <= 0}
            className="flex-1 bg-secondary text-secondary-foreground text-sm font-bold py-2.5 rounded-2xl hover:bg-[#9B5DE5] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 hover:-translate-y-0.5">
            {(p.stock ?? 1) <= 0 ? "Esgotado" : "+ Carrinho"}
          </button>
          <button onClick={onBuy}
            className="flex-1 bg-gradient-to-r from-[#9B5DE5] to-[#7C3AED] text-white text-sm font-bold py-2.5 rounded-2xl hover:opacity-90 transition-all shadow-sm hover:-translate-y-0.5 hover:shadow-md">
            Pedir Agora
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default ProductCard;
