// Gera o "Pix Copia e Cola" no formato padrão do Banco Central (EMV/BR Code).
// Referência: manual de padrões para iniciação do Pix (Bacen).

function tlv(id: string, value: string): string {
  const len = String(value.length).padStart(2, "0");
  return `${id}${len}${value}`;
}

// CRC16-CCITT (0xFFFF), exigido no final do payload do Pix.
function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

// Remove acentos e caracteres fora do padrão aceito pelo Pix (só ASCII).
function sanitize(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9 ]/g, "").trim();
}

export function buildPixPayload({
  key, name, city, amount, txid = "***",
}: { key: string; name: string; city: string; amount?: number; txid?: string }): string {
  const merchantAccount =
    tlv("00", "br.gov.bcb.pix") +
    tlv("01", key);

  const additionalData = tlv("05", txid || "***");

  let payload =
    tlv("00", "01") +                                  // Payload Format Indicator
    tlv("01", "12") +                                  // Point of Initiation Method (12 = estático reutilizável)
    tlv("26", merchantAccount) +                        // Merchant Account Information (Pix)
    tlv("52", "0000") +                                 // Merchant Category Code
    tlv("53", "986");                                   // Moeda: Real (BRL)

  if (amount && amount > 0) {
    payload += tlv("54", amount.toFixed(2));            // Valor da transação (opcional)
  }

  payload +=
    tlv("58", "BR") +                                   // País
    tlv("59", sanitize(name).slice(0, 25) || "BC BOM FEITO") +  // Nome do recebedor (máx 25)
    tlv("60", sanitize(city).slice(0, 15) || "FLORIANO") +      // Cidade (máx 15)
    tlv("62", additionalData);                          // Dados adicionais (txid)

  payload += "6304"; // marcador do CRC, o valor vem logo abaixo
  return payload + crc16(payload);
}
