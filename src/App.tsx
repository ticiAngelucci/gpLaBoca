import { useStore } from './store';
import { DriverSelect } from './ui/DriverSelect';
import { GameScreen } from './ui/GameScreen';
import { MainMenu } from './ui/MainMenu';

export default function App() {
  const screen = useStore((s) => s.screen);
  if (screen === 'menu') return <MainMenu />;
  if (screen === 'select') return <DriverSelect />;
  return <GameScreen />;
}
