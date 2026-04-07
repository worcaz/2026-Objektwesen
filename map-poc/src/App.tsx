import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import MapPage from './pages/MapPage';
import MapPageV2 from './pages/MapPageV2';
import ListPage from './pages/ListPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"    element={<HomePage />} />
        <Route path="/map"  element={<MapPage />} />
        <Route path="/mapv2" element={<MapPageV2 />} />
        <Route path="/list" element={<ListPage />} />
        <Route path="*"    element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
