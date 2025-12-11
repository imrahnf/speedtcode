
export interface PlayableRange {
  startLine: number; // 0-indexed, inclusive
  endLine: number;   // 0-indexed, exclusive (like slice)
}

export function getPlayableCodeRange(code: string, language: string): PlayableRange {
  const lines = code.split('\n');
  const lang = language.toLowerCase();
  
  let startLine = 0;
  let endLine = lines.length;

  if (lang === 'python') {
    // Find "class Solution:" then the first "def"
    let foundClass = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('class Solution:')) {
        foundClass = true;
      }
      if (foundClass && line.startsWith('def ')) {
        startLine = i + 1;
        break;
      }
    }
  } else if (lang === 'javascript' || lang === 'js') {
    // Find the function definition line. Usually starts with var/const/function and ends with {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if ((line.startsWith('var ') || line.startsWith('const ') || line.startsWith('function ')) && line.endsWith('{')) {
        startLine = i + 1;
        break;
      }
    }
    // Remove the last line (closing brace)
    if (lines.length > 0) {
      endLine = lines.length - 1;
    }
  } else if (lang === 'cpp' || lang === 'c++') {
    // Find class Solution, then public:, then the function definition
    let foundClass = false;
    let foundPublic = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.includes('class Solution')) foundClass = true;
      if (foundClass && line.includes('public:')) foundPublic = true;
      
      // Function def usually has return type, name, parens, and opening brace
      // Heuristic: contains ')' and '{'
      if (foundPublic && line.includes(')') && line.includes('{')) {
        startLine = i + 1;
        break;
      }
    }
    
    // Remove the last 2 lines (closing brace for function and class)
    if (lines.length > 1) {
      endLine = lines.length - 2;
    }
  }

  // Safety check
  if (startLine >= endLine) {
    return { startLine: 0, endLine: lines.length };
  }

  return { startLine, endLine };
}
