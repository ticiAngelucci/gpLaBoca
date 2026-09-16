import { useStore } from './store';
import { DriverSelect } from './ui/DriverSelect';
import { MainMenu } from './ui/MainMenu';
import { RaceScreen } from './ui/RaceScreen';

export default function App() {
  const screen = useStore((s) => s.screen);
  if (screen === 'menu') return <MainMenu />;
  if (screen === 'select') return <DriverSelect />;
  return <RaceScreen />;
}
