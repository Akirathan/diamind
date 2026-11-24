export interface MarkupTag {
  name: string;
  /** The values are not decoded. */
  attributes: ReadonlyMap<string, string>;
  closing: boolean;
  selfClosing: boolean;
  /** The position behind the tag. */
  end: number;
}

const NAME = /[A-Za-z_][\w:.-]*/y;
const ATTRIBUTE_NAME = /[^\s"'<>/=]+/y;
const UNQUOTED_VALUE = /[^\s"'<>]+/y;
const SPACE = /\s*/y;

/** Parses the XML or HTML tag that starts at `start`. Returns `null` if there is none. */
export function parseTag(source: string, start: number): MarkupTag | null {
  let pos = start + 1;

  function match(pattern: RegExp): string {
    pattern.lastIndex = pos;
    const text = pattern.exec(source)?.[0] ?? "";
    pos += text.length;
    return text;
  }

  /** Returns `null` if a quote is missing. */
  function attributeValue(): string | null {
    const quote = source[pos];
    if (quote !== '"' && quote !== "'") {
      return match(UNQUOTED_VALUE);
    }
    const close = source.indexOf(quote, pos + 1);
    if (close < 0) {
      return null;
    }
    const value = source.slice(pos + 1, close);
    pos = close + 1;
    return value;
  }

  const closing = source[pos] === "/";
  if (closing) {
    pos++;
  }
  const name = match(NAME);
  if (name === "") {
    return null;
  }
  const attributes = new Map<string, string>();
  for (;;) {
    match(SPACE);
    if (source[pos] === ">") {
      return { name, attributes, closing, selfClosing: false, end: pos + 1 };
    }
    if (source.startsWith("/>", pos)) {
      return { name, attributes, closing, selfClosing: true, end: pos + 2 };
    }
    const attribute = match(ATTRIBUTE_NAME);
    if (attribute === "") {
      return null;
    }
    match(SPACE);
    let value: string | null = "";
    if (source[pos] === "=") {
      pos++;
      match(SPACE);
      value = attributeValue();
    }
    if (value === null) {
      return null;
    }
    attributes.set(attribute, value);
  }
}
