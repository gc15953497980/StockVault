import { create } from 'zustand';
import type { Note } from '../types';
import { pushToGist } from '../utils/gistSync';

function autoSyncPush() {
  if (localStorage.getItem('stockvault_sync_auto') === '1') {
    pushToGist().catch(() => {});
  }
}

interface NotesStore {
  notes: Record<string, Note[]>; // keyed by stockId/fundId
  addNote: (targetId: string, note: Note) => void;
  deleteNote: (targetId: string, noteId: string) => void;
  setNotes: (notes: Record<string, Note[]>) => void;
}

const STORAGE_KEY = 'stockvault_notes';

function load(): Record<string, Note[]> {
  try {
    const d = localStorage.getItem(STORAGE_KEY);
    return d ? JSON.parse(d) : {};
  } catch { return {}; }
}

function save(notes: Record<string, Note[]>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(notes)); } catch { /* ignore */ }
  autoSyncPush();
}

export const useNotesStore = create<NotesStore>((set, get) => ({
  notes: load(),

  addNote: (targetId, note) => {
    const notes = { ...get().notes };
    if (!notes[targetId]) notes[targetId] = [];
    notes[targetId] = [...notes[targetId], note].sort((a, b) => b.date.localeCompare(a.date));
    save(notes);
    set({ notes });
  },

  deleteNote: (targetId, noteId) => {
    const notes = { ...get().notes };
    if (notes[targetId]) notes[targetId] = notes[targetId].filter(n => n.id !== noteId);
    save(notes);
    set({ notes });
  },

  setNotes: (notes) => {
    save(notes);
    set({ notes });
  },
}));
