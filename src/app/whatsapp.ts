const DEFAULT_WHATSAPP = "5589994112439";

export function openWhatsApp(
  msg = "Olá!\nGostaria de fazer um pedido na BC Bom Feito Confeitaria.",
  number = DEFAULT_WHATSAPP,
) {
  const cleanNumber = String(number || DEFAULT_WHATSAPP).replace(/\D/g, "");
  const url = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(msg)}`;
  window.location.assign(url);
}
