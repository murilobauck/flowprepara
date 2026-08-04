import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import styles from './Leaderboard.module.css';

interface RankingEntry {
  player_name: string;
  score: number;
}

export const Leaderboard = () => {
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLeaderboard = async () => {
      try {
        const { data, error } = await supabase
          .from('leaderboard')
          .select('player_name, score')
          .order('score', { ascending: false })
          .order('created_at', { ascending: true })
          .limit(10);

        if (error) throw error;
        if (data) {
          setRanking(data as RankingEntry[]);
        }
      } catch (err) {
        console.error('Erro ao carregar ranking do Supabase:', err);
      } finally {
        setLoading(false);
      }
    };

    loadLeaderboard();
  }, []);

  return (
    <section className={styles.section}>
      <motion.div 
        className={styles.rankingContainer}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <h3 className={styles.rankingTitle}>🏆 Top 10 Global</h3>
        
        {loading ? (
          <div className={styles.loading}>Carregando placar...</div>
        ) : ranking.length > 0 ? (
          <ul className={styles.rankingList}>
            {ranking.map((r, i) => (
              <li key={`${r.player_name}-${i}`} className={styles.rankingItem}>
                <span className={styles.rankingRank}>#{i + 1}</span>
                <span className={styles.rankingName}>{r.player_name}</span>
                <span className={styles.rankingScore}>{r.score}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className={styles.emptyState}>
            Nenhum registro no placar ainda. Seja o primeiro a jogar!
          </div>
        )}
      </motion.div>
    </section>
  );
};
