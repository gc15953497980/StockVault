export const DEFAULT_KEY = '';
export const DEFAULT_MODEL = 'gemini-2.5-flash-lite';
const LS_KEY = 'stockvault_gemini_key';
const LS_MODEL = 'stockvault_gemini_model';

export function getGeminiKey(): string {
  return localStorage.getItem(LS_KEY) || DEFAULT_KEY;
}

export function setGeminiKey(key: string): void {
  localStorage.setItem(LS_KEY, key);
}

export function getGeminiModel(): string {
  return localStorage.getItem(LS_MODEL) || DEFAULT_MODEL;
}

export function setGeminiModel(model: string): void {
  localStorage.setItem(LS_MODEL, model);
}

export interface FundRecognitionResult {
  code?: string;
  name?: string;
  holdingAmount?: number;
  holdingCost?: number;
  sector?: string;
}

export async function recognizeFundFromImage(base64Data: string, mimeType: string): Promise<FundRecognitionResult[]> {
  const apiKey = getGeminiKey();
  if (!apiKey) {
    throw new Error('未配置 Gemini API Key，请先在表单中点击「API 设置」填入你的 Key');
  }
  const model = getGeminiModel();
  const url = `/api/gemini/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const prompt = `你是一个基金持仓截图识别助手。请从图片中提取所有基金的持仓信息，以JSON数组格式返回。只返回JSON，不要有其他文字。

对每只基金必须提取以下字段：
- code: 基金代码（6位纯数字，通常在基金名称旁边或详情页顶部，一定要仔细查找）
- name: 基金全称
- holdingAmount: 持有金额（元）
- holdingCost: 持仓成本净值（如果有的话）
- sector: 行业类型（如科技、消费、医药、金融、债券、混合、指数、港股、ETF等）

重要：code是必填字段，每只基金都必须有code。如果实在找不到code，设置为空字符串""。
JSON格式示例：
[{"code":"000001","name":"某某基金","holdingAmount":10000,"holdingCost":1.2345,"sector":"混合"}]`;

  const body = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: mimeType, data: base64Data } },
      ],
    }],
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    let errMsg: string;
    try {
      const errJson = JSON.parse(errText);
      const msg = errJson?.error?.message || errText;
      if (res.status === 429) {
        errMsg = `API 配额已用尽，请稍后再试或更换 API Key。\n${msg}`;
      } else if (res.status === 400) {
        errMsg = `请求参数错误，请检查模型名称: ${model}\n${msg}`;
      } else if (res.status === 403) {
        errMsg = `API Key 无效或无权访问。\n${msg}`;
      } else {
        errMsg = `Gemini API 请求失败 (${res.status}): ${msg}`;
      }
    } catch {
      errMsg = `Gemini API 请求失败 (${res.status}): ${errText}`;
    }
    throw new Error(errMsg);
  }

  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini 未返回识别结果');

  return extractJSON(text);
}

/** Extract JSON array or object from AI response */
function extractJSON(text: string): FundRecognitionResult[] {
  let cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  // Remove trailing commas before } or ]
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

  // Try parsing the whole thing first
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Extract the outermost JSON structure
    const arrayStart = cleaned.indexOf('[');
    const arrayEnd = cleaned.lastIndexOf(']');
    const objStart = cleaned.indexOf('{');
    const objEnd = cleaned.lastIndexOf('}');

    if (arrayStart !== -1 && arrayEnd > arrayStart) {
      try {
        parsed = JSON.parse(cleaned.slice(arrayStart, arrayEnd + 1));
      } catch (e) {
        throw new Error(`JSON数组解析失败: ${e instanceof Error ? e.message : String(e)}\n原始文本: ${text.slice(0, 300)}`, { cause: e });
      }
    } else if (objStart !== -1 && objEnd > objStart) {
      try {
        parsed = JSON.parse(cleaned.slice(objStart, objEnd + 1));
      } catch (e) {
        throw new Error(`JSON对象解析失败: ${e instanceof Error ? e.message : String(e)}\n原始文本: ${text.slice(0, 300)}`, { cause: e });
      }
    } else {
      throw new Error('未能从识别结果中找到JSON: ' + text.slice(0, 200));
    }
  }

  // Normalize to array
  const items: unknown[] = Array.isArray(parsed) ? parsed : [parsed];

  return items.map(item => normalizeResult(item as Record<string, unknown>));
}

function normalizeResult(raw: Record<string, unknown>): FundRecognitionResult {
  const r: FundRecognitionResult = {};
  if (typeof raw.code === 'string' || typeof raw.code === 'number') {
    r.code = String(raw.code).trim();
  }
  if (typeof raw.name === 'string') {
    r.name = raw.name;
  }
  if (typeof raw.holdingAmount === 'string' || typeof raw.holdingAmount === 'number') {
    r.holdingAmount = parseFloat(String(raw.holdingAmount)) || undefined;
  }
  if (typeof raw.holdingCost === 'string' || typeof raw.holdingCost === 'number') {
    r.holdingCost = parseFloat(String(raw.holdingCost)) || undefined;
  }
  if (typeof raw.sector === 'string') {
    r.sector = raw.sector;
  }
  return r;
}
