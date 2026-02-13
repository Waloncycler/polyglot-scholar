/**
 * 学术翻译规范与提示词配置 (Prompt Engineering Rules)
 * 包含：学术符号、地质层位、井号命名、物理单位等标准化协议
 */

export const ACADEMIC_FORMAT_PROTOCOL = `
### **学术符号与命名规范协议 (Academic Notation & Formatting Protocol)**

为了确保翻译结果的专业性及与 Word/WPS 的直接兼容性，请严格遵守以下三大核心规范：

#### **1. 地质地层标识 (Geological Stratigraphy)**
**核心原则**：严格遵循“主层位下标 + 次层位上标”的 Unicode 组合格式。
*   **规则**：
    *   地质代号（如 E, J, K, T, O, Є）后的**第一个数字**视为统/组（System/Series），使用 **Unicode 下标** (\`₀-₉\`)。
    *   **第二个数字**（通常紧跟在第一个数字后，或表示更细分的层位），使用 **Unicode 上标** (\`⁰-⁹\`)。
*   **示例 (Few-Shot Examples)**：
    *   \`E23\` 或 \`E2^3\` → **E₂³** (Correct)
    *   \`J31\` → **J₃¹** (Correct)
    *   \`K1\` → **K₁** (Correct)
    *   \`T2\` → **T₂** (Correct)
*   **禁止**：\`E_2^3\`, \`E2-3\`, \`E_2_3\`

#### **2. 井号命名规范 (Well Naming Convention)**
**核心原则**：拼音与数字间用空格，仅在数字层级间用连字符。
*   **规则**：
    *   **前缀处理**：井名汉字部分转换为拼音首字母大写（如“自”→\`Zi\`, “苏”→\`Su\`）。
    *   **主分隔符**：拼音与第一组数字之间，**必须使用空格**，**严禁**使用连字符 \`-\`。
    *   **次级分隔符**：仅在井号内部存在分支/侧钻/层级时，数字与数字之间使用连字符 \`-\`。
*   **示例 (Few-Shot Examples)**：
    *   原文“自23” → **Zi 23** (Correct) | 错误: Zi-23
    *   原文“自23-2” → **Zi 23-2** (Correct) | 错误: Zi 23 2
    *   原文“苏里格11-5” → **Sulige 11-5** (或缩写 **Su 11-5**)

#### **3. 物理与计量单位 (Physical Units)**
**核心原则**：所见即所得 (Visual Unicode First)。
*   **规则**：所有单位中的指数必须使用 **Unicode 上标**，禁止使用 LaTeX 或 Markdown 代码。
*   **示例 (Few-Shot Examples)**：
    *   \`m^3\` → **m³**
    *   \`s^-1\` → **s⁻¹**
    *   \`g/cm^3\` → **g·cm⁻³** 或 **g/cm³**
    *   \`10^-3\` → **10⁻³**

#### **4. 数学公式 (Formulas)**
*   **规则**：保持“可视化纯文本数学格式” (Visual Plain Text Math)。
    *   禁止使用 LaTeX 代码（如 \`\\beta\`, \`$\`）。
    *   使用 Unicode 希腊字母（α, β, γ）。
    *   简单上下标使用 Unicode 字符（x₁, x²）。
    *   复杂公式尽量保持可读性，仅在无法用 Unicode 表示时使用 \`^\` 或 \`_\`。
`;
