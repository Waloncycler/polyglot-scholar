/**
 * 文本格式化工具 (Text Formatter)
 * 专门用于对翻译结果进行后处理清洗，确保学术符号、单位、井号等格式的绝对正确性。
 * 作为 Prompt 的兜底保障，修复模型偶尔产生的格式幻觉。
 */

// 1. 物理单位与上标修正规则
const UNIT_REPLACEMENTS: [RegExp, string | ((match: string, ...args: string[]) => string)][] = [
  // 修正常见的 ^n 格式为 Unicode 上标
  [/(\d+|[a-zA-Z])\^3/g, '$1³'], // m^3 -> m³
  [/(\d+|[a-zA-Z])\^2/g, '$1²'], // m^2 -> m²
  [/(\d+|[a-zA-Z])\^1/g, '$1¹'], // x^1 -> x¹
  [/(\d+|[a-zA-Z])\^0/g, '$1⁰'], // x^0 -> x⁰
  [/(\d+|[a-zA-Z])\^-1/g, '$1⁻¹'], // s^-1 -> s⁻¹
  [/(\d+|[a-zA-Z])\^-2/g, '$1⁻²'], // s^-2 -> s⁻²
  [/(\d+|[a-zA-Z])\^-3/g, '$1⁻³'], // s^-3 -> s⁻³
  
  // 修正特定的单位组合 (防止误伤)
  [/g\/cm\^3/g, 'g/cm³'],
  [/kg\/m\^3/g, 'kg/m³'],
  [/10\^-(\d+)/g, (match: string, p1: string) => {
    // Helper function toSuperscript used here
    const map: { [key: string]: string } = {
      '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
      '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
      '-': '⁻', '+': '⁺', '=': '⁼', '(': '⁽', ')': '⁾'
    };
    const sup = p1.split('').map(c => map[c] || c).join('');
    return `10⁻${sup}`;
  }],
];

// 2. 井号命名修正规则
const WELL_NAME_PATTERNS = [
  // 修正 "Zi-23" -> "Zi 23" (拼音+连字符+数字 -> 拼音+空格+数字)
  {
    regex: /\b([A-Z][a-z]+)-(\d+)(?!\d)/g, // Zi-23, Wei-2
    replacement: '$1 $2'
  },
  // 修正 "Zi23" -> "Zi 23" (拼音+数字粘连 -> 拼音+空格+数字)
  // 注意：需要避开已有空格的情况，且仅针对特定常见前缀以防误伤
  {
    regex: /\b(Zi|Su|Wei|Long|Xi|Dong)(\d+)(?!\d)/g,
    replacement: '$1 $2'
  },
  // 修正 "Zi 23 2" -> "Zi 23-2" (拼音+空格+数字+空格+数字 -> 拼音+空格+数字+连字符+数字)
  // 针对分支井号的特定修复
  {
    regex: /\b([A-Z][a-z]+)\s+(\d+)\s+(\d+)\b/g,
    replacement: '$1 $2-$3'
  }
];

// 3. 地层标识修正规则 (谨慎使用)
const STRATIGRAPHY_PATTERNS = [
  // 修正 "E2^3" -> "E₂³"
  // Previous regex was /\b([EJKTO])(\d)\^(\d)\b/g but ^3 is already converted to ³ by UNIT_REPLACEMENTS
  // So we need to match "E2³" and convert the 2 to subscript
  {
    regex: /\b([EJKTO])(\d)([⁰¹²³⁴⁵⁶⁷⁸⁹])\b/g,
    replacement: (match: string, p1: string, p2: string, p3: string) => `${p1}${toSubscript(p2)}${p3}`
  },
  // 修正 "E23" -> "E₂³" (仅针对特定前缀 + 2位数字，且数字不大)
  {
    regex: /\b([EJKTO])([1-4])([1-4])\b/g,
    replacement: (match: string, p1: string, p2: string, p3: string) => `${p1}${toSubscript(p2)}${toSuperscript(p3)}`
  },
  // 修正 "K1" -> "K₁" (Single digit suffix)
  {
    regex: /\b([EJKTO])(\d)\b/g,
    replacement: (match: string, p1: string, p2: string) => `${p1}${toSubscript(p2)}`
  }
];

// 辅助函数：转换为上标
function toSuperscript(str: string): string {
  const map: { [key: string]: string } = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '-': '⁻', '+': '⁺', '=': '⁼', '(': '⁽', ')': '⁾'
  };
  return str.split('').map(c => map[c] || c).join('');
}

// 辅助函数：转换为下标
function toSubscript(str: string): string {
  const map: { [key: string]: string } = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
    '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎'
  };
  return str.split('').map(c => map[c] || c).join('');
}

/**
 * 主格式化函数
 * @param text 原始翻译文本
 * @returns 清洗后的文本
 */
export const postProcessText = (text: string): string => {
  let result = text;

  // 1. 应用单位修正
  UNIT_REPLACEMENTS.forEach(([regex, replacement]) => {
    if (typeof replacement === 'string') {
      result = result.replace(regex, replacement);
    } else {
      result = result.replace(regex, replacement);
    }
  });

  // 2. 应用井号修正
  WELL_NAME_PATTERNS.forEach(({ regex, replacement }) => {
    result = result.replace(regex, replacement);
  });

  // 3. 应用地层修正
  STRATIGRAPHY_PATTERNS.forEach(({ regex, replacement }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result = result.replace(regex, replacement as any);
  });

  return result;
};
