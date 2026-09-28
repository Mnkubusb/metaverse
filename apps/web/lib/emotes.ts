// Must match EMOTES in apps/ws/src/chat.ts
export const EMOTES = [
  { id: 'wave', emoji: '👋', label: 'Wave' },
  { id: 'laugh', emoji: '😂', label: 'Laugh' },
  { id: 'heart', emoji: '❤️', label: 'Heart' },
  { id: 'thumbs-up', emoji: '👍', label: 'Thumbs up' },
  { id: 'party', emoji: '🎉', label: 'Celebrate' },
  { id: 'think', emoji: '🤔', label: 'Thinking' },
] as const;

export type EmoteId = (typeof EMOTES)[number]['id'];

export const emojiFor = (id: string) => EMOTES.find((e) => e.id === id)?.emoji;
