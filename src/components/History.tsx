import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useAppStore } from '../store';
import { translations } from '../translations';
import { deleteRecording } from '../services/recordings';
import { Clock, Play, Search, Calendar, FileText, Trash2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface HistoryProps {
  onViewRecording: (id: number) => void;
}

export function History({ onViewRecording }: HistoryProps) {
  const { settings } = useAppStore();
  const t = translations[settings.language] || translations.ar;
  
  const recordings = useLiveQuery(() => db.recordings.orderBy('date').reverse().toArray());
  const [search, setSearch] = React.useState('');
  const [deleteId, setDeleteId] = React.useState<number | null>(null);

  const filtered = recordings?.filter(rec => 
    rec.title.toLowerCase().includes(search.toLowerCase()) ||
    rec.transcript?.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async () => {
    if (deleteId !== null) {
      await deleteRecording(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">{t.history}</h2>
          <p className="text-sm md:text-base text-muted-foreground mt-1">Manage and review your past recordings.</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search recordings..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:gap-4">
        {filtered?.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-12 text-center text-muted-foreground">
            {t.noRecordings}
          </div>
        ) : (
          filtered?.map((rec) => (
            <div
              key={rec.id}
              className="bg-card border border-border p-4 md:p-5 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col md:flex-row md:items-center justify-between gap-4"
              onClick={() => onViewRecording(rec.id!)}
            >
              <div className="flex items-center gap-3 md:gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-accent rounded-xl flex items-center justify-center text-accent-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
                  <Play className="w-5 h-5 md:w-6 md:h-6 fill-current" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-semibold text-base md:text-lg text-foreground group-hover:text-primary transition-colors truncate">{rec.title}</h4>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-[10px] md:text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 md:w-4 md:h-4" />
                      {new Date(rec.date).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 md:w-4 md:h-4" />
                      {Math.floor(rec.duration / 60)}m {rec.duration % 60}s
                    </span>
                    {rec.summary && (
                      <span className="flex items-center gap-1.5 text-green-600 font-medium">
                        <FileText className="w-3 h-3 md:w-4 md:h-4" />
                        Summary Ready
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteId(rec.id!);
                  }}
                  className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                  title={t.delete}
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <button className="px-3 md:px-4 py-1.5 md:py-2 bg-muted text-muted-foreground rounded-lg text-xs md:text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors">
                  View Details
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteId !== null && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card rounded-2xl w-full max-w-sm shadow-2xl p-6 border border-border"
            >
              <div className="flex items-center gap-3 text-destructive mb-4">
                <div className="p-2 bg-transparent border border-destructive/30 rounded-full text-destructive">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold">{t.delete}</h3>
              </div>
              <p className="text-muted-foreground mb-6">{t.confirmDelete}</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeleteId(null)}
                  className="flex-1 px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-border transition-colors font-medium"
                >
                  {t.cancel}
                </button>
                <button 
                  onClick={handleDelete}
                  className="flex-1 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:opacity-90 transition-colors font-medium"
                >
                  {t.delete}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
