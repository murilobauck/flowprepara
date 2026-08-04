import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { type Question } from './components/GamePlay/GamePlay';
import { supabase } from '@/lib/supabase';
import { Header, GrainOverlay } from '@/components';
import { GameGate } from './components/GameGate/GameGate';
import { GameHUD } from './components/GameHUD/GameHUD';
import { GamePlay } from './components/GamePlay/GamePlay';
import { GameEnd } from './components/GameEnd/GameEnd';
import styles from './Game.module.css';

type GameState = 'GATE_NAME' | 'PLAYING' | 'FEEDBACK' | 'END';

interface RankingEntry {
  player_name: string;
  score: number;
  created_at: string;
}

const TOTAL_TIME_MS = 10000;

export const Game = () => {
  const [gameState, setGameState] = useState<GameState>('GATE_NAME');
  
  const [leadId, setLeadId] = useState<string | null>(null);
  const [name, setName] = useState('');
  
  const [currentRunQuestions, setCurrentRunQuestions] = useState<Question[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const totalScoreRef = useRef(0);
  
  const [multiplier, setMultiplier] = useState(1.0);
  const multiplierRef = useRef(1.0);
  
  const [showOptions, setShowOptions] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME_MS);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [feedbackScore, setFeedbackScore] = useState<number | null>(null);
  
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);

  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const loadLeaderboard = async () => {
    try {
      const { data, error } = await supabase
        .from('leaderboard')
        .select('player_name, score, created_at')
        .order('score', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(10);

      if (error) throw error;
      if (data) setRanking(data as RankingEntry[]);
    } catch (err) {
      console.error('Erro ao carregar ranking:', err);
    }
  };

  const loadQuestions = async () => {
    try {
      const { data, error } = await supabase.from('questions').select('*');
      if (error) throw error;
      if (data) setAllQuestions(data as Question[]);
    } catch (err) {
      console.error('Erro ao carregar questões:', err);
    }
  };

  useEffect(() => {
    loadLeaderboard();
    loadQuestions();
  }, []);

  const handleValidLead = (id: string, playerName: string) => {
    setLeadId(id);
    setName(playerName);
  };

  const startGame = () => {
    if (allQuestions.length === 0) return;

    const answeredIdsStr = localStorage.getItem('flow_answered_questions');
    let answeredIds: number[] = answeredIdsStr ? JSON.parse(answeredIdsStr) : [];
    
    let available = allQuestions.filter(q => !answeredIds.includes(q.id));
    
    if (available.length < 10) {
      answeredIds = [];
      available = [...allQuestions];
    }
    
    const shuffled = [...available].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 10);
    
    const newAnsweredIds = [...answeredIds, ...selected.map(q => q.id)];
    localStorage.setItem('flow_answered_questions', JSON.stringify(newAnsweredIds));

    setCurrentRunQuestions(selected);
    
    setCurrentQIndex(0);
    setTotalScore(0);
    totalScoreRef.current = 0;
    setMultiplier(1.0);
    multiplierRef.current = 1.0;
    setGameState('PLAYING');
    
    setupQuestion(0);
  };

  const setupQuestion = (index: number) => {
    setSelectedOption(null);
    setFeedbackScore(null);
    setTimeLeft(TOTAL_TIME_MS);
    
    if (index === 0) {
      setShowOptions(false);
      setTimeout(() => {
        setShowOptions(true);
        startTimer();
      }, 3000); 
    } else {
      setShowOptions(true);
      startTimer();
    }
  };

  const startTimer = () => {
    startTimeRef.current = performance.now();
    
    const tick = () => {
      const now = performance.now();
      const elapsed = now - (startTimeRef.current || now);
      const remaining = Math.max(0, TOTAL_TIME_MS - elapsed);
      
      setTimeLeft(remaining);
      
      if (remaining > 0) {
        timerRef.current = requestAnimationFrame(tick);
      } else {
        handleTimeout();
      }
    };
    
    timerRef.current = requestAnimationFrame(tick);
  };

  const stopTimer = () => {
    if (timerRef.current) cancelAnimationFrame(timerRef.current);
  };

  const handleTimeout = () => {
    stopTimer();
    setMultiplier(1.0);
    multiplierRef.current = 1.0;
    setFeedbackScore(0);
    showFeedbackAndAdvance();
  };

  const handleOptionClick = (index: number) => {
    if (selectedOption !== null || gameState !== 'PLAYING') return; 
    
    stopTimer();
    setSelectedOption(index);
    
    const elapsed = TOTAL_TIME_MS - timeLeft;
    const isCorrect = index === currentRunQuestions[currentQIndex].correct_index;
    
    if (isCorrect) {
      const basePoints = Math.max(500, 1000 - (0.05 * elapsed));
      const earned = Math.round(basePoints * multiplierRef.current);
      
      const newScore = totalScoreRef.current + earned;
      setTotalScore(newScore);
      totalScoreRef.current = newScore;
      setFeedbackScore(earned);
      
      const newMult = Math.min(1.9, multiplierRef.current + 0.1);
      setMultiplier(newMult);
      multiplierRef.current = newMult;
    } else {
      setFeedbackScore(0);
      setMultiplier(1.0);
      multiplierRef.current = 1.0;
    }
    
    showFeedbackAndAdvance();
  };

  const showFeedbackAndAdvance = () => {
    setGameState('FEEDBACK');
    
    setTimeout(() => {
      const nextIndex = currentQIndex + 1;
      if (nextIndex < 10) {
        setCurrentQIndex(nextIndex);
        setGameState('PLAYING');
        setupQuestion(nextIndex);
      } else {
        finishGame();
      }
    }, 2000);
  };

  const finishGame = () => {
    setGameState('END');
    if (leadId) {
      savePlayerScore(leadId, totalScoreRef.current);
    }
  };

  const savePlayerScore = async (userLeadId: string, finalScore: number) => {
    try {
      const { error } = await supabase.rpc('save_score', {
        user_lead_id: userLeadId,
        score_to_save: finalScore
      });
      if (error) throw error;
      await loadLeaderboard();
    } catch (err) {
      console.error('Erro ao salvar pontuação:', err);
    }
  };

  return (
    <>
      <GrainOverlay />
      <Header />
      <div className={styles.ambientBg} />
      
      <div className={styles.container}>
        <AnimatePresence mode="wait">
          {gameState === 'GATE_NAME' && (
            <motion.div key="gate" className={styles.stateWrapper} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
              <GameGate 
                leadId={leadId}
                name={name}
                onValidLead={handleValidLead}
                onStartGame={startGame}
                onReset={() => { setLeadId(null); setName(''); }}
              />
            </motion.div>
          )}

          {(gameState === 'PLAYING' || gameState === 'FEEDBACK') && currentRunQuestions.length > 0 && (
            <motion.div key="play" className={styles.gameWrapper} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0, y: 50}}>
              <GameHUD 
                timeLeft={timeLeft}
                totalTime={TOTAL_TIME_MS}
                multiplier={multiplier}
                totalScore={totalScore}
                feedbackScore={feedbackScore}
              />
              <GamePlay 
                currentQ={currentRunQuestions[currentQIndex]}
                showOptions={showOptions}
                gameState={gameState}
                selectedOption={selectedOption}
                onOptionClick={handleOptionClick}
              />
            </motion.div>
          )}

          {gameState === 'END' && (
            <motion.div key="end" className={styles.stateWrapper} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
              <GameEnd 
                ranking={ranking}
                totalScore={totalScore}
                playerName={name}
                onPlayAgain={startGame}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};
