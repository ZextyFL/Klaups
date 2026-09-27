// Keyboard shortcut encoding for the soundboard.
//
// Stored as modifiers + KeyboardEvent.code, e.g. "Ctrl+Shift+KeyA" or "F7".
// `code` (physical key) rather than `key` (produced character) so a binding
// survives keyboard layout switches and Shift doesn't turn "1" into "!".

const MODIFIER_CODES = new Set([
  'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight',
  'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight',
]);

// Keys the browser or OS owns; binding them would either never fire or
// break normal navigation.
const RESERVED = new Set(['Tab', 'CapsLock', 'ContextMenu', 'NumLock', 'ScrollLock']);

export type KeyLike = Pick<KeyboardEvent, 'code' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'>;

export function isModifierOnly(event: KeyLike) {
  return MODIFIER_CODES.has(event.code);
}

export function isReserved(event: KeyLike) {
  return RESERVED.has(event.code);
}

export function comboFromEvent(event: KeyLike): string {
  const parts: string[] = [];
  if (event.ctrlKey) parts.push('Ctrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  if (event.metaKey) parts.push('Meta');
  parts.push(event.code);
  return parts.join('+');
}

function codeLabel(code: string) {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) {
    const rest = code.slice(6);
    const ops: Record<string, string> = {
      Add: '+', Subtract: '−', Multiply: '×', Divide: '÷', Decimal: '.', Enter: 'Enter',
    };
    return `Num ${ops[rest] ?? rest}`;
  }
  const named: Record<string, string> = {
    Space: 'Space', Enter: 'Enter', Backquote: '`', Minus: '-', Equal: '=',
    BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';',
    Quote: "'", Comma: ',', Period: '.', Slash: '/',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
    Insert: 'Ins', Delete: 'Del', Home: 'Home', End: 'End',
    PageUp: 'PgUp', PageDown: 'PgDn', Escape: 'Esc', Backspace: '⌫',
  };
  return named[code] ?? code;
}

export function comboLabel(combo: string | null | undefined): string {
  if (!combo) return 'No key';
  return combo
    .split('+')
    .map((part) => (['Ctrl', 'Alt', 'Shift', 'Meta'].includes(part) ? (part === 'Meta' ? '⌘' : part) : codeLabel(part)))
    .join(' + ');
}

/** True when the user is typing somewhere a keypress must not trigger sounds. */
export function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName === 'INPUT') {
    const type = (el as HTMLInputElement).type;
    // Sliders, checkboxes and buttons don't take text; keep hotkeys live there.
    return !['range', 'checkbox', 'radio', 'button', 'submit', 'color', 'file'].includes(type);
  }
  return false;
}

/** Window-wide flag so the recorder can swallow the keypress it is capturing. */
export const KEYBIND_RECORDING_EVENT = 'klaups:keybind-recording';
export const SOUNDBOARD_CHANGED_EVENT = 'klaups:soundboard-changed';
