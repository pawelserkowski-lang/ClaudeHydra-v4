export interface TextSegment {
  type: 'text';
  content: string;
}

export interface ToolSegment {
  type: 'tool';
  name: string;
  content: string;
}

export type MessageSegment = TextSegment | ToolSegment;

export function stripParallelHeader(input: string): string {
  if (!input) return input;
  return input.replace(/^(?:⚡\s*)?Parallel execution: \d+ tools(?:\r?\n)?/, '');
}

export function splitToolOutput(input: string): MessageSegment[] {
  if (!input) return [];

  const segments: MessageSegment[] = [];
  const toolRegex = /(?:\n)?---\n\*\*(?:🔧\s*)?Tool:\*\* `([^`]+)`\n```\n([\s\S]*?)\n```\n---(?:\n)?/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null = toolRegex.exec(input);

  while (match !== null) {
    const textContent = input.slice(lastIndex, match.index);
    if (textContent) {
      segments.push({ type: 'text', content: textContent });
    }

    segments.push({
      type: 'tool',
      name: match[1] || '',
      content: match[2] || '',
    });

    lastIndex = match.index + match[0].length;
    match = toolRegex.exec(input);
  }

  const remainingText = input.slice(lastIndex);
  if (remainingText) {
    segments.push({ type: 'text', content: remainingText });
  }

  return segments;
}
