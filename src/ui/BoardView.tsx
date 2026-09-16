import { useEffect, useRef } from 'react';
import { BoardScene } from '../three/boardScene';
import type { GameState } from '../engine/types';

interface Props {
  state: GameState;
  onPathComplete: () => void;
}

export function BoardView({ state, onPathComplete }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<BoardScene | null>(null);
  const animatingRef = useRef(false);
  const doneRef = useRef(onPathComplete);
  doneRef.current = onPathComplete;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const scene = new BoardScene(mount, state);
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.setHighlight([state.trophyTile, ...state.junctionOptions]);
    if (state.pendingPath.length && !animatingRef.current) {
      animatingRef.current = true;
      scene.animatePath(state.current, state.pendingPath, () => {
        animatingRef.current = false;
        doneRef.current();
      });
    } else if (!state.pendingPath.length && !animatingRef.current) {
      scene.syncState(state);
    }
  }, [state]);

  return <div className="board-canvas" ref={mountRef} />;
}
