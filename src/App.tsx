import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import History from "./pages/History";
import ParseResult from "./pages/ParseResult";
import AnalysisReport from "./pages/AnalysisReport";
import RealTimeResult from "./pages/RealTimeResult";
import { historyManager } from "./utils/historyManager";

export default function App() {
  const [historyCount, setHistoryCount] = useState(0);
  const [progress, setProgress] = useState(0);

  // 更新历史记录数量
  const updateHistoryCount = () => {
    const stats = historyManager.getStats();
    setHistoryCount(stats.total);
  };

  useEffect(() => {
    // 初始化历史记录数量
    updateHistoryCount();

    // 监听存储变化
    const handleStorageChange = () => {
      updateHistoryCount();
    };

    window.addEventListener('storage', handleStorageChange);
    
    // 自定义事件监听（用于同一页面内的更新）
    window.addEventListener('historyUpdated', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('historyUpdated', handleStorageChange);
    };
  }, []);

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Navbar progress={progress} historyCount={historyCount} />
        <Routes>
          <Route path="/" element={<Home onHistoryUpdate={updateHistoryCount} />} />
          <Route path="/history" element={<History onHistoryUpdate={updateHistoryCount} />} />
          <Route path="/parse-result" element={<ParseResult />} />
          <Route path="/results/:fileId" element={<ParseResult />} />
          <Route path="/analysis-report" element={<AnalysisReport />} />
          <Route path="/real-time-result" element={<RealTimeResult />} />
        </Routes>
      </div>
    </Router>
  );
}
