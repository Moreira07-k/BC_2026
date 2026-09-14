import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import {
  LayoutDashboard, Package, ShoppingBag, Users, Star, ImageIcon, Settings,
  LogOut, Menu, X, ChevronRight, Plus, Edit2, Trash2, Eye, EyeOff,
  CheckCircle, XCircle, Clock, Truck, TrendingUp, DollarSign,
  Search, Copy, BarChart2, ArrowUpRight, ArrowDownRight,
  MessageSquare, Lock, User, ChefHat, MapPin, Phone,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { supabase, supabaseConfigError } from "../lib/supabaseClient";

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface AdminProduct {
  id: number; name: string; tagline: string; description: string;
  price: number; category: string; stock: number; imageUrl: string; active: boolean;
  bestseller: boolean; isNew: boolean; layers: string[];
}

interface OrderProduct { productId?: number; name: string; qty: number; price: number; }
type OrderStatus = "novo" | "confirmado" | "preparo" | "pronto" | "entrega" | "entregue" | "cancelado";

interface AdminOrder {
  id: string; customerId: number | null; customer: string; phone: string; products: OrderProduct[];
  address: string; city: string; deliveryType: "entrega" | "retirada";
  payment: string; frete: number; subtotal: number; total: number;
  status: OrderStatus; date: string; time: string; notes: string;
}

interface AdminCustomer {
  id: number; name: string; phone: string; email: string;
  city: string; orders: number; spent: number; lastOrder: string; since: string;
}

interface AdminReview {
  id: number; name: string; rating: number; comment: string;
  date: string; approved: boolean; pinned: boolean; response?: string;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  novo:       { label: "Novo",            color: "text-blue-600",   bg: "bg-blue-50"   },
  confirmado: { label: "Confirmado",      color: "text-purple-600", bg: "bg-purple-50" },
  preparo:    { label: "Em Preparo",      color: "text-amber-600",  bg: "bg-amber-50"  },
  pronto:     { label: "Pronto",          color: "text-green-600",  bg: "bg-green-50"  },
  entrega:    { label: "Saiu p/ Entrega", color: "text-orange-600", bg: "bg-orange-50" },
  entregue:   { label: "Entregue",        color: "text-green-700",  bg: "bg-green-100" },
  cancelado:  { label: "Cancelado",       color: "text-red-600",    bg: "bg-red-50"    },
};

const STATUS_FLOW: OrderStatus[] = ["novo","confirmado","preparo","pronto","entrega","entregue"];

const NAV_ITEMS = [
  { id: "dashboard",     label: "Dashboard",    icon: LayoutDashboard },
  { id: "produtos",      label: "Produtos",     icon: Package         },
  { id: "pedidos",       label: "Pedidos",      icon: ShoppingBag     },
  { id: "clientes",      label: "Clientes",     icon: Users           },
  { id: "avaliacoes",    label: "Avaliações",   icon: Star            },
  { id: "galeria",       label: "Galeria",      icon: ImageIcon       },
  { id: "configuracoes", label: "Configurações",icon: Settings        },
];

const SECTION_TITLES: Record<string, string> = {
  dashboard: "Dashboard", produtos: "Produtos", pedidos: "Pedidos",
  clientes: "Clientes", avaliacoes: "Avaliações", galeria: "Galeria",
  configuracoes: "Configurações",
};

// ─── DADOS ────────────────────────────────────────────────────────────────────
// Produtos, pedidos, clientes e avaliações vêm todos do Supabase (tabelas
// products, orders, customers, reviews) — nada fica fixo/fictício no código.
// O catálogo inicial de produtos e as políticas de acesso estão em
// supabase/schema.sql. = ["#9B5DE5", "#F15BB5", "#C4B5FD", "#FBBF24", "#FCA5A5", "#22C55E", "#06B6D4"];
const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const CHART_PALETTE = ["#9B5DE5", "#F15BB5", "#C4B5FD", "#FBBF24", "#FCA5A5", "#22C55E", "#06B6D4"];

// Monta o gráfico de faturamento dos últimos 7 dias a partir dos pedidos reais (não cancelados).
function buildWeekChartData(orders: AdminOrder[]) {
  const today = new Date();
  const byDate: Record<string, number> = {};
  const ordered: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    byDate[key] = 0;
    ordered.push(key);
  }
  orders.forEach(o => {
    if (o.status !== "cancelado" && byDate[o.date] !== undefined) byDate[o.date] += o.total;
  });
  return ordered.map(key => ({ dia: WEEKDAY_LABELS[new Date(key).getDay()], faturamento: byDate[key] }));
}

// Monta a distribuição por produto a partir da quantidade vendida em pedidos reais.
function buildProductSalesData(orders: AdminOrder[]) {
  const qtyByName: Record<string, number> = {};
  orders.forEach(o => {
    if (o.status === "cancelado") return;
    o.products.forEach(p => { qtyByName[p.name] = (qtyByName[p.name] || 0) + p.qty; });
  });
  const entries = Object.entries(qtyByName).sort((a, b) => b[1] - a[1]);
  const totalQty = entries.reduce((s, [, q]) => s + q, 0);
  if (totalQty === 0) return [];
  const top = entries.slice(0, 4);
  const rest = entries.slice(4);
  const data = top.map(([name, qty], i) => ({ name, value: Math.round((qty / totalQty) * 100), color: CHART_PALETTE[i] }));
  if (rest.length) {
    const restQty = rest.reduce((s, [, q]) => s + q, 0);
    data.push({ name: "Outros", value: Math.round((restQty / totalQty) * 100), color: CHART_PALETTE[4] });
  }
  return data;
}

// Gera o próximo ID de pedido de forma sequencial e segura mesmo após exclusões.
function nextOrderId(orders: AdminOrder[]) {
  const max = orders.reduce((m, o) => {
    const n = parseInt(o.id.replace(/\D/g, ""), 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `PED-${String(max + 1).padStart(3, "0")}`;
}

// ─── MAPEAMENTO COM O SUPABASE (camelCase no app ↔ snake_case no banco) ───────
const productFromDb = (r: any): AdminProduct => ({
  id: r.id, name: r.name, tagline: r.tagline ?? "", description: r.description ?? "",
  price: Number(r.price ?? 0), category: r.category ?? "", stock: r.stock ?? 0, imageUrl: r.image_url ?? "",
  active: r.active, bestseller: r.bestseller, isNew: r.is_new, layers: r.layers ?? [],
});
const productToDb = (p: AdminProduct) => ({
  id: p.id, name: p.name, tagline: p.tagline, description: p.description, price: p.price,
  category: p.category, stock: p.stock, image_url: p.imageUrl || null, active: p.active, bestseller: p.bestseller,
  is_new: p.isNew, layers: p.layers,
});

const customerFromDb = (r: any): AdminCustomer => ({
  id: r.id, name: r.name, phone: r.phone ?? "", email: r.email ?? "", city: r.city ?? "",
  orders: r.orders ?? 0, spent: Number(r.spent ?? 0), lastOrder: r.last_order ?? "—", since: r.since ?? "",
});
const customerToDb = (c: AdminCustomer) => ({
  id: c.id, name: c.name, phone: c.phone, email: c.email, city: c.city,
  orders: c.orders, spent: c.spent, last_order: c.lastOrder, since: c.since,
});

const orderFromDb = (r: any): AdminOrder => ({
  id: r.id, customerId: r.customer_id, customer: r.customer, phone: r.phone ?? "",
  products: r.products ?? [], address: r.address ?? "", city: r.city ?? "",
  deliveryType: r.delivery_type, payment: r.payment, frete: Number(r.frete ?? 0),
  subtotal: Number(r.subtotal ?? 0), total: Number(r.total ?? 0), status: r.status,
  date: r.date, time: r.time, notes: r.notes ?? "",
});
const orderToDb = (o: AdminOrder) => ({
  id: o.id, customer_id: o.customerId, customer: o.customer, phone: o.phone,
  products: o.products, address: o.address, city: o.city, delivery_type: o.deliveryType,
  payment: o.payment, frete: o.frete, subtotal: o.subtotal, total: o.total,
  status: o.status, date: o.date, time: o.time, notes: o.notes,
});

const reviewFromDb = (r: any): AdminReview => ({
  id: r.id, name: r.name, rating: r.rating, comment: r.comment ?? "", date: r.date,
  approved: r.approved, pinned: r.pinned, response: r.response ?? undefined,
});
const reviewToDb = (r: AdminReview) => ({
  id: r.id, name: r.name, rating: r.rating, comment: r.comment, date: r.date,
  approved: r.approved, pinned: r.pinned, response: r.response ?? null,
});

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function useLocalStorage<T>(key: string, seed: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const s = localStorage.getItem(key);
      return s ? JSON.parse(s) : seed;
    } catch { return seed; }
  });
  useEffect(() => { localStorage.setItem(key, JSON.stringify(value)); }, [key, value]);
  return [value, setValue] as const;
}

// Mantém um array de estado (products, orders, customers, reviews) sincronizado
// com uma tabela do Supabase. Funciona como um useState normal — os componentes
// continuam chamando setItems(prev => ...) exatamente como faziam com o
// useLocalStorage — mas por baixo dos panos calcula o que foi criado, alterado
// ou removido e reflete isso no banco (respeitando as políticas de RLS).
function useSupabaseTable<T extends { id: string | number }>(
  table: string,
  mapFromDb: (row: any) => T,
  mapToDb: (item: T) => Record<string, any>
) {
  const [items, setItemsState] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const itemsRef = useRef<T[]>([]);
  itemsRef.current = items;

  useEffect(() => {
    let active = true;
    supabase.from(table).select("*").then(({ data, error }) => {
      if (!active) return;
      if (error) { setError(error.message); setLoading(false); return; }
      setItemsState((data || []).map(mapFromDb));
      setLoading(false);
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);

  const syncToSupabase = async (prev: T[], next: T[]) => {
    const prevMap = new Map(prev.map(i => [String(i.id), i]));
    const nextMap = new Map(next.map(i => [String(i.id), i]));

    const toInsert = next.filter(i => !prevMap.has(String(i.id)));
    const toUpdate = next.filter(i => {
      const old = prevMap.get(String(i.id));
      return old && JSON.stringify(old) !== JSON.stringify(i);
    });
    const toDeleteIds = prev.filter(i => !nextMap.has(String(i.id))).map(i => i.id);

    if (toInsert.length) {
      const { error } = await supabase.from(table).insert(toInsert.map(mapToDb));
      if (error) setError(error.message);
    }
    for (const item of toUpdate) {
      const { error } = await supabase.from(table).update(mapToDb(item)).eq("id", item.id);
      if (error) setError(error.message);
    }
    if (toDeleteIds.length) {
      const { error } = await supabase.from(table).delete().in("id", toDeleteIds);
      if (error) setError(error.message);
    }
  };

  const setItems: React.Dispatch<React.SetStateAction<T[]>> = (updater) => {
    const prev = itemsRef.current;
    const next = typeof updater === "function" ? (updater as (p: T[]) => T[])(prev) : updater;
    setItemsState(next);
    syncToSupabase(prev, next);
  };

  return [items, setItems, loading, error] as const;
}

// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────────
function Toast({ msg }: { msg: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="fixed top-6 right-6 z-[200] bg-[#9B5DE5] text-white px-5 py-3 rounded-2xl shadow-lg font-bold text-sm flex items-center gap-2 pointer-events-none">
      <CheckCircle size={15} /> {msg}
    </motion.div>
  );
}

function useToast() {
  const [msg, setMsg] = useState("");
  const show = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };
  return { msg, show };
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const c = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full ${c.color} ${c.bg}`}>
      {c.label}
    </span>
  );
}

function StatCard({ label, value, sub, icon: Icon, color = "#9B5DE5", trend }: {
  label: string; value: string; sub?: string; icon: React.ElementType; color?: string; trend?: "up" | "down";
}) {
  return (
    <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm p-5 flex items-start gap-4">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: color + "18" }}>
        <Icon size={20} style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-black text-gray-900 mt-0.5 leading-none">{value}</p>
        {sub && (
          <p className={`text-xs mt-1 font-semibold flex items-center gap-0.5 ${trend === "up" ? "text-green-600" : trend === "down" ? "text-red-500" : "text-gray-400"}`}>
            {trend === "up" && <ArrowUpRight size={12} />}
            {trend === "down" && <ArrowDownRight size={12} />}
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginScreen() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const attempt = async () => {
    if (!email.trim() || !password.trim()) { setError("Preencha todos os campos."); return; }
    setLoading(true); setError("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) setError("E-mail ou senha incorretos.");
    // Se der certo, o listener de sessão no componente Admin cuida de liberar o painel.
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "radial-gradient(ellipse at 30% 50%,#F3E8FF,transparent 55%),radial-gradient(ellipse at 70% 20%,#FFE4EF,transparent 55%),#FFF5EF", fontFamily: "'Nunito',sans-serif" }}>
      <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}
        className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-[#9B5DE5] to-[#F15BB5] rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-300/40">
            <Lock size={26} className="text-white" />
          </div>
          <h1 className="text-2xl font-black text-gray-900" style={{ fontFamily: "'Fredoka',sans-serif" }}>Painel Administrativo</h1>
          <p className="text-gray-400 text-sm mt-1">BC Bom Feito Confeitaria</p>
        </div>

        <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm p-6 space-y-4">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">E-mail</label>
            <div className="relative">
              <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
              <input type="email" placeholder="seu@email.com" value={email}
                onChange={e => { setEmail(e.target.value); setError(""); }}
                onKeyDown={e => e.key === "Enter" && attempt()}
                className="w-full pl-10 pr-4 py-3 rounded-2xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#C4B5FD] bg-[#F9F0FF] transition-all" />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Senha</label>
            <div className="relative">
              <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
              <input type={showPw ? "text" : "password"} placeholder="Sua senha" value={password}
                onChange={e => { setPassword(e.target.value); setError(""); }}
                onKeyDown={e => e.key === "Enter" && attempt()}
                className="w-full pl-10 pr-11 py-3 rounded-2xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#C4B5FD] bg-[#F9F0FF] transition-all" />
              <button onClick={() => setShowPw(v => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors">
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {error && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-xs text-red-500 font-semibold flex items-center gap-1">
              <XCircle size={13} /> {error}
            </motion.p>
          )}

          <button onClick={attempt} disabled={loading}
            className="w-full bg-gradient-to-r from-[#9B5DE5] to-[#7C3AED] text-white font-bold py-3.5 rounded-2xl hover:opacity-90 disabled:opacity-60 transition-all flex items-center justify-center gap-2 shadow-sm mt-1">
            {loading
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <><Lock size={14} /> Entrar</>}
          </button>
        </div>
        <p className="text-center text-xs text-gray-400 mt-5">Acesso restrito a administradores</p>
      </motion.div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ orders, products, customers, reviews }: {
  orders: AdminOrder[]; products: AdminProduct[]; customers: AdminCustomer[]; reviews: AdminReview[];
}) {
  const pending  = orders.filter(o => ["novo","confirmado","preparo"].includes(o.status));
  const revenue  = orders.filter(o => o.status === "entregue").reduce((s, o) => s + o.total, 0);
  const avgTicket = orders.length ? orders.reduce((s, o) => s + o.total, 0) / orders.length : 0;
  const chartData = buildWeekChartData(orders);
  const pieData   = buildProductSalesData(orders);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total de Pedidos" value={String(orders.length)}    sub="no sistema"            icon={ShoppingBag} color="#9B5DE5" />
        <StatCard label="Pendentes"        value={String(pending.length)}   sub="aguardando ação"       icon={Clock}       color="#F15BB5" />
        <StatCard label="Faturamento"      value={fmt(revenue)}             sub="pedidos entregues"     icon={DollarSign}  color="#22C55E" trend="up" />
        <StatCard label="Ticket Médio"     value={fmt(avgTicket)}           sub="por pedido"            icon={TrendingUp}  color="#F59E0B" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Produtos"   value={String(products.length)}               sub={`${products.filter(p=>p.active).length} ativos`}  icon={Package}  color="#8B5CF6" />
        <StatCard label="Clientes"   value={String(customers.length)}              sub="cadastrados"                                       icon={Users}    color="#EC4899" />
        <StatCard label="Avaliações" value={String(reviews.filter(r=>r.approved).length)} sub="aprovadas"                                icon={Star}     color="#F59E0B" />
        <StatCard label="Em Estoque" value={String(products.filter(p=>p.stock>0).length)} sub="produtos disponíveis"                     icon={BarChart2} color="#06B6D4" />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-3xl border border-[#E5E7EB] shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-gray-900" style={{ fontFamily: "'Fredoka',sans-serif" }}>Faturamento Semanal</h3>
            <span className="text-xs text-gray-400 bg-gray-50 px-3 py-1 rounded-full font-semibold">Últimos 7 dias</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="dia" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontFamily: "Nunito", fill: "#9CA3AF" }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9CA3AF" }} width={40} tickFormatter={v => `R$${v}`} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid #E5E7EB", fontFamily: "Nunito", fontSize: 12 }}
                formatter={(v: number) => [fmt(v), "Faturamento"]}
              />
              <Bar dataKey="faturamento" fill="#9B5DE5" radius={[8,8,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm p-5">
          <h3 className="font-black text-gray-900 mb-3" style={{ fontFamily: "'Fredoka',sans-serif" }}>Por Produto</h3>
          {pieData.length === 0 ? (
            <div className="h-[170px] flex flex-col items-center justify-center text-gray-300">
              <BarChart2 size={28} className="mb-2 opacity-50" />
              <p className="text-xs font-semibold text-gray-400">Sem vendas registradas ainda</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={68} paddingAngle={3}>
                    {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, fontFamily: "Nunito", fontSize: 11 }} formatter={(v) => [`${v}%`, ""]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-1">
                {pieData.map(d => (
                  <div key={d.name} className="flex items-center gap-2 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                    <span className="text-gray-400 flex-1 truncate">{d.name}</span>
                    <span className="font-bold text-gray-700">{d.value}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#F3F4F6] flex items-center justify-between">
          <h3 className="font-black text-gray-900" style={{ fontFamily: "'Fredoka',sans-serif" }}>Últimos Pedidos</h3>
          <span className="text-xs font-bold text-[#9B5DE5]">{orders.length} total</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/60">
              <tr>
                {["Pedido","Cliente","Produtos","Total","Status","Data"].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {orders.slice(0, 5).map(o => (
                <tr key={o.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 font-bold text-[#9B5DE5]">{o.id}</td>
                  <td className="px-4 py-3 font-semibold whitespace-nowrap">{o.customer}</td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">{o.products.map(p => `${p.name} x${p.qty}`).join(", ")}</td>
                  <td className="px-4 py-3 font-black">{fmt(o.total)}</td>
                  <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">{o.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── PRODUTOS ─────────────────────────────────────────────────────────────────
const EMPTY: Omit<AdminProduct,"id"> = { name:"", tagline:"", description:"", price:12, category:"chocolate", stock:10, imageUrl:"", active:true, bestseller:false, isNew:false, layers:[] };

function ProdutosSection({ products, setProducts }: { products: AdminProduct[]; setProducts: React.Dispatch<React.SetStateAction<AdminProduct[]>>; }) {
  const { msg, show } = useToast();
  const [modal, setModal]       = useState<AdminProduct | null>(null);
  const [isNew, setIsNew]       = useState(false);
  const [layerIn, setLayerIn]   = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [search, setSearch]     = useState("");

  const openNew  = () => { setModal({ id: Date.now(), ...EMPTY }); setIsNew(true); setLayerIn(""); };
  const openEdit = (p: AdminProduct) => { setModal({ ...p }); setIsNew(false); setLayerIn(""); };
  const save = () => {
    if (!modal) return;
    setProducts(prev => isNew ? [...prev, modal] : prev.map(p => p.id === modal.id ? modal : p));
    setModal(null); show(isNew ? "Produto adicionado!" : "Produto atualizado!");
  };
  const dup    = (p: AdminProduct) => { setProducts(prev => [...prev, { ...p, id: Date.now(), name: p.name + " (Cópia)" }]); show("Duplicado!"); };
  const remove = (id: number)      => { setProducts(prev => prev.filter(p => p.id !== id)); setDeleteId(null); show("Excluído!"); };
  const toggle = (id: number)      => setProducts(prev => prev.map(p => p.id === id ? { ...p, active: !p.active } : p));

  const addLayer = () => {
    if (!layerIn.trim() || !modal) return;
    setModal(m => m ? { ...m, layers: [...m.layers, layerIn.trim()] } : m);
    setLayerIn("");
  };

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-5">
      {msg && <Toast msg={msg} />}

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative max-w-xs w-full">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
          <input type="text" placeholder="Buscar produto..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-[#E5E7EB] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#C4B5FD]" />
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 bg-gradient-to-r from-[#9B5DE5] to-[#7C3AED] text-white font-bold px-5 py-2.5 rounded-2xl hover:opacity-90 transition-all shadow-sm whitespace-nowrap text-sm">
          <Plus size={15} /> Novo Produto
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/60">
              <tr>
                {["Produto","Categoria","Preço","Estoque","Status","Ações"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 min-w-[190px]">
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-purple-50 flex-shrink-0 border border-[#F0E7FF]">
                        {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" /> : <Package size={18} className="m-auto mt-3 text-[#C4B5FD]" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 truncate">{p.name}</p>
                        <p className="text-xs text-gray-400 truncate">{p.tagline}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="bg-gray-100 text-gray-500 text-xs font-semibold px-2.5 py-1 rounded-full capitalize">{p.category}</span>
                  </td>
                  <td className="px-4 py-3 font-black text-[#9B5DE5]">{fmt(p.price)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold ${p.stock === 0 ? "text-red-500" : p.stock < 5 ? "text-amber-500" : "text-green-600"}`}>
                      {p.stock === 0 ? "Esgotado" : `${p.stock} un.`}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggle(p.id)}
                      className={`text-xs font-bold px-2.5 py-1 rounded-full transition-colors ${p.active ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-400 hover:bg-gray-200"}`}>
                      {p.active ? "Ativo" : "Inativo"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(p)} title="Editar"    className="w-8 h-8 rounded-lg hover:bg-purple-50 text-[#9B5DE5] flex items-center justify-center transition-colors"><Edit2 size={13} /></button>
                      <button onClick={() => dup(p)}      title="Duplicar"  className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-400  flex items-center justify-center transition-colors"><Copy  size={13} /></button>
                      <button onClick={() => setDeleteId(p.id)} title="Excluir" className="w-8 h-8 rounded-lg hover:bg-red-50 text-red-400 flex items-center justify-center transition-colors"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400"><Package size={36} className="mx-auto mb-2 opacity-30" /><p className="font-semibold text-sm">Nenhum produto encontrado</p></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Product modal ── */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl border border-[#E5E7EB] shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-[#F3F4F6] flex items-center justify-between rounded-t-3xl z-10">
              <h3 className="font-black text-gray-900" style={{ fontFamily: "'Fredoka',sans-serif" }}>{isNew ? "Novo Produto" : "Editar Produto"}</h3>
              <button onClick={() => setModal(null)} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200"><X size={14} /></button>
            </div>
            <div className="p-6 space-y-4">
              {[{ key:"name", label:"Nome", ph:"Ex: Bombom Especial" },{ key:"tagline", label:"Tagline", ph:"Ex: O Favorito" }].map(f => (
                <div key={f.key}>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">{f.label}</label>
                  <input type="text" placeholder={f.ph} value={(modal as any)[f.key]}
                    onChange={e => setModal(m => m ? { ...m, [f.key]: e.target.value } : m)}
                    className="w-full px-4 py-2.5 rounded-2xl border border-[#E5E7EB] bg-[#F9F0FF] text-sm focus:outline-none focus:ring-2 focus:ring-[#C4B5FD]" />
                </div>
              ))}
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Descrição</label>
                <textarea rows={3} value={modal.description}
                  onChange={e => setModal(m => m ? { ...m, description: e.target.value } : m)}
                  className="w-full px-4 py-2.5 rounded-2xl border border-[#E5E7EB] bg-[#F9F0FF] text-sm focus:outline-none focus:ring-2 focus:ring-[#C4B5FD] resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Preço (R$)</label>
                  <input type="number" step="0.01" value={modal.price}
                    onChange={e => setModal(m => m ? { ...m, price: parseFloat(e.target.value) || 0 } : m)}
                    className="w-full px-4 py-2.5 rounded-2xl border border-[#E5E7EB] bg-[#F9F0FF] text-sm focus:outline-none focus:ring-2 focus:ring-[#C4B5FD]" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Estoque</label>
                  <input type="number" value={modal.stock}
                    onChange={e => setModal(m => m ? { ...m, stock: parseInt(e.target.value) || 0 } : m)}
                    className="w-full px-4 py-2.5 rounded-2xl border border-[#E5E7EB] bg-[#F9F0FF] text-sm focus:outline-none focus:ring-2 focus:ring-[#C4B5FD]" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Imagem do produto (URL)</label>
                <input type="url" placeholder="https://..." value={modal.imageUrl}
                  onChange={e => setModal(m => m ? { ...m, imageUrl: e.target.value } : m)}
                  className="w-full px-4 py-2.5 rounded-2xl border border-[#E5E7EB] bg-[#F9F0FF] text-sm focus:outline-none focus:ring-2 focus:ring-[#C4B5FD]" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Categoria</label>
                <select value={modal.category} onChange={e => setModal(m => m ? { ...m, category: e.target.value } : m)}
                  className="w-full px-4 py-2.5 rounded-2xl border border-[#E5E7EB] bg-[#F9F0FF] text-sm focus:outline-none focus:ring-2 focus:ring-[#C4B5FD]">
                  {["chocolate","frutas","mousse","especial","pote"].map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Camadas</label>
                <div className="flex gap-2 mb-2">
                  <input type="text" placeholder="Ex: Ganache" value={layerIn}
                    onChange={e => setLayerIn(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addLayer()}
                    className="flex-1 px-4 py-2 rounded-2xl border border-[#E5E7EB] bg-[#F9F0FF] text-sm focus:outline-none focus:ring-2 focus:ring-[#C4B5FD]" />
                  <button onClick={addLayer} className="px-4 py-2 bg-gray-100 rounded-2xl text-sm font-bold hover:bg-[#9B5DE5] hover:text-white transition-all">+</button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {modal.layers.map((l, i) => (
                    <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-semibold flex items-center gap-1">
                      {l}
                      <button onClick={() => setModal(m => m ? { ...m, layers: m.layers.filter((_,j)=>j!==i) } : m)}><X size={10} /></button>
                    </span>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[{ key:"active",label:"Ativo" },{ key:"bestseller",label:"Destaque" },{ key:"isNew",label:"Novidade" }].map(f => (
                  <label key={f.key} className="flex items-center gap-2 cursor-pointer bg-gray-50 rounded-2xl px-3 py-2.5 hover:bg-purple-50 transition-colors">
                    <input type="checkbox" checked={(modal as any)[f.key]}
                      onChange={e => setModal(m => m ? { ...m, [f.key]: e.target.checked } : m)}
                      className="w-4 h-4 accent-[#9B5DE5]" />
                    <span className="text-xs font-semibold text-gray-700">{f.label}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setModal(null)} className="flex-1 border border-[#E5E7EB] text-gray-600 font-bold py-3 rounded-2xl hover:bg-gray-50 transition-colors text-sm">Cancelar</button>
                <button onClick={save} className="flex-1 bg-gradient-to-r from-[#9B5DE5] to-[#7C3AED] text-white font-bold py-3 rounded-2xl hover:opacity-90 transition-all shadow-sm text-sm">
                  {isNew ? "Adicionar" : "Salvar"}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Delete confirm ── */}
      {deleteId !== null && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-xl border border-[#E5E7EB] text-center">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 size={22} className="text-red-500" /></div>
            <h3 className="font-black text-gray-900 text-lg mb-2">Excluir produto?</h3>
            <p className="text-gray-400 text-sm mb-5">Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 border border-[#E5E7EB] font-bold py-3 rounded-2xl hover:bg-gray-50 text-sm">Cancelar</button>
              <button onClick={() => remove(deleteId!)} className="flex-1 bg-red-500 text-white font-bold py-3 rounded-2xl hover:bg-red-600 text-sm">Excluir</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// ─── PEDIDOS ──────────────────────────────────────────────────────────────────
function PedidosSection({ orders, setOrders, customers, setCustomers, products }: {
  orders: AdminOrder[]; setOrders: React.Dispatch<React.SetStateAction<AdminOrder[]>>;
  customers: AdminCustomer[]; setCustomers: React.Dispatch<React.SetStateAction<AdminCustomer[]>>;
  products: AdminProduct[];
}) {
  const { msg, show } = useToast();
  const [filter, setFilter]   = useState<OrderStatus | "todos">("todos");
  const [search, setSearch]   = useState("");
  const [selected, setSelected] = useState<AdminOrder | null>(null);
  const [newModal, setNewModal] = useState(false);

  const updateStatus = async (id: string, status: OrderStatus) => {
    const current = orders.find(o => o.id === id);
    if (!current || current.status === status) return;
    if (status === "cancelado" && current.status !== "cancelado") {
      const { error } = await supabase.rpc("set_order_stock_reservation", { p_order_id: id, p_reserved: false });
      if (error) { show("Não foi possível liberar o estoque: " + error.message); return; }
    } else if (current.status === "cancelado" && status !== "cancelado") {
      const { error } = await supabase.rpc("set_order_stock_reservation", { p_order_id: id, p_reserved: true });
      if (error) { show("Estoque insuficiente para reativar o pedido."); return; }
    }
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
    setSelected(prev => prev?.id === id ? { ...prev, status } : prev);
    show("Status atualizado!");
  };

  const filtered = orders.filter(o => {
    const fOk = filter === "todos" || o.status === filter;
    const sOk = !search || o.customer.toLowerCase().includes(search.toLowerCase()) || o.id.includes(search);
    return fOk && sOk;
  });

  return (
    <div className="space-y-5">
      {msg && <Toast msg={msg} />}

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1 min-w-0">
          <div className="relative max-w-xs w-full">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
            <input type="text" placeholder="Buscar pedido ou cliente..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-[#E5E7EB] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#C4B5FD]" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setFilter("todos")}
              className={`px-3 py-2 rounded-2xl text-xs font-bold transition-all ${filter === "todos" ? "bg-[#9B5DE5] text-white" : "bg-white border border-[#E5E7EB] text-gray-400 hover:border-[#C4B5FD]"}`}>
              Todos ({orders.length})
            </button>
            {(["novo","preparo","entregue","cancelado"] as OrderStatus[]).map(s => (
              <button key={s} onClick={() => setFilter(s)}
                className={`px-3 py-2 rounded-2xl text-xs font-bold transition-all ${filter === s ? "bg-[#9B5DE5] text-white" : "bg-white border border-[#E5E7EB] text-gray-400 hover:border-[#C4B5FD]"}`}>
                {STATUS_CONFIG[s].label} ({orders.filter(o=>o.status===s).length})
              </button>
            ))}
          </div>
        </div>
        <button onClick={() => setNewModal(true)} disabled={customers.length === 0}
          title={customers.length === 0 ? "Cadastre um cliente na aba Clientes primeiro" : undefined}
          className="flex items-center gap-2 bg-gradient-to-r from-[#9B5DE5] to-[#7C3AED] text-white font-bold px-5 py-2.5 rounded-2xl hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm whitespace-nowrap text-sm">
          <Plus size={15} /> Novo Pedido
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/60">
              <tr>
                {["ID","Cliente","Total","Entrega","Pagamento","Status","Ver"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(o => (
                <tr key={o.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 font-bold text-[#9B5DE5]">{o.id}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{o.customer}</p>
                    <p className="text-xs text-gray-400">{o.phone}</p>
                  </td>
                  <td className="px-4 py-3 font-black">{fmt(o.total)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold ${o.deliveryType === "entrega" ? "text-[#9B5DE5]" : "text-green-600"}`}>
                      {o.deliveryType === "entrega" ? "🛵 Entrega" : "🏪 Retirada"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{o.payment}</td>
                  <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                  <td className="px-4 py-3">
                    <button onClick={() => setSelected(o)} className="w-8 h-8 rounded-lg hover:bg-purple-50 text-[#9B5DE5] flex items-center justify-center transition-colors">
                      <Eye size={13} />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400"><ShoppingBag size={36} className="mx-auto mb-2 opacity-30" /><p className="font-semibold text-sm">Nenhum pedido encontrado</p></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Order detail modal ── */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl border border-[#E5E7EB] shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-[#F3F4F6] flex items-center justify-between rounded-t-3xl z-10">
              <div>
                <h3 className="font-black text-gray-900" style={{ fontFamily: "'Fredoka',sans-serif" }}>{selected.id}</h3>
                <p className="text-xs text-gray-400">{selected.date} às {selected.time}</p>
              </div>
              <button onClick={() => setSelected(null)} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center"><X size={14} /></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="bg-gray-50 rounded-2xl p-4 space-y-1.5">
                <p className="font-black text-gray-900">{selected.customer}</p>
                <p className="text-sm text-gray-400 flex items-center gap-1.5"><Phone size={12} /> {selected.phone}</p>
                {selected.address && <p className="text-sm text-gray-400 flex items-center gap-1.5"><MapPin size={12} /> {selected.address}, {selected.city}</p>}
              </div>

              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Produtos</p>
                <div className="space-y-1.5">
                  {selected.products.map((p, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="font-semibold">{p.name} <span className="text-gray-400">x{p.qty}</span></span>
                      <span className="font-bold">{fmt(p.price * p.qty)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-gray-100 mt-3 pt-3 space-y-1">
                  <div className="flex justify-between text-sm text-gray-400"><span>Subtotal</span><span className="font-semibold text-gray-700">{fmt(selected.subtotal)}</span></div>
                  <div className="flex justify-between text-sm text-gray-400"><span>Frete</span><span className="font-semibold text-gray-700">{selected.frete === 0 ? "Grátis" : fmt(selected.frete)}</span></div>
                  <div className="flex justify-between font-black text-base pt-1"><span>Total</span><span className="text-[#9B5DE5]">{fmt(selected.total)}</span></div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-50 rounded-2xl p-3"><p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Pagamento</p><p className="font-bold">{selected.payment}</p></div>
                <div className="bg-gray-50 rounded-2xl p-3"><p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Entrega</p><p className="font-bold">{selected.deliveryType === "entrega" ? "Motoboy" : "Retirada"}</p></div>
              </div>

              {selected.notes && (
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 text-sm">
                  <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">Observações</p>
                  <p className="text-amber-800">{selected.notes}</p>
                </div>
              )}

              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Atualizar Status</p>
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_FLOW.map(s => (
                    <button key={s} onClick={() => updateStatus(selected.id, s)}
                      className={`py-2.5 rounded-2xl text-xs font-bold transition-all border ${selected.status === s ? "bg-[#9B5DE5] text-white border-[#9B5DE5]" : "bg-white border-[#E5E7EB] hover:border-[#9B5DE5] text-gray-500"}`}>
                      {STATUS_CONFIG[s].label}
                    </button>
                  ))}
                  <button onClick={() => updateStatus(selected.id, "cancelado")}
                    className={`py-2.5 rounded-2xl text-xs font-bold transition-all border col-span-2 ${selected.status === "cancelado" ? "bg-red-500 text-white border-red-500" : "bg-white border-red-200 text-red-500 hover:bg-red-50"}`}>
                    Cancelar Pedido
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── New order modal ── */}
      {newModal && (
        <NovoPedidoModal
          customers={customers}
          products={products}
          onClose={() => setNewModal(false)}
          onSave={(order, customerId) => {
            setOrders(prev => [order, ...prev]);
            setCustomers(prev => prev.map(c => c.id === customerId
              ? { ...c, orders: c.orders + 1, spent: c.spent + order.total, lastOrder: order.date }
              : c));
            setNewModal(false);
            show("Pedido criado!");
          }}
          nextId={nextOrderId(orders)}
        />
      )}
    </div>
  );
}

// ─── NOVO PEDIDO (vincula o pedido a um cliente já cadastrado) ────────────────
function NovoPedidoModal({ customers, products, onClose, onSave, nextId }: {
  customers: AdminCustomer[]; products: AdminProduct[]; nextId: string;
  onClose(): void; onSave(order: AdminOrder, customerId: number): void;
}) {
  const [customerId, setCustomerId]     = useState<number | "">("");
  const [deliveryType, setDeliveryType] = useState<"entrega"|"retirada">("retirada");
  const [payment, setPayment]           = useState("PIX");
  const [address, setAddress]           = useState("");
  const [city, setCity]                 = useState("");
  const [frete, setFrete]               = useState(0);
  const [notes, setNotes]               = useState("");
  const [items, setItems]               = useState<{ productId: number; qty: number }[]>([]);
  const [productPick, setProductPick]   = useState<number | "">("");
  const [error, setError]               = useState("");

  const customer = customers.find(c => c.id === customerId);

  const addItem = () => {
    if (productPick === "") return;
    setItems(prev => prev.some(i => i.productId === productPick) ? prev : [...prev, { productId: productPick as number, qty: 1 }]);
    setProductPick("");
  };
  const setQty = (productId: number, qty: number) => setItems(prev => prev.map(i => i.productId === productId ? { ...i, qty: Math.max(1, qty) } : i));
  const removeItem = (productId: number) => setItems(prev => prev.filter(i => i.productId !== productId));

  const subtotal = items.reduce((s, i) => { const p = products.find(p => p.id === i.productId); return s + (p ? p.price * i.qty : 0); }, 0);
  const total = subtotal + (frete || 0);

  const save = () => {
    if (!customer)        { setError("Selecione o cliente."); return; }
    if (items.length === 0) { setError("Adicione ao menos um produto."); return; }
    const now = new Date();
    const orderProducts: OrderProduct[] = items.map(i => {
      const p = products.find(pp => pp.id === i.productId)!;
      return { name: p.name, qty: i.qty, price: p.price };
    });
    const order: AdminOrder = {
      id: nextId, customerId: customer.id, customer: customer.name, phone: customer.phone,
      products: orderProducts, address, city: city || customer.city, deliveryType, payment,
      frete: frete || 0, subtotal, total, status: "novo",
      date: now.toISOString().slice(0, 10), time: now.toTimeString().slice(0, 5), notes,
    };
    onSave(order, customer.id);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl border border-[#E5E7EB] shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white px-6 py-4 border-b border-[#F3F4F6] flex items-center justify-between rounded-t-3xl z-10">
          <h3 className="font-black text-gray-900" style={{ fontFamily: "'Fredoka',sans-serif" }}>Novo Pedido · {nextId}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200"><X size={14} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Cliente cadastrado</label>
            <select value={customerId} onChange={e => { setCustomerId(e.target.value ? Number(e.target.value) : ""); setError(""); }}
              className="w-full px-4 py-2.5 rounded-2xl border border-[#E5E7EB] bg-[#F9F0FF] text-sm focus:outline-none focus:ring-2 focus:ring-[#C4B5FD]">
              <option value="">Selecione pelo nome...</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Produtos</label>
            <div className="flex gap-2 mb-2">
              <select value={productPick} onChange={e => setProductPick(e.target.value ? Number(e.target.value) : "")}
                className="flex-1 px-4 py-2 rounded-2xl border border-[#E5E7EB] bg-[#F9F0FF] text-sm focus:outline-none focus:ring-2 focus:ring-[#C4B5FD]">
                <option value="">Escolher produto...</option>
                {products.filter(p => p.active).map(p => <option key={p.id} value={p.id}>{p.name} — {fmt(p.price)}</option>)}
              </select>
              <button onClick={addItem} className="px-4 py-2 bg-gray-100 rounded-2xl text-sm font-bold hover:bg-[#9B5DE5] hover:text-white transition-all">+</button>
            </div>
            <div className="space-y-1.5">
              {items.map(i => {
                const p = products.find(pp => pp.id === i.productId)!;
                return (
                  <div key={i.productId} className="flex items-center gap-2 bg-gray-50 rounded-2xl px-3 py-2">
                    <span className="flex-1 text-sm font-semibold truncate">{p.name}</span>
                    <input type="number" min={1} value={i.qty} onChange={e => setQty(i.productId, parseInt(e.target.value) || 1)}
                      className="w-16 px-2 py-1 rounded-xl border border-[#E5E7EB] text-sm text-center" />
                    <span className="text-sm font-black text-[#9B5DE5] w-20 text-right">{fmt(p.price * i.qty)}</span>
                    <button onClick={() => removeItem(i.productId)}><X size={14} className="text-gray-400 hover:text-red-500" /></button>
                  </div>
                );
              })}
              {items.length === 0 && <p className="text-xs text-gray-400 text-center py-3">Nenhum produto adicionado.</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Entrega</label>
              <select value={deliveryType} onChange={e => setDeliveryType(e.target.value as "entrega"|"retirada")}
                className="w-full px-4 py-2.5 rounded-2xl border border-[#E5E7EB] bg-[#F9F0FF] text-sm focus:outline-none focus:ring-2 focus:ring-[#C4B5FD]">
                <option value="retirada">Retirada</option>
                <option value="entrega">Entrega</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Pagamento</label>
              <select value={payment} onChange={e => setPayment(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl border border-[#E5E7EB] bg-[#F9F0FF] text-sm focus:outline-none focus:ring-2 focus:ring-[#C4B5FD]">
                {["PIX","Dinheiro","Cartão"].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {deliveryType === "entrega" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Endereço</label>
                <input type="text" value={address} onChange={e => setAddress(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl border border-[#E5E7EB] bg-[#F9F0FF] text-sm focus:outline-none focus:ring-2 focus:ring-[#C4B5FD]" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Cidade</label>
                <input type="text" placeholder={customer?.city} value={city} onChange={e => setCity(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl border border-[#E5E7EB] bg-[#F9F0FF] text-sm focus:outline-none focus:ring-2 focus:ring-[#C4B5FD]" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Frete (R$)</label>
              <input type="number" step="0.01" value={frete} onChange={e => setFrete(parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-2.5 rounded-2xl border border-[#E5E7EB] bg-[#F9F0FF] text-sm focus:outline-none focus:ring-2 focus:ring-[#C4B5FD]" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Total</label>
              <div className="px-4 py-2.5 rounded-2xl bg-gray-50 text-sm font-black text-[#9B5DE5]">{fmt(total)}</div>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Observações</label>
            <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full px-4 py-2.5 rounded-2xl border border-[#E5E7EB] bg-[#F9F0FF] text-sm focus:outline-none focus:ring-2 focus:ring-[#C4B5FD] resize-none" />
          </div>

          {error && <p className="text-xs text-red-500 font-semibold flex items-center gap-1"><XCircle size={13} /> {error}</p>}

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 border border-[#E5E7EB] text-gray-600 font-bold py-3 rounded-2xl hover:bg-gray-50 transition-colors text-sm">Cancelar</button>
            <button onClick={save} className="flex-1 bg-gradient-to-r from-[#9B5DE5] to-[#7C3AED] text-white font-bold py-3 rounded-2xl hover:opacity-90 transition-all shadow-sm text-sm">Criar Pedido</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── CLIENTES ─────────────────────────────────────────────────────────────────
function ClientesSection({ customers, setCustomers }: {
  customers: AdminCustomer[]; setCustomers: React.Dispatch<React.SetStateAction<AdminCustomer[]>>;
}) {
  const { msg, show } = useToast();
  const [search, setSearch]   = useState("");
  const [modal, setModal]     = useState(false);
  const [name, setName]       = useState("");
  const [phone, setPhone]     = useState("");
  const [email, setEmail]     = useState("");
  const [city, setCity]       = useState("");
  const [error, setError]     = useState("");

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.city.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => { setName(""); setPhone(""); setEmail(""); setCity(""); setError(""); setModal(true); };

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) { setError("O nome do cliente é obrigatório."); return; }
    const newCustomer: AdminCustomer = {
      id: Date.now(), name: trimmed, phone: phone.trim(), email: email.trim(), city: city.trim(),
      orders: 0, spent: 0, lastOrder: "—", since: new Date().toISOString().slice(0, 10),
    };
    setCustomers(prev => [newCustomer, ...prev]);
    setModal(false);
    show("Cliente cadastrado!");
  };

  return (
    <div className="space-y-5">
      {msg && <Toast msg={msg} />}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative max-w-xs w-full">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
          <input type="text" placeholder="Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-[#E5E7EB] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#C4B5FD]" />
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 bg-gradient-to-r from-[#9B5DE5] to-[#7C3AED] text-white font-bold px-5 py-2.5 rounded-2xl hover:opacity-90 transition-all shadow-sm whitespace-nowrap text-sm">
          <Plus size={15} /> Novo Cliente
        </button>
      </div>
      <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/60">
              <tr>
                {["Cliente","Contato","Cidade","Pedidos","Total Gasto","Desde"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#9B5DE5] to-[#F15BB5] flex items-center justify-center text-white font-black text-sm flex-shrink-0">{c.name[0]}</div>
                      <p className="font-bold text-gray-900">{c.name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-700">{c.phone}</p>
                    <p className="text-xs text-gray-400">{c.email}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{c.city}</td>
                  <td className="px-4 py-3"><span className="bg-purple-50 text-[#9B5DE5] font-black text-sm px-2.5 py-1 rounded-full">{c.orders}</span></td>
                  <td className="px-4 py-3 font-black text-gray-900">{fmt(c.spent)}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{c.since}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400"><Users size={36} className="mx-auto mb-2 opacity-30" /><p className="font-semibold text-sm">Nenhum cliente cadastrado ainda</p></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── New customer modal ── */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setModal(false)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl border border-[#E5E7EB] shadow-xl w-full max-w-md"
            onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-[#F3F4F6] flex items-center justify-between rounded-t-3xl">
              <h3 className="font-black text-gray-900" style={{ fontFamily: "'Fredoka',sans-serif" }}>Novo Cliente</h3>
              <button onClick={() => setModal(false)} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200"><X size={14} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Nome *</label>
                <input type="text" placeholder="Nome completo" value={name}
                  onChange={e => { setName(e.target.value); setError(""); }}
                  onKeyDown={e => e.key === "Enter" && save()}
                  className="w-full px-4 py-2.5 rounded-2xl border border-[#E5E7EB] bg-[#F9F0FF] text-sm focus:outline-none focus:ring-2 focus:ring-[#C4B5FD]" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Telefone</label>
                <input type="text" placeholder="(89) 90000-0000" value={phone} onChange={e => setPhone(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl border border-[#E5E7EB] bg-[#F9F0FF] text-sm focus:outline-none focus:ring-2 focus:ring-[#C4B5FD]" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">E-mail</label>
                <input type="email" placeholder="cliente@email.com" value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl border border-[#E5E7EB] bg-[#F9F0FF] text-sm focus:outline-none focus:ring-2 focus:ring-[#C4B5FD]" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Cidade</label>
                <input type="text" placeholder="Floriano" value={city} onChange={e => setCity(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl border border-[#E5E7EB] bg-[#F9F0FF] text-sm focus:outline-none focus:ring-2 focus:ring-[#C4B5FD]" />
              </div>
              {error && <p className="text-xs text-red-500 font-semibold flex items-center gap-1"><XCircle size={13} /> {error}</p>}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setModal(false)} className="flex-1 border border-[#E5E7EB] text-gray-600 font-bold py-3 rounded-2xl hover:bg-gray-50 transition-colors text-sm">Cancelar</button>
                <button onClick={save} className="flex-1 bg-gradient-to-r from-[#9B5DE5] to-[#7C3AED] text-white font-bold py-3 rounded-2xl hover:opacity-90 transition-all shadow-sm text-sm">Cadastrar</button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// ─── AVALIAÇÕES ───────────────────────────────────────────────────────────────
function AvaliacoesSection({ reviews, setReviews }: { reviews: AdminReview[]; setReviews: React.Dispatch<React.SetStateAction<AdminReview[]>>; }) {
  const { msg, show } = useToast();
  const [filter, setFilter]   = useState<"todas"|"aprovadas"|"pendentes">("todas");
  const [replyFor, setReplyFor] = useState<AdminReview | null>(null);
  const [replyText, setReplyText] = useState("");

  const approve = (id: number) => { setReviews(p => p.map(r => r.id===id ? {...r,approved:true}  : r)); show("Aprovada!"); };
  const hide    = (id: number) => { setReviews(p => p.map(r => r.id===id ? {...r,approved:false} : r)); show("Ocultada!"); };
  const pin     = (id: number) => setReviews(p => p.map(r => r.id===id ? {...r,pinned:!r.pinned} : r));
  const remove  = (id: number) => { setReviews(p => p.filter(r => r.id!==id)); show("Excluída!"); };
  const saveReply = () => {
    if (!replyFor) return;
    setReviews(p => p.map(r => r.id===replyFor.id ? {...r,response:replyText} : r));
    setReplyFor(null); setReplyText(""); show("Resposta salva!");
  };

  const filtered = reviews.filter(r =>
    filter === "todas" ? true : filter === "aprovadas" ? r.approved : !r.approved
  );

  return (
    <div className="space-y-5">
      {msg && <Toast msg={msg} />}
      <div className="flex gap-2">
        {[["todas","Todas"],["aprovadas","Aprovadas"],["pendentes","Pendentes"]].map(([k,l]) => (
          <button key={k} onClick={() => setFilter(k as any)}
            className={`px-4 py-2 rounded-2xl text-sm font-bold transition-all ${filter===k ? "bg-[#9B5DE5] text-white" : "bg-white border border-[#E5E7EB] text-gray-400 hover:border-[#C4B5FD]"}`}>
            {l}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.map(r => (
          <div key={r.id} className={`bg-white rounded-3xl border shadow-sm p-5 ${r.pinned ? "border-[#9B5DE5]" : "border-[#E5E7EB]"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#9B5DE5] to-[#F15BB5] flex items-center justify-center text-white font-black flex-shrink-0">{r.name[0]}</div>
                <div>
                  <p className="font-bold text-gray-900">{r.name}</p>
                  <div className="flex gap-0.5 mt-0.5">
                    {[1,2,3,4,5].map(i => <Star key={i} size={12} className={i<=r.rating?"fill-amber-400 text-amber-400":"text-gray-200"} />)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {r.pinned && <span className="text-xs bg-purple-50 text-[#9B5DE5] font-bold px-2 py-0.5 rounded-full">📌 Fixado</span>}
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.approved ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-600"}`}>{r.approved?"Aprovado":"Pendente"}</span>
              </div>
            </div>

            <p className="text-sm text-gray-500 mt-3 leading-relaxed italic">"{r.comment}"</p>

            {r.response && (
              <div className="mt-3 bg-purple-50 rounded-2xl p-3">
                <p className="text-[10px] font-bold text-[#9B5DE5] uppercase tracking-wider mb-1">Resposta da Loja</p>
                <p className="text-sm text-gray-700">{r.response}</p>
              </div>
            )}

            <div className="flex gap-2 mt-4 flex-wrap">
              {!r.approved && <button onClick={() => approve(r.id)} className="text-xs font-bold text-green-600 bg-green-50 px-3 py-1.5 rounded-xl hover:bg-green-100 transition-colors flex items-center gap-1"><CheckCircle size={11}/> Aprovar</button>}
              {r.approved  && <button onClick={() => hide(r.id)}    className="text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-xl hover:bg-amber-100 transition-colors flex items-center gap-1"><EyeOff size={11}/> Ocultar</button>}
              <button onClick={() => pin(r.id)} className="text-xs font-bold text-[#9B5DE5] bg-purple-50 px-3 py-1.5 rounded-xl hover:bg-purple-100 transition-colors">{r.pinned?"Desafixar":"Fixar"}</button>
              <button onClick={() => { setReplyFor(r); setReplyText(r.response||""); }} className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl hover:bg-blue-100 transition-colors flex items-center gap-1"><MessageSquare size={11}/> Responder</button>
              <button onClick={() => remove(r.id)} className="text-xs font-bold text-red-500 bg-red-50 px-3 py-1.5 rounded-xl hover:bg-red-100 transition-colors flex items-center gap-1"><Trash2 size={11}/> Excluir</button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400 bg-white rounded-3xl border border-[#E5E7EB]">
            <Star size={36} className="mx-auto mb-2 opacity-30" /><p className="font-semibold">Nenhuma avaliação encontrada</p>
          </div>
        )}
      </div>

      {replyFor && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl border border-[#E5E7EB] shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-gray-900" style={{ fontFamily: "'Fredoka',sans-serif" }}>Responder</h3>
              <button onClick={() => setReplyFor(null)} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center"><X size={14}/></button>
            </div>
            <div className="bg-gray-50 rounded-2xl p-3 mb-4"><p className="text-sm text-gray-500 italic">"{replyFor.comment}"</p></div>
            <textarea rows={4} placeholder="Digite sua resposta..." value={replyText} onChange={e => setReplyText(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-[#E5E7EB] bg-[#F9F0FF] text-sm focus:outline-none focus:ring-2 focus:ring-[#C4B5FD] resize-none mb-4" />
            <div className="flex gap-3">
              <button onClick={() => setReplyFor(null)} className="flex-1 border border-[#E5E7EB] font-bold py-3 rounded-2xl hover:bg-gray-50 text-sm">Cancelar</button>
              <button onClick={saveReply} className="flex-1 bg-gradient-to-r from-[#9B5DE5] to-[#7C3AED] text-white font-bold py-3 rounded-2xl hover:opacity-90 text-sm">Salvar</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// ─── GALERIA ──────────────────────────────────────────────────────────────────
function GaleriaSection() {
  const { msg, show } = useToast();
  const [items, setItems] = useLocalStorage<{id:number;name:string;category:string;url:string}[]>("bc_gallery",[
    { id:1, name:"Oreo",            category:"produto",   url:"https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&q=80" },
    { id:2, name:"Bombom Morango",  category:"produto",   url:"https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&q=80" },
    { id:3, name:"Entrega",         category:"destaque",  url:"https://images.unsplash.com/photo-1549541671-30ae92a5f83e?w=400&q=80"  },
  ]);
  const [name, setName]   = useState("");
  const [cat, setCat]     = useState("produto");

  const add = () => {
    if (!name.trim()) return;
    setItems(prev => [...prev, { id: Date.now(), name, category: cat, url: `https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&q=80&sig=${Date.now()}` }]);
    setName(""); show("Imagem adicionada!");
  };

  return (
    <div className="space-y-5">
      {msg && <Toast msg={msg} />}
      <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm p-5">
        <h3 className="font-black text-gray-900 mb-4" style={{ fontFamily: "'Fredoka',sans-serif" }}>Adicionar à Galeria</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <input type="text" placeholder="Nome da imagem" value={name} onChange={e => setName(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-2xl border border-[#E5E7EB] bg-[#F9F0FF] text-sm focus:outline-none focus:ring-2 focus:ring-[#C4B5FD]" />
          <select value={cat} onChange={e => setCat(e.target.value)}
            className="px-4 py-2.5 rounded-2xl border border-[#E5E7EB] bg-[#F9F0FF] text-sm focus:outline-none focus:ring-2 focus:ring-[#C4B5FD]">
            {["produto","destaque","evento","outro"].map(c=><option key={c} value={c} className="capitalize">{c}</option>)}
          </select>
          <button onClick={add} className="flex items-center gap-2 bg-gradient-to-r from-[#9B5DE5] to-[#7C3AED] text-white font-bold px-5 py-2.5 rounded-2xl hover:opacity-90 transition-all text-sm whitespace-nowrap">
            <Plus size={14}/> Adicionar
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-3">Em produção: integrar Supabase Storage para upload real de arquivos (por enquanto os itens ficam salvos só neste navegador).</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map(item => (
          <div key={item.id} className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm overflow-hidden group">
            <div className="relative h-36 bg-purple-50">
              <img src={item.url} alt={item.name} className="w-full h-full object-cover"
                onError={e => { (e.target as HTMLImageElement).style.opacity="0"; }} />
              <button onClick={() => { setItems(p=>p.filter(i=>i.id!==item.id)); show("Removida!"); }}
                className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow">
                <X size={12}/>
              </button>
            </div>
            <div className="p-3">
              <p className="font-bold text-sm text-gray-900 truncate">{item.name}</p>
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-semibold capitalize">{item.category}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── CONFIGURAÇÕES ────────────────────────────────────────────────────────────
function ConfigSection() {
  const { msg, show } = useToast();
  const [cfg, setCfg] = useLocalStorage("bc_config", {
    nome:    "BC Bom Feito Confeitaria",
    wa:      "(89) 99411-2439",
    ig:      "@bcconfeitaria_doces",
    email:   "emillesilva879@gmail.com",
    horario: "Qua – Dom · 14h às 20h",
    pix:     "ludmyla.emille1412@gmail.com",
    freteFL: "3,00",
    freteBG: "4,00",
    sl1:     "Feito com carinho, servido em cada colher.",
    sl2:     "Transformando momentos em doces lembranças.",
    sl3:     "O sabor que abraça o coração.",
  });

  const FIELDS = [
    { section:"Informações da Loja",       keys:[["nome","Nome da Confeitaria"],["horario","Horário de Funcionamento"],["email","E-mail"]] },
    { section:"Redes Sociais & Contato",   keys:[["wa","WhatsApp"],["ig","Instagram"]] },
    { section:"Pagamento",                  keys:[["pix","Chave PIX"]] },
    { section:"Fretes Fixos (R$)",         keys:[["freteFL","Floriano – PI"],["freteBG","Barão de Grajaú – MA"]] },
    { section:"Slogans do Site",            keys:[["sl1","Slogan 1"],["sl2","Slogan 2"],["sl3","Slogan 3"]] },
  ];

  return (
    <div className="space-y-5 max-w-2xl">
      {msg && <Toast msg={msg} />}
      {FIELDS.map(block => (
        <div key={block.section} className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm p-5">
          <h3 className="font-black text-gray-900 mb-4" style={{ fontFamily: "'Fredoka',sans-serif" }}>{block.section}</h3>
          <div className="space-y-3">
            {block.keys.map(([k,l]) => (
              <div key={k}>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">{l}</label>
                <input type="text" value={(cfg as any)[k]}
                  onChange={e => setCfg((c:any) => ({ ...c, [k]: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-2xl border border-[#E5E7EB] bg-[#F9F0FF] text-sm focus:outline-none focus:ring-2 focus:ring-[#C4B5FD]" />
              </div>
            ))}
          </div>
        </div>
      ))}
      <button onClick={() => show("Configurações salvas!")}
        className="w-full bg-gradient-to-r from-[#9B5DE5] to-[#7C3AED] text-white font-bold py-3.5 rounded-2xl hover:opacity-90 transition-all shadow-sm flex items-center justify-center gap-2 text-sm">
        <CheckCircle size={15}/> Salvar Configurações
      </button>
      <p className="text-xs text-gray-400 text-center">Produtos, pedidos, clientes e avaliações já são salvos no Supabase. Estas configurações gerais ainda ficam só neste navegador.</p>
    </div>
  );
}

// ─── ADMIN ROOT ───────────────────────────────────────────────────────────────
export default function Admin() {
  const [session, setSession]     = useState<any>(undefined); // undefined = ainda checando
  const [section, setSection]     = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileSB, setMobileSB]   = useState(false);

  useEffect(() => {
    if (supabaseConfigError) return; // evita chamadas ao cliente "stub"
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  const [products,  setProducts,  loadingProducts]  = useSupabaseTable<AdminProduct>("products", productFromDb, productToDb);
  const [orders,    setOrders,    loadingOrders]    = useSupabaseTable<AdminOrder>("orders", orderFromDb, orderToDb);
  const [customers, setCustomers, loadingCustomers] = useSupabaseTable<AdminCustomer>("customers", customerFromDb, customerToDb);
  const [reviews,   setReviews,   loadingReviews]   = useSupabaseTable<AdminReview>("reviews", reviewFromDb, reviewToDb);

  const logout = () => supabase.auth.signOut();
  const nav    = (s: string) => { setSection(s); setMobileSB(false); };

  // Todos os hooks acima já rodaram — a partir daqui é seguro decidir o que renderizar.
  if (supabaseConfigError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F6FF] px-4">
        <div className="max-w-md bg-white rounded-3xl border border-red-200 shadow-sm p-6 text-center">
          <XCircle size={32} className="text-red-500 mx-auto mb-3" />
          <h1 className="font-black text-gray-900 mb-1">Supabase não configurado</h1>
          <p className="text-sm text-gray-500 mb-1">{supabaseConfigError}</p>
          <p className="text-xs text-gray-400 mt-3">
            Confira VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nas variáveis de
            ambiente do projeto (sem espaços extras) e refaça o deploy.
          </p>
        </div>
      </div>
    );
  }

  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F6FF]">
        <div className="w-8 h-8 border-4 border-[#C4B5FD] border-t-[#9B5DE5] rounded-full animate-spin" />
      </div>
    );
  }
  if (!session) return <LoginScreen />;

  const user = session.user.email as string;
  const dataLoading = loadingProducts || loadingOrders || loadingCustomers || loadingReviews;

  const Sidebar = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-white/10 flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#F15BB5] to-[#9B5DE5] flex items-center justify-center flex-shrink-0 shadow-sm">
          <ChefHat size={19} className="text-white" />
        </div>
        {!collapsed && (
          <div>
            <p className="text-white font-black text-sm leading-tight" style={{ fontFamily:"'Fredoka',sans-serif" }}>BC Bom Feito</p>
            <p className="text-white/40 text-[10px] font-semibold">Painel Admin</p>
          </div>
        )}
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => nav(id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all text-left ${section===id ? "bg-white/15 text-white" : "text-white/45 hover:bg-white/8 hover:text-white/70"}`}>
            <Icon size={17} className="flex-shrink-0" />
            {!collapsed && <span className="text-sm font-semibold">{label}</span>}
          </button>
        ))}
      </nav>

      <div className="p-3 border-t border-white/10">
        <button onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-white/40 hover:bg-red-500/15 hover:text-red-400 transition-all text-left">
          <LogOut size={17} className="flex-shrink-0" />
          {!collapsed && <span className="text-sm font-semibold">Sair</span>}
        </button>
        {!collapsed && <p className="text-white/25 text-[10px] text-center mt-3 truncate px-2">Logado como <span className="text-white/45 font-bold">{user}</span></p>}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex" style={{ fontFamily:"'Nunito',sans-serif", background:"#F8F6FF" }}>
      {/* Desktop sidebar */}
      <aside className={`hidden md:flex flex-col flex-shrink-0 bg-[#1A1625] transition-all duration-300 ${collapsed ? "w-[68px]" : "w-60"}`}>
        <Sidebar />
      </aside>

      {/* Mobile sidebar */}
      {mobileSB && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileSB(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-60 bg-[#1A1625] flex flex-col shadow-2xl">
            <Sidebar />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-[#F0EBF8] px-5 py-3.5 flex items-center gap-3">
          <button onClick={() => { setCollapsed(v=>!v); setMobileSB(v=>!v); }}
            className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-purple-50 text-gray-500 hover:text-[#9B5DE5] transition-colors flex-shrink-0">
            <Menu size={16} />
          </button>
          <div className="flex items-center gap-1.5 text-sm text-gray-400 min-w-0">
            <span className="hidden sm:inline font-semibold">Admin</span>
            <ChevronRight size={13} className="hidden sm:inline flex-shrink-0" />
            <span className="font-black text-gray-900 truncate">{SECTION_TITLES[section]}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 bg-gray-100 rounded-2xl px-3 py-1.5 max-w-[220px]">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#9B5DE5] to-[#F15BB5] flex items-center justify-center text-white text-xs font-black flex-shrink-0">{user[0].toUpperCase()}</div>
              <span className="text-sm font-bold text-gray-700 truncate">{user}</span>
            </div>
            <button onClick={logout}
              className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-colors text-gray-400">
              <LogOut size={15}/>
            </button>
          </div>
        </header>

        <main className="flex-1 p-5 sm:p-6 overflow-auto">
          {dataLoading ? (
            <div className="flex items-center justify-center py-24">
              <div className="w-7 h-7 border-4 border-[#C4B5FD] border-t-[#9B5DE5] rounded-full animate-spin" />
            </div>
          ) : (
            <motion.div key={section} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}>
              {section === "dashboard"     && <Dashboard orders={orders} products={products} customers={customers} reviews={reviews} />}
              {section === "produtos"      && <ProdutosSection products={products} setProducts={setProducts} />}
              {section === "pedidos"       && <PedidosSection orders={orders} setOrders={setOrders} customers={customers} setCustomers={setCustomers} products={products} />}
              {section === "clientes"      && <ClientesSection customers={customers} setCustomers={setCustomers} />}
              {section === "avaliacoes"    && <AvaliacoesSection reviews={reviews} setReviews={setReviews} />}
              {section === "galeria"       && <GaleriaSection />}
              {section === "configuracoes" && <ConfigSection />}
            </motion.div>
          )}
        </main>
      </div>
    </div>
  );
}
