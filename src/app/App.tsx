/** @jsxRuntime classic */
import React, { useState, useEffect, Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router";
import { motion } from "motion/react";

// Carregado sob demanda: só baixa e executa o código do Admin (e do Supabase)
// quando alguém visita /admin. Assim, qualquer erro de configuração do
// Supabase fica isolado no painel e nunca derruba o site público.
const Admin = lazy(() => import("./Admin"));
import {
  ShoppingCart, Heart, Star, X, Plus, Minus,
  Menu as MenuIcon, ChevronUp, Search, Phone, UserRound,
  Instagram, Clock, MapPin, Mail, Layers,
  MessageCircle, ChefHat, Info, CheckCircle,
  Refrigerator, Truck, Banknote, CreditCard, QrCode, Copy
} from "lucide-react";
import QRCode from "qrcode";
import { buildPixPayload } from "@/lib/pix";
import { ImageWithFallback } from "@/app/components/figma/ImageWithFallback";
import { supabase } from "@/lib/supabaseClient";
import logoImg from "@/imports/logo.jpeg";

// ─── TYPES ───────────────────────────────────────────────────────────────────
import type { Product } from "./siteData";
import {
  PRODUCTS,
  GALLERY_ITEMS,
  FILTERS,
  DEFAULT_SETTINGS,
  calcFrete,
  FALLBACK_IMAGES,
} from "./siteData";
import { openWhatsApp as wa } from "./whatsapp";

interface CartItem extends Product { qty: number; }

interface Review {
  id: number;
  name: string;
  rating: number;
  comment: string;
  avatar: string;
  response?: string;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const Stars = ({ rating, size = 14 }: { rating: number; size?: number }) => (
  <span className="flex gap-0.5">
    {[1,2,3,4,5].map(i => (
      <Star key={i} size={size}
        className={i <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-gray-200"} />
    ))}
  </span>
);

// ─── PRODUCT CARD ─────────────────────────────────────────────────────────────
import ProductCard from "./components/ProductCard";

// ─── MAIN SITE ────────────────────────────────────────────────────────────────
function MainSite() {
  const [activeSection, setActiveSection]   = useState("home");
  const [cartItems, setCartItems]           = useState<CartItem[]>([]);
  const [siteProducts, setSiteProducts]     = useState<Product[]>(PRODUCTS);
  const [productsLoading, setProductsLoading] = useState(true);
  const [cartOpen, setCartOpen]             = useState(false);
  const [cartTab, setCartTab]               = useState<"itens"|"cliente"|"frete">("itens");
  const [customerInfo, setCustomerInfo]     = useState({ nome: "", telefone: "", observacao: "" });
  const [deliveryType, setDeliveryType]     = useState<"retirada"|"entrega">("entrega");
  const [cep, setCep]                       = useState("");
  const [cepLoading, setCepLoading]         = useState(false);
  const [cepError, setCepError]             = useState("");
  const [address, setAddress]               = useState({ rua: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "" });
  const [paymentMethod, setPaymentMethod]   = useState<"" | "dinheiro" | "pix" | "cartao">("");
  const [precisaTroco, setPrecisaTroco]     = useState<"" | "sim" | "nao">("");
  const [trocoPara, setTrocoPara]           = useState("");
  const [pixQrDataUrl, setPixQrDataUrl]     = useState("");
  const [pixCopiado, setPixCopiado]         = useState(false);
  const [favorites, setFavorites]           = useState<Set<number>>(new Set());
  const [activeFilter, setActiveFilter]     = useState("todos");
  const [sloganIndex, setSloganIndex]       = useState(0);
  const [showBackToTop, setShowBackToTop]   = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery]       = useState("");
  const [reviews, setReviews]               = useState<Review[]>([]);
  const [newReview, setNewReview]           = useState({ name: "", rating: 5, comment: "" });
  const [reviewDone, setReviewDone]         = useState(false);
  const [hoverStar, setHoverStar]           = useState(0);
  const [settings, setSettings]             = useState(DEFAULT_SETTINGS);
  const [galleryItems, setGalleryItems]     = useState<{ id: number; src: string; alt: string; cls: string }[] | null>(null);

  useEffect(() => {
    const t = setInterval(() => setSloganIndex(i => (i + 1) % settings.slogans.length), 3800);
    return () => clearInterval(t);
  }, [settings.slogans.length]);

  // Configurações da loja (WhatsApp, PIX, Instagram, horário, fretes, slogans)
  // vêm do Supabase e refletem o que a admin altera em Configurações — os
  // valores padrão acima servem só de fallback enquanto isso carrega.
  useEffect(() => {
    supabase.from("site_settings").select("*").eq("id", 1).maybeSingle().then(({ data, error }) => {
      if (error || !data) return;
      setSettings({
        nome: data.nome || DEFAULT_SETTINGS.nome,
        whatsapp: (data.whatsapp || "").replace(/\D/g, "") || DEFAULT_SETTINGS.whatsapp,
        whatsappDisplay: data.whatsapp || DEFAULT_SETTINGS.whatsappDisplay,
        instagram: (data.instagram || DEFAULT_SETTINGS.instagram).replace(/^@/, ""),
        email: data.email || DEFAULT_SETTINGS.email,
        horario: data.horario || DEFAULT_SETTINGS.horario,
        pixKey: data.pix_key || DEFAULT_SETTINGS.pixKey,
        freteFloriano: Number(data.frete_floriano ?? DEFAULT_SETTINGS.freteFloriano),
        freteBarao: Number(data.frete_barao ?? DEFAULT_SETTINGS.freteBarao),
        slogans: (data.slogans && data.slogans.length) ? data.slogans : DEFAULT_SETTINGS.slogans,
      });
    });
  }, []);

  // Galeria pública: usa o que a admin cadastrou no Supabase Storage; se
  // ainda não houver nada cadastrado, mantém as fotos locais de sempre.
  useEffect(() => {
    supabase.from("gallery_items").select("*").order("id").then(({ data, error }) => {
      if (error || !data?.length) return;
      setGalleryItems(data.map((g: any, i: number) => ({
        id: g.id, src: g.url, alt: g.name || "Foto da confeitaria",
        cls: GALLERY_ITEMS[i]?.cls || "",
      })));
    });
  }, []);

  // Avaliações de verdade, vindas do Supabase — só as já aprovadas no painel
  // admin aparecem aqui. Ficam permanentes: sobrevivem a recarregar a página.
  useEffect(() => {
    supabase.from("reviews").select("*")
      .eq("approved", true)
      .order("pinned", { ascending: false })
      .order("date", { ascending: false })
      .then(({ data, error }) => {
        if (error) { console.error("Erro ao carregar avaliações:", error.message); return; }
        setReviews((data || []).map((r: any) => ({
          id: r.id, name: r.name, rating: r.rating, comment: r.comment ?? "",
          avatar: (r.name?.[0] || "?").toUpperCase(),
          response: r.response ?? undefined,
        })));
      });
  }, []);

  // Catálogo público vem do Supabase; os dados locais permanecem como fallback
  // para preservar a identidade visual mesmo quando o banco estiver indisponível.
  useEffect(() => {
    let active = true;
    supabase.from("products").select("*").eq("active", true).order("id").then(({ data, error }) => {
      if (!active) return;
      if (error || !data?.length) {
        setSiteProducts(PRODUCTS);
      } else {
        const fallbackImages = FALLBACK_IMAGES;
        setSiteProducts(data.map((r: any) => ({
          id: Number(r.id), name: r.name, tagline: r.tagline ?? "",
          description: r.description ?? "", layers: r.layers ?? [],
          price: Number(r.price ?? 0), image: r.image_url || fallbackImages[Number(r.id)] || FALLBACK_IMAGES[1],
          category: r.category ?? "especial", bestseller: !!r.bestseller, isNew: !!r.is_new,
          stock: Number(r.stock ?? 0),
        } as Product & { stock: number })));
      }
      setProductsLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const onScroll = () => {
      setShowBackToTop(window.scrollY > 500);
      const ids = ["home", "cardapio", "galeria", "avaliacoes", "contato"];
      for (const id of [...ids].reverse()) {
        const el = document.getElementById(id);
        if (el && window.scrollY >= el.offsetTop - 120) { setActiveSection(id); break; }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const addToCart = (p: Product) => {
    const stock = Number((p as Product & { stock?: number }).stock ?? 999999);
    if (stock <= 0) return;
    setCartItems(prev => {
      const ex = prev.find(i => i.id === p.id);
      if (ex) return prev.map(i => i.id === p.id ? { ...i, qty: Math.min(stock, i.qty + 1) } : i);
      return [...prev, { ...p, qty: 1 }];
    });
    setCartOpen(true);
    setCartTab("itens");
  };

  const updateQty = (id: number, delta: number) =>
    setCartItems(prev =>
      prev.map(i => i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i).filter(i => i.qty > 0)
    );

  const toggleFav = (id: number) =>
    setFavorites(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const cartSubtotal = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
  const freteValue   = deliveryType === "retirada" ? 0
    : address.cidade ? calcFrete(address.cidade, address.uf, settings.freteFloriano, settings.freteBarao)
    : null;
  const cartTotal    = cartSubtotal + (freteValue !== null && freteValue >= 0 ? freteValue : 0);

  const totalConhecido = deliveryType === "retirada" || (freteValue !== null && freteValue >= 0);

  useEffect(() => {
    if (paymentMethod !== "pix") return;
    const payload = buildPixPayload({
      key: settings.pixKey,
      name: "BC Bom Feito",
      city: "Floriano",
      amount: totalConhecido ? cartTotal : undefined,
    });
    QRCode.toDataURL(payload, { width: 220, margin: 1 })
      .then(setPixQrDataUrl)
      .catch(() => setPixQrDataUrl(""));
  }, [paymentMethod, cartTotal, totalConhecido, settings.pixKey]);

  const fetchCep = async (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (digits.length !== 8) { setCepError("CEP deve ter 8 dígitos"); return; }
    setCepLoading(true); setCepError("");
    try {
      const res  = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (data.erro) { setCepError("CEP não encontrado"); return; }
      setAddress(a => ({ ...a, rua: data.logradouro || "", bairro: data.bairro || "", cidade: data.localidade || "", uf: data.uf || "" }));
    } catch {
      setCepError("Erro ao buscar CEP. Tente novamente.");
    } finally {
      setCepLoading(false);
    }
  };
  const cartCount    = cartItems.reduce((s, i) => s + i.qty, 0);

  const filtered = siteProducts.filter(p => {
    const fOk = activeFilter === "todos"
      || (activeFilter === "maisVendidos" && p.bestseller)
      || (activeFilter === "novidades"    && p.isNew)
      || (activeFilter === "frutas"       && p.category === "frutas")
      || (activeFilter === "chocolate"    && p.category === "chocolate")
      || (activeFilter === "mousse"       && p.category === "mousse")
      || (activeFilter === "especial"     && p.category === "especial")
    || (activeFilter === "pote"         && p.category === "pote");
    const sOk = !searchQuery
      || p.name.toLowerCase().includes(searchQuery.toLowerCase())
      || p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return fOk && sOk;
  });

  const scrollTo = (id: string) => {
    setMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const submitReview = async () => {
    if (!newReview.name.trim() || !newReview.comment.trim()) return;
    const { error } = await supabase.from("reviews").insert({
      id: Date.now(),
      name: newReview.name.trim(),
      rating: newReview.rating,
      comment: newReview.comment.trim(),
      date: new Date().toISOString().slice(0, 10),
      approved: false,
      pinned: false,
    });
    if (error) { console.error("Erro ao enviar avaliação:", error.message); return; }
    setNewReview({ name: "", rating: 5, comment: "" });
    setHoverStar(0);
    setReviewDone(true);
    setTimeout(() => setReviewDone(false), 4000);
  };

  const navItems = [
    { label: "Home",       id: "home" },
    { label: "Cardápio",   id: "cardapio" },
    { label: "Galeria",    id: "galeria" },
    { label: "Avaliações", id: "avaliacoes" },
    { label: "Contato",    id: "contato" },
  ];

  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : "5.0";

  return (
    <div className="min-h-screen text-foreground overflow-x-hidden"
      style={{ fontFamily: "'Nunito', sans-serif", background: "var(--background)" }}>

      {/* ── NAVBAR ──────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-40 px-4 py-3">
        <div className="max-w-6xl mx-auto bg-white/80 backdrop-blur-xl rounded-2xl shadow-sm border border-border flex items-center justify-between px-5 py-3">
          <button onClick={() => scrollTo("home")} className="flex items-center gap-2.5">
            <ImageWithFallback src={logoImg} alt="BC Bom Feito"
              className="w-10 h-10 rounded-xl object-cover shadow" />
            <div className="leading-tight">
              <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">BC</p>
              <p className="text-sm font-black text-foreground" style={{ fontFamily: "'Fredoka', sans-serif" }}>Bom Feito</p>
            </div>
          </button>

          <ul className="hidden md:flex items-center gap-1">
            {navItems.map(({ label, id }) => (
              <li key={id}>
                <button onClick={() => scrollTo(id)}
                  className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    activeSection === id
                      ? "bg-[#9B5DE5] text-white shadow-sm"
                      : "text-foreground/70 hover:bg-secondary hover:text-foreground"
                  }`}>
                  {label}
                </button>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2">
            <button onClick={() => setCartOpen(true)}
              className="relative w-10 h-10 rounded-xl bg-secondary flex items-center justify-center hover:bg-[#9B5DE5] hover:text-white transition-all duration-200">
              <ShoppingCart size={18} />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#F15BB5] text-white text-[10px] font-black rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
            <button onClick={() => setMobileMenuOpen(v => !v)}
              className="md:hidden w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
              {mobileMenuOpen ? <X size={18} /> : <MenuIcon size={18} />}
            </button>
          </div>
        </div>

        <motion.div animate={{ height: mobileMenuOpen ? "auto" : 0, opacity: mobileMenuOpen ? 1 : 0 }}
          initial={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }}
          className="overflow-hidden max-w-6xl mx-auto mt-1">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl border border-border p-3 flex flex-col gap-1">
            {navItems.map(({ label, id }) => (
              <button key={id} onClick={() => scrollTo(id)}
                className="text-left px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-secondary transition-colors">
                {label}
              </button>
            ))}
          </div>
        </motion.div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────────────── */}
      <section id="home"
        className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden pt-24 pb-16 px-4"
        style={{ background: "radial-gradient(ellipse at 20% 50%,#F3E8FF 0%,transparent 50%),radial-gradient(ellipse at 80% 20%,#FFE4EF 0%,transparent 50%),radial-gradient(ellipse at 60% 80%,#FFF0E6 0%,transparent 50%),#FFF5EF" }}>
        <div className="absolute top-1/4 left-10 w-64 h-64 rounded-full bg-[#C4B5FD]/20 blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-10 w-80 h-80 rounded-full bg-[#FFB3C6]/20 blur-3xl pointer-events-none" />

        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }} className="text-center z-10 max-w-2xl">

          <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.7 }} className="mb-7">
            <ImageWithFallback src={logoImg} alt="BC Bom Feito Confeitaria"
              className="w-44 h-44 md:w-56 md:h-56 rounded-full object-cover mx-auto shadow-2xl shadow-[#9B5DE5]/25 border-4 border-white/70" />
          </motion.div>

          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="text-muted-foreground text-xs font-bold tracking-widest uppercase mb-6">
            Confeitaria Artesanal · Floriano – PI
          </motion.p>

          <div className="h-16 mb-10 overflow-hidden flex items-center justify-center">
            <motion.p key={sloganIndex} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-2xl md:text-3xl text-foreground/80 font-semibold"
              style={{ fontFamily: "'Caveat', cursive" }}>
              "{settings.slogans[sloganIndex % settings.slogans.length]}"
            </motion.p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => scrollTo("cardapio")}
              className="inline-flex items-center gap-2.5 bg-gradient-to-r from-[#9B5DE5] to-[#7C3AED] text-white px-8 py-3.5 rounded-2xl font-bold text-base shadow-lg shadow-[#9B5DE5]/30 hover:opacity-90 transition-opacity">
              <MessageCircle size={18} /> Pedir Agora
            </motion.button>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => scrollTo("cardapio")}
              className="inline-flex items-center gap-2 bg-white/70 backdrop-blur-sm border border-border text-foreground px-8 py-3.5 rounded-2xl font-bold text-base hover:bg-white transition-colors">
              Ver Cardápio
            </motion.button>
          </div>

          <div className="mt-10 inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Clock size={14} /> <span>Qua – Dom &nbsp;·&nbsp; 14h às 20h</span>
          </div>
        </motion.div>

        <motion.div animate={{ y: [0, 10, 0] }} transition={{ duration: 2, repeat: Infinity }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 w-6 h-10 rounded-full border-2 border-[#C4B5FD] flex items-start justify-center pt-1.5">
          <div className="w-1.5 h-3 bg-[#9B5DE5] rounded-full" />
        </motion.div>
      </section>

      {/* ── CARDÁPIO ────────────────────────────────────────────────────────── */}
      <section id="cardapio" className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-12">
            <p className="text-[#9B5DE5] font-bold tracking-widest uppercase text-xs mb-3">Nossos Produtos</p>
            <h2 className="text-4xl md:text-5xl font-black text-foreground" style={{ fontFamily: "'Fredoka', sans-serif" }}>
              Cardápio
            </h2>
          </motion.div>

          {/* Info banner */}
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="mb-10 bg-gradient-to-r from-[#F3E8FF] to-[#FDE8F0] border border-[#C4B5FD]/30 rounded-3xl p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="w-10 h-10 rounded-2xl bg-[#9B5DE5]/10 flex items-center justify-center flex-shrink-0">
              <Info size={20} className="text-[#9B5DE5]" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-foreground mb-1">Informações Importantes</p>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-6 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Clock size={13} className="text-[#9B5DE5]" /> Encomendas com 1 a 3 dias de antecedência
                </span>
                <span className="flex items-center gap-1.5">
                  <Refrigerator size={13} className="text-[#F15BB5]" /> Produtos com frutas devem ser refrigerados
                </span>
              </div>
            </div>
          </motion.div>

          {/* Search + filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-8">
            <div className="relative max-w-xs w-full">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="text" placeholder="Buscar produto..." value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-[#C4B5FD] transition-all" />
            </div>
            <div className="flex gap-2 flex-wrap">
              {FILTERS.map(f => (
                <button key={f.key} onClick={() => setActiveFilter(f.key)}
                  className={`px-4 py-2 rounded-2xl text-sm font-semibold transition-all whitespace-nowrap ${
                    activeFilter === f.key
                      ? "bg-[#9B5DE5] text-white shadow-sm"
                      : "bg-card border border-border text-foreground/70 hover:border-[#9B5DE5]/40"
                  }`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {productsLoading ? (
            <div className="text-center py-20 text-muted-foreground">
              <ChefHat size={48} className="mx-auto mb-4 opacity-30 animate-pulse" />
              <p className="text-lg font-semibold">Carregando cardápio...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <ChefHat size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-lg font-semibold">Nenhum produto encontrado</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map(p => (
                <ProductCard key={p.id} p={p}
                  onAdd={() => addToCart(p)}
                  onBuy={() => addToCart(p)}
                  isFav={favorites.has(p.id)} onFav={() => toggleFav(p.id)} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── GALERIA ─────────────────────────────────────────────────────────── */}
      <section id="galeria" className="py-24 px-4 bg-gradient-to-b from-[#FFF5EF] to-[#F3E8FF]/30">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-12">
            <p className="text-[#9B5DE5] font-bold tracking-widest uppercase text-xs mb-3">Nossa Arte</p>
            <h2 className="text-4xl md:text-5xl font-black text-foreground" style={{ fontFamily: "'Fredoka', sans-serif" }}>
              Galeria
            </h2>
            <p className="text-muted-foreground mt-3 text-sm">Cada camada, uma história doce.</p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 auto-rows-[180px]">
            {(galleryItems || GALLERY_ITEMS).map((img, i) => (
              <motion.div key={img.id}
                initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }} transition={{ delay: i * 0.07 }} whileHover={{ scale: 1.02 }}
                className={`overflow-hidden rounded-3xl bg-[#F3E8FF] ${img.cls}`}>
                <ImageWithFallback src={img.src} alt={img.alt} className="w-full h-full object-cover" />
              </motion.div>
            ))}
          </div>

          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
            className="text-center mt-10">
            <a href={`https://www.instagram.com/${settings.instagram}`} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 border border-border bg-card text-foreground px-6 py-3 rounded-2xl text-sm font-bold hover:bg-secondary transition-colors shadow-sm">
              <Instagram size={16} className="text-[#F15BB5]" /> Ver mais no Instagram @{settings.instagram}
            </a>
          </motion.div>
        </div>
      </section>

      {/* ── AVALIAÇÕES ──────────────────────────────────────────────────────── */}
      <section id="avaliacoes" className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-10">
            <p className="text-[#F15BB5] font-bold tracking-widest uppercase text-xs mb-3">O Que Dizem</p>
            <h2 className="text-4xl md:text-5xl font-black text-foreground" style={{ fontFamily: "'Fredoka', sans-serif" }}>
              Avaliações
            </h2>
          </motion.div>

          {/* Rating hero banner */}
          <motion.div initial={{ opacity: 0, scale: 0.96 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
            className="mb-12 bg-gradient-to-r from-[#9B5DE5] to-[#F15BB5] rounded-3xl p-10 text-white text-center relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
              {[...Array(12)].map((_, i) => (
                <Star key={i} size={20} fill="white"
                  className="absolute text-white opacity-10"
                  style={{ top: `${(i * 17) % 100}%`, left: `${(i * 23 + 5) % 100}%` }} />
              ))}
            </div>
            <div className="relative z-10">
              <p className="text-7xl font-black leading-none mb-3" style={{ fontFamily: "'Fredoka', sans-serif" }}>
                {avgRating}
              </p>
              <Stars rating={5} size={28} />
              <p className="mt-4 text-white/80 font-semibold text-lg">
                {reviews.length === 0
                  ? "Seja o primeiro a avaliar nossa confeitaria!"
                  : `${reviews.length} avaliação${reviews.length > 1 ? "ões" : ""} de clientes`}
              </p>
              {reviews.length === 0 && (
                <p className="text-white/60 text-sm mt-2">Compartilhe sua experiência conosco ↓</p>
              )}
            </div>
          </motion.div>

          {/* Review cards */}
          {reviews.length > 0 && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
              {reviews.map((r, i) => (
                <motion.div key={r.id}
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="bg-card border border-border rounded-3xl p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#9B5DE5] to-[#F15BB5] flex items-center justify-center text-white font-black text-base flex-shrink-0">
                      {r.avatar}
                    </div>
                    <div>
                      <p className="font-bold text-foreground">{r.name}</p>
                      <Stars rating={r.rating} />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed italic">"{r.comment}"</p>
                  {r.response && (
                    <div className="mt-4 bg-[#9B5DE5]/5 border border-[#9B5DE5]/15 rounded-2xl p-4">
                      <p className="text-[10px] font-bold text-[#9B5DE5] uppercase tracking-wider mb-1">
                        Resposta da Loja
                      </p>
                      <p className="text-sm text-foreground/80 leading-relaxed">{r.response}</p>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}

          {/* Review form */}
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="max-w-xl mx-auto">
            <div className="bg-card border border-border rounded-3xl p-7 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#9B5DE5] to-[#F15BB5] flex items-center justify-center">
                  <Star size={18} className="text-white fill-white" />
                </div>
                <div>
                  <h3 className="font-black text-xl text-foreground" style={{ fontFamily: "'Fredoka', sans-serif" }}>
                    Deixe sua Avaliação
                  </h3>
                  <p className="text-xs text-muted-foreground">Sua opinião é muito importante!</p>
                </div>
              </div>

              {reviewDone ? (
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  className="text-center py-10">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#9B5DE5] to-[#F15BB5] flex items-center justify-center mx-auto mb-4">
                    <CheckCircle size={32} className="text-white" />
                  </div>
                  <p className="font-black text-xl text-foreground" style={{ fontFamily: "'Fredoka', sans-serif" }}>
                    Obrigada pela avaliação!
                  </p>
                  <p className="text-muted-foreground text-sm mt-2">Seu comentário foi enviado e vai aparecer aqui assim que for aprovado.</p>
                </motion.div>
              ) : (
                <div className="flex flex-col gap-4">
                  <input type="text" placeholder="Seu nome" value={newReview.name}
                    onChange={e => setNewReview(r => ({ ...r, name: e.target.value }))}
                    className="w-full px-4 py-3 rounded-2xl border border-border bg-[#F9F0FF] text-sm focus:outline-none focus:ring-2 focus:ring-[#C4B5FD] transition-all" />

                  <div className="bg-secondary/50 rounded-2xl p-4">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Sua nota</p>
                    <div className="flex gap-2 justify-center">
                      {[1,2,3,4,5].map(n => (
                        <button key={n}
                          onClick={() => setNewReview(r => ({ ...r, rating: n }))}
                          onMouseEnter={() => setHoverStar(n)}
                          onMouseLeave={() => setHoverStar(0)}
                          className="transition-transform hover:scale-125">
                          <Star size={32} className={`transition-colors ${
                            n <= (hoverStar || newReview.rating)
                              ? "fill-amber-400 text-amber-400"
                              : "text-gray-200"
                          }`} />
                        </button>
                      ))}
                    </div>
                    <p className="text-center text-xs text-muted-foreground mt-2 font-semibold h-4">
                      {["","Ruim","Regular","Bom","Muito bom","Excelente!"][hoverStar || newReview.rating]}
                    </p>
                  </div>

                  <textarea rows={3} placeholder="Conte sua experiência com nossos produtos..."
                    value={newReview.comment}
                    onChange={e => setNewReview(r => ({ ...r, comment: e.target.value }))}
                    className="w-full px-4 py-3 rounded-2xl border border-border bg-[#F9F0FF] text-sm focus:outline-none focus:ring-2 focus:ring-[#C4B5FD] resize-none transition-all" />

                  <p className="text-xs text-muted-foreground text-center -mt-2">
                    Dúvidas? Entre em contato: <a href={`mailto:${settings.email}`}
                      className="text-[#9B5DE5] font-bold hover:underline">{settings.email}</a>
                  </p>

                  <button onClick={submitReview}
                    disabled={!newReview.name.trim() || !newReview.comment.trim()}
                    className="bg-gradient-to-r from-[#9B5DE5] to-[#7C3AED] text-white font-bold py-3.5 rounded-2xl hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
                    Publicar Avaliação
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── CONTATO ─────────────────────────────────────────────────────────── */}
      <section id="contato" className="py-24 px-4 bg-gradient-to-b from-[#FFF5EF] to-[#F3E8FF]/40">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-12">
            <p className="text-[#9B5DE5] font-bold tracking-widest uppercase text-xs mb-3">Fale Conosco</p>
            <h2 className="text-4xl md:text-5xl font-black text-foreground" style={{ fontFamily: "'Fredoka', sans-serif" }}>
              Contato
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <motion.button initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              whileHover={{ y: -4 }} onClick={() => wa(undefined, settings.whatsapp)}
              className="bg-gradient-to-br from-[#25D366] to-[#128C7E] text-white rounded-3xl p-6 text-left shadow-lg shadow-green-500/20 flex flex-col gap-3">
              <div className="w-11 h-11 bg-white/20 rounded-2xl flex items-center justify-center">
                <MessageCircle size={22} />
              </div>
              <div>
                <p className="font-black text-base" style={{ fontFamily: "'Fredoka', sans-serif" }}>WhatsApp</p>
                <p className="text-white/80 text-xs mt-0.5">{settings.whatsappDisplay}</p>
              </div>
              <span className="text-xs bg-white/20 rounded-full px-3 py-1 w-fit font-bold">Fazer Pedido</span>
            </motion.button>

            <motion.a href={`https://www.instagram.com/${settings.instagram}`} target="_blank" rel="noreferrer"
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: 0.08 }} whileHover={{ y: -4 }}
              className="bg-gradient-to-br from-[#E1306C] via-[#833AB4] to-[#FD1D1D] text-white rounded-3xl p-6 flex flex-col gap-3 shadow-lg shadow-pink-500/20">
              <div className="w-11 h-11 bg-white/20 rounded-2xl flex items-center justify-center">
                <Instagram size={22} />
              </div>
              <div>
                <p className="font-black text-base" style={{ fontFamily: "'Fredoka', sans-serif" }}>Instagram</p>
                <p className="text-white/80 text-xs mt-0.5">@{settings.instagram}</p>
              </div>
              <span className="text-xs bg-white/20 rounded-full px-3 py-1 w-fit font-bold">Seguir</span>
            </motion.a>

            <motion.a href={`mailto:${settings.email}`}
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: 0.16 }} whileHover={{ y: -4 }}
              className="bg-gradient-to-br from-[#9B5DE5] to-[#7C3AED] text-white rounded-3xl p-6 flex flex-col gap-3 shadow-lg shadow-purple-500/20">
              <div className="w-11 h-11 bg-white/20 rounded-2xl flex items-center justify-center">
                <Mail size={22} />
              </div>
              <div>
                <p className="font-black text-base" style={{ fontFamily: "'Fredoka', sans-serif" }}>E-mail</p>
                <p className="text-white/80 text-xs mt-0.5 break-all">{settings.email}</p>
              </div>
              <span className="text-xs bg-white/20 rounded-full px-3 py-1 w-fit font-bold">Enviar mensagem</span>
            </motion.a>

            <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: 0.24 }}
              className="bg-card border border-border rounded-3xl p-6 flex flex-col gap-3">
              <div className="w-11 h-11 bg-secondary rounded-2xl flex items-center justify-center">
                <Clock size={22} className="text-[#9B5DE5]" />
              </div>
              <div>
                <p className="font-black text-base text-foreground" style={{ fontFamily: "'Fredoka', sans-serif" }}>Horário</p>
                <p className="text-[#9B5DE5] font-black mt-0.5">{settings.horario}</p>
              </div>
              <p className="text-xs text-muted-foreground">Pedidos fora do horário pelo WhatsApp</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer className="bg-foreground text-white py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <ImageWithFallback src={logoImg} alt="BC Bom Feito" className="w-10 h-10 rounded-xl object-cover" />
              <div>
                <p className="font-black text-white" style={{ fontFamily: "'Fredoka', sans-serif" }}>BC Bom Feito Confeitaria</p>
                <p className="text-white/40 text-xs">Ludmyla Emille de Souza Silva</p>
              </div>
            </div>
            <div className="flex gap-4 text-sm text-white/50 flex-wrap justify-center">
              {navItems.map(({ label, id }) => (
                <button key={id} onClick={() => scrollTo(id)} className="hover:text-white transition-colors">{label}</button>
              ))}
            </div>
            <div className="flex gap-3">
              <a href={`https://www.instagram.com/${settings.instagram}`} target="_blank" rel="noreferrer"
                className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center hover:bg-[#F15BB5] transition-colors">
                <Instagram size={16} />
              </a>
              <button onClick={() => wa(undefined, settings.whatsapp)}
                className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center hover:bg-[#25D366] transition-colors">
                <Phone size={16} />
              </button>
              <a href={`mailto:${settings.email}`}
                className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center hover:bg-[#9B5DE5] transition-colors">
                <Mail size={16} />
              </a>
            </div>
          </div>
          <div className="border-t border-white/10 mt-8 pt-6 text-center text-white/30 text-xs">
            © {new Date().getFullYear()} BC Bom Feito Confeitaria · Todos os direitos reservados
          </div>
        </div>
      </footer>

      {/* ── CART OVERLAY ────────────────────────────────────────────────────── */}
      <motion.div animate={{ opacity: cartOpen ? 1 : 0, pointerEvents: cartOpen ? "auto" : "none" }}
        initial={{ opacity: 0 }}
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50"
        onClick={() => setCartOpen(false)} />

      {/* ── CART DRAWER ─────────────────────────────────────────────────────── */}
      <motion.div animate={{ x: cartOpen ? 0 : "100%" }} initial={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 250 }}
        className="fixed inset-y-0 right-0 w-full max-w-sm bg-white z-50 flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <ShoppingCart size={18} className="text-[#9B5DE5]" />
            <h3 className="font-black text-foreground" style={{ fontFamily: "'Fredoka', sans-serif" }}>Carrinho</h3>
            {cartCount > 0 && (
              <span className="bg-[#9B5DE5] text-white text-xs font-bold px-2 py-0.5 rounded-full">{cartCount}</span>
            )}
          </div>
          <button onClick={() => setCartOpen(false)}
            className="w-8 h-8 rounded-xl bg-secondary flex items-center justify-center hover:bg-muted transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 p-3 border-b border-border bg-secondary/20">
          {(["itens", "cliente", "frete"] as const).map(tab => (
            <button key={tab} onClick={() => setCartTab(tab)}
              className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                cartTab === tab ? "bg-[#9B5DE5] text-white shadow-sm" : "text-muted-foreground hover:bg-secondary"
              }`}>
              {tab === "itens" ? <ShoppingCart size={14} /> : tab === "cliente" ? <UserRound size={14} /> : <Truck size={14} />}
              {tab === "itens" ? "Itens" : tab === "cliente" ? "Cliente" : "Frete"}
              {tab === "frete" && freteValue !== null && freteValue >= 0 && (
                <span className="text-[10px] bg-white/20 rounded-full px-1.5">{fmt(freteValue)}</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab: Itens */}
        {cartTab === "itens" && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cartItems.length === 0 ? (
              <div className="text-center py-16">
                <ShoppingCart size={48} className="mx-auto mb-4 text-[#C4B5FD]" />
                <p className="font-semibold text-muted-foreground">Seu carrinho está vazio</p>
                <button onClick={() => { setCartOpen(false); scrollTo("cardapio"); }}
                  className="mt-4 text-sm text-[#9B5DE5] font-bold hover:underline">
                  Ver Cardápio
                </button>
              </div>
            ) : (
              cartItems.map(item => (
                <div key={item.id} className="flex gap-3 bg-secondary/40 rounded-2xl p-3">
                  <ImageWithFallback src={item.image} alt={item.name}
                    className="w-16 h-16 rounded-xl object-cover bg-[#F3E8FF] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-foreground truncate">{item.name}</p>
                    <p className="text-[10px] text-muted-foreground">{item.tagline}</p>
                    <p className="text-[#9B5DE5] font-black text-sm mt-0.5">{fmt(item.price * item.qty)}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <button onClick={() => updateQty(item.id, -1)}
                        className="w-6 h-6 rounded-lg bg-white border border-border flex items-center justify-center hover:border-[#9B5DE5] transition-colors">
                        <Minus size={10} />
                      </button>
                      <span className="text-sm font-black w-5 text-center">{item.qty}</span>
                      <button onClick={() => updateQty(item.id, 1)}
                        className="w-6 h-6 rounded-lg bg-white border border-border flex items-center justify-center hover:border-[#9B5DE5] transition-colors">
                        <Plus size={10} />
                      </button>
                    </div>
                  </div>
                  <button onClick={() => updateQty(item.id, -99)}
                    className="text-muted-foreground hover:text-destructive transition-colors self-start mt-1">
                    <X size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab: Cliente */}
        {cartTab === "cliente" && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <UserRound size={12} /> Informações do Cliente
              </p>
              <p className="text-xs text-muted-foreground">
                Preencha seus dados para identificarmos corretamente o comprador no pedido.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-foreground ml-1 mb-1.5 block">Nome completo *</label>
                <input
                  type="text"
                  placeholder="Ex.: João da Silva"
                  value={customerInfo.nome}
                  onChange={e => setCustomerInfo(c => ({ ...c, nome: e.target.value }))}
                  className="w-full px-4 py-3 rounded-2xl border border-border bg-[#F9F0FF] text-sm focus:outline-none focus:ring-2 focus:ring-[#C4B5FD] transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-foreground ml-1 mb-1.5 block">Telefone / WhatsApp *</label>
                <input
                  type="tel"
                  inputMode="tel"
                  placeholder="(89) 99999-9999"
                  value={customerInfo.telefone}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 11);
                    let formatted = v;
                    if (v.length > 10) formatted = `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`;
                    else if (v.length > 6) formatted = `(${v.slice(0,2)}) ${v.slice(2,6)}-${v.slice(6)}`;
                    else if (v.length > 2) formatted = `(${v.slice(0,2)}) ${v.slice(2)}`;
                    setCustomerInfo(c => ({ ...c, telefone: formatted }));
                  }}
                  className="w-full px-4 py-3 rounded-2xl border border-border bg-[#F9F0FF] text-sm focus:outline-none focus:ring-2 focus:ring-[#C4B5FD] transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-foreground ml-1 mb-1.5 block">Observação <span className="font-normal text-muted-foreground">(opcional)</span></label>
                <textarea
                  placeholder="Ex.: ponto de referência, preferência ou outra informação..."
                  value={customerInfo.observacao}
                  onChange={e => setCustomerInfo(c => ({ ...c, observacao: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-3 rounded-2xl border border-border bg-[#F9F0FF] text-sm focus:outline-none focus:ring-2 focus:ring-[#C4B5FD] transition-all resize-none"
                />
              </div>
            </div>

            <div className="bg-[#F3E8FF] rounded-2xl p-4 flex items-start gap-3">
              <Info size={18} className="text-[#9B5DE5] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Seus dados serão enviados junto com o pedido pelo WhatsApp para facilitar a identificação e o atendimento.
              </p>
            </div>
          </div>
        )}

        {/* Tab: Frete */}
        {cartTab === "frete" && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">

            {/* Tipo de entrega */}
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Truck size={12} /> Forma de Entrega
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(["retirada", "entrega"] as const).map(tipo => (
                  <button key={tipo} onClick={() => { setDeliveryType(tipo); setCepError(""); }}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all text-sm font-bold ${
                      deliveryType === tipo
                        ? "border-[#9B5DE5] bg-[#F3E8FF] text-[#9B5DE5]"
                        : "border-border bg-card text-muted-foreground hover:border-[#C4B5FD]"
                    }`}>
                    {tipo === "retirada" ? <MapPin size={18} /> : <Truck size={18} />}
                    {tipo === "retirada" ? "Retirar na Loja" : "Entrega"}
                    <span className="text-[10px] font-semibold opacity-70">
                      {tipo === "retirada" ? "Grátis" : "Calcular pelo CEP"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Endereço via ViaCEP */}
            {deliveryType === "entrega" && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin size={12} /> Endereço de Entrega
                </p>

                {/* CEP */}
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text" placeholder="CEP (somente números)"
                      value={cep} maxLength={9}
                      onChange={e => {
                        const v = e.target.value.replace(/\D/g, "").slice(0, 8);
                        const fmt8 = v.length > 5 ? v.slice(0,5) + "-" + v.slice(5) : v;
                        setCep(fmt8); setCepError("");
                        if (v.length === 8) fetchCep(v);
                      }}
                      className="w-full px-4 py-3 rounded-2xl border border-border bg-[#F9F0FF] text-sm focus:outline-none focus:ring-2 focus:ring-[#C4B5FD] transition-all pr-10"
                    />
                    {cepLoading && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-[#9B5DE5] border-t-transparent rounded-full animate-spin" />
                    )}
                  </div>
                  <button onClick={() => fetchCep(cep.replace(/\D/g, ""))}
                    disabled={cepLoading || cep.replace(/\D/g, "").length !== 8}
                    className="px-4 py-3 bg-[#9B5DE5] text-white text-sm font-bold rounded-2xl hover:opacity-90 disabled:opacity-40 transition-all flex-shrink-0">
                    Buscar
                  </button>
                </div>

                {cepError && (
                  <p className="text-xs text-rose-500 font-semibold flex items-center gap-1">⚠ {cepError}</p>
                )}

                {/* Campos de endereço */}
                <input type="text" placeholder="Rua / Logradouro" value={address.rua}
                  onChange={e => setAddress(a => ({ ...a, rua: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-2xl border border-border bg-[#F9F0FF] text-sm focus:outline-none focus:ring-2 focus:ring-[#C4B5FD] transition-all" />

                <div className="grid grid-cols-2 gap-2">
                  <input type="text" placeholder="Número" value={address.numero}
                    onChange={e => setAddress(a => ({ ...a, numero: e.target.value }))}
                    className="px-4 py-2.5 rounded-2xl border border-border bg-[#F9F0FF] text-sm focus:outline-none focus:ring-2 focus:ring-[#C4B5FD] transition-all" />
                  <input type="text" placeholder="Complemento" value={address.complemento}
                    onChange={e => setAddress(a => ({ ...a, complemento: e.target.value }))}
                    className="px-4 py-2.5 rounded-2xl border border-border bg-[#F9F0FF] text-sm focus:outline-none focus:ring-2 focus:ring-[#C4B5FD] transition-all" />
                </div>

                <input type="text" placeholder="Bairro" value={address.bairro}
                  onChange={e => setAddress(a => ({ ...a, bairro: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-2xl border border-border bg-[#F9F0FF] text-sm focus:outline-none focus:ring-2 focus:ring-[#C4B5FD] transition-all" />

                <div className="grid grid-cols-3 gap-2">
                  <input type="text" placeholder="Cidade" value={address.cidade}
                    onChange={e => setAddress(a => ({ ...a, cidade: e.target.value }))}
                    className="col-span-2 px-4 py-2.5 rounded-2xl border border-border bg-[#F9F0FF] text-sm focus:outline-none focus:ring-2 focus:ring-[#C4B5FD] transition-all" />
                  <input type="text" placeholder="UF" value={address.uf} maxLength={2}
                    onChange={e => setAddress(a => ({ ...a, uf: e.target.value.toUpperCase() }))}
                    className="px-4 py-2.5 rounded-2xl border border-border bg-[#F9F0FF] text-sm focus:outline-none focus:ring-2 focus:ring-[#C4B5FD] transition-all text-center font-bold" />
                </div>

                {/* Resultado do frete */}
                {address.cidade && (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    className={`rounded-2xl p-4 text-sm font-semibold flex items-center justify-between ${
                      freteValue !== null && freteValue >= 0
                        ? "bg-[#F3E8FF] border border-[#C4B5FD]/40 text-[#9B5DE5]"
                        : "bg-amber-50 border border-amber-200 text-amber-700"
                    }`}>
                    <span className="flex items-center gap-2">
                      <Truck size={15} />
                      {freteValue !== null && freteValue >= 0
                        ? `Entrega em ${address.cidade} – ${address.uf}`
                        : "Cidade fora das rotas fixas"}
                    </span>
                    {freteValue !== null && freteValue >= 0
                      ? <span className="font-black">{fmt(freteValue)}</span>
                      : <button onClick={() => wa(`Olá! Gostaria de consultar frete para ${address.cidade} – ${address.uf}.`, settings.whatsapp)}
                          className="inline-flex items-center gap-1 bg-[#25D366] text-white text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-[#128C7E] transition-colors">
                          <MessageCircle size={12} /> WhatsApp
                        </button>
                    }
                  </motion.div>
                )}
              </motion.div>
            )}

            {deliveryType === "retirada" && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className="bg-[#F3E8FF] rounded-2xl p-4 flex items-center gap-3">
                <CheckCircle size={20} className="text-[#9B5DE5] flex-shrink-0" />
                <div>
                  <p className="font-bold text-sm text-foreground">Retirada na Loja — Grátis</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Combinar horário pelo WhatsApp</p>
                </div>
              </motion.div>
            )}

            {/* Forma de pagamento */}
            <div className="pt-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Forma de Pagamento</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: "dinheiro" as const, label: "Espécie", icon: Banknote },
                  { key: "pix"      as const, label: "Pix",     icon: QrCode },
                  { key: "cartao"   as const, label: "Cartão",  icon: CreditCard },
                ].map(({ key, label, icon: Icon }) => (
                  <button key={key}
                    onClick={() => { setPaymentMethod(key); setPrecisaTroco(""); setTrocoPara(""); }}
                    className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl border text-xs font-bold transition-all ${
                      paymentMethod === key
                        ? "bg-[#9B5DE5] border-[#9B5DE5] text-white"
                        : "border-border bg-[#F9F0FF] text-muted-foreground hover:border-[#C4B5FD]"
                    }`}>
                    <Icon size={18} />
                    {label}
                  </button>
                ))}
              </div>

              {paymentMethod === "dinheiro" && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-[#F3E8FF] rounded-2xl p-4 mt-3 space-y-3">
                  <p className="text-sm font-bold text-foreground">Precisa de troco?</p>
                  <div className="flex gap-2">
                    <button onClick={() => setPrecisaTroco("sim")}
                      className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${precisaTroco === "sim" ? "bg-[#9B5DE5] text-white" : "bg-white border border-border text-muted-foreground"}`}>
                      Sim
                    </button>
                    <button onClick={() => { setPrecisaTroco("nao"); setTrocoPara(""); }}
                      className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${precisaTroco === "nao" ? "bg-[#9B5DE5] text-white" : "bg-white border border-border text-muted-foreground"}`}>
                      Não
                    </button>
                  </div>
                  {precisaTroco === "sim" && (
                    <input type="text" inputMode="decimal" placeholder="Troco para quanto? Ex: 100"
                      value={trocoPara} onChange={e => setTrocoPara(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#C4B5FD] transition-all" />
                  )}
                </motion.div>
              )}

              {paymentMethod === "cartao" && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-[#F3E8FF] rounded-2xl p-4 mt-3 flex items-center gap-3">
                  <CreditCard size={20} className="text-[#9B5DE5] flex-shrink-0" />
                  <p className="text-sm font-semibold text-foreground">Vamos levar a maquininha até você 💳</p>
                </motion.div>
              )}

              {paymentMethod === "pix" && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-[#F3E8FF] rounded-2xl p-4 mt-3 space-y-3 text-center">
                  {pixQrDataUrl ? (
                    <img src={pixQrDataUrl} alt="QR Code Pix" className="mx-auto rounded-xl border border-[#C4B5FD]/40 bg-white p-2" width={180} height={180} />
                  ) : (
                    <div className="w-[180px] h-[180px] mx-auto rounded-xl border border-[#C4B5FD]/40 bg-white flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-[#C4B5FD] border-t-[#9B5DE5] rounded-full animate-spin" />
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">Escaneie com o app do seu banco{totalConhecido ? ` — valor: ${fmt(cartTotal)}` : ""}</p>
                  <button
                    onClick={() => { navigator.clipboard.writeText(settings.pixKey); setPixCopiado(true); setTimeout(() => setPixCopiado(false), 2000); }}
                    className="w-full flex items-center justify-center gap-2 bg-white border border-border rounded-xl px-3 py-2.5 text-xs font-semibold text-foreground hover:border-[#C4B5FD] transition-all">
                    <Copy size={13} /> {pixCopiado ? "Chave copiada!" : settings.pixKey}
                  </button>
                  <p className="text-xs font-bold text-[#9B5DE5]">📩 Envie o comprovante aqui pelo WhatsApp após pagar!</p>
                </motion.div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        {cartItems.length > 0 && (
          <div className="border-t border-border p-5 space-y-3">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal ({cartCount} {cartCount === 1 ? "item" : "itens"})</span>
                <span className="font-bold text-foreground">{fmt(cartSubtotal)}</span>
              </div>
              <div className="flex justify-between text-sm items-center">
                <span className="text-muted-foreground flex items-center gap-1.5"><Truck size={12} /> Frete</span>
                {deliveryType === "retirada" ? (
                  <span className="font-bold text-[#9B5DE5]">Grátis</span>
                ) : freteValue === null ? (
                  <button onClick={() => setCartTab("frete")} className="text-xs text-[#9B5DE5] font-bold hover:underline">
                    Informar CEP →
                  </button>
                ) : freteValue === -1 ? (
                  <span className="text-xs text-amber-600 font-bold">A consultar</span>
                ) : (
                  <span className="font-bold text-foreground">{fmt(freteValue)}</span>
                )}
              </div>
              {(deliveryType === "retirada" || (freteValue !== null && freteValue >= 0)) && (
                <div className="flex justify-between font-black text-base border-t border-border pt-2">
                  <span>Total</span>
                  <span className="text-[#9B5DE5]">{fmt(cartTotal)}</span>
                </div>
              )}
            </div>

            <button
              disabled={!customerInfo.nome.trim() || !customerInfo.telefone.trim() || !paymentMethod || (paymentMethod === "dinheiro" && precisaTroco === "sim" && !trocoPara.trim())}
              onClick={async () => {
                if (!customerInfo.nome.trim() || !customerInfo.telefone.trim()) {
                  setCartTab("cliente");
                  return;
                }
                if (deliveryType === "entrega" && (!address.cidade || freteValue === null)) {
                  setCartTab("frete");
                  return;
                }
                const lines = cartItems.map(i => `• ${i.name} x${i.qty} — ${fmt(i.price * i.qty)}`).join("\n");
                const entregaStr = deliveryType === "retirada"
                  ? "\n🏪 Forma de Entrega: Retirar na Loja\n🚚 Frete: Grátis"
                  : address.cidade
                    ? `\n🚚 Entrega: ${address.rua}${address.numero ? ", " + address.numero : ""}${address.complemento ? " – " + address.complemento : ""}, ${address.bairro}, ${address.cidade} – ${address.uf} (CEP ${cep})\n📦 Frete: ${freteValue !== null && freteValue >= 0 ? fmt(freteValue) : "A consultar"}`
                    : "\n🚚 Entrega: endereço não preenchido";
                const clienteStr = `\n👤 Cliente: ${customerInfo.nome.trim()}\n📞 Telefone: ${customerInfo.telefone.trim()}${customerInfo.observacao.trim() ? `\n📝 Observação: ${customerInfo.observacao.trim()}` : ""}`;
                const totalStr = totalConhecido ? `\n💰 Total: ${fmt(cartTotal)}` : "";
                const pagamentoStr =
                  paymentMethod === "dinheiro"
                    ? `\n💵 Pagamento: Dinheiro${precisaTroco === "sim" ? ` (troco para ${fmt(Number(trocoPara.replace(",", ".")) || 0)})` : precisaTroco === "nao" ? " (sem troco)" : ""}`
                    : paymentMethod === "cartao"
                      ? "\n💳 Pagamento: Cartão (favor levar a maquininha)"
                      : paymentMethod === "pix"
                        ? `\n📱 Pagamento: Pix (chave: ${settings.pixKey}) — comprovante será enviado aqui`
                        : "";
                const now = new Date();
                const orderId = `PED-${now.getTime()}`;
                const addressText = deliveryType === "retirada" ? "Retirada na loja" : `${address.rua}${address.numero ? `, ${address.numero}` : ""}${address.complemento ? ` – ${address.complemento}` : ""}, ${address.bairro}, ${address.cidade} – ${address.uf} (CEP ${cep})`;
                const orderProducts = cartItems.map(i => ({ productId: i.id, name: i.name, qty: i.qty, price: i.price }));
                const { error: orderError } = await supabase.rpc("create_public_order", {
                  p_order_id: orderId,
                  p_customer_name: customerInfo.nome.trim(),
                  p_phone: customerInfo.telefone.trim(),
                  p_email: null,
                  p_city: address.cidade || "",
                  p_products: orderProducts,
                  p_address: addressText,
                  p_delivery_type: deliveryType,
                  p_payment: paymentMethod === "pix" ? "PIX" : paymentMethod === "cartao" ? "Cartão" : "Dinheiro",
                  p_frete: Number(freteValue && freteValue >= 0 ? freteValue : 0),
                  p_subtotal: cartSubtotal,
                  p_total: cartTotal,
                  p_date: now.toISOString().slice(0, 10),
                  p_time: now.toTimeString().slice(0, 5),
                  p_notes: customerInfo.observacao.trim(),
                });
                if (orderError) {
                  console.error("Erro ao registrar pedido:", orderError.message);
                  return;
                }
                wa(`Olá! Gostaria de fazer um pedido:\n\n${clienteStr}\n\n${lines}${entregaStr}${totalStr}${pagamentoStr}\n🧾 Pedido: ${orderId}\n\nBC Bom Feito Confeitaria`, settings.whatsapp);
              }}
              className="w-full bg-gradient-to-r from-[#9B5DE5] to-[#7C3AED] text-white font-bold py-3.5 rounded-2xl hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-sm">
              <MessageCircle size={16} /> Finalizar pelo WhatsApp
            </button>
            {(!customerInfo.nome.trim() || !customerInfo.telefone.trim()) ? (
              <p className="text-xs text-center text-amber-600 font-semibold">
                Preencha nome e telefone na aba Cliente para continuar
              </p>
            ) : !paymentMethod ? (
              <p className="text-xs text-center text-amber-600 font-semibold">Escolha uma forma de pagamento para continuar</p>
            ) : null}
            <button onClick={() => setCartItems([])}
              className="w-full text-sm text-muted-foreground hover:text-destructive transition-colors font-semibold">
              Limpar carrinho
            </button>
          </div>
        )}
      </motion.div>

      {/* ── WHATSAPP FAB ─────────────────────────────────────────────────────── */}
      <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.5 }}
        whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => wa(undefined, settings.whatsapp)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-[#25D366] text-white rounded-full shadow-lg shadow-green-500/40 flex items-center justify-center">
        <MessageCircle size={24} fill="white" />
      </motion.button>

      {/* ── BACK TO TOP ──────────────────────────────────────────────────────── */}
      <motion.button
        animate={{ opacity: showBackToTop ? 1 : 0, y: showBackToTop ? 0 : 10, pointerEvents: showBackToTop ? "auto" : "none" }}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="fixed bottom-24 right-6 z-40 w-10 h-10 bg-white border border-border rounded-full shadow flex items-center justify-center text-[#9B5DE5] hover:bg-secondary transition-colors">
        <ChevronUp size={18} />
      </motion.button>
    </div>
  );
}

// ─── APP (ROUTER) ─────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin" element={
          <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-[#F8F6FF]">
              <div className="w-8 h-8 border-4 border-[#C4B5FD] border-t-[#9B5DE5] rounded-full animate-spin" />
            </div>
          }>
            <Admin />
          </Suspense>
        } />
        <Route path="*" element={<MainSite />} />
      </Routes>
    </BrowserRouter>
  );
}