const XML_ENTITIES: ReadonlyMap<string, string> = new Map([
  ["amp", "&"],
  ["lt", "<"],
  ["gt", ">"],
  ["quot", '"'],
  ["apos", "'"],
]);

const HTML_ENTITIES: ReadonlyMap<string, string> = new Map([
  ...XML_ENTITIES,
  ["nbsp", " "],
  ["ensp", " "],
  ["emsp", " "],
  ["thinsp", " "],
  ["shy", "­"],
  ["zwnj", "‌"],
  ["zwj", "‍"],
  ["ndash", "–"],
  ["mdash", "—"],
  ["lsquo", "‘"],
  ["rsquo", "’"],
  ["sbquo", "‚"],
  ["ldquo", "“"],
  ["rdquo", "”"],
  ["bdquo", "„"],
  ["laquo", "«"],
  ["raquo", "»"],
  ["hellip", "…"],
  ["bull", "•"],
  ["middot", "·"],
  ["sect", "§"],
  ["para", "¶"],
  ["copy", "©"],
  ["reg", "®"],
  ["trade", "™"],
  ["deg", "°"],
  ["plusmn", "±"],
  ["times", "×"],
  ["divide", "÷"],
  ["frac12", "½"],
  ["frac14", "¼"],
  ["frac34", "¾"],
  ["micro", "µ"],
  ["cent", "¢"],
  ["pound", "£"],
  ["yen", "¥"],
  ["euro", "€"],
  ["larr", "←"],
  ["uarr", "↑"],
  ["rarr", "→"],
  ["darr", "↓"],
  ["harr", "↔"],
  ["le", "≤"],
  ["ge", "≥"],
  ["ne", "≠"],
]);

const ENTITY = /&(?:#(\d{1,7})|#[xX]([\da-fA-F]{1,6})|([A-Za-z][\da-zA-Z]*));/g;
const REPLACEMENT_CHARACTER = "�";

export function decodeXml(text: string): string {
  return decode(text, XML_ENTITIES);
}

export function decodeHtml(text: string): string {
  return decode(text, HTML_ENTITIES);
}

/** Unknown entities stay as they are. Only one pass, so the result never grows. */
function decode(text: string, names: ReadonlyMap<string, string>): string {
  if (!text.includes("&")) {
    return text;
  }
  return text.replace(
    ENTITY,
    (entity, decimal?: string, hex?: string, name?: string) => {
      if (decimal !== undefined) {
        return fromCodePoint(Number.parseInt(decimal, 10));
      }
      if (hex !== undefined) {
        return fromCodePoint(Number.parseInt(hex, 16));
      }
      return names.get(name as string) ?? entity;
    },
  );
}

function fromCodePoint(code: number): string {
  const isSurrogate = code >= 0xd800 && code <= 0xdfff;
  if (code === 0 || code > 0x10ffff || isSurrogate) {
    return REPLACEMENT_CHARACTER;
  }
  return String.fromCodePoint(code);
}
