import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import ExecutiveDashboard from './pages/ExecutiveDashboard';
import UserManagement from './pages/UserManagement';
import UserAnalytics from './pages/UserAnalytics';
import InventoryGovernance from './pages/InventoryGovernance';
import ReconciliationOps from './pages/ReconciliationOps';
import ReportManagement from './pages/ReportManagement';
import AuditCompliance from './pages/AuditCompliance';
import AIOperations from './pages/AIOperations';
import APIMonitoring from './pages/APIMonitoring';
import DatabaseOps from './pages/DatabaseOps';
import SystemHealth from './pages/SystemHealth';
import SecurityOps from './pages/SecurityOps';
import BusinessIntelligence from './pages/BusinessIntelligence';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<ExecutiveDashboard />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="user-analytics" element={<UserAnalytics />} />
          <Route path="inventory" element={<InventoryGovernance />} />
          <Route path="reconciliations" element={<ReconciliationOps />} />
          <Route path="reports" element={<ReportManagement />} />
          <Route path="audit" element={<AuditCompliance />} />
          <Route path="ai-operations" element={<AIOperations />} />
          <Route path="api-monitoring" element={<APIMonitoring />} />
          <Route path="database" element={<DatabaseOps />} />
          <Route path="system-health" element={<SystemHealth />} />
          <Route path="security" element={<SecurityOps />} />
          <Route path="business-intelligence" element={<BusinessIntelligence />} />
          <Route path="settings" element={<div className="glass-card p-6"><h1 className="text-xl font-bold text-white mb-2">Settings</h1><p className="text-slate-400">Settings panel details. In production, Super Admin settings are managed via policy files.</p></div>} />
        </Route>
      </Routes>
    </Router>
  );
}
