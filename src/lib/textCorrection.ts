export type LanguageToolReplacement = {
  value: string;
};

export type LanguageToolMatch = {
  message: string;
  shortMessage?: string;
  replacements: LanguageToolReplacement[];
  offset: number;
  length: number;
  context?: {
    text: string;
    offset: number;
    length: number;
  };
  rule: {
    id: string;
    description: string;
    issueType?: string;
    category?: {
      id: string;
      name: string;
    };
  };
};

export type AppliedCorrection = {
  original: string;
  replacement: string;
  message: string;
  ruleId: string;
  ruleDescription: string;
  offset: number;
  length: number;
  context?: string;
};

export type TextCorrectionResult = {
  correctedText: string;
  matches: LanguageToolMatch[];
  appliedCorrections: AppliedCorrection[];
};

const LANGUAGE_TOOL_ENDPOINT = 'https://api.languagetool.org/v2/check';
const MAX_CHUNK_SIZE = 4500;

const splitIntoChunks = (text: string): Array<{ text: string; offset: number }> => {
  const chunks: Array<{ text: string; offset: number }> = [];
  let pointer = 0;

  while (pointer < text.length) {
    let end = Math.min(pointer + MAX_CHUNK_SIZE, text.length);

    if (end < text.length) {
      const slice = text.slice(pointer, end);
      const lastParagraphBreak = slice.lastIndexOf('\n\n');
      const lastSentenceBreak = slice.lastIndexOf('. ');
      const lastSpace = slice.lastIndexOf(' ');

      const preferredBreak = Math.max(lastParagraphBreak, lastSentenceBreak, lastSpace);

      if (preferredBreak > 0 && preferredBreak > slice.length * 0.2) {
        end = pointer + preferredBreak + 1;
      }
    }

    const chunkText = text.slice(pointer, end);
    chunks.push({ text: chunkText, offset: pointer });
    pointer = end;
  }

  return chunks;
};

const requestLanguageTool = async (text: string): Promise<{ matches: LanguageToolMatch[] }> => {
  const params = new URLSearchParams();
  params.set('text', text);
  params.set('language', 'es');
  params.set('enabledOnly', 'false');

  const response = await fetch(LANGUAGE_TOOL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LanguageTool error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return { matches: data.matches as LanguageToolMatch[] };
};

const applyMatchesToText = (
  baseText: string,
  matches: LanguageToolMatch[],
  globalOffset: number
): { correctedText: string; applied: AppliedCorrection[]; normalizedMatches: LanguageToolMatch[] } => {
  if (!matches.length) {
    return { correctedText: baseText, applied: [], normalizedMatches: [] };
  }

  let workingText = baseText;
  const applied: AppliedCorrection[] = [];

  const sorted = [...matches]
    .filter(match => Array.isArray(match.replacements) && match.replacements.length > 0)
    .sort((a, b) => b.offset - a.offset);

  for (const match of sorted) {
    const replacement = match.replacements[0]?.value;
    if (!replacement) continue;

    const start = match.offset;
    const end = start + match.length;
    const originalSegment = workingText.slice(start, end);

    workingText = `${workingText.slice(0, start)}${replacement}${workingText.slice(end)}`;

    applied.push({
      original: originalSegment,
      replacement,
      message: match.message,
      ruleId: match.rule?.id ?? 'desconocido',
      ruleDescription: match.rule?.description ?? '',
      offset: globalOffset + start,
      length: match.length,
      context: match.context?.text,
    });
  }

  const normalizedMatches = matches.map(match => ({
    ...match,
    offset: match.offset + globalOffset,
    context: match.context
      ? {
          ...match.context,
          offset: match.context.offset + globalOffset,
        }
      : match.context,
  }));

  return {
    correctedText: workingText,
    applied: applied.reverse(),
    normalizedMatches,
  };
};

export const applySpanishTextCorrections = async (text: string): Promise<TextCorrectionResult> => {
  if (!text || !text.trim()) {
    return {
      correctedText: text,
      matches: [],
      appliedCorrections: [],
    };
  }

  const chunks = splitIntoChunks(text);
  const correctedParts: string[] = [];
  const allMatches: LanguageToolMatch[] = [];
  const allCorrections: AppliedCorrection[] = [];

  for (const chunk of chunks) {
    const { matches } = await requestLanguageTool(chunk.text);
    const { correctedText, applied, normalizedMatches } = applyMatchesToText(
      chunk.text,
      matches,
      chunk.offset
    );

    correctedParts.push(correctedText);
    allCorrections.push(...applied);
    allMatches.push(...normalizedMatches);
  }

  return {
    correctedText: correctedParts.join(''),
    matches: allMatches,
    appliedCorrections: allCorrections,
  };
};
