import { useState } from 'react';
import { useNotesStore } from '../store/useNotesStore';
import styles from './NotesPanel.module.css';

const EMPTY_ARRAY: never[] = [];

interface Props {
  targetId: string;
  label?: string;
}

export default function NotesPanel({ targetId }: Props) {
  const notes = useNotesStore(s => s.notes[targetId] ?? EMPTY_ARRAY);
  const addNote = useNotesStore(s => s.addNote);
  const deleteNote = useNotesStore(s => s.deleteNote);
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const handleAdd = () => {
    if (!title.trim() && !content.trim()) return;
    addNote(targetId, {
      id: Date.now().toString(36),
      date,
      title: title.trim() || '无标题',
      content: content.trim(),
    });
    setTitle('');
    setContent('');
    setShowForm(false);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>投资笔记 ({notes.length})</span>
        <button className={styles.addBtn} onClick={() => setShowForm(!showForm)}>
          {showForm ? '取消' : '+ 添加'}
        </button>
      </div>

      {showForm && (
        <div className={styles.form}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={styles.field} />
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="标题" className={styles.field} />
          <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="笔记内容..." className={styles.textarea} rows={3} />
          <button onClick={handleAdd} className={styles.saveBtn}>保存笔记</button>
        </div>
      )}

      {notes.length > 0 && (
        <div className={styles.list}>
          {notes.map(n => (
            <div key={n.id} className={styles.note}>
              <div className={styles.noteHeader}>
                <span className={styles.noteDate}>{n.date}</span>
                <span className={styles.noteTitle}>{n.title}</span>
                <button className={styles.delBtn} onClick={() => deleteNote(targetId, n.id)}>✕</button>
              </div>
              {n.content && <div className={styles.noteContent}>{n.content}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
